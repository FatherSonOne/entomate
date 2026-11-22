/**
 * Calendar auto-join (feature audit 2026-11-22, rec 1).
 *
 * A person who connected Google Calendar can switch auto-join on in
 * Settings › Bot auto-join. Every run (GitHub Actions every 15 minutes via
 * POST /api/internal/jobs/autojoin, plus an in-process timer while the
 * server is awake) looks at their next LOOKAHEAD_MS of events and schedules
 * a Recall bot, with join_at set to the start time, for each event that
 * qualifies:
 *
 *   - it has a Google Meet, Zoom or Teams link
 *   - it is not all-day, not cancelled, and they did not decline it
 *   - at least one other person is invited
 *   - scope 'organized' (default): they organise it; scope 'all': any event
 *
 * The bot is launched in their name, on the consent they gave when they
 * turned auto-join on, and the usual opt-out emails go to the invitees.
 * bot_sessions.calendar_event_key (event id + start time, unique per org
 * while live) stops a second run from scheduling it twice. A scheduled bot
 * whose event was moved, cancelled or no longer qualifies is withdrawn.
 *
 * Settings live at user_settings.calendar_json.auto_join:
 *   { enabled, scope, org_id, consent_at }
 */

'use strict';

const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');

const LOOKAHEAD_MS = 2 * 60 * 60 * 1000;
const GRACE_MS = 5 * 60 * 1000; // still join a meeting that started up to 5 min ago
const ADMIN_ROLES = ['owner', 'admin'];
const SCOPES = ['organized', 'all'];
const LIVE_STATUSES = ['pending', 'launching'];

const db = () => supabaseAdmin;

// ── Pure helpers ──

const LINK_PATTERNS = [
  { platform: 'meet', re: /https:\/\/meet\.google\.com\/[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}\b/i },
  { platform: 'zoom', re: /https:\/\/(?:[\w-]+\.)?zoom\.us\/(?:j|my|w)\/[\w.?=&%-]+/i },
  { platform: 'teams', re: /https:\/\/teams\.(?:microsoft|live)\.com\/(?:l\/meetup-join|meet)\/[^\s"'<>]+/i },
];

/** First video link in a string, with its platform. */
function findLink(text) {
  if (!text) return null;
  for (const { platform, re } of LINK_PATTERNS) {
    const m = String(text).match(re);
    if (m) return { platform, url: m[0].replace(/[).,;]+$/, '') };
  }
  return null;
}

/** The event's meeting link: conference data first, then location, then description. */
function meetingLink(event) {
  const entries = event?.conferenceData?.entryPoints || [];
  const video = entries.find((e) => e.entryPointType === 'video' && e.uri);
  return findLink(video?.uri) || findLink(event?.hangoutLink) || findLink(event?.location) || findLink(event?.description);
}

/** Invited people other than the user and rooms. */
function otherInvitees(event) {
  return (event?.attendees || []).filter((a) => !a.self && !a.resource && a.email);
}

function startOf(event) {
  return event?.start?.dateTime ? new Date(event.start.dateTime) : null;
}

/** Event id + start, so a moved event counts as a new one. */
function eventKey(event) {
  const start = startOf(event);
  return `${event.id}@${start ? start.toISOString() : 'none'}`;
}

/**
 * Decide whether auto-join should take this event.
 * @returns {{ join: boolean, reason?: string, link?: { platform: string, url: string } }}
 */
function qualifies(event, { scope = 'organized', now = new Date(), lookaheadMs = LOOKAHEAD_MS } = {}) {
  if (!event || event.status === 'cancelled') return { join: false, reason: 'cancelled' };
  const start = startOf(event);
  if (!start || Number.isNaN(start.getTime())) return { join: false, reason: 'all_day' };
  if (start.getTime() < now.getTime() - GRACE_MS) return { join: false, reason: 'started' };
  if (start.getTime() > now.getTime() + lookaheadMs) return { join: false, reason: 'later' };
  const me = (event.attendees || []).find((a) => a.self);
  if (me?.responseStatus === 'declined') return { join: false, reason: 'declined' };
  if (otherInvitees(event).length === 0) return { join: false, reason: 'no_invitees' };
  const organizer = Boolean(event.organizer?.self || (!event.organizer && event.creator?.self));
  if (scope !== 'all' && !organizer) return { join: false, reason: 'not_organizer' };
  const link = meetingLink(event);
  if (!link) return { join: false, reason: 'no_link' };
  return { join: true, link };
}

/** Settings with defaults; never trusts stored values blindly. */
function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: s.enabled === true && Boolean(s.consent_at) && typeof s.org_id === 'string',
    scope: SCOPES.includes(s.scope) ? s.scope : 'organized',
    org_id: typeof s.org_id === 'string' ? s.org_id : null,
    consent_at: typeof s.consent_at === 'string' ? s.consent_at : null,
  };
}

// ── Job ──

function calendar() {
  const service = require('./calendarService');
  service.initialize();
  return service;
}
function orchestrator() { return require('./botOrchestrator'); }

/** Keep refreshed Google tokens without dropping the auto-join settings. */
async function persistTokens(userId, tokens) {
  const { data } = await db().from('user_settings').select('calendar_json').eq('user_id', userId).maybeSingle();
  const next = { ...(data?.calendar_json || {}), tokens: stripCallbacks(tokens) };
  const { error } = await db().from('user_settings').update({ calendar_json: next }).eq('user_id', userId);
  if (error) log.warn('[AutoJoin] could not save refreshed tokens', { userId, error: error.message });
}

function stripCallbacks(tokens) {
  const { _onRefresh, ...rest } = tokens || {};
  return rest;
}

async function isOrgAdmin(userId, orgId) {
  const { data } = await db()
    .from('org_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();
  return ADMIN_ROLES.includes(data?.role);
}

async function userIdentity(userId) {
  try {
    const { data } = await db().auth.admin.getUserById(userId);
    const u = data?.user;
    const name = u?.user_metadata?.full_name || u?.user_metadata?.first_name || (u?.email ? u.email.split('@')[0] : null);
    return { email: u?.email || null, name };
  } catch {
    return { email: null, name: null };
  }
}

/**
 * Schedule bots for one user's upcoming events and withdraw stale ones.
 * @returns {Promise<{ scheduled: number, withdrawn: number, skipped: number, errors: number }>}
 */
async function runForUser(row, now = new Date()) {
  const userId = row.user_id;
  const settings = normalizeSettings(row.calendar_json?.auto_join);
  const out = { scheduled: 0, withdrawn: 0, skipped: 0, errors: 0 };
  const tokens = row.calendar_json?.tokens;
  if (!settings.enabled || !tokens) return out;
  if (!(await isOrgAdmin(userId, settings.org_id))) {
    log.warn('[AutoJoin] user is no longer an owner or admin of the org; skipping', { userId, orgId: settings.org_id });
    return out;
  }

  const live = { ...tokens, _onRefresh: (t) => persistTokens(userId, t) };
  const events = await calendar().getEvents(live, {
    timeMin: new Date(now.getTime() - GRACE_MS).toISOString(),
    timeMax: new Date(now.getTime() + LOOKAHEAD_MS).toISOString(),
    maxResults: 50,
  });

  const wanted = new Map();
  for (const event of events) {
    const q = qualifies(event, { scope: settings.scope, now });
    if (q.join) wanted.set(eventKey(event), { event, link: q.link });
    else out.skipped += 1;
  }

  const { data: existing, error } = await db()
    .from('bot_sessions')
    .select('id, calendar_event_key, status, join_at')
    .eq('org_id', settings.org_id)
    .eq('consent_acknowledged_by', userId)
    .not('calendar_event_key', 'is', null)
    .neq('status', 'stopped')
    .gte('join_at', new Date(now.getTime() - GRACE_MS).toISOString());
  if (error) throw error;
  const have = new Set((existing || []).map((s) => s.calendar_event_key));

  const me = await userIdentity(userId);
  for (const [key, { event, link }] of wanted) {
    if (have.has(key)) continue;
    const start = startOf(event);
    try {
      await orchestrator().launchBotSession({
        workspaceId: settings.org_id,
        meetingId: require('crypto').randomUUID(),
        meetingUrl: link.url,
        platform: link.platform,
        consentAcknowledgedBy: userId,
        consentAcknowledgedByName: me.name,
        consentAcknowledgedByEmail: me.email,
        participantEmails: otherInvitees(event).map((a) => a.email),
        joinAt: start.toISOString(),
        calendarEventKey: key,
        title: event.summary || null,
      });
      out.scheduled += 1;
    } catch (err) {
      // A duplicate key means another run got there first; anything else is logged.
      if (!/duplicate key|bot_sessions_org_calendar_event_key/i.test(err.message)) {
        out.errors += 1;
        log.warn('[AutoJoin] could not schedule bot', { userId, key, error: err.message });
      }
    }
  }

  // Withdraw bots that have not joined yet and whose event no longer qualifies.
  for (const s of existing || []) {
    if (wanted.has(s.calendar_event_key)) continue;
    if (!LIVE_STATUSES.includes(s.status)) continue;
    if (!s.join_at || new Date(s.join_at).getTime() <= now.getTime()) continue;
    try {
      await orchestrator().stopBotSession(s.id, 'calendar_changed');
      out.withdrawn += 1;
    } catch (err) {
      out.errors += 1;
      log.warn('[AutoJoin] could not withdraw bot', { sessionId: s.id, error: err.message });
    }
  }
  return out;
}

/**
 * Withdraw every bot auto-join scheduled for this user that has not joined
 * yet. Used when they switch auto-join off or disconnect the calendar.
 */
async function withdrawScheduled(userId, now = new Date()) {
  const { data, error } = await db()
    .from('bot_sessions')
    .select('id')
    .eq('consent_acknowledged_by', userId)
    .not('calendar_event_key', 'is', null)
    .in('status', LIVE_STATUSES)
    .gt('join_at', now.toISOString());
  if (error) throw error;
  let withdrawn = 0;
  for (const s of data || []) {
    try {
      await orchestrator().stopBotSession(s.id, 'auto_join_off');
      withdrawn += 1;
    } catch (err) {
      log.warn('[AutoJoin] could not withdraw bot', { sessionId: s.id, error: err.message });
    }
  }
  return withdrawn;
}

/**
 * What auto-join would do with the user's next day of events, for the
 * Settings screen. Read-only.
 */
async function preview(userId, tokens, settings, now = new Date()) {
  const s = normalizeSettings(settings);
  const events = await calendar().getEvents(tokens, {
    timeMin: new Date(now.getTime() - GRACE_MS).toISOString(),
    timeMax: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    maxResults: 25,
  });
  const { data: sessions } = await db()
    .from('bot_sessions')
    .select('calendar_event_key, status')
    .eq('consent_acknowledged_by', userId)
    .not('calendar_event_key', 'is', null)
    .neq('status', 'stopped')
    .gte('join_at', new Date(now.getTime() - GRACE_MS).toISOString());
  const byKey = new Map((sessions || []).map((x) => [x.calendar_event_key, x.status]));
  return events
    .filter((e) => startOf(e))
    .map((e) => {
      const q = qualifies(e, { scope: s.scope, now, lookaheadMs: 24 * 60 * 60 * 1000 });
      const key = eventKey(e);
      return {
        id: e.id,
        title: e.summary || 'Untitled event',
        start: startOf(e).toISOString(),
        platform: q.link?.platform || meetingLink(e)?.platform || null,
        join: q.join,
        reason: q.join ? null : q.reason,
        botStatus: byKey.get(key) || null,
      };
    });
}

/** One pass over everyone with auto-join on. Idempotent. */
async function runAutoJoin(now = new Date()) {
  if (!db()) return { users: 0, skipped: 'no_database' };
  if (!calendar().isConfigured() || !process.env.RECALL_API_KEY) {
    return { users: 0, skipped: 'not_configured' };
  }
  const { data: rows, error } = await db()
    .from('user_settings')
    .select('user_id, calendar_json')
    .eq('calendar_json->auto_join->>enabled', 'true');
  if (error) throw error;

  const totals = { users: 0, scheduled: 0, withdrawn: 0, skipped: 0, errors: 0 };
  for (const row of rows || []) {
    try {
      const r = await runForUser(row, now);
      totals.users += 1;
      totals.scheduled += r.scheduled;
      totals.withdrawn += r.withdrawn;
      totals.skipped += r.skipped;
      totals.errors += r.errors;
    } catch (err) {
      totals.errors += 1;
      log.warn('[AutoJoin] run failed for user', { userId: row.user_id, error: err.message });
    }
  }
  return totals;
}

// ── In-process timer (the GitHub Actions schedule covers a sleeping server) ──

let timer = null;
let running = false;

function initialize(intervalMs = 10 * 60 * 1000) {
  if (timer || process.env.NODE_ENV === 'test') return;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    runAutoJoin()
      .then((r) => { if (r.scheduled || r.withdrawn || r.errors) log.info('[AutoJoin] run', r); })
      .catch((err) => log.warn('[AutoJoin] run failed', { error: err.message }))
      .finally(() => { running = false; });
  }, intervalMs);
  if (timer.unref) timer.unref();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  LOOKAHEAD_MS,
  SCOPES,
  findLink,
  meetingLink,
  otherInvitees,
  eventKey,
  qualifies,
  normalizeSettings,
  runForUser,
  runAutoJoin,
  withdrawScheduled,
  preview,
  initialize,
  stop,
};
