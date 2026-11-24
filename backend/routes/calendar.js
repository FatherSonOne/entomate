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
const { attachOrgIds } = require('../utils/orgContext');
const autoJoin = require('../services/calendarAutoJoin');
const { readCalendarSettings, updateCalendarSettings } = require('../services/calendarSettings');
const { createState, verifyState } = require('../utils/oauthState');
router.use(attachOrgIds); // org-owned tables below are limited to req.orgIds (audit finding 3)

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
    // Shown so a redirect_uri_mismatch can be checked against Google Cloud.
    redirectUri: calendarService.redirectUri(),
    message: isConfigured
      ? (hasTokens ? 'Connected to Google Calendar' : 'Not connected - authorization required')
      : 'Google Calendar not configured - add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'
  });
});

/**
 * GET /api/calendar/auth
 * Get OAuth authorization URL
 */
router.get('/auth', authenticate, (req, res) => {
  try {
    if (!calendarService.isConfigured()) {
      return res.status(503).json({
        error: 'Calendar service not configured',
        setup: 'Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to .env'
      });
    }

    // Signed: the callback learns who is connecting from this, not a cookie.
    const state = createState({ userId: req.user.id, returnUrl: req.query.returnUrl });
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

    // Save for the user named in the signed state. Without a valid state the
    // tokens stay in the session only (old flow).
    const verified = verifyState(state);
    if (verified) {
      await saveTokensToDB(verified.userId, tokens);
    } else {
      log.warn('Calendar OAuth callback without a valid state; tokens not saved to the account');
    }

    // Redirect to frontend (the return path was checked when the state was made).
    const returnUrl = verified ? verified.returnUrl : '/calendar';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const separator = returnUrl.includes('?') ? '&' : '?';
    res.redirect(`${frontendUrl}${returnUrl}${separator}connected=true`);
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
  try {
    await updateCalendarSettings(req.user.id, () => ({}));
  } catch (error) {
    log.error('Failed to disconnect calendar', { error: error.message });
    return res.status(500).json({ error: 'Failed to disconnect Google Calendar' });
  }
  // Clear the connection first so the scheduler stops dispatching new bots.
  await autoJoin.withdrawScheduled(req.user.id).catch((err) =>
    log.warn('Auto-join withdraw on disconnect failed:', err.message));
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
  if (!supabase || !userId || !tokens) return Promise.resolve();
  const { _onRefresh, ...clean } = tokens;
  return updateCalendarSettings(userId, (prev) => ({
    ...prev,
    tokens: clean,
    connected_at: new Date().toISOString(),
  }), { create: true }).catch((err) => log.warn('Failed to save calendar tokens to DB:', err.message));
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
  const original = { ...tokens };
  tokens._onRefresh = (updatedTokens) => {
    // Save refreshed tokens to DB
    autoJoin.persistTokens(req.user.id, updatedTokens, original, supabase);
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
        meetingLink: autoJoin.meetingLink(event)?.url || null,
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
      .in('org_id', req.orgIds)
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
      .in('org_id', req.orgIds)
      .not('due_date', 'is', null)
      .not('status', 'in', '("done","complete","completed","cancelled")');

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
      .in('org_id', req.orgIds)
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
          source: 'google_calendar',
          // For carry-forward on Today: who is invited (not the room or yourself twice).
          attendees: (e.attendees || [])
            .filter(a => !a.resource)
            .map(a => ({ name: a.displayName || null, email: a.email || null }))
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
        .in('org_id', req.orgIds)
        .not('due_date', 'is', null)
        .not('status', 'in', '("done","complete","completed","cancelled")')
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


    // Combine and sort by date
    const allItems = [...calendarEvents, ...actionItems]
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      upcoming: allItems,
      counts: {
        calendarEvents: calendarEvents.length,
        actionItems: actionItems.length,
        total: allItems.length
      }
    });
  } catch (error) {
    log.error('Error getting upcoming items:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to get upcoming items', details: error.message });
  }
});

/**
 * GET /api/calendar/auto-join
 * The user's auto-join settings and what it will do with their next day.
 */
router.get('/auto-join', authenticate, async (req, res) => {
  try {
    const tokens = await getTokens(req);
    const { data } = await supabase
      .from('user_settings')
      .select('calendar_json')
      .eq('user_id', req.user.id)
      .maybeSingle();
    const settings = autoJoin.normalizeSettings(data?.calendar_json?.auto_join);
    let upcoming = [];
    let previewError = null;
    if (tokens && calendarService.isConfigured()) {
      try {
        upcoming = await autoJoin.preview(req.user.id, tokens, settings);
      } catch (err) {
        previewError = 'Could not read your calendar. Try connecting it again.';
        log.warn('Auto-join preview failed:', err.message);
      }
    }
    res.json({
      configured: calendarService.isConfigured(),
      botsConfigured: Boolean(process.env.RECALL_API_KEY),
      connected: Boolean(tokens),
      settings,
      upcoming,
      previewError,
      health: autoJoin.healthOf(data?.calendar_json)
    });
  } catch (error) {
    log.error('Error getting auto-join settings:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to load auto-join settings' });
  }
});

/** A sync from the app runs at most this often per person; the scheduled runs cover the rest. */
const SYNC_MIN_GAP_MS = 5 * 60 * 1000;

/**
 * GET /api/calendar/auto-join/health
 * When auto-join last checked this person's calendar, and meetings it missed.
 */
router.get('/auto-join/health', authenticate, async (req, res) => {
  try {
    const row = await readCalendarSettings(req.user.id);
    res.set('Cache-Control', 'no-store');
    res.json({ enabled: autoJoin.normalizeSettings(row?.calendar_json?.auto_join).enabled, ...autoJoin.healthOf(row?.calendar_json) });
  } catch (error) {
    log.error('Error reading auto-join health:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to read auto-join status' });
  }
});

/**
 * POST /api/calendar/auto-join/sync
 * Check this person's calendar now (the app calls it when opened), so a skipped
 * scheduled run cannot leave a meeting without its bot. At most every 5 minutes.
 */
router.post('/auto-join/sync', authenticate, async (req, res) => {
  try {
    const row = await readCalendarSettings(req.user.id);
    const health = autoJoin.healthOf(row?.calendar_json);
    const enabled = autoJoin.normalizeSettings(row?.calendar_json?.auto_join).enabled;
    const recent = health.lastRunAt && Date.now() - Date.parse(health.lastRunAt) < SYNC_MIN_GAP_MS;
    if (!enabled || recent || !calendarService.isConfigured() || !process.env.RECALL_API_KEY) {
      return res.json({ ran: false, enabled, ...health });
    }
    const result = await autoJoin.runForUser(row);
    const after = autoJoin.healthOf((await readCalendarSettings(req.user.id))?.calendar_json);
    res.json({ ran: true, enabled, scheduled: result.scheduled, ...after });
  } catch (error) {
    log.error('Error syncing auto-join:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to check your calendar' });
  }
});

/**
 * POST /api/calendar/auto-join/missed/dismiss  { key }
 * Hide a missed-meeting notice.
 */
router.post('/auto-join/missed/dismiss', authenticate, async (req, res) => {
  try {
    const key = typeof req.body?.key === 'string' ? req.body.key : '';
    await updateCalendarSettings(req.user.id, (json) => {
      const h = json.auto_join_health || {};
      const missed = (Array.isArray(h.missed) ? h.missed : [])
        .map((m) => (m.key === key ? { ...m, dismissedAt: new Date().toISOString() } : m));
      return { ...json, auto_join_health: { ...h, missed } };
    });
    res.json({ success: true });
  } catch (error) {
    log.error('Error dismissing missed auto-join:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to dismiss' });
  }
});

/**
 * PUT /api/calendar/auto-join
 * Switch auto-join on or off. Turning it on needs a connected calendar, an
 * org the user owns or administers, and their consent: they confirm that
 * the people they invite are told the meeting is recorded. Turning it off
 * withdraws bots that have not joined yet.
 */
router.put('/auto-join', authenticate, validate(schemas.autoJoin), async (req, res) => {
  try {
    const { enabled } = req.body;
    const settings = await autoJoin.configure(req.user.id, req.orgIds || [], req.body);

    let withdrawn = 0;
    if (!enabled) {
      // The setting is saved; a failed withdraw must not report it as failed.
      withdrawn = await autoJoin.withdrawScheduled(req.user.id, new Date(), { keepBookings: true }).catch((err) => {
        log.warn('Auto-join withdraw failed:', err.message);
        return 0;
      });
    }

    res.json({ settings, withdrawn });
  } catch (error) {
    if (error instanceof autoJoin.SettingsError) {
      return res.status(error.status).json({ error: error.code, message: error.message });
    }
    log.error('Error saving auto-join settings:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to save auto-join settings' });
  }
});

/**
 * GET /api/calendar/upcoming-meetings?days=60
 * Meetings › Upcoming: calendar events for the next days with what the bot
 * will do for each (join, reason, the person's own skip/join) and why.
 */
router.get('/upcoming-meetings', authenticate, async (req, res) => {
  try {
    const { data } = await supabase
      .from('user_settings')
      .select('calendar_json')
      .eq('user_id', req.user.id)
      .maybeSingle();
    const calendarJson = data?.calendar_json || {};
    const settings = autoJoin.normalizeSettings(calendarJson.auto_join);
    const tokens = calendarJson.tokens || null;
    const base = {
      configured: calendarService.isConfigured(),
      connected: Boolean(tokens),
      autoJoin: { enabled: settings.enabled, scope: settings.scope, leadMinutes: settings.lead_minutes },
      health: autoJoin.healthOf(calendarJson),
      events: [],
      error: null
    };
    if (!tokens || !base.configured) return res.json(base);
    try {
      base.events = await autoJoin.upcoming(req.user.id, tokens, settings, { days: req.query.days });
    } catch (err) {
      log.warn('Upcoming meetings failed:', err.message);
      base.error = 'Could not read your calendar. Try connecting it again.';
    }
    res.set('Cache-Control', 'no-store');
    res.json(base);
  } catch (error) {
    log.error('Error getting upcoming meetings:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to load upcoming meetings' });
  }
});

/**
 * PUT /api/calendar/auto-join/override  { eventKey, decision: 'skip'|'join'|null }
 * One meeting's bot choice. Takes effect on the next auto-join run; when
 * auto-join is on, this person's run happens now so a skip withdraws a
 * scheduled bot straight away.
 */
router.put('/auto-join/override', authenticate, validate(schemas.autoJoinOverride), async (req, res) => {
  try {
    const { eventKey, decision } = req.body;
    const nextJson = await updateCalendarSettings(req.user.id, (json) => {
      if (!json.tokens) return null;
      const overrides = { ...autoJoin.normalizeSettings(json.auto_join).overrides };
      if (decision) overrides[eventKey] = decision;
      else delete overrides[eventKey];
      return { ...json, auto_join: { ...json.auto_join, overrides: autoJoin.normalizeOverrides(overrides) } };
    });
    if (!nextJson) {
      return res.status(400).json({ error: 'calendar_not_connected', message: 'Connect Google Calendar first.' });
    }

    let run = null;
    if (autoJoin.normalizeSettings(nextJson.auto_join).enabled) {
      run = await autoJoin.runForUser({ user_id: req.user.id, calendar_json: nextJson }).catch((err) => {
        log.warn('Auto-join run after override failed:', err.message);
        return null;
      });
    }
    res.json({ eventKey, decision: decision || null, applied: Boolean(run) });
  } catch (error) {
    log.error('Error saving auto-join override:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to save that choice' });
  }
});

module.exports = router;
