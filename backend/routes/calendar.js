/**
 * Calendar API Routes
 * Week 7: Google Calendar Integration
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const calendarService = require('../services/calendarService');
const log = require('../utils/log');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/calendar');

// Initialize calendar service
calendarService.initialize();

/**
 * GET /api/calendar/status
 * Check calendar integration status
 */
router.get('/status', async (req, res) => {
  const isConfigured = calendarService.isConfigured();

  // Check for tokens in session first, then DB
  let hasTokens = !!req.session?.calendarTokens;
  if (!hasTokens && supabase) {
    // Try to resolve user from Authorization header (optional — non-blocking)
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id) {
          const { data } = await supabase
            .from('user_settings')
            .select('calendar_json')
            .eq('user_id', user.id)
            .single();
          hasTokens = !!data?.calendar_json?.tokens;
        }
      }
    } catch (e) {
      // Not critical — fall through to session check
    }
  }

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

    // Store tokens in session as immediate transport
    if (!req.session) {
      req.session = {};
    }
    req.session.calendarTokens = tokens;

    // Also persist to DB if we can identify the user (session or cookie may carry user ID)
    // The frontend will also trigger a save on the next authenticated request via requireCalendar
    if (req.session?.userId) {
      saveTokensToDB(req.session.userId, tokens);
    }

    // Redirect to frontend
    const returnUrl = state || '/calendar';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}${returnUrl}?connected=true`);
  } catch (error) {
    log.error('Calendar OAuth error:', { error: error.message || error });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/calendar?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * POST /api/calendar/disconnect
 * Disconnect calendar integration
 */
router.post('/disconnect', authenticate, async (req, res) => {
  // Clear DB tokens
  if (supabase && req.user?.id) {
    await supabase
      .from('user_settings')
      .update({ calendar_json: {} })
      .eq('user_id', req.user.id);
  }
  // Clear session/cookie fallbacks
  if (req.session) {
    delete req.session.calendarTokens;
  }
  res.clearCookie('calendar_tokens');
  res.json({ success: true, message: 'Calendar disconnected' });
});

/**
 * Get tokens — checks DB first, then session/cookie as fallback.
 * If tokens are found in session/cookie but not yet in DB, saves them (migration path).
 */
const getTokens = async (req) => {
  // 1. Check DB (preferred storage)
  if (supabase && req.user?.id) {
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('calendar_json')
        .eq('user_id', req.user.id)
        .single();

      if (data?.calendar_json?.tokens) {
        return data.calendar_json.tokens;
      }
    } catch (e) {
      // Table may not have the column yet — fall through
    }
  }

  // 2. Session fallback
  if (req.session?.calendarTokens) {
    const tokens = req.session.calendarTokens;
    // Migrate to DB if user is known
    saveTokensToDB(req.user?.id, tokens);
    return tokens;
  }

  // 3. Cookie fallback
  if (req.cookies?.calendar_tokens) {
    try {
      const tokens = JSON.parse(req.cookies.calendar_tokens);
      saveTokensToDB(req.user?.id, tokens);
      return tokens;
    } catch (e) {
      return null;
    }
  }

  return null;
};

/**
 * Persist calendar tokens to user_settings DB (non-blocking)
 */
const saveTokensToDB = (userId, tokens) => {
  if (!supabase || !userId || !tokens) return;
  const calendarJson = { tokens, connected_at: new Date().toISOString() };
  supabase
    .from('user_settings')
    .upsert({ user_id: userId, calendar_json: calendarJson }, { onConflict: 'user_id' })
    .then(({ error }) => {
      if (error) log.warn('Failed to save calendar tokens to DB:', error.message);
    });
};

/**
 * Middleware to require calendar connection
 */
const requireCalendar = async (req, res, next) => {
  const tokens = await getTokens(req);
  if (!tokens) {
    return res.status(401).json({
      error: 'Calendar not connected',
      authUrl: calendarService.isConfigured() ? '/api/calendar/auth' : null
    });
  }
  // Attach refresh callback so calendarService can persist updated tokens
  tokens._onRefresh = (updatedTokens) => {
    // Save refreshed tokens to DB
    saveTokensToDB(req.user?.id, updatedTokens);
    // Also update session for current request
    if (req.session) {
      req.session.calendarTokens = updatedTokens;
    }
  };

  req.calendarTokens = tokens;
  next();
};

/**
 * GET /api/calendar/calendars
 * List user's calendars
 */
router.get('/calendars', authenticate, requireCalendar, async (req, res) => {
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
    log.error('Error listing calendars:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to list calendars', details: error.message });
  }
});

/**
 * GET /api/calendar/events
 * Get calendar events
 */
router.get('/events', authenticate, requireCalendar, async (req, res) => {
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
    log.error('Error getting events:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to get events', details: error.message });
  }
});

/**
 * POST /api/calendar/events
 * Create a calendar event
 */
router.post('/events', authenticate, requireCalendar, validate(schemas.createEvent), async (req, res) => {
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
    log.error('Error creating event:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to create event', details: error.message });
  }
});

/**
 * PATCH /api/calendar/events/:eventId
 * Update a calendar event
 */
router.patch('/events/:eventId', authenticate, requireCalendar, validate(schemas.updateEvent), async (req, res) => {
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
    log.error('Error updating event:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to update event', details: error.message });
  }
});

/**
 * DELETE /api/calendar/events/:eventId
 * Delete a calendar event
 */
router.delete('/events/:eventId', authenticate, requireCalendar, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { calendarId = 'primary' } = req.query;

    await calendarService.deleteEvent(req.calendarTokens, eventId, calendarId);

    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    log.error('Error deleting event:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to delete event', details: error.message });
  }
});

/**
 * POST /api/calendar/sync/action-item/:id
 * Sync a single action item to calendar
 */
router.post('/sync/action-item/:id', authenticate, requireCalendar, validate(schemas.syncActionItem), async (req, res) => {
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
    log.error('Error syncing action item:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to sync action item', details: error.message });
  }
});

/**
 * POST /api/calendar/sync/action-items
 * Sync all action items with due dates to calendar
 */
router.post('/sync/action-items', authenticate, requireCalendar, validate(schemas.syncActionItems), async (req, res) => {
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
    log.error('Error syncing action items:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to sync action items', details: error.message });
  }
});

/**
 * POST /api/calendar/sync/goal/:id
 * Sync a goal deadline to calendar
 */
router.post('/sync/goal/:id', authenticate, requireCalendar, validate(schemas.syncGoal), async (req, res) => {
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
    log.error('Error syncing goal:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to sync goal', details: error.message });
  }
});

/**
 * POST /api/calendar/sync/meeting/:id
 * Sync meeting to calendar
 */
router.post('/sync/meeting/:id', authenticate, requireCalendar, validate(schemas.syncMeeting), async (req, res) => {
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
    log.error('Error syncing meeting:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to sync meeting', details: error.message });
  }
});

/**
 * GET /api/calendar/upcoming
 * Get upcoming deadlines and events combined view
 */
router.get('/upcoming', authenticate, async (req, res) => {
  try {
    const { days = 14 } = req.query;
    const { addDays } = require('date-fns');

    const now = new Date();
    const endDate = addDays(now, parseInt(days));

    // Get calendar events (only if Google Calendar is connected)
    let calendarEvents = [];
    const tokens = await getTokens(req);
    if (tokens && calendarService.isConfigured()) {
      try {
        const events = await calendarService.getEvents(tokens, {
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
        log.info('Could not fetch calendar events:', e.message);
      }
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
    log.error('Error getting upcoming items:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to get upcoming items', details: error.message });
  }
});

module.exports = router;
