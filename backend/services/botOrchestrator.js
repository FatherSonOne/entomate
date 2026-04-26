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

const RECALL_API_BASE = process.env.RECALL_API_BASE || 'https://us-west-2.recall.ai/api/v1';
const DEFAULT_BOT_NAME = 'Meet Mate';

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
 * @param {Object} p
 * @param {string} p.workspaceId
 * @param {string} p.meetingId
 * @param {string} p.meetingUrl
 * @param {'meet'|'zoom'|'teams'} p.platform
 * @param {string} [p.botName]
 * @returns {Promise<{sessionId: string, recallBotId: string}>}
 */
async function launchBotSession(p) {
  const { workspaceId, meetingId, meetingUrl, platform, botName } = p || {};
  if (!workspaceId || !meetingId || !meetingUrl || !platform) {
    throw new Error('launchBotSession: workspaceId, meetingId, meetingUrl, platform are required');
  }
  if (!['meet', 'zoom', 'teams'].includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const sessionId = crypto.randomUUID();

  const { error: insertErr } = await db()
    .from('bot_sessions')
    .insert({
      id: sessionId,
      org_id: workspaceId,
      meeting_id: meetingId,
      platform,
      status: 'pending',
      meeting_url: meetingUrl,
      callback_token_hash: 'recall' // legacy column; not used in Recall path
    });
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
  return { sessionId, recallBotId: bot.id };
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
 * Map Recall's status codes to our bot_sessions.status enum.
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
  const statusCode = data?.status?.code;
  const mapped = mapRecallStatus(statusCode);

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
  _internal: { mapRecallStatus, recallFetch, latestRecallStatusCode, resolveSessionFromPayload }
};
