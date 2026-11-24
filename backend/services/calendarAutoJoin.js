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
const DAY_MS = 86_400_000;
const MAX_BOOKINGS = 60;
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

function eventIdOf(key) {
  return typeof key === 'string' ? key.slice(0, key.lastIndexOf('@')) : '';
}

function eventMissing(error) {
  return [404, 410].includes(Number(error.response?.status ?? error.code));
}

function validEventId(id) {
  return typeof id === 'string' && /^[a-z0-9_-]{1,1024}$/i.test(id) &&
    !['__proto__', 'constructor', 'prototype'].includes(id);
}

function normalizeBookings(raw, now) {
  const bookings = {};
  for (const [id, value] of Object.entries(raw || {})) {
    if (!validEventId(id) || !value || !['schedule', 'cancel'].includes(value.decision) ||
      !validLeadMinutes(value.leadMinutes) || Date.parse(value.start) < now.getTime() - DAY_MS ||
      !Number.isFinite(Date.parse(value.start))) continue;
    bookings[id] = { decision: value.decision, leadMinutes: value.leadMinutes, start: value.start };
    if (Object.keys(bookings).length >= MAX_OVERRIDES) break;
  }
  return bookings;
}

function hasBookingRoom(bookings, id) {
  if (bookings[id]?.decision === 'schedule') return true;
  const choices = Object.values(bookings);
  return (Object.hasOwn(bookings, id) || choices.length < MAX_OVERRIDES) &&
    choices.filter((choice) => choice.decision === 'schedule').length < MAX_BOOKINGS;
}

function settingsForStorage({ bookings, ...settings }) {
  return Object.keys(bookings).length ? { ...settings, bookings } : settings;
}

function chosenMeeting(event) {
  const start = startOf(event);
  if (!start || !Number.isFinite(start.getTime()) || event.status === 'cancelled' ||
    event.attendees?.some((a) => a.self && a.responseStatus === 'declined')) return null;
  return meetingLink(event);
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
    bookings: normalizeBookings(s.bookings, now),
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
  if (prev.org_id && target !== prev.org_id && Object.values(prev.bookings).some((b) => b.decision === 'schedule')) {
    throw new SettingsError(409, 'booking_workspace', 'Cancel the calendar’s one-off bookings before switching its workspace.');
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
    auto_join: settingsForStorage(await nextSettings(userId, orgIds, current, changes)),
  }), { client });
  const settings = normalizeSettings(json?.auto_join);
  if (settings.enabled && process.env.RECALL_API_KEY && calendar().isConfigured()) {
    runForUser({ user_id: userId, calendar_json: json }).catch((err) =>
      log.warn('[AutoJoin] run after settings change failed', { userId, error: err.message }));
  }
  return settings;
}

/** Resolve a concrete calendar occurrence under the caller's account. */
async function prepareBooking(ctx, args, now = new Date()) {
  const id = eventIdOf(args.eventKey);
  if (!validEventId(id) || !['schedule', 'cancel'].includes(args.decision)) {
    throw new SettingsError(400, 'invalid_booking', 'Choose a calendar meeting and a booking action.');
  }
  const row = await readCalendarSettings(ctx.userId, ctx.db);
  const json = row?.calendar_json;
  if (!json?.tokens || !calendar().isConfigured() || !process.env.RECALL_API_KEY) {
    throw new SettingsError(400, 'calendar_not_ready', 'Connect Google Calendar and set up the recording bot first.');
  }
  const settings = normalizeSettings(json.auto_join, now);
  const orgId = args.orgId || settings.org_id || (ctx.orgIds.length === 1 ? ctx.orgIds[0] : null);
  if (!ctx.orgIds.includes(orgId) || !ADMIN_ROLES.includes(await orgRole(ctx.userId, orgId))) {
    throw new SettingsError(403, 'booking_role', 'Choose a workspace where you are an owner or admin.');
  }
  if (settings.org_id && orgId !== settings.org_id &&
    (settings.enabled || Object.keys(settings.bookings).length)) {
    throw new SettingsError(409, 'booking_workspace', 'Use the workspace selected for this calendar in Recording settings.');
  }
  const tokens = json.tokens;
  const event = await calendar().getEvent({ ...tokens, _onRefresh: (t) => persistTokens(ctx.userId, t, tokens, ctx.db) }, id)
    .catch((err) => {
      if (eventMissing(err)) return null;
      throw err;
    });
  const start = startOf(event);
  if (!start || !Number.isFinite(start.getTime()) || event.status === 'cancelled' || event.recurrence?.length ||
    args.eventKey !== eventKey(event) || (args.revision !== undefined && args.revision !== (event.etag || null))) {
    throw new SettingsError(409, 'event_changed', 'This meeting has changed in Google Calendar. Refresh it and review the new details.');
  }
  const existing = settings.bookings[id];
  const leadMinutes = args.leadMinutes ?? existing?.leadMinutes ?? settings.lead_minutes;
  if (!validLeadMinutes(leadMinutes)) throw new SettingsError(400, 'invalid_lead', 'Choose a lead time from 0 to 5 whole minutes.');
  const joinAt = targetArrival(event, { lead_minutes: leadMinutes });
  if (args.decision === 'schedule') {
    if (!chosenMeeting(event)) throw new SettingsError(400, 'unavailable_link', 'This meeting needs a supported video link and an accepted or pending invitation.');
    if (joinAt.getTime() <= now.getTime() + RECALL_SCHEDULE_NOTICE_MS) {
      throw new SettingsError(400, 'insufficient_notice', 'Choose an arrival time more than 10 minutes away. For a meeting about to start, use Bot to send it now.');
    }
    if (!hasBookingRoom(settings.bookings, id)) {
      throw new SettingsError(409, 'booking_limit', 'This calendar has reached its one-off booking limit.');
    }
  } else {
    const recurring = settings.enabled && decide(event, {
      scope: settings.scope, now, lookaheadMs: Infinity, overrides: settings.overrides,
    }).join;
    if (start <= now || (existing?.decision !== 'schedule' && !recurring)) {
      throw new SettingsError(409, 'no_booking', 'There is no upcoming bot booking to cancel for this meeting.');
    }
    const { data: session, error } = await db().from('bot_sessions').select('status')
      .eq('org_id', orgId).eq('consent_acknowledged_by', ctx.userId).eq('calendar_event_key', args.eventKey)
      .in('status', ['in_call', 'completed']).maybeSingle();
    if (error) throw error;
    if (session) throw new SettingsError(409, 'bot_started', 'The bot has already started. Use the Bot page to manage it.');
  }
  return { id, orgId, event, start, joinAt, leadMinutes, connection: json.connected_at || null };
}

async function saveBooking(ctx, args) {
  const booking = await prepareBooking(ctx, args);
  const json = await updateCalendarSettings(ctx.userId, (current) => {
    if (!current.tokens || (current.connected_at || null) !== booking.connection) {
      throw new SettingsError(409, 'calendar_changed', 'Your calendar connection changed. Open the meeting and try again.');
    }
    const settings = normalizeSettings(current.auto_join);
    if (settings.org_id && settings.org_id !== booking.orgId &&
      (settings.enabled || Object.keys(settings.bookings).length)) {
      throw new SettingsError(409, 'booking_workspace', 'The calendar workspace changed. Open the meeting and try again.');
    }
    if (args.decision === 'schedule' && !hasBookingRoom(settings.bookings, booking.id)) {
      throw new SettingsError(409, 'booking_limit', 'This calendar has reached its one-off booking limit.');
    }
    settings.org_id = booking.orgId;
    settings.bookings[booking.id] = {
      decision: args.decision, leadMinutes: booking.leadMinutes, start: booking.start.toISOString(),
    };
    return { ...current, auto_join: settingsForStorage(settings) };
  }, { client: ctx.db });
  if (!json) throw new SettingsError(409, 'calendar_changed', 'Your calendar connection changed. Reconnect it and try again.');
  // The intent is durable even when this run fails or the meeting is outside the reservation window.
  try {
    await runForUser({ user_id: ctx.userId, calendar_json: json });
  } catch (error) {
    log.warn('[AutoJoin] booking saved; calendar sync will retry', { userId: ctx.userId, error: error.message });
  }
  return { eventId: booking.id, decision: args.decision, joinAt: booking.joinAt.toISOString() };
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
  if (!tokens) return out;
  if (!settings.enabled && !Object.keys(settings.bookings).length) {
    if (row.calendar_json?.auto_join?.bookings) {
      await updateCalendarSettings(userId, (json) => json.tokens ? {
        ...json, auto_join: settingsForStorage(normalizeSettings(json.auto_join, now)),
      } : null, { client: db() });
    }
    return out;
  }
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

  const seen = new Set(events.map((event) => event.id));
  const removed = new Set();
  // A booked occurrence can move outside the polling window. Resolve its stable
  // Google id before treating an absent event as cancelled.
  for (const [id, booking] of Object.entries(settings.bookings)) {
    if (seen.has(id) || Date.parse(booking.start) > now.getTime() + LOOKAHEAD_MS) continue;
    try {
      const event = await calendar().getEvent(live, id);
      if (!event || event.status === 'cancelled') removed.add(id);
      else events.push(event);
    } catch (err) {
      if (eventMissing(err)) removed.add(id);
      else throw err; // A failed Calendar read is not evidence of a cancellation.
    }
  }

  const wanted = new Map();
  const plannedById = new Map();
  const starts = new Map();
  for (const event of events) {
    const booking = Object.hasOwn(settings.bookings, event.id) ? settings.bookings[event.id] : null;
    const start = startOf(event);
    if (booking && start && Number.isFinite(start.getTime())) starts.set(event.id, start.toISOString());
    const rule = settings.enabled && !booking
      ? decide(event, { scope: settings.scope, now, overrides: settings.overrides })
      : null;
    const link = booking?.decision === 'schedule' ? chosenMeeting(event) : rule?.join ? rule.link : null;
    if (link && start && start.getTime() >= now.getTime() - GRACE_MS && start.getTime() <= now.getTime() + LOOKAHEAD_MS) {
      const key = eventKey(event);
      const lead = booking?.leadMinutes ?? settings.lead_minutes;
      const target = { event, key, link, lead, oneOff: Boolean(booking), joinAt: targetArrival(event, { lead_minutes: lead }) };
      wanted.set(key, target);
      plannedById.set(event.id, target);
    } else {
      out.skipped += 1;
    }
  }

  const { data: existing, error } = await db()
    .from('bot_sessions')
    .select('id, calendar_event_key, status, join_at, recall_bot_id, meeting_url')
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
    const id = eventIdOf(s.calendar_event_key);
    const explicit = Object.hasOwn(settings.bookings, id) ? settings.bookings[id] : null;
    const cancel = explicit?.decision === 'cancel';
    if ((!LIVE_STATUSES.includes(s.status) && !(cancel && s.status === 'joining')) || !s.join_at) continue;
    const oldTime = new Date(s.join_at);
    if (oldTime <= now && !cancel) continue;
    const planned = wanted.get(s.calendar_event_key) || (explicit ? plannedById.get(id) : null);
    const moved = planned && (planned.key !== s.calendar_event_key || (s.meeting_url && planned.link.url !== s.meeting_url));
    if (planned && !moved && (planned.joinAt.getTime() === oldTime.getTime() ||
      !canSchedule(oldTime) || !canSchedule(planned.joinAt))) continue;
    try {
      if (!(await stillCurrent())) return out;
      if (planned && (!moved || (canSchedule(oldTime) && canSchedule(planned.joinAt)))) {
        if (!s.recall_bot_id) {
          have.add(planned.key);
          continue;
        }
        const changes = moved ? [{ calendarEventKey: planned.key, meetingUrl: planned.link.url, platform: planned.link.platform }] : [];
        await orchestrator().rescheduleBotSession(s, planned.joinAt.toISOString(), ...changes);
        have.add(planned.key);
      } else {
        await orchestrator().stopBotSession(s.id, cancel ? 'calendar_booking_cancelled' : 'calendar_changed');
        have.delete(s.calendar_event_key);
        out.withdrawn += 1;
      }
    } catch (err) {
      if (planned) have.add(planned.key); // Keep the existing reservation as the only bot on a provider failure.
      removed.delete(id); // Preserve the cancellation intent until the provider has withdrawn the old bot.
      out.errors += 1;
      log.warn('[AutoJoin] could not update scheduled bot', { sessionId: s.id, error: err.message });
    }
  }

  const me = await userIdentity(userId);
  for (const [key, { event, link, joinAt, lead, oneOff }] of wanted) {
    if (have.has(key)) continue;
    // A selected bot must not launch ad hoc before its confirmed arrival.
    if ((oneOff || lead) && joinAt > now && !canSchedule(joinAt)) continue;
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
        requireScheduled: oneOff && joinAt > now,
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

  if (Object.keys(settings.bookings).length || row.calendar_json?.auto_join?.bookings) {
    await updateCalendarSettings(userId, (json) => {
      if (!json.tokens || json.connected_at !== row.calendar_json.connected_at) return null;
      const current = normalizeSettings(json.auto_join, now);
      for (const [id, start] of starts) {
        if (isDeepStrictEqual(current.bookings[id], settings.bookings[id])) current.bookings[id].start = start;
      }
      for (const id of removed) {
        if (isDeepStrictEqual(current.bookings[id], settings.bookings[id])) delete current.bookings[id];
      }
      const next = settingsForStorage(current);
      return isDeepStrictEqual(next, json.auto_join) ? null : { ...json, auto_join: next };
    }, { client: db() }).catch((err) => log.warn('[AutoJoin] could not refresh booking dates', { userId, error: err.message }));
  }
  if (settings.enabled) {
    const recurringEvents = events.filter((e) => !Object.hasOwn(settings.bookings, e.id));
    await recordHealth(userId, missedEvents(recurringEvents, existing || [], settings.scope, now, settings.overrides), now, me)
      .catch((err) => log.warn('[AutoJoin] could not save the run', { userId, error: err.message }));
  }
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
async function withdrawScheduled(userId, now = new Date(), { keepBookings = false } = {}) {
  const { data, error } = await db()
    .from('bot_sessions')
    .select('id, org_id, calendar_event_key')
    .eq('consent_acknowledged_by', userId)
    .not('calendar_event_key', 'is', null)
    .in('status', LIVE_STATUSES)
    .gt('join_at', now.toISOString());
  if (error) throw error;
  const settings = keepBookings ? normalizeSettings((await readCalendarSettings(userId, db()))?.calendar_json?.auto_join, now) : null;
  let withdrawn = 0;
  for (const s of data || []) {
    if (settings?.org_id === s.org_id && settings?.bookings[eventIdOf(s.calendar_event_key)]?.decision === 'schedule') continue;
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
      const booking = Object.hasOwn(s.bookings, e.id) ? s.bookings[e.id] : null;
      const link = e.start?.dateTime ? chosenMeeting(e) : null;
      const scheduledAt = link ? targetArrival(e, { lead_minutes: booking?.leadMinutes ?? s.lead_minutes }) : null;
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
        booking: booking?.decision || null,
        canSchedule: Boolean(scheduledAt && startOf(e).getTime() > now.getTime() + RECALL_SCHEDULE_NOTICE_MS),
        organizer,
        attendees: (e.attendees || []).filter((a) => !a.resource).map((a) => ({ name: a.displayName || null, email: a.email || null, self: Boolean(a.self) })),
        botStatus: session?.status || null,
        joinAt: session?.join_at || (booking?.decision === 'schedule' ? scheduledAt?.toISOString() || null : (d.join ? targetArrival(e, s).toISOString() : null)),
        htmlLink: typeof e.htmlLink === 'string' ? e.htmlLink : null,
        meetingLink: meetingLink(e)?.url || null,
      };
    });
}

/** Reconcile recurring rules and one-off bookings, including pending cancellations. */
async function runAutoJoin(now = new Date()) {
  if (!db()) return { users: 0, skipped: 'no_database' };
  if (!calendar().isConfigured() || !process.env.RECALL_API_KEY) {
    return { users: 0, skipped: 'not_configured' };
  }
  const { data: rows, error } = await db()
    .from('user_settings')
    .select('user_id, calendar_json')
    .or('calendar_json->auto_join->>enabled.eq.true,calendar_json->auto_join->bookings.not.is.null');
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
  prepareBooking,
  saveBooking,
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
