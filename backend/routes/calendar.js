/**
 * Calendar API Routes
 * Week 7: Google Calendar Integration
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const calendarService = require('../services/calendarService');

// Initialize calendar service
calendarService.initialize();

/**
 * GET /api/calendar/status
 * Check calendar integration status
 */
router.get('/status', (req, res) => {
  const isConfigured = calendarService.isConfigured();
  const hasTokens = !!req.session?.calendarTokens;

  res.json({
    configured: isConfigured,
    connected: hasTokens,
    message: isConfigured
      ? (hasTokens ? 'Connected to Google Calendar' : 'Not connected - authorization required')
      : 'Google Calendar not configured - add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'
  });
});

/**
 * GET /api/calendar/auth
 * Get OAuth authorization URL
 */
router.get('/auth', (req, res) => {
  try {
    if (!calendarService.isConfigured()) {
      return res.status(503).json({
        error: 'Calendar service not configured',
        setup: 'Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to .env'
      });
    }

    const state = req.query.returnUrl || '/calendar';
    const authUrl = calendarService.getAuthUrl(state);

    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/calendar/callback
 * OAuth callback handler
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const tokens = await calendarService.getTokensFromCode(code);

    // Store tokens in session (in production, store in database)
    if (!req.session) {
      req.session = {};
    }
    req.session.calendarTokens = tokens;

    // Also store in a cookie for stateless access
    res.cookie('calendar_tokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // Redirect to frontend
    const returnUrl = state || '/calendar';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}${returnUrl}?connected=true`);
  } catch (error) {
    console.error('Calendar OAuth error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/calendar?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * POST /api/calendar/disconnect
 * Disconnect calendar integration
 */
router.post('/disconnect', (req, res) => {
  if (req.session) {
    delete req.session.calendarTokens;
  }
  res.clearCookie('calendar_tokens');
  res.json({ success: true, message: 'Calendar disconnected' });
});

/**
 * Middleware to get tokens from session or cookie
 */
const getTokens = (req) => {
  if (req.session?.calendarTokens) {
    return req.session.calendarTokens;
  }
  if (req.cookies?.calendar_tokens) {
    try {
      return JSON.parse(req.cookies.calendar_tokens);
    } catch (e) {
      return null;
    }
  }
  // For testing, allow tokens in header
  if (req.headers['x-calendar-tokens']) {
    try {
      return JSON.parse(req.headers['x-calendar-tokens']);
    } catch (e) {
      return null;
    }
  }
  return null;
};

/**
 * Middleware to require calendar connection
 */
const requireCalendar = (req, res, next) => {
  const tokens = getTokens(req);
  if (!tokens) {
    return res.status(401).json({
      error: 'Calendar not connected',
      authUrl: calendarService.isConfigured() ? '/api/calendar/auth' : null
    });
  }
  req.calendarTokens = tokens;
  next();
};

/**
 * GET /api/calendar/calendars
 * List user's calendars
 */
router.get('/calendars', requireCalendar, async (req, res) => {
  try {
    const calendars = await calendarService.listCalendars(req.calendarTokens);
    res.json({
      calendars: calendars.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary || false,
        backgroundColor: cal.backgroundColor,
        accessRole: cal.accessRole
      }))
    });
  } catch (error) {
    console.error('Error listing calendars:', error);
    res.status(500).json({ error: 'Failed to list calendars', details: error.message });
  }
});

/**
 * GET /api/calendar/events
 * Get calendar events
 */
router.get('/events', requireCalendar, async (req, res) => {
  try {
    const { calendarId, days = 30 } = req.query;
    const { addDays } = require('date-fns');

    const events = await calendarService.getEvents(req.calendarTokens, {
      calendarId: calendarId || 'primary',
      timeMin: new Date().toISOString(),
      timeMax: addDays(new Date(), parseInt(days)).toISOString()
    });

    res.json({
      events: events.map(event => ({
        id: event.id,
        title: event.summary,
        description: event.description,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        allDay: !event.start?.dateTime,
        location: event.location,
        htmlLink: event.htmlLink,
        status: event.status,
        colorId: event.colorId
      }))
    });
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ error: 'Failed to get events', details: error.message });
  }
});

/**
 * POST /api/calendar/events
 * Create a calendar event
 */
router.post('/events', requireCalendar, async (req, res) => {
  try {
    const { calendarId = 'primary', ...eventData } = req.body;

    if (!eventData.title || !eventData.startDate) {
      return res.status(400).json({ error: 'title and startDate are required' });
    }

    const event = await calendarService.createEvent(req.calendarTokens, eventData, calendarId);

    res.status(201).json({
      success: true,
      event: {
        id: event.id,
        title: event.summary,
        htmlLink: event.htmlLink
      }
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event', details: error.message });
  }
});

/**
 * PATCH /api/calendar/events/:eventId
 * Update a calendar event
 */
router.patch('/events/:eventId', requireCalendar, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { calendarId = 'primary', ...eventData } = req.body;

    const event = await calendarService.updateEvent(req.calendarTokens, eventId, eventData, calendarId);

    res.json({
      success: true,
      event: {
        id: event.id,
        title: event.summary,
        htmlLink: event.htmlLink
      }
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event', details: error.message });
  }
});

/**
 * DELETE /api/calendar/events/:eventId
 * Delete a calendar event
 */
router.delete('/events/:eventId', requireCalendar, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { calendarId = 'primary' } = req.query;

    await calendarService.deleteEvent(req.calendarTokens, eventId, calendarId);

    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event', details: error.message });
  }
});

/**
 * POST /api/calendar/sync/action-item/:id
 * Sync a single action item to calendar
 */
router.post('/sync/action-item/:id', requireCalendar, async (req, res) => {
  try {
    const { id } = req.params;
    const { calendarId = 'primary' } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: actionItem, error } = await supabase
      .from('action_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !actionItem) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    if (!actionItem.due_date) {
      return res.status(400).json({ error: 'Action item has no due date' });
    }

    const event = await calendarService.createEventFromActionItem(req.calendarTokens, actionItem, calendarId);

    res.json({
      success: true,
      event: {
        id: event.id,
        title: event.summary,
        htmlLink: event.htmlLink
      }
    });
  } catch (error) {
    console.error('Error syncing action item:', error);
    res.status(500).json({ error: 'Failed to sync action item', details: error.message });
  }
});

/**
 * POST /api/calendar/sync/action-items
 * Sync all action items with due dates to calendar
 */
router.post('/sync/action-items', requireCalendar, async (req, res) => {
  try {
    const { calendarId = 'primary', meetingId } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    let query = supabase
      .from('action_items')
      .select('*')
      .not('due_date', 'is', null)
      .not('status', 'in', '("done","complete")');

    if (meetingId) {
      query = query.eq('meeting_id', meetingId);
    }

    const { data: actionItems, error } = await query;

    if (error) throw error;

    const results = await calendarService.syncActionItemsToCalendar(
      req.calendarTokens,
      actionItems || [],
      calendarId
    );

    res.json({
      success: true,
      synced: results.synced.length,
      errors: results.errors.length,
      details: results
    });
  } catch (error) {
    console.error('Error syncing action items:', error);
    res.status(500).json({ error: 'Failed to sync action items', details: error.message });
  }
});

/**
 * POST /api/calendar/sync/goal/:id
 * Sync a goal deadline to calendar
 */
router.post('/sync/goal/:id', requireCalendar, async (req, res) => {
  try {
    const { id } = req.params;
    const { calendarId = 'primary' } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: goal, error } = await supabase
      .from('goals')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (!goal.target_date) {
      return res.status(400).json({ error: 'Goal has no target date' });
    }

    const event = await calendarService.createEventFromGoal(req.calendarTokens, goal, calendarId);

    res.json({
      success: true,
      event: {
        id: event.id,
        title: event.summary,
        htmlLink: event.htmlLink
      }
    });
  } catch (error) {
    console.error('Error syncing goal:', error);
    res.status(500).json({ error: 'Failed to sync goal', details: error.message });
  }
});

/**
 * POST /api/calendar/sync/meeting/:id
 * Sync meeting to calendar
 */
router.post('/sync/meeting/:id', requireCalendar, async (req, res) => {
  try {
    const { id } = req.params;
    const { calendarId = 'primary' } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: meeting, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const event = await calendarService.createEventFromMeeting(req.calendarTokens, meeting, calendarId);

    res.json({
      success: true,
      event: {
        id: event.id,
        title: event.summary,
        htmlLink: event.htmlLink
      }
    });
  } catch (error) {
    console.error('Error syncing meeting:', error);
    res.status(500).json({ error: 'Failed to sync meeting', details: error.message });
  }
});

/**
 * GET /api/calendar/upcoming
 * Get upcoming deadlines and events combined view
 */
router.get('/upcoming', requireCalendar, async (req, res) => {
  try {
    const { days = 14 } = req.query;
    const { addDays, parseISO, isBefore } = require('date-fns');

    const now = new Date();
    const endDate = addDays(now, parseInt(days));

    // Get calendar events
    let calendarEvents = [];
    try {
      const events = await calendarService.getEvents(req.calendarTokens, {
        timeMin: now.toISOString(),
        timeMax: endDate.toISOString()
      });
      calendarEvents = events.map(e => ({
        type: 'calendar',
        id: e.id,
        title: e.summary,
        date: e.start?.dateTime || e.start?.date,
        allDay: !e.start?.dateTime,
        source: 'google_calendar'
      }));
    } catch (e) {
      console.log('Could not fetch calendar events:', e.message);
    }

    // Get action items with due dates
    let actionItems = [];
    if (supabase) {
      const { data } = await supabase
        .from('action_items')
        .select('id, task_description, due_date, priority, status')
        .not('due_date', 'is', null)
        .not('status', 'in', '("done","complete")')
        .gte('due_date', now.toISOString())
        .lte('due_date', endDate.toISOString())
        .order('due_date');

      actionItems = (data || []).map(item => ({
        type: 'action_item',
        id: item.id,
        title: item.task_description,
        date: item.due_date,
        priority: item.priority,
        status: item.status,
        source: 'entomate'
      }));
    }

    // Get goals with target dates
    let goals = [];
    if (supabase) {
      const { data } = await supabase
        .from('goals')
        .select('id, title, target_date, goal_type, status, progress')
        .not('target_date', 'is', null)
        .neq('status', 'completed')
        .neq('status', 'abandoned')
        .gte('target_date', now.toISOString())
        .lte('target_date', endDate.toISOString())
        .order('target_date');

      goals = (data || []).map(goal => ({
        type: 'goal',
        id: goal.id,
        title: goal.title,
        date: goal.target_date,
        goalType: goal.goal_type,
        progress: goal.progress,
        source: 'entomate'
      }));
    }

    // Combine and sort by date
    const allItems = [...calendarEvents, ...actionItems, ...goals]
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      upcoming: allItems,
      counts: {
        calendarEvents: calendarEvents.length,
        actionItems: actionItems.length,
        goals: goals.length,
        total: allItems.length
      }
    });
  } catch (error) {
    console.error('Error getting upcoming items:', error);
    res.status(500).json({ error: 'Failed to get upcoming items', details: error.message });
  }
});

module.exports = router;
