/**
 * Bot Orchestrator — Recall.ai client.
 *
 * Launches per-meeting recording bots via Recall.ai's API instead of
 * spinning our own Fly Machines. Recall handles bot identity, anti-bot
 * detection, audio capture, and platform-specific quirks (Meet/Zoom/
 * Teams). We track session state in `bot_sessions` and react to Recall
 * webhook events posted to /api/admin/bots/recall-webhook.
 *
 * Decision: pivoted from in-house Fly bot (P1.2 Pass 2) after Google
 * served CAPTCHA challenges to our datacenter IP + headless Chromium
 * combo. See docs/plans/ENTOMATE_GAP_CLOSING_PLAN.md §8 for the original
 * build-vs-buy tradeoff. To be revisited at M-PR pricing checkpoint.
 *
 * Env vars:
 *   RECALL_API_KEY                  — required, from Recall.ai dashboard
 *   RECALL_API_BASE                 — default https://us-west-2.recall.ai/api/v1
 *   RECALL_WEBHOOK_SIGNING_SECRET   — Svix `whsec_…` secret, configured per
 *                                     workspace in the Recall dashboard.
 *                                     Webhooks are workspace-level, not
 *                                     per-bot — there is no `webhook_url`
 *                                     field on Recall's bot create endpoint.
 */

'use strict';

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');
const consentEmail = require('./consentEmailService');

const RECALL_API_BASE = process.env.RECALL_API_BASE || 'https://us-west-2.recall.ai/api/v1';
const DEFAULT_BOT_NAME = 'Meet Mate';
// Deepgram Nova-3 language for bot transcripts. 'multi' follows the speakers
// across English, Spanish, French, German, Hindi, Russian, Portuguese, Japanese,
// Italian and Dutch, including switches mid-call (surface audit 2026-11-22, gap 2).
// BOT_TRANSCRIPT_LANGUAGE pins one language (e.g. 'en') if a workspace needs it.
const BOT_TRANSCRIPT_LANGUAGE = (process.env.BOT_TRANSCRIPT_LANGUAGE || 'multi').trim() || 'multi';

// Casual, neutral disclosure posted to chat when the bot joins. Per-workspace
// override lives at tenant_organizations.settings.bot_announcement_message;
// the {organizer} token resolves to the launching user's first name (falls
// back to email-username, then drops the substitution).
const DEFAULT_ANNOUNCEMENT_TEMPLATE =
  'Hey all — Meet Mate (an AI notetaker) is recording this meeting{organizerSuffix}. ' +
  'Notes + transcript shared with the meeting host.';

function renderAnnouncement(template, organizerName) {
  const suffix = organizerName ? ` for ${organizerName}` : '';
  return template
    .replace('{organizerSuffix}', suffix)
    .replace('{organizer}', organizerName || 'the meeting host');
}

// Opt-out token plumbing (P1.7 Slice 2). The raw token is generated here,
// embedded in the email link, and never persisted. Only sha256(raw) is
// stored on bot_session_attendees so a stolen DB dump can't be used to
// mass-unsubscribe.
function generateOptOutToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

function hashOptOutToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

// Loose RFC 5322-ish email shape check. Not a full parser — just enough
// to reject obvious typos before we hit Resend.
function normalizeEmail(e) {
  if (typeof e !== 'string') return null;
  const trimmed = e.trim().toLowerCase();
  if (!trimmed.includes('@') || !trimmed.includes('.')) return null;
  if (trimmed.length < 5 || trimmed.length > 254) return null;
  return trimmed;
}

function normalizeEmailList(emails, organizerEmail) {
  const orgLower = organizerEmail ? organizerEmail.toLowerCase() : null;
  const seen = new Set();
  const out = [];
  for (const e of Array.isArray(emails) ? emails : []) {
    const n = normalizeEmail(e);
    if (!n) continue;
    if (n === orgLower) continue;     // never email the organizer their own bot launch
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

async function resolveAnnouncementMessage(workspaceId, organizerName) {
  try {
    const { data } = await db()
      .from('tenant_organizations')
      .select('settings')
      .eq('id', workspaceId)
      .maybeSingle();
    const custom = data?.settings?.bot_announcement_message;
    if (typeof custom === 'string' && custom.trim()) {
      return renderAnnouncement(custom, organizerName);
    }
  } catch (err) {
    log.warn('Announcement override lookup failed; using default', {
      workspaceId, error: err.message
    });
  }
  return renderAnnouncement(DEFAULT_ANNOUNCEMENT_TEMPLATE, organizerName);
}

/**
 * Where Recall posts live captions for a session: the backend's public URL
 * plus a per-session token. Null when no public URL is configured.
 */
function realtimeUrl(sessionId) {
  const base = (process.env.RECALL_REALTIME_BASE_URL || process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) return null;
  const token = require('./botCaptions').captionToken(sessionId);
  return `${base}/api/admin/bots/realtime/${sessionId}?token=${encodeURIComponent(token)}`;
}

const db = () => {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_KEY is not set');
  return supabaseAdmin;
};

const PLAN_LABELS = { free: 'Free', solo: 'Solo', team: 'Team' };

/** The message shown when an org has no bot hours left. */
function botHoursMessage(hours) {
  const plan = PLAN_LABELS[hours.plan] || hours.plan;
  const shared = hours.plan === 'team' ? ' shared' : '';
  const resets = new Date(hours.resets_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  });
  if (hours.plan === 'free') {
    return `No bot hours left. Your Free plan includes ${Number(hours.included_hours)} bot hours a month, ` +
      `and this workspace has used them all. ` +
      `Upgrade to Solo or Team, or wait until ${resets}, when the hours reset.`;
  }
  return `No bot hours left. Your ${plan} plan includes ${Number(hours.included_hours)}${shared} bot hours a month, ` +
    `and this workspace has used them all, with no extra hours left. ` +
    `Add a 10-hour pack ($10), or wait until ${resets}, when the hours reset.`;
}

/**
 * Refuse a launch when the org's plan has a bot-hour limit and no hours are
 * left (plan hours this month plus pack hours). Usage comes from
 * get_org_bot_hours (migration 20261122000015_bot_hour_limits.sql). A failed
 * read is logged and the launch goes ahead: a database error must not stop
 * every bot.
 */
async function assertBotHoursLeft(orgId) {
  const { data, error } = await db().rpc('get_org_bot_hours', { p_org_id: orgId });
  if (error) {
    log.warn('Bot-hour check failed; launching anyway', { orgId, error: error.message });
    return;
  }
  if (!data || !data.limited || Number(data.remaining_hours) > 0) return;
  const err = new Error(botHoursMessage(data));
  err.code = 'bot_hours_exhausted';
  err.botHours = data;
  throw err;
}

function authHeaders() {
  const token = process.env.RECALL_API_KEY;
  if (!token) throw new Error('RECALL_API_KEY is not set');
  return {
    Authorization: `Token ${token}`,
    'Content-Type': 'application/json'
  };
}

async function recallFetch(path, options = {}) {
  const res = await fetch(`${RECALL_API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Recall API ${res.status} @ ${path}: ${text.slice(0, 500)}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

/**
 * Launch a new bot session.
 *
 * Caller must have already verified the launching user affirmed consent
 * from all meeting participants (P1.7). The route layer (routes/bots.js)
 * enforces consentAcknowledged: true on the request body before invoking
 * this function; the consent fields below record who/when for audit.
 *
 * @param {Object} p
 * @param {string} p.workspaceId
 * @param {string} p.meetingId
 * @param {string} p.meetingUrl
 * @param {'meet'|'zoom'|'teams'} p.platform
 * @param {string} [p.botName]
 * @param {string} [p.consentAcknowledgedBy]      auth.users.id of the
 *   organizer who clicked the consent checkbox. Required by the route
 *   layer; treated as optional here so direct callers (e.g. future
 *   scheduled jobs) can pass null when there is no human in the loop.
 * @param {string} [p.consentAcknowledgedByName]  Display name used in the
 *   in-meeting chat announcement and the opt-out email. Falls back
 *   gracefully if missing.
 * @param {string} [p.consentAcknowledgedByEmail] Organizer's email; used
 *   to filter their own address out of participantEmails and as the
 *   recipient for the organizer-side opt-out notification email.
 * @param {string[]} [p.participantEmails]        External attendees who
 *   should receive a pre-meeting opt-out email. The organizer is
 *   filtered out automatically; duplicates collapsed; bad shapes
 *   dropped. Empty/missing array skips the email flow entirely.
 * @returns {Promise<{
 *   sessionId: string,
 *   recallBotId: string,
 *   attendees: Array<{email: string, status: string, error?: string}>
 * }>}
 */
async function launchBotSession(p) {
  const {
    workspaceId, meetingId, meetingUrl, platform, botName,
    consentAcknowledgedBy, consentAcknowledgedByName, consentAcknowledgedByEmail,
    participantEmails, intelligenceProfileId,
    // Calendar auto-join (services/calendarAutoJoin.js): when the bot should
    // join, which calendar event it is for, and the event's title.
    joinAt, requireScheduled, calendarEventKey, title
  } = p || {};
  if (!workspaceId || !meetingId || !meetingUrl || !platform) {
    throw new Error('launchBotSession: workspaceId, meetingId, meetingUrl, platform are required');
  }
  if (!['meet', 'zoom', 'teams'].includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const checkReservationTime = () => {
    if (requireScheduled && Date.parse(joinAt) <= Date.now() + 10 * 60_000) {
      throw new Error('There is too little time to reserve this bot.');
    }
  };
  checkReservationTime();

  await assertBotHoursLeft(workspaceId);

  const sessionId = crypto.randomUUID();
  const announcementMessage = await resolveAnnouncementMessage(
    workspaceId, consentAcknowledgedByName || null
  );

  const insertRow = {
    id: sessionId,
    org_id: workspaceId,
    meeting_id: meetingId,
    platform,
    status: 'pending',
    meeting_url: meetingUrl,
    callback_token_hash: 'recall' // legacy column; not used in Recall path
  };
  if (consentAcknowledgedBy) {
    insertRow.consent_acknowledged_at = new Date().toISOString();
    insertRow.consent_acknowledged_by = consentAcknowledgedBy;
  }
  if (calendarEventKey) insertRow.calendar_event_key = calendarEventKey;
  if (intelligenceProfileId) insertRow.intelligence_profile_id = intelligenceProfileId;
  if (title) insertRow.title = String(title).slice(0, 200);
  if (joinAt) insertRow.join_at = joinAt;

  const { error: insertErr } = await db()
    .from('bot_sessions')
    .insert(insertRow);
  if (insertErr) throw new Error(`bot_sessions insert failed: ${insertErr.message}`);

  const recallPayload = {
    meeting_url: meetingUrl,
    bot_name: botName || DEFAULT_BOT_NAME,
    // Recall needs more than ten minutes to reserve a bot. Pass a future
    // target when possible; a target at or near now uses its ad hoc pool.
    ...(joinAt && new Date(joinAt).getTime() > Date.now() + 60 * 1000 ? { join_at: joinAt } : {}),
    // Webhooks are configured at the Recall workspace level (dashboard),
    // not per-bot — Recall's bot create endpoint has no webhook_url field.
    // Status events arrive via the Svix-signed POST to
    // /api/admin/bots/recall-webhook and are routed to a session by
    // metadata.session_id below.
    // Deepgram Nova-3 with speaker diarization. BYO Deepgram API key is
    // configured in the Recall dashboard, not here. Speaker labels arrive
    // as generic "A", "B", "C" in the transcript JSON we fetch from
    // transcript_url on bot.done.
    recording_config: {
      transcript: {
        provider: {
          deepgram_streaming: {
            model: 'nova-3',
            language: BOT_TRANSCRIPT_LANGUAGE,
            diarize: true
          }
        }
      },
      // Live captions (services/botCaptions.js): Recall posts each finished
      // utterance to our realtime endpoint while the bot records. Left out
      // when the backend's public URL is unknown, so a launch never fails over it.
      ...(realtimeUrl(sessionId) ? {
        realtime_endpoints: [{ type: 'webhook', url: realtimeUrl(sessionId), events: ['transcript.data'] }]
      } : {})
    },
    // P1.7 in-meeting consent announcement. Recall posts this on join.
    // If Recall rejects the field shape (it has shifted before — the
    // dashboard catalog should be the source of truth), launch will fail
    // loud at the Recall API call below and we'll iterate to a runtime
    // POST /bot/<id>/send_chat_message fallback.
    chat: {
      on_bot_join: {
        send_to: 'everyone',
        message: announcementMessage
      }
    },
    metadata: {
      session_id: sessionId,
      workspace_id: workspaceId,
      meeting_id: meetingId,
      platform
    }
  };

  let bot;
  try {
    // Recall's API rejects trailing slashes on these endpoints (returns
    // auth_failed misleadingly on POST /bot/). Two settings are optional, and a
    // 400 that names one of them drops it and tries again: the multilingual
    // transcript language (falls back to English, the old proven setting) and
    // live captions.
    for (let attempt = 0; ; attempt++) {
      try {
        checkReservationTime();
        bot = await recallFetch('/bot', {
          method: 'POST',
          body: JSON.stringify(recallPayload)
        });
        break;
      } catch (err) {
        if (attempt >= 2 || !/\b400\b/.test(err.message)) throw err;
        const deepgram = recallPayload.recording_config.transcript.provider.deepgram_streaming;
        if (deepgram.language !== 'en' && /language|multi/i.test(err.message)) {
          log.warn('Recall refused the transcript language; launching in English', { sessionId, language: deepgram.language, error: err.message });
          deepgram.language = 'en';
        } else if (recallPayload.recording_config.realtime_endpoints) {
          log.warn('Recall refused realtime captions; launching without them', { sessionId, error: err.message });
          delete recallPayload.recording_config.realtime_endpoints;
        } else {
          throw err;
        }
      }
    }
  } catch (err) {
    await db()
      .from('bot_sessions')
      .update({
        status: 'failed',
        failure_reason: `recall_launch_failed: ${err.message}`,
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    log.error('Recall bot launch failed', { sessionId, error: err.message });
    throw err;
  }

  const { error: updErr } = await db()
    .from('bot_sessions')
    .update({
      live_state: { captions: Boolean(recallPayload.recording_config.realtime_endpoints) },
      status: 'launching',
      recall_bot_id: bot.id,
      started_at: new Date().toISOString()
    })
    .eq('id', sessionId);
  if (updErr) log.warn('bot_sessions post-launch update failed', { sessionId, error: updErr.message });

  log.info('Recall bot launched', { sessionId, recallBotId: bot.id, platform });

  // P1.7 Slice 2 — fire pre-meeting opt-out emails. Best-effort: a single
  // bad address or a Resend outage must not fail the launch (the bot is
  // already in flight at this point). Per-attendee status is persisted on
  // bot_session_attendees and surfaced in the launch response so the UI
  // can warn if any sends failed.
  const cleanEmails = normalizeEmailList(participantEmails, consentAcknowledgedByEmail);
  let attendees = [];
  if (cleanEmails.length > 0) {
    try {
      attendees = await sendOptOutEmailsForSession({
        sessionId,
        workspaceId,
        organizerName: consentAcknowledgedByName || null,
        emails: cleanEmails
      });
    } catch (err) {
      log.warn('Opt-out email fan-out threw unexpectedly', {
        sessionId, error: err.message
      });
    }
  }

  return { sessionId, recallBotId: bot.id, attendees };
}

/**
 * Fan out pre-meeting opt-out emails for a launched session. For each
 * email:
 *   1. Generate a token + insert a bot_session_attendees row (status pending).
 *   2. Send via consentEmailService (skipped if RESEND_API_KEY unset).
 *   3. Update the row to sent/failed/skipped with timestamp + error.
 *
 * Returns an array of {email, status, error?} mirroring DB state.
 */
async function sendOptOutEmailsForSession({ sessionId, workspaceId, organizerName, emails }) {
  const rows = emails.map((email) => {
    const { raw, hash } = generateOptOutToken();
    return { email, raw, hash };
  });

  // Insert all attendee rows up front, status='pending'. Done as one batch
  // so we never end up half-inserted if the request is interrupted mid-loop.
  const { error: insertErr } = await db()
    .from('bot_session_attendees')
    .insert(rows.map((r) => ({
      session_id: sessionId,
      org_id: workspaceId,
      email: r.email,
      opt_out_token_hash: r.hash,
      email_status: 'pending'
    })));
  if (insertErr) {
    log.warn('bot_session_attendees insert failed; opt-out emails skipped', {
      sessionId, error: insertErr.message
    });
    return emails.map((email) => ({ email, status: 'failed', error: insertErr.message }));
  }

  const sends = rows.map(async (r) => {
    try {
      const result = await consentEmail.sendAttendeeOptOutEmail({
        to: r.email,
        organizerName,
        rawToken: r.raw
      });
      const skipped = result && result.skipped;
      const messageId = !skipped && result && result.id ? result.id : null;
      const status = skipped ? 'skipped' : 'sent';
      await db()
        .from('bot_session_attendees')
        .update({
          email_status: status,
          email_sent_at: new Date().toISOString(),
          email_provider_message_id: messageId
        })
        .eq('session_id', sessionId)
        .eq('email', r.email);
      return { email: r.email, status };
    } catch (err) {
      log.warn('Attendee opt-out email send failed', { email: r.email, error: err.message });
      await db()
        .from('bot_session_attendees')
        .update({
          email_status: 'failed',
          email_error: String(err.message || err).slice(0, 500)
        })
        .eq('session_id', sessionId)
        .eq('email', r.email);
      return { email: r.email, status: 'failed', error: err.message };
    }
  });

  return Promise.all(sends);
}

/**
 * Public opt-out endpoint helper — resolve an attendee row from the raw
 * token. Returns the minimum context the OptOut landing page needs to
 * render. Returns null for unknown / malformed tokens (the route turns
 * this into a 404 — never leak whether the token-shape was valid but
 * unmatched vs invalid).
 */
async function resolveAttendeeFromToken(rawToken) {
  if (typeof rawToken !== 'string' || rawToken.length < 16) return null;
  const hash = hashOptOutToken(rawToken);

  const { data: attendee, error } = await db()
    .from('bot_session_attendees')
    .select('id, session_id, org_id, email, opted_out_at')
    .eq('opt_out_token_hash', hash)
    .maybeSingle();
  if (error || !attendee) return null;

  // Pull a tiny bit of session context for the page. We deliberately do
  // NOT expose the meeting URL — anyone with the email link could use
  // that to crash the meeting. Just the organizer name + meeting time.
  const { data: session } = await db()
    .from('bot_sessions')
    .select('created_at, consent_acknowledged_by, platform')
    .eq('id', attendee.session_id)
    .maybeSingle();

  let organizerName = null;
  if (session?.consent_acknowledged_by && supabaseAdmin) {
    try {
      const { data: userInfo } = await supabaseAdmin.auth.admin
        .getUserById(session.consent_acknowledged_by);
      const meta = userInfo?.user?.user_metadata || {};
      organizerName = meta.full_name
        || meta.name
        || (userInfo?.user?.email ? userInfo.user.email.split('@')[0] : null);
    } catch (err) {
      log.warn('Could not resolve organizer for opt-out page', { error: err.message });
    }
  }

  return {
    attendeeId: attendee.id,
    sessionId: attendee.session_id,
    email: attendee.email,
    alreadyOptedOut: Boolean(attendee.opted_out_at),
    optedOutAt: attendee.opted_out_at,
    organizerName,
    meetingPlatform: session?.platform || null,
    meetingTime: session?.created_at || null
  };
}

/**
 * Record an opt-out and notify the organizer. Idempotent: re-clicking the
 * link returns alreadyOptedOut: true without re-sending the notification.
 *
 * @param {string} rawToken
 * @param {Object} ctx
 * @param {string} [ctx.reason]      Optional free-text reason from the form.
 * @param {string} [ctx.ip]          Source IP of the click for audit.
 */
async function recordAttendeeOptOut(rawToken, ctx = {}) {
  if (typeof rawToken !== 'string' || rawToken.length < 16) {
    return { ok: false, error: 'invalid_token' };
  }
  const hash = hashOptOutToken(rawToken);

  const { data: attendee, error: lookupErr } = await db()
    .from('bot_session_attendees')
    .select('id, session_id, org_id, email, opted_out_at')
    .eq('opt_out_token_hash', hash)
    .maybeSingle();
  if (lookupErr || !attendee) return { ok: false, error: 'not_found' };

  if (attendee.opted_out_at) {
    return { ok: true, alreadyOptedOut: true };
  }

  const reason = typeof ctx.reason === 'string' ? ctx.reason.slice(0, 1000) : null;
  const ip = typeof ctx.ip === 'string' ? ctx.ip : null;

  const { error: updErr } = await db()
    .from('bot_session_attendees')
    .update({
      opted_out_at: new Date().toISOString(),
      opt_out_reason: reason,
      opt_out_ip: ip
    })
    .eq('id', attendee.id);
  if (updErr) {
    log.error('bot_session_attendees opt-out update failed', {
      attendeeId: attendee.id, error: updErr.message
    });
    return { ok: false, error: 'update_failed' };
  }

  // Best-effort organizer notification. Failures here are logged but not
  // surfaced — the attendee should always see "you're opted out" regardless.
  try {
    const { data: session } = await db()
      .from('bot_sessions')
      .select('consent_acknowledged_by')
      .eq('id', attendee.session_id)
      .maybeSingle();

    if (session?.consent_acknowledged_by && supabaseAdmin) {
      const { data: userInfo } = await supabaseAdmin.auth.admin
        .getUserById(session.consent_acknowledged_by);
      const organizerEmail = userInfo?.user?.email || null;
      const meta = userInfo?.user?.user_metadata || {};
      const organizerName = meta.full_name
        || meta.name
        || (organizerEmail ? organizerEmail.split('@')[0] : null);

      if (organizerEmail) {
        await consentEmail.sendOrganizerOptOutNotification({
          to: organizerEmail,
          organizerName,
          attendeeEmail: attendee.email,
          reason
        });
      }
    }
  } catch (err) {
    log.warn('Organizer notification skipped due to error', { error: err.message });
  }

  return { ok: true, alreadyOptedOut: false };
}

// Recall status codes grouped by lifecycle phase. The right "stop" action
// depends on which phase the bot is in: pre-call bots have to be deleted
// (Recall returns 400 cannot_command_unstarted_bot on /leave_call), in-call
// bots get /leave_call, and bots already in a terminal state need no Recall
// call at all.
const PRE_CALL_STATUSES = new Set(['ready', 'joining_call', 'in_waiting_room']);
const IN_CALL_STATUSES = new Set(['in_call_not_recording', 'in_call_recording']);
const TERMINAL_STATUSES = new Set([
  'recording_done', 'call_ended', 'done', 'fatal', 'timeout'
]);

function latestRecallStatusCode(bot) {
  const changes = Array.isArray(bot?.status_changes) ? bot.status_changes : [];
  if (!changes.length) return bot?.status?.code || null;
  return changes[changes.length - 1]?.code || null;
}

/** Change only the arrival time, preserving the bot and its invitees’ opt-outs. */
async function rescheduleBotSession(session, joinAt, change) {
  if (!session.recall_bot_id) return;
  const previousKey = session.calendar_event_key;
  const nextKey = change?.calendarEventKey;
  const moved = Boolean(nextKey && nextKey !== previousKey);
  if (moved) {
    // Claim the existing unique key for the new occurrence time before touching Recall.
    const { data, error } = await db().from('bot_sessions').update({ calendar_event_key: nextKey })
      .eq('id', session.id).eq('calendar_event_key', previousKey).select('id').maybeSingle();
    if (error || !data) throw new Error(error?.message || 'The reservation changed while rescheduling.');
  }
  try {
    await recallFetch(`/bot/${session.recall_bot_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ join_at: joinAt, ...(change ? { meeting_url: change.meetingUrl } : {}) }),
    });
  } catch (error) {
    if (moved) {
      const rollback = await db().from('bot_sessions').update({ calendar_event_key: previousKey })
        .eq('id', session.id).eq('calendar_event_key', nextKey);
      if (rollback.error) log.warn('Could not restore the calendar reservation key', { sessionId: session.id });
    }
    throw error;
  }
  const calendar = change ? { meeting_url: change.meetingUrl, platform: change.platform } : {};
  const { error } = await db().from('bot_sessions').update({ join_at: joinAt, ...calendar }).eq('id', session.id);
  if (error) throw error;
}

/**
 * Stop a running bot session.
 *
 * Branches on the bot's current Recall lifecycle phase to pick the right
 * cancellation endpoint. See PRE_CALL_STATUSES / IN_CALL_STATUSES /
 * TERMINAL_STATUSES above for the mapping.
 */
async function stopBotSession(sessionId, reason = 'manual_stop') {
  const { data: session, error } = await db()
    .from('bot_sessions')
    .select('recall_bot_id, status, join_at')
    .eq('id', sessionId)
    .single();
  if (error || !session) throw new Error(`Session not found: ${sessionId}`);
  if (!session.recall_bot_id) throw new Error(`Session ${sessionId} has no recall_bot_id`);

  let recallStatus = null;
  let undispatched = false;
  try {
    const bot = await recallFetch(`/bot/${session.recall_bot_id}`);
    recallStatus = latestRecallStatusCode(bot);
    undispatched = Boolean(bot && !recallStatus && session.join_at);
  } catch (err) {
    // If Recall doesn't know about the bot anymore, treat as terminal — nothing
    // to stop. Any other failure should surface; don't blindly try /leave_call.
    if (/\b404\b/.test(err.message)) {
      log.warn('Recall bot already gone; marking session stopped', {
        sessionId, recallBotId: session.recall_bot_id
      });
    } else {
      throw err;
    }
  }

  if (undispatched || PRE_CALL_STATUSES.has(recallStatus)) {
    await recallFetch(`/bot/${session.recall_bot_id}`, { method: 'DELETE' }).catch((error) => {
      if (!/\b404\b/.test(error.message)) throw error;
    });
  } else if (recallStatus && IN_CALL_STATUSES.has(recallStatus)) {
    await recallFetch(`/bot/${session.recall_bot_id}/leave_call`, { method: 'POST' });
  } else if (recallStatus && !TERMINAL_STATUSES.has(recallStatus)) {
    // Unknown status — attempt leave_call as the historical default but log it
    // so we can extend the map if Recall introduces new codes.
    log.warn('Unknown Recall status on stop; defaulting to leave_call', {
      sessionId, recallBotId: session.recall_bot_id, recallStatus
    });
    await recallFetch(`/bot/${session.recall_bot_id}/leave_call`, { method: 'POST' });
  }

  const { error: updErr } = await db()
    .from('bot_sessions')
    .update({ status: 'stopped', failure_reason: reason, ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (updErr) log.warn('bot_sessions post-stop update failed', { sessionId, error: updErr.message });

  log.info('Recall bot stopped', {
    sessionId, recallBotId: session.recall_bot_id, recallStatus, reason
  });
  return { sessionId, recallBotId: session.recall_bot_id, recallStatus };
}

/**
 * Pause or resume the recording (the bot stays in the call). While paused
 * nothing is recorded or transcribed; Recall reports in_call_not_recording.
 */
async function setRecordingPaused(sessionId, paused) {
  const { data: session, error } = await db()
    .from('bot_sessions')
    .select('recall_bot_id, status')
    .eq('id', sessionId)
    .single();
  if (error || !session?.recall_bot_id) throw new Error(`Session not found: ${sessionId}`);
  if (session.status !== 'in_call') throw new Error('The bot is not in the call');
  await recallFetch(`/bot/${session.recall_bot_id}/${paused ? 'pause_recording' : 'resume_recording'}`, { method: 'POST' });
  require('./botCaptions').setPaused(sessionId, paused);
  await saveLiveState(sessionId, { recording: !paused, pausedByYou: paused, recordingAt: new Date().toISOString() });
  log.info(paused ? 'Bot recording paused' : 'Bot recording resumed', { sessionId });
  return { sessionId, paused };
}

/** Merge into bot_sessions.live_state (recording / captions flags for the live views). */
async function saveLiveState(sessionId, patch) {
  const { data, error } = await db().from('bot_sessions').select('live_state').eq('id', sessionId).maybeSingle();
  if (error) throw error;
  const { error: updErr } = await db()
    .from('bot_sessions')
    .update({ live_state: { ...(data?.live_state || {}), ...patch } })
    .eq('id', sessionId);
  if (updErr) throw updErr;
}

const MAX_MARKS = 100;

/**
 * Mark a moment while the bot is in the call. Stored on bot_sessions.marks
 * with the transcript time (from the latest live caption) and the words
 * around it, so the debrief can list and play them.
 */
async function addMark(sessionId, { note, byUserId } = {}) {
  const captions = require('./botCaptions');
  const { data: session, error } = await db()
    .from('bot_sessions')
    .select('id, status, marks')
    .eq('id', sessionId)
    .single();
  if (error) throw new Error(/marks/.test(error.message) ? 'marks_unavailable' : error.message);
  if (session.status !== 'in_call') throw new Error('The bot is not in the call');
  const last = captions.latestLine(sessionId);
  const mark = {
    id: crypto.randomUUID(),
    atMs: captions.latestAtMs(sessionId),
    at: new Date().toISOString(),
    quote: last && !last.hidden ? last.text.slice(0, 280) : null,
    speaker: last && !last.hidden ? last.speaker : null,
    note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 280) : null,
    by: byUserId || null
  };
  const marks = [...(Array.isArray(session.marks) ? session.marks : []), mark].slice(-MAX_MARKS);
  const { error: updErr } = await db().from('bot_sessions').update({ marks }).eq('id', sessionId);
  if (updErr) throw new Error(updErr.message);
  return mark;
}

async function listActiveSessions(orgId) {
  let query = db()
    .from('bot_sessions')
    .select('*')
    .not('status', 'in', '(completed,failed,stopped,timeout)')
    .order('created_at', { ascending: false });
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Fetch the bot's full state from Recall (status history, recording URL,
 * transcript URL once available). Useful for admin debugging and for
 * recovering from missed webhooks.
 */
async function getRecallBotState(sessionId) {
  const { data: session, error } = await db()
    .from('bot_sessions')
    .select('recall_bot_id')
    .eq('id', sessionId)
    .single();
  if (error || !session?.recall_bot_id) throw new Error(`Session ${sessionId} has no recall_bot_id`);
  return recallFetch(`/bot/${session.recall_bot_id}`);
}

/**
 * Map a Recall status code (no `bot.` prefix) to our bot_sessions.status enum.
 */
function mapRecallStatus(code) {
  const map = {
    ready: 'pending',
    joining_call: 'joining',
    in_waiting_room: 'joining',
    in_call_not_recording: 'in_call',
    in_call_recording: 'in_call',
    recording_done: 'completed',
    call_ended: 'completed',
    done: 'completed',
    fatal: 'failed',
    timeout: 'timeout'
  };
  return map[code] || null;
}

/**
 * Workspace-level Svix webhooks identify status by event TYPE (e.g.
 * `bot.in_call_recording`), not by a nested `data.status.code` field —
 * we verified empirically 2026-04-26 that bot.done payloads land without
 * any data.status.code at all. Strip the `bot.` prefix and re-use the
 * mapping above.
 */
function mapRecallEvent(event) {
  if (typeof event !== 'string' || !event.startsWith('bot.')) return null;
  return mapRecallStatus(event.slice(4));
}

/**
 * Resolve which `bot_sessions` row a Recall webhook payload refers to.
 * Workspace-level webhooks fire for *every* bot in the Recall workspace
 * (including any future bots from other apps that share the workspace),
 * so an unknown bot is not an error — we silently no-op on it.
 *
 * Lookup order:
 *   1. payload.data.bot.metadata.session_id  — we wrote this at launch.
 *   2. payload.data.bot.id matched against bot_sessions.recall_bot_id —
 *      defensive fallback if metadata is missing (e.g. legacy bots, or
 *      a payload shape change).
 */
async function resolveSessionFromPayload(payload) {
  const bot = payload?.data?.bot || payload?.data || {};
  const metaSessionId = bot?.metadata?.session_id;
  const recallBotId = bot?.id;

  if (metaSessionId) {
    const { data } = await db()
      .from('bot_sessions')
      .select('id')
      .eq('id', metaSessionId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  if (recallBotId) {
    const { data } = await db()
      .from('bot_sessions')
      .select('id')
      .eq('recall_bot_id', recallBotId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}

/**
 * Process an inbound Recall webhook event. Signature is verified at the
 * route layer (Svix HMAC) before this is called. The session is resolved
 * from the payload, not the URL — workspace-level webhooks have no
 * per-bot URL params to pivot off.
 *
 * @param {Object} payload — Recall webhook body (event + data)
 */
const FINAL_STATUSES = ['completed', 'failed', 'stopped', 'timeout'];

async function handleRecallWebhook(payload) {
  const event = payload?.event;
  const data = payload?.data || {};
  // Status comes from the event type for workspace-level Svix webhooks; fall
  // back to data.status.code for the legacy per-bot payload shape.
  const statusCode = data?.status?.code;
  const mapped = mapRecallEvent(event) || mapRecallStatus(statusCode);

  const sessionId = await resolveSessionFromPayload(payload);
  if (!sessionId) {
    log.info('Recall webhook for unknown bot — ignoring', {
      event, statusCode, recallBotId: data?.bot?.id || data?.id || null
    });
    return { ok: true, ignored: true };
  }

  log.info('Recall webhook', { sessionId, event, statusCode, mapped });

  // Status and the data fields are written separately (audit finding 6):
  // Svix retries and does not promise order, so a late bot.in_call_recording
  // must not reopen a finished session, and a second final event must not
  // replace the first final status or move ended_at. Recording/transcript
  // URLs and the failure reason are still saved whatever the status is.
  const statusUpdate = {};
  if (mapped) statusUpdate.status = mapped;
  if (mapped && FINAL_STATUSES.includes(mapped)) {
    statusUpdate.ended_at = new Date().toISOString();
  }
  const update = {};

  // Recall doesn't fire a separate bot.recording.done / bot.transcript.done
  // event (verified against the dashboard event catalog 2026-04-26). On
  // bot.done we do an authoritative GET /bot/<id> and pull URLs from
  // recordings[0].media_shortcuts. Best-effort: a transient failure here
  // shouldn't block the status update — recordings can be backfilled later
  // via the Recall dashboard or a manual reconcile.
  if (event === 'bot.done') {
    const recallBotId = data?.bot?.id || data?.id;
    if (recallBotId) {
      try {
        const fullBot = await recallFetch(`/bot/${recallBotId}`);
        const rec = Array.isArray(fullBot?.recordings) ? fullBot.recordings[0] : null;
        const shortcuts = rec?.media_shortcuts || {};
        const recordingUrl = shortcuts.video_mixed?.data?.download_url
                          || shortcuts.audio_mixed?.data?.download_url
                          || rec?.media_url;
        const transcriptUrl = shortcuts.transcript?.data?.download_url
                           || rec?.transcript?.url;
        if (recordingUrl) update.recording_url = recordingUrl;
        if (transcriptUrl) update.transcript_url = transcriptUrl;
      } catch (err) {
        log.warn('Failed to fetch bot for recording URLs', {
          recallBotId, error: err.message
        });
      }
    }
  }

  // Paused / resumed from anywhere (our keys or Recall's own) shows in the live views.
  if (event === 'bot.in_call_not_recording') require('./botCaptions').setPaused(sessionId, true);
  if (event === 'bot.in_call_recording') require('./botCaptions').setPaused(sessionId, false);
  // Saved on the row too, so "in the call, not recording" survives a restart and the
  // live views never show REC for a bot that is not recording (e.g. a Zoom host who
  // has not allowed recording yet).
  if (event === 'bot.in_call_not_recording' || event === 'bot.in_call_recording') {
    const recording = event === 'bot.in_call_recording';
    await saveLiveState(sessionId, { recording, recordingAt: new Date().toISOString(), ...(recording ? { pausedByYou: false } : {}) })
      .catch((err) => log.warn('Could not save the bot recording state', { sessionId, error: err.message }));
  }

  if (event === 'bot.fatal' && data?.fatal_reason) {
    update.failure_reason = String(data.fatal_reason).slice(0, 500);
  }

  if (Object.keys(statusUpdate).length > 0) {
    const { error: statusErr } = await db()
      .from('bot_sessions')
      .update(statusUpdate)
      .eq('id', sessionId)
      .not('status', 'in', `(${FINAL_STATUSES.join(',')})`);
    if (statusErr) throw statusErr;
  }

  if (Object.keys(update).length > 0) {
    const { error: updErr } = await db()
      .from('bot_sessions')
      .update(update)
      .eq('id', sessionId);
    if (updErr) throw updErr;
  }

  // Turn the transcript into a meeting while its pre-signed URL is fresh. Fire-and-forget:
  // the AI pipeline takes far longer than Recall's webhook timeout, and a slow or failed
  // ingest must not make Recall retry the status update. A missed ingest can be re-run
  // with POST /api/admin/bots/:sessionId/ingest, which fetches a fresh URL.
  if (event === 'bot.done' && update.transcript_url) {
    transcriptIngest()
      .ingestBotTranscript(sessionId, { transcriptUrl: update.transcript_url })
      .then((r) => afterIngest(sessionId, r))
      .catch((err) => {
        log.error('Transcript ingest failed', { sessionId, error: err.message });
        backupTakesOver(sessionId);
      });
  } else if ((event === 'bot.done' && !update.transcript_url) || ['failed', 'timeout'].includes(statusUpdate.status)) {
    // No transcript is coming: a recording made beside the bot writes the minutes instead.
    backupTakesOver(sessionId);
  }

  return { ok: true, sessionId };
}

/** Once the meeting exists, keep its audio for playback (services/botRecording.js). */
function afterIngest(sessionId, result) {
  if (result?.meetingId && ['ingested', 'already_ingested'].includes(result.status)) {
    require('./botRecording')
      .copyBotRecording(sessionId)
      .catch((err) => log.warn('Bot recording copy failed', { sessionId, error: err.message }));
  }
  if (['empty', 'no_transcript'].includes(result?.status)) backupTakesOver(sessionId);
  return result;
}

/**
 * The bot will not write this meeting's minutes. If its owner also recorded the call in
 * the browser (services/meetingRecorder.js, "beside the bot"), that recording does.
 * Fire-and-forget; does nothing when there is no such recording.
 */
function backupTakesOver(sessionId) {
  require('./meetingRecorder')
    .botCouldNotDeliver({ sessionId })
    .catch((err) => log.warn('Backup recording could not take over', { sessionId, error: err.message }));
}

/** Lazy: transcriptIngest requires the meetings route, which must not load at require time here. */
function transcriptIngest() {
  return require('./transcriptIngest');
}

/**
 * Re-run transcript ingestion for a finished session (admin retry). Asks Recall for the
 * bot again, because the stored transcript_url is pre-signed and may have expired.
 *
 * @param {string} sessionId
 */
async function ingestSessionTranscript(sessionId) {
  const { data: session, error } = await db()
    .from('bot_sessions')
    .select('id, recall_bot_id, retention_deleted_at')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!session) return { status: 'not_found' };
  if (session.retention_deleted_at) return { status: 'retention_deleted' };
  if (!session.recall_bot_id) return { status: 'no_bot' };

  const fullBot = await recallFetch(`/bot/${session.recall_bot_id}`);
  const rec = Array.isArray(fullBot?.recordings) ? fullBot.recordings[0] : null;
  const transcriptUrl = rec?.media_shortcuts?.transcript?.data?.download_url || rec?.transcript?.url;
  if (!transcriptUrl) return { status: 'no_transcript' };
  return afterIngest(sessionId, await transcriptIngest().ingestBotTranscript(sessionId, { transcriptUrl }));
}

module.exports = {
  launchBotSession,
  rescheduleBotSession,
  stopBotSession,
  setRecordingPaused,
  addMark,
  listActiveSessions,
  getRecallBotState,
  handleRecallWebhook,
  ingestSessionTranscript,
  resolveAttendeeFromToken,
  recordAttendeeOptOut,
  _internal: {
    mapRecallStatus,
    mapRecallEvent,
    realtimeUrl,
    recallFetch,
    latestRecallStatusCode,
    resolveSessionFromPayload,
    renderAnnouncement,
    resolveAnnouncementMessage,
    DEFAULT_ANNOUNCEMENT_TEMPLATE,
    generateOptOutToken,
    hashOptOutToken,
    normalizeEmail,
    normalizeEmailList,
    sendOptOutEmailsForSession
  }
};
