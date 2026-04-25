/**
 * Bot Orchestrator — Fly.io Machines client.
 *
 * Launches per-session meeting bots as ephemeral Fly Machines, tracks state
 * in the `bot_sessions` table, and exposes launch / stop / list / logs for
 * admin operations and future schedulers.
 *
 * See docs/plans/ENTOMATE_GAP_CLOSING_PLAN.md (P1.1) and
 * docs/runbooks/BOT_OPS.md.
 */

'use strict';

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');

// All bot_sessions mutations bypass RLS; end-user reads go through the public
// anon client elsewhere via the `bot_sessions_select` policy.
const db = () => {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_KEY is not set');
  return supabaseAdmin;
};

const FLY_API = 'https://api.machines.dev/v1';
const APP = process.env.FLY_BOT_APP_NAME || 'entomate-bot-fleet';
const IMAGE = process.env.FLY_BOT_IMAGE || `registry.fly.io/${APP}:latest`;
const REGION = process.env.FLY_BOT_REGION || 'sjc';
const CALLBACK_BASE = process.env.BOT_CALLBACK_BASE_URL || '';
const DEFAULT_MAX_DURATION_MS = 3 * 60 * 60 * 1000;

function authHeaders() {
  const token = process.env.FLY_API_TOKEN;
  if (!token) throw new Error('FLY_API_TOKEN is not set');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function flyFetch(path, options = {}) {
  const res = await fetch(`${FLY_API}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fly API ${res.status} @ ${path}: ${text.slice(0, 500)}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Launch a new bot session.
 *
 * @param {Object} p
 * @param {string} p.workspaceId   org_id
 * @param {string} p.meetingId
 * @param {string} p.meetingUrl
 * @param {'meet'|'zoom'|'teams'} p.platform
 * @param {string} [p.botName]
 * @param {number} [p.maxDurationMs]
 * @returns {Promise<{sessionId: string, machineId: string}>}
 */
async function launchBotSession(p) {
  const { workspaceId, meetingId, meetingUrl, platform, botName, maxDurationMs } = p || {};
  if (!workspaceId || !meetingId || !meetingUrl || !platform) {
    throw new Error('launchBotSession: workspaceId, meetingId, meetingUrl, platform are required');
  }
  if (!['meet', 'zoom', 'teams'].includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const sessionId = crypto.randomUUID();
  const callbackToken = crypto.randomBytes(32).toString('hex');

  const { error: insertErr } = await db()
    .from('bot_sessions')
    .insert({
      id: sessionId,
      org_id: workspaceId,
      meeting_id: meetingId,
      platform,
      status: 'pending',
      meeting_url: meetingUrl,
      callback_token_hash: hashToken(callbackToken)
    });
  if (insertErr) throw new Error(`bot_sessions insert failed: ${insertErr.message}`);

  // Meet Mate identity creds are passed through from backend env to the
  // Machine. They live on the backend as MEET_MATE_*, mirrored 1:1 into the
  // Machine's env so the bot doesn't have to translate naming.
  const meetMateEmail = process.env.MEET_MATE_EMAIL || '';
  const meetMatePassword = process.env.MEET_MATE_PASSWORD || '';
  const meetMateTotpSecret = process.env.MEET_MATE_TOTP_SECRET || '';
  const meetMateDisplayName =
    botName || process.env.MEET_MATE_DISPLAY_NAME || 'Meet Mate';

  if (!meetMateEmail || !meetMatePassword || !meetMateTotpSecret) {
    log.warn('Bot launch missing Meet Mate identity env — bot will fail at login', {
      sessionId,
      hasEmail: Boolean(meetMateEmail),
      hasPassword: Boolean(meetMatePassword),
      hasTotpSecret: Boolean(meetMateTotpSecret)
    });
  }

  const machineConfig = {
    region: REGION,
    config: {
      image: IMAGE,
      auto_destroy: true,
      restart: { policy: 'no' },
      guest: { cpu_kind: 'shared', cpus: 2, memory_mb: 4096 },
      env: {
        BOT_SESSION_ID: sessionId,
        BOT_WORKSPACE_ID: workspaceId,
        BOT_MEETING_ID: meetingId,
        BOT_MEETING_URL: meetingUrl,
        BOT_PLATFORM: platform,
        BOT_MAX_DURATION_MS: String(maxDurationMs || DEFAULT_MAX_DURATION_MS),
        BOT_CALLBACK_URL: CALLBACK_BASE
          ? `${CALLBACK_BASE}/api/admin/bots/${sessionId}/callback`
          : '',
        BOT_CALLBACK_TOKEN: callbackToken,

        // Meet Mate identity — consumed by src/drivers/<platform>.js (P1.2 Pass 2)
        MEET_MATE_EMAIL: meetMateEmail,
        MEET_MATE_PASSWORD: meetMatePassword,
        MEET_MATE_TOTP_SECRET: meetMateTotpSecret,
        MEET_MATE_DISPLAY_NAME: meetMateDisplayName
      },
      metadata: { session_id: sessionId, workspace_id: workspaceId, platform }
    }
  };

  let machine;
  try {
    machine = await flyFetch(`/apps/${APP}/machines`, {
      method: 'POST',
      body: JSON.stringify(machineConfig)
    });
  } catch (err) {
    await db()
      .from('bot_sessions')
      .update({
        status: 'failed',
        failure_reason: `launch_failed: ${err.message}`,
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);
    log.error('Bot launch failed', { sessionId, error: err.message });
    throw err;
  }

  const { error: updErr } = await db()
    .from('bot_sessions')
    .update({ status: 'launching', machine_id: machine.id, started_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (updErr) log.warn('bot_sessions post-launch update failed', { sessionId, error: updErr.message });

  log.info('Bot session launched', { sessionId, machineId: machine.id, platform });
  return { sessionId, machineId: machine.id };
}

/**
 * Stop a running bot session (manual kill via admin).
 */
async function stopBotSession(sessionId, reason = 'manual_stop') {
  const { data: session, error } = await db()
    .from('bot_sessions')
    .select('machine_id, status')
    .eq('id', sessionId)
    .single();
  if (error || !session) throw new Error(`Session not found: ${sessionId}`);
  if (!session.machine_id) throw new Error(`Session ${sessionId} has no machine_id`);

  await flyFetch(`/apps/${APP}/machines/${session.machine_id}?force=true`, { method: 'DELETE' });

  const { error: updErr } = await db()
    .from('bot_sessions')
    .update({ status: 'stopped', failure_reason: reason, ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (updErr) log.warn('bot_sessions post-stop update failed', { sessionId, error: updErr.message });

  log.info('Bot session stopped', { sessionId, machineId: session.machine_id, reason });
  return { sessionId, machineId: session.machine_id };
}

async function listActiveSessions() {
  const { data, error } = await db()
    .from('bot_sessions')
    .select('*')
    .not('status', 'in', '(completed,failed,stopped,timeout)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getSessionLogs(sessionId, limit = 500) {
  const { data: session, error } = await db()
    .from('bot_sessions')
    .select('machine_id')
    .eq('id', sessionId)
    .single();
  if (error || !session?.machine_id) throw new Error(`Session ${sessionId} has no machine_id`);
  return flyFetch(`/apps/${APP}/machines/${session.machine_id}/logs?limit=${limit}`);
}

/**
 * Bot → orchestrator status callback. Token is verified against
 * bot_sessions.callback_token_hash (SHA-256).
 */
async function handleBotCallback(sessionId, rawToken, payload) {
  if (!sessionId || !rawToken) throw new Error('Missing session or token');

  const { data: session, error } = await db()
    .from('bot_sessions')
    .select('callback_token_hash, status')
    .eq('id', sessionId)
    .single();
  if (error || !session) throw new Error('Session not found');

  const provided = hashToken(rawToken);
  if (
    provided.length !== session.callback_token_hash.length ||
    !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(session.callback_token_hash))
  ) {
    throw new Error('Invalid callback token');
  }

  const update = { last_callback_at: new Date().toISOString() };
  if (payload?.status) update.status = payload.status;
  if (payload?.error) update.failure_reason = payload.error;
  if (['completed', 'failed', 'timeout', 'stopped'].includes(payload?.status)) {
    update.ended_at = new Date().toISOString();
  }

  const { error: updErr } = await db()
    .from('bot_sessions')
    .update(update)
    .eq('id', sessionId);
  if (updErr) throw updErr;

  return { ok: true };
}

module.exports = {
  launchBotSession,
  stopBotSession,
  listActiveSessions,
  getSessionLogs,
  handleBotCallback,
  _internal: { hashToken, flyFetch }
};
