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
 *   RECALL_API_KEY         — required, from Recall.ai dashboard
 *   RECALL_API_BASE        — default https://us-east-1.recall.ai/api/v1
 *   RECALL_WEBHOOK_TOKEN   — random secret matched in webhook URL query
 *   BOT_CALLBACK_BASE_URL  — public URL of this backend (for webhook)
 */

'use strict';

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');

const RECALL_API_BASE = process.env.RECALL_API_BASE || 'https://us-west-2.recall.ai/api/v1';
const CALLBACK_BASE = process.env.BOT_CALLBACK_BASE_URL || '';
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

function webhookUrl(sessionId) {
  if (!CALLBACK_BASE) return '';
  const token = process.env.RECALL_WEBHOOK_TOKEN || '';
  const params = new URLSearchParams({ session: sessionId });
  if (token) params.set('token', token);
  return `${CALLBACK_BASE}/api/admin/bots/recall-webhook?${params.toString()}`;
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
    webhook_url: webhookUrl(sessionId),
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

/**
 * Stop a running bot session.
 */
async function stopBotSession(sessionId, reason = 'manual_stop') {
  const { data: session, error } = await db()
    .from('bot_sessions')
    .select('recall_bot_id, status')
    .eq('id', sessionId)
    .single();
  if (error || !session) throw new Error(`Session not found: ${sessionId}`);
  if (!session.recall_bot_id) throw new Error(`Session ${sessionId} has no recall_bot_id`);

  await recallFetch(`/bot/${session.recall_bot_id}/leave_call`, { method: 'POST' });

  const { error: updErr } = await db()
    .from('bot_sessions')
    .update({ status: 'stopped', failure_reason: reason, ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (updErr) log.warn('bot_sessions post-stop update failed', { sessionId, error: updErr.message });

  log.info('Recall bot stopped', { sessionId, recallBotId: session.recall_bot_id, reason });
  return { sessionId, recallBotId: session.recall_bot_id };
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
 * Process an inbound Recall webhook event. The token query param is
 * verified by the route layer before this is called.
 *
 * @param {string} sessionId — from webhook URL ?session=...
 * @param {Object} payload   — Recall webhook body (event + data)
 */
async function handleRecallWebhook(sessionId, payload) {
  if (!sessionId) throw new Error('Missing session id');

  const event = payload?.event;
  const data = payload?.data || {};
  const statusCode = data?.status?.code;
  const mapped = mapRecallStatus(statusCode);

  log.info('Recall webhook', { sessionId, event, statusCode, mapped });

  const update = {};
  if (mapped) update.status = mapped;
  if (mapped && ['completed', 'failed', 'stopped', 'timeout'].includes(mapped)) {
    update.ended_at = new Date().toISOString();
  }

  // Recall sends the recording URL on bot.done or bot.recording.done
  if (event === 'bot.done' || event === 'bot.recording.done') {
    if (data?.recording?.media_url) update.recording_url = data.recording.media_url;
    if (data?.transcript?.url) update.transcript_url = data.transcript.url;
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

  return { ok: true };
}

module.exports = {
  launchBotSession,
  stopBotSession,
  listActiveSessions,
  getRecallBotState,
  handleRecallWebhook,
  _internal: { mapRecallStatus, recallFetch }
};
