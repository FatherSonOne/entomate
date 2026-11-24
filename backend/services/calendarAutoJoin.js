/**
 * Calendar auto-join (feature audit 2026-11-22, rec 1).
 *
 * A person who connected Google Calendar can switch auto-join on in
 * Settings › Bot auto-join. Every run (GitHub Actions every 15 minutes via
 * POST /api/internal/jobs/autojoin, plus an in-process timer while the
 * server is awake) looks at their next LOOKAHEAD_MS of events and schedules
 * a Recall bot, with join_at set from the configured lead time, for each event that
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
 *   { enabled, scope, org_id, consent_at, lead_minutes, overrides }
 *
 * overrides: { [eventKey]: 'skip' | 'join' }, set per meeting from
 * Meetings › Upcoming. 'skip' keeps the bot out of a meeting auto-join would
 * take; 'join' sends it to one it would pass over because someone else
 * organizes it or nobody else is invited. 'join' never adds a missing link.
 */

'use strict';

const { isDeepStrictEqual } = require('node:util');
const { supabaseAdmin } = require('../config/supabase');
const { readCalendarSettings, updateCalendarSettings } = require('./calendarSettings');
const log = require('../utils/log');

// Twelve hours ahead: Recall holds a scheduled bot and joins at join_at on its own, so
// one run any time in the half-day before a meeting is enough. GitHub's schedule and a
// sleeping server both skip runs; a short lookahead turned each skip into a missed meeting.
const LOOKAHEAD_MS = 12 * 60 * 60 * 1000;
const GRACE_MS = 5 * 60 * 1000; // still join a meeting that started up to 5 min ago
// Google Meet caps the waiting room at 10 minutes. Leave time for a late host.
const MAX_LEAD_MINUTES = 5;
// Recall treats bots with 10 minutes or less of notice as ad hoc.
const RECALL_SCHEDULE_NOTICE_MS = 10 * 60 * 1000;
const ADMIN_ROLES = ['owner', 'admin'];
const SCOPES = ['organized', 'all'];
const LIVE_STATUSES = ['pending', 'launching'];
/** A qualifying event that started this long ago without a bot is reported as missed. */
const MISSED_WINDOW_MS = 60 * 60 * 1000;
/** Allow a bot this long after the start to get in before calling it missed. */
const MISSED_AFTER_MS = 3 * 60 * 1000;
const FAILED_STATUSES = ['failed', 'timeout'];
const MAX_MISSED = 10;

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
    const m = String(text).replace(/&amp;/gi, '&').match(re);
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

function targetArrival(event, settings) {
  return new Date(startOf(event).getTime() - settings.lead_minutes * 60_000);
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

function validLeadMinutes(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_LEAD_MINUTES;
}

/** Settings with defaults; never trusts stored values blindly. */
function normalizeSettings(raw, now = new Date()) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: s.enabled === true && typeof s.consent_at === 'string' && Boolean(s.consent_at) && typeof s.org_id === 'string',
    scope: SCOPES.includes(s.scope) ? s.scope : 'organized',
    lead_minutes: validLeadMinutes(s.lead_minutes) ? s.lead_minutes : 0,
    org_id: typeof s.org_id === 'string' ? s.org_id : null,
    consent_at: typeof s.consent_at === 'string' ? s.consent_at : null,
    overrides: normalizeOverrides(s.overrides, now),
  };
}

const OVERRIDES = ['skip', 'join'];
const MAX_OVERRIDES = 300;
/** Reasons a person may overrule with 'join'. */
const JOINABLE = ['not_organizer', 'no_invitees'];

/** Valid entries only; drops meetings that started more than a day ago. */
function normalizeOverrides(raw, now = new Date()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  const out = {};
  for (const [key, v] of Object.entries(raw)) {
    if (!OVERRIDES.includes(v) || typeof key !== 'string' || key.length > 300) continue;
    const at = Date.parse(key.slice(key.lastIndexOf('@') + 1));
    if (Number.isFinite(at) && at < cutoff) continue;
    out[key] = v;
    if (Object.keys(out).length >= MAX_OVERRIDES) break;
  }
  return out;
}

/**
 * qualifies() plus the person's per-meeting choice.
 * @returns {{ join: boolean, reason?: string, link?: object, override: 'skip'|'join'|null, canJoin: boolean }}
 */
function decide(event, { scope = 'organized', now = new Date(), lookaheadMs = LOOKAHEAD_MS, overrides = {} } = {}) {
  const q = qualifies(event, { scope, now, lookaheadMs });
  const override = overrides[eventKey(event)] || null;
  if (q.join) {
    if (override === 'skip') return { join: false, reason: 'skipped', link: q.link, override, canJoin: true };
    return { ...q, override: null, canJoin: true };
  }
  const link = meetingLink(event);
  const canJoin = JOINABLE.includes(q.reason) && Boolean(link);
  if (override === 'join' && canJoin) return { join: true, link, override, canJoin };
  return { ...q, override: null, canJoin };
}

// ── Job ──

function calendar() {
  const service = require('./calendarService');
  service.initialize();
  return service;
}
function orchestrator() { return require('./botOrchestrator'); }

// A refresh should never reconnect a disconnected calendar or replace a new connection.
async function persistTokens(userId, tokens, original, client = db()) {
  const { _onRefresh, ...clean } = tokens;
  try {
    await updateCalendarSettings(userId, (json) => {
      const current = json.tokens;
      const same = original.refresh_token
        ? current?.refresh_token === original.refresh_token
        : current?.access_token === original.access_token;
      return same ? { ...json, tokens: clean } : null;
    }, { client });
  } catch (error) {
    log.warn('[AutoJoin] could not save refreshed tokens', { userId, error: error.message });
  }
}

class SettingsError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function orgRole(userId, orgId) {
  const { data, error } = await db().from('org_members')
    .select('role').eq('user_id', userId).eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  return data?.role;
}

async function nextSettings(userId, orgIds, json, { enabled, scope, orgId, leadMinutes, consentAcknowledged }) {
  const prev = normalizeSettings(json.auto_join);
  const next = { ...prev, enabled, scope: scope ?? prev.scope, lead_minutes: leadMinutes ?? prev.lead_minutes };
  if (!enabled) return next;
  if (!json.tokens) throw new SettingsError(400, 'calendar_not_connected', 'Connect Google Calendar in Settings first.');
  const target = orgId || prev.org_id || orgIds[0];
  if (!target || !orgIds.includes(target)) {
    throw new SettingsError(403, 'org_not_allowed', 'Pick a workspace you belong to.');
  }
  if (!ADMIN_ROLES.includes(await orgRole(userId, target))) {
    throw new SettingsError(403, 'admin_required', 'Only workspace owners and admins can send the bot.');
  }
  if (consentAcknowledged !== true && !prev.consent_at) {
    throw new SettingsError(400, 'consent_required', 'Confirm that your invitees are told the meeting is recorded.');
  }
  return { ...next, org_id: target, consent_at: prev.consent_at || new Date().toISOString() };
}

async function configure(userId, orgIds, changes, client = db()) {
  const json = await updateCalendarSettings(userId, async (current) => ({
    ...current,
    auto_join: await nextSettings(userId, orgIds, current, changes),
  }), { client });
  const settings = normalizeSettings(json?.auto_join);
  if (settings.enabled && process.env.RECALL_API_KEY && calendar().isConfigured()) {
    runForUser({ user_id: userId, calendar_json: json }).catch((err) =>
      log.warn('[AutoJoin] run after settings change failed', { userId, error: err.message }));
  }
  return settings;
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
  const settings = normalizeSettings(row.calendar_json?.auto_join, now);
  const out = { scheduled: 0, withdrawn: 0, skipped: 0, errors: 0 };
  const tokens = row.calendar_json?.tokens;
  if (!settings.enabled || !tokens) return out;
  if (!ADMIN_ROLES.includes(await orgRole(userId, settings.org_id))) {
    log.warn('[AutoJoin] user is no longer an owner or admin of the org; skipping', { userId, orgId: settings.org_id });
    return out;
  }

  const stillCurrent = async () => {
    const current = (await readCalendarSettings(userId, db()))?.calendar_json;
    return Boolean(current?.tokens && current.connected_at === row.calendar_json.connected_at &&
      isDeepStrictEqual(normalizeSettings(current.auto_join, now), settings));
  };
  const live = { ...tokens, _onRefresh: (t) => persistTokens(userId, t, tokens) };
  const events = await calendar().getEvents(live, {
    timeMin: new Date(now.getTime() - MISSED_WINDOW_MS).toISOString(),
    timeMax: new Date(now.getTime() + LOOKAHEAD_MS).toISOString(),
    maxResults: 250,
    allPages: true,
  });

  const wanted = new Map();
  for (const event of events) {
    const q = decide(event, { scope: settings.scope, now, overrides: settings.overrides });
    if (q.join) {
      const joinAt = targetArrival(event, settings);
      wanted.set(eventKey(event), { event, link: q.link, joinAt });
    } else {
      out.skipped += 1;
    }
  }

  const { data: existing, error } = await db()
    .from('bot_sessions')
    .select('id, calendar_event_key, status, join_at, recall_bot_id')
    .eq('org_id', settings.org_id)
    .eq('consent_acknowledged_by', userId)
    .not('calendar_event_key', 'is', null)
    .neq('status', 'stopped')
    .gte('join_at', new Date(now.getTime() - MISSED_WINDOW_MS - MAX_LEAD_MINUTES * 60 * 1000).toISOString());
  if (error) throw error;
  if (!(await stillCurrent())) return out;
  const have = new Set((existing || []).map((s) => s.calendar_event_key));

  // Keep an imminent bot at its booked time. Recall may already be dispatching it.
  const canSchedule = (at) => at.getTime() > now.getTime() + RECALL_SCHEDULE_NOTICE_MS;
  for (const s of existing || []) {
    if (!LIVE_STATUSES.includes(s.status) || !s.join_at) continue;
    const oldTime = new Date(s.join_at);
    if (oldTime <= now) continue;
    const planned = wanted.get(s.calendar_event_key);
    if (planned && (planned.joinAt.getTime() === oldTime.getTime() ||
      !canSchedule(oldTime) || !canSchedule(planned.joinAt))) continue;
    try {
      if (!(await stillCurrent())) return out;
      if (planned) {
        await orchestrator().rescheduleBotSession(s, planned.joinAt.toISOString());
      } else {
        await orchestrator().stopBotSession(s.id, 'calendar_changed');
        out.withdrawn += 1;
      }
    } catch (err) {
      out.errors += 1;
      log.warn('[AutoJoin] could not update scheduled bot', { sessionId: s.id, error: err.message });
    }
  }

  const me = await userIdentity(userId);
  for (const [key, { event, link, joinAt }] of wanted) {
    if (have.has(key)) continue;
    // With an early-join rule, an ad hoc bot must not arrive before the selected time.
    if (settings.lead_minutes && joinAt > now && !canSchedule(joinAt)) continue;
    try {
      if (!(await stillCurrent())) return out;
      const bot = await orchestrator().launchBotSession({
        workspaceId: settings.org_id,
        meetingId: require('crypto').randomUUID(),
        meetingUrl: link.url,
        platform: link.platform,
        consentAcknowledgedBy: userId,
        consentAcknowledgedByName: me.name,
        consentAcknowledgedByEmail: me.email,
        participantEmails: otherInvitees(event).map((a) => a.email),
        joinAt: joinAt.toISOString(),
        calendarEventKey: key,
        title: event.summary || null,
      });
      if (!(await stillCurrent())) {
        await orchestrator().stopBotSession(bot.sessionId, 'calendar_settings_changed');
        out.withdrawn += 1;
        return out;
      }
      out.scheduled += 1;
    } catch (err) {
      // A duplicate key means another run got there first; anything else is logged.
      if (!/duplicate key|bot_sessions_org_calendar_event_key/i.test(err.message)) {
        out.errors += 1;
        log.warn('[AutoJoin] could not schedule bot', { userId, key, error: err.message });
      }
    }
  }

  await recordHealth(userId, missedEvents(events, existing || [], settings.scope, now, settings.overrides), now, me)
    .catch((err) => log.warn('[AutoJoin] could not save the run', { userId, error: err.message }));
  return out;
}

/**
 * Qualifying events that started 3 to 60 minutes ago with no bot, or whose bot failed.
 * Pure: `sessions` are this user's auto-join bot_sessions rows.
 */
function missedEvents(events, sessions, scope, now = new Date(), overrides = {}) {
  const byKey = new Map(sessions.map((s) => [s.calendar_event_key, s]));
  const out = [];
  for (const event of events || []) {
    const start = startOf(event);
    if (!start) continue;
    const ago = now.getTime() - start.getTime();
    if (ago < MISSED_AFTER_MS || ago > MISSED_WINDOW_MS) continue;
    // Would auto-join have taken it, judged at its own start time?
    if (!decide(event, { scope, now: start, overrides }).join) continue;
    const key = eventKey(event);
    const session = byKey.get(key);
    if (session && !FAILED_STATUSES.includes(session.status)) continue;
    out.push({ key, title: event.summary || 'Untitled event', start: start.toISOString(), reason: session ? 'failed' : 'no_bot', sessionId: session?.id || null });
  }
  return out;
}

/**
 * Save when auto-join last checked this person's calendar, and any missed meetings
 * (calendar_json.auto_join_health), so the app can show both. A newly missed meeting
 * is also emailed once: the person is probably in that call, not looking at Entomate.
 */
async function recordHealth(userId, missed, now, me) {
  let fresh = [];
  const saved = await updateCalendarSettings(userId, (json) => {
    if (!json.tokens) return null;
    const prev = json.auto_join_health || {};
    const known = new Map((Array.isArray(prev.missed) ? prev.missed : []).map((m) => [m.key, m]));
    fresh = missed.filter((m) => !known.has(m.key));
    for (const m of fresh) known.set(m.key, { ...m, notedAt: now.toISOString() });
    const keep = [...known.values()]
      .filter((m) => now.getTime() - Date.parse(m.start) < 24 * 60 * 60 * 1000)
      .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
      .slice(0, MAX_MISSED);
    return { ...json, auto_join_health: { ...prev, lastRunAt: now.toISOString(), missed: keep } };
  }, { client: db() });
  if (!saved) return null;
  if (fresh.length && me?.email) {
    for (const m of fresh) {
      await notifyMissed(me.email, m).catch((err) => log.warn('[AutoJoin] missed-bot email failed', { userId, error: err.message }));
    }
  }
  return saved.auto_join_health;
}

async function notifyMissed(to, m) {
  const email = require('./emailService');
  const base = (process.env.FRONTEND_URL || 'https://entomate.app').replace(/\/$/, '');
  const when = new Date(m.start).toUTCString().replace(/:00 GMT$/, ' UTC');
  const why = m.reason === 'failed' ? 'The bot was sent but could not get in.' : 'No bot was sent.';
  const subject = `Your bot did not join "${m.title}"`;
  const text = `${why} "${m.title}" started ${when} and Entomate is not recording it.\n\nSend the bot now from ${base}/bot, or record it in the browser from ${base}/meetings.`;
  const html = `<p>${escapeHtml(why)} <strong>${escapeHtml(m.title)}</strong> started ${escapeHtml(when)} and Entomate is not recording it.</p>`
    + `<p><a href="${base}/bot">Send the bot now</a> or <a href="${base}/meetings">record it in the browser</a>.</p>`;
  return email.sendEmail({ to, subject, html, text });
}

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Auto-join's health for the app: last check and missed meetings not yet dismissed. */
function healthOf(calendarJson) {
  const h = calendarJson?.auto_join_health || {};
  return {
    lastRunAt: typeof h.lastRunAt === 'string' ? h.lastRunAt : null,
    missed: (Array.isArray(h.missed) ? h.missed : []).filter((m) => !m.dismissedAt),
  };
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
  const s = normalizeSettings(settings, now);
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
    .gte('join_at', new Date(now.getTime() - GRACE_MS - MAX_LEAD_MINUTES * 60 * 1000).toISOString());
  const byKey = new Map((sessions || []).map((x) => [x.calendar_event_key, x.status]));
  return events
    .filter((e) => startOf(e))
    .map((e) => {
      const q = decide(e, { scope: s.scope, now, lookaheadMs: 24 * 60 * 60 * 1000, overrides: s.overrides });
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

const UPCOMING_MAX_DAYS = 90;

/** All-day events have a date, not a time. */
function dayOf(event) {
  if (event?.start?.dateTime) return new Date(event.start.dateTime);
  if (event?.start?.date) return new Date(`${event.start.date}T00:00:00`);
  return null;
}

/**
 * Meetings › Upcoming: the next `days` of events with what the bot will do
 * for each, and why. Read-only. With auto-join off, `join` says what it would do.
 */
async function upcoming(userId, tokens, settings, { days = 60, now = new Date() } = {}) {
  const s = normalizeSettings(settings, now);
  const span = Math.min(Math.max(Number(days) || 60, 1), UPCOMING_MAX_DAYS);
  const events = await calendar().getEvents(tokens, {
    timeMin: new Date(now.getTime() - GRACE_MS).toISOString(),
    timeMax: new Date(now.getTime() + span * 24 * 60 * 60 * 1000).toISOString(),
    maxResults: 250,
  });
  const { data: sessions } = await db()
    .from('bot_sessions')
    .select('id, calendar_event_key, status, join_at')
    .eq('consent_acknowledged_by', userId)
    .not('calendar_event_key', 'is', null)
    .neq('status', 'stopped')
    .gte('join_at', new Date(now.getTime() - GRACE_MS - MAX_LEAD_MINUTES * 60 * 1000).toISOString());
  const byKey = new Map((sessions || []).map((x) => [x.calendar_event_key, x]));
  return events
    .filter((e) => dayOf(e) && e.status !== 'cancelled')
    .map((e) => {
      const allDay = !e.start?.dateTime;
      const d = allDay ? { join: false, reason: 'all_day', override: null, canJoin: false }
        : decide(e, { scope: s.scope, now, lookaheadMs: span * 24 * 60 * 60 * 1000, overrides: s.overrides });
      const key = allDay ? null : eventKey(e);
      const session = key ? byKey.get(key) : null;
      const organizer = e.organizer?.self ? 'you' : (e.organizer?.displayName || e.organizer?.email || null);
      return {
        id: e.id,
        key,
        title: e.summary || 'Untitled event',
        start: allDay ? e.start.date : e.start.dateTime,
        end: allDay ? (e.end?.date || null) : (e.end?.dateTime || null),
        allDay,
        platform: d.link?.platform || meetingLink(e)?.platform || null,
        join: d.join,
        reason: d.join ? null : d.reason,
        override: d.override,
        canJoin: d.canJoin,
        organizer,
        attendees: (e.attendees || []).filter((a) => !a.resource).map((a) => ({ name: a.displayName || null, email: a.email || null, self: Boolean(a.self) })),
        botStatus: session?.status || null,
        joinAt: session?.join_at || (d.join ? targetArrival(e, s).toISOString() : null),
        htmlLink: typeof e.htmlLink === 'string' ? e.htmlLink : null,
        meetingLink: meetingLink(e)?.url || null,
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
  MAX_LEAD_MINUTES,
  validLeadMinutes,
  SettingsError,
  nextSettings,
  configure,
  persistTokens,
  SCOPES,
  findLink,
  meetingLink,
  otherInvitees,
  eventKey,
  qualifies,
  decide,
  normalizeSettings,
  normalizeOverrides,
  upcoming,
  runForUser,
  runAutoJoin,
  missedEvents,
  healthOf,
  withdrawScheduled,
  preview,
  initialize,
  stop,
};
