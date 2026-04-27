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

const db = () => {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_KEY is not set');
  return supabaseAdmin;
};

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
    participantEmails
  } = p || {};
  if (!workspaceId || !meetingId || !meetingUrl || !platform) {
    throw new Error('launchBotSession: workspaceId, meetingId, meetingUrl, platform are required');
  }
  if (!['meet', 'zoom', 'teams'].includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

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

  const { error: insertErr } = await db()
    .from('bot_sessions')
    .insert(insertRow);
  if (insertErr) throw new Error(`bot_sessions insert failed: ${insertErr.message}`);

  const recallPayload = {
    meeting_url: meetingUrl,
    bot_name: botName || DEFAULT_BOT_NAME,
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
            language: 'en',
            diarize: true
          }
        }
      }
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
    // auth_failed misleadingly on POST /bot/).
    bot = await recallFetch('/bot', {
      method: 'POST',
      body: JSON.stringify(recallPayload)
    });
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
    .select('recall_bot_id, status')
    .eq('id', sessionId)
    .single();
  if (error || !session) throw new Error(`Session not found: ${sessionId}`);
  if (!session.recall_bot_id) throw new Error(`Session ${sessionId} has no recall_bot_id`);

  let recallStatus = null;
  try {
    const bot = await recallFetch(`/bot/${session.recall_bot_id}`);
    recallStatus = latestRecallStatusCode(bot);
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

  if (recallStatus && PRE_CALL_STATUSES.has(recallStatus)) {
    await recallFetch(`/bot/${session.recall_bot_id}`, { method: 'DELETE' });
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

  const update = {};
  if (mapped) update.status = mapped;
  if (mapped && ['completed', 'failed', 'stopped', 'timeout'].includes(mapped)) {
    update.ended_at = new Date().toISOString();
  }

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

  if (event === 'bot.fatal' && data?.fatal_reason) {
    update.failure_reason = String(data.fatal_reason).slice(0, 500);
  }

  if (Object.keys(update).length > 0) {
    const { error: updErr } = await db()
      .from('bot_sessions')
      .update(update)
      .eq('id', sessionId);
    if (updErr) throw updErr;
  }

  return { ok: true, sessionId };
}

module.exports = {
  launchBotSession,
  stopBotSession,
  listActiveSessions,
  getRecallBotState,
  handleRecallWebhook,
  resolveAttendeeFromToken,
  recordAttendeeOptOut,
  _internal: {
    mapRecallStatus,
    mapRecallEvent,
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
