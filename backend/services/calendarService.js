/**
 * Calendar Service
 * Week 7: Google Calendar Integration
 */

const { google } = require('googleapis');
const { addDays, addHours, format, parseISO, startOfDay, endOfDay } = require('date-fns');
const log = require('../utils/log');

class CalendarService {
  constructor() {
    this.oauth2Client = null;
    this.initialized = false;
  }

  /**
   * Initialize Google OAuth2 client
   */
  initialize() {
    if (this.initialized) return;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/callback';

    if (!clientId || !clientSecret) {
      log.info('Google Calendar not configured - missing credentials');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    this.initialized = true;
    log.info('Google Calendar service initialized');
  }

  /**
   * Check if service is configured
   */
  isConfigured() {
    return this.initialized && this.oauth2Client !== null;
  }

  /**
   * Generate OAuth URL for user authorization
   */
  getAuthUrl(state = '') {
    if (!this.isConfigured()) {
      throw new Error('Calendar service not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code) {
    if (!this.isConfigured()) {
      throw new Error('Calendar service not configured');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  /**
   * Create authenticated calendar instance
   */
  getCalendar(tokens) {
    if (!this.isConfigured()) {
      throw new Error('Calendar service not configured');
    }

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials(tokens);

    return google.calendar({ version: 'v3', auth });
  }

  /**
   * List user's calendars
   */
  async listCalendars(tokens) {
    const calendar = this.getCalendar(tokens);
    const response = await calendar.calendarList.list();
    return response.data.items || [];
  }

  /**
   * Get events from calendar
   */
  async getEvents(tokens, options = {}) {
    const calendar = this.getCalendar(tokens);

    const {
      calendarId = 'primary',
      timeMin = new Date().toISOString(),
      timeMax = addDays(new Date(), 30).toISOString(),
      maxResults = 100,
      singleEvents = true,
      orderBy = 'startTime'
    } = options;

    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents,
      orderBy
    });

    return response.data.items || [];
  }

  /**
   * Create a calendar event
   */
  async createEvent(tokens, eventData, calendarId = 'primary') {
    const calendar = this.getCalendar(tokens);

    const event = {
      summary: eventData.title,
      description: eventData.description || '',
      start: eventData.allDay
        ? { date: format(parseISO(eventData.startDate), 'yyyy-MM-dd') }
        : { dateTime: eventData.startDate, timeZone: eventData.timeZone || 'UTC' },
      end: eventData.allDay
        ? { date: format(parseISO(eventData.endDate || eventData.startDate), 'yyyy-MM-dd') }
        : { dateTime: eventData.endDate || addHours(parseISO(eventData.startDate), 1).toISOString(), timeZone: eventData.timeZone || 'UTC' },
      reminders: eventData.reminders || {
        useDefault: true
      }
    };

    // Add location if provided
    if (eventData.location) {
      event.location = eventData.location;
    }

    // Add attendees if provided
    if (eventData.attendees && eventData.attendees.length > 0) {
      event.attendees = eventData.attendees.map(email => ({ email }));
    }

    // Add color if provided
    if (eventData.colorId) {
      event.colorId = eventData.colorId;
    }

    const response = await calendar.events.insert({
      calendarId,
      resource: event,
      sendUpdates: eventData.sendNotifications ? 'all' : 'none'
    });

    return response.data;
  }

  /**
   * Update a calendar event
   */
  async updateEvent(tokens, eventId, eventData, calendarId = 'primary') {
    const calendar = this.getCalendar(tokens);

    const event = {};

    if (eventData.title) event.summary = eventData.title;
    if (eventData.description !== undefined) event.description = eventData.description;
    if (eventData.location !== undefined) event.location = eventData.location;

    if (eventData.startDate) {
      event.start = eventData.allDay
        ? { date: format(parseISO(eventData.startDate), 'yyyy-MM-dd') }
        : { dateTime: eventData.startDate, timeZone: eventData.timeZone || 'UTC' };
    }

    if (eventData.endDate) {
      event.end = eventData.allDay
        ? { date: format(parseISO(eventData.endDate), 'yyyy-MM-dd') }
        : { dateTime: eventData.endDate, timeZone: eventData.timeZone || 'UTC' };
    }

    const response = await calendar.events.patch({
      calendarId,
      eventId,
      resource: event
    });

    return response.data;
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(tokens, eventId, calendarId = 'primary') {
    const calendar = this.getCalendar(tokens);

    await calendar.events.delete({
      calendarId,
      eventId
    });

    return { success: true };
  }

  /**
   * Create event from action item
   */
  async createEventFromActionItem(tokens, actionItem, calendarId = 'primary') {
    if (!actionItem.due_date) {
      throw new Error('Action item has no due date');
    }

    const dueDate = parseISO(actionItem.due_date);

    const eventData = {
      title: `[Task] ${actionItem.task_description}`,
      description: this.buildActionItemDescription(actionItem),
      startDate: startOfDay(dueDate).toISOString(),
      endDate: endOfDay(dueDate).toISOString(),
      allDay: true,
      colorId: this.getPriorityColor(actionItem.priority),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 * 24 }, // 1 day before
          { method: 'popup', minutes: 60 * 2 }   // 2 hours before
        ]
      }
    };

    return this.createEvent(tokens, eventData, calendarId);
  }

  /**
   * Create event from meeting
   */
  async createEventFromMeeting(tokens, meeting, calendarId = 'primary') {
    const eventData = {
      title: meeting.title || 'Meeting Recap Available',
      description: this.buildMeetingDescription(meeting),
      startDate: meeting.scheduled_at || meeting.created_at,
      allDay: !meeting.scheduled_at,
      colorId: '9' // Blue
    };

    if (meeting.duration_seconds) {
      const startDate = parseISO(eventData.startDate);
      eventData.endDate = addHours(startDate, meeting.duration_seconds / 3600).toISOString();
      eventData.allDay = false;
    }

    return this.createEvent(tokens, eventData, calendarId);
  }

  /**
   * Create event from goal deadline
   */
  async createEventFromGoal(tokens, goal, calendarId = 'primary') {
    if (!goal.target_date) {
      throw new Error('Goal has no target date');
    }

    const targetDate = parseISO(goal.target_date);

    const eventData = {
      title: `[Goal Due] ${goal.title}`,
      description: this.buildGoalDescription(goal),
      startDate: startOfDay(targetDate).toISOString(),
      endDate: endOfDay(targetDate).toISOString(),
      allDay: true,
      colorId: this.getGoalTypeColor(goal.goal_type),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 * 24 * 7 }, // 1 week before
          { method: 'popup', minutes: 60 * 24 }      // 1 day before
        ]
      }
    };

    return this.createEvent(tokens, eventData, calendarId);
  }

  /**
   * Build description for action item event
   */
  buildActionItemDescription(item) {
    let desc = '';
    if (item.task_description) desc += `Task: ${item.task_description}\n\n`;
    if (item.priority) desc += `Priority: ${item.priority.toUpperCase()}\n`;
    if (item.assigned_to_name) desc += `Assigned to: ${item.assigned_to_name}\n`;
    if (item.status) desc += `Status: ${item.status}\n`;
    desc += '\n---\nManaged by Entomate';
    return desc;
  }

  /**
   * Build description for meeting event
   */
  buildMeetingDescription(meeting) {
    let desc = '';
    if (meeting.summary) desc += `Summary:\n${meeting.summary}\n\n`;
    if (meeting.key_points && meeting.key_points.length > 0) {
      desc += 'Key Points:\n';
      meeting.key_points.forEach(p => desc += `• ${p}\n`);
      desc += '\n';
    }
    if (meeting.decisions && meeting.decisions.length > 0) {
      desc += 'Decisions:\n';
      meeting.decisions.forEach(d => desc += `• ${d}\n`);
    }
    desc += '\n---\nManaged by Entomate';
    return desc;
  }

  /**
   * Build description for goal event
   */
  buildGoalDescription(goal) {
    let desc = `Goal: ${goal.title}\n`;
    if (goal.description) desc += `\n${goal.description}\n`;
    desc += `\nType: ${goal.goal_type}`;
    desc += `\nProgress: ${goal.progress || 0}%`;
    desc += `\nStatus: ${goal.status}`;
    if (goal.key_results && goal.key_results.length > 0) {
      desc += '\n\nKey Results:';
      goal.key_results.forEach(kr => {
        desc += `\n• ${kr.title}: ${kr.current}/${kr.target} ${kr.unit || ''}`;
      });
    }
    desc += '\n\n---\nManaged by Entomate';
    return desc;
  }

  /**
   * Get Google Calendar color ID based on priority
   */
  getPriorityColor(priority) {
    const colors = {
      high: '11',    // Red
      medium: '5',   // Yellow
      low: '10'      // Green
    };
    return colors[priority] || '9'; // Default blue
  }

  /**
   * Get Google Calendar color ID based on goal type
   */
  getGoalTypeColor(goalType) {
    const colors = {
      company: '3',     // Purple
      team: '1',        // Blue
      individual: '10'  // Green
    };
    return colors[goalType] || '9';
  }

  /**
   * Sync all action items with due dates to calendar
   */
  async syncActionItemsToCalendar(tokens, actionItems, calendarId = 'primary') {
    const results = {
      synced: [],
      errors: []
    };

    for (const item of actionItems) {
      if (!item.due_date || item.status === 'done' || item.status === 'complete') {
        continue;
      }

      try {
        const event = await this.createEventFromActionItem(tokens, item, calendarId);
        results.synced.push({
          actionItemId: item.id,
          eventId: event.id,
          title: item.task_description
        });
      } catch (error) {
        results.errors.push({
          actionItemId: item.id,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new CalendarService();
