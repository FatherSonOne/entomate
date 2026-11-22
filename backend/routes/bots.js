/**
 * Bot admin routes — mounted at /api/admin/bots.
 *
 * Recall.ai-backed (after pivoting from in-house Fly bots, see
 * botOrchestrator.js header). Admin endpoints unchanged externally;
 * the callback endpoint is replaced by a Recall webhook receiver
 * authenticated by a shared token in the URL query string.
 *
 * Authorization: requester must be `owner` or `admin` of the workspace
 * (org) the bot belongs to. Source of truth is `org_members`, resolved
 * via `authorizeOrgRole`. The legacy `authorize(['admin'])` was a no-op
 * for real users since `user_metadata.role` is never populated.
 */

const express = require('express');
const { authenticate, authorizeOrgRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const orchestrator = require('../services/botOrchestrator');
const { buildBotView } = require('../services/botView');
const captions = require('../services/botCaptions');
const log = require('../utils/log');

const router = express.Router();

const ADMIN_ROLES = ['owner', 'admin'];
// Anyone in the workspace may read how a bot meeting went; only owners and admins send or stop bots.
const MEMBER_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];

const orgFromBody = (req) => req.body?.workspaceId || null;
const orgFromQuery = (req) => req.query?.workspaceId || null;

const orgFromSession = async (req) => {
  const sessionId = req.params?.sessionId;
  if (!sessionId || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('bot_sessions')
    .select('org_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) {
    log.warn('orgFromSession lookup failed', { sessionId, error: error.message });
    return null;
  }
  return data?.org_id || null;
};

const orgFromMeeting = async (req) => {
  const meetingId = req.params?.meetingId;
  if (!meetingId || !supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from('bot_sessions')
    .select('org_id')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.org_id || null;
};

const MEETING_FIELDS = 'id, org_id, title, summary, summary_template, decisions, attendees, transcript_segments, duration_minutes, recording_job';

/** Join a session with its meeting, action items and invitees, and build the view. */
async function viewsFor(sessions) {
  if (!sessions.length) return [];
  const meetingIds = sessions.map((s) => s.meeting_id).filter(Boolean);
  const sessionIds = sessions.map((s) => s.id);
  const [meetings, items, attendees] = await Promise.all([
    supabaseAdmin.from('meetings').select(MEETING_FIELDS).in('id', meetingIds),
    supabaseAdmin.from('action_items').select('id, meeting_id').in('meeting_id', meetingIds),
    supabaseAdmin.from('bot_session_attendees').select('session_id, email_status, opted_out_at').in('session_id', sessionIds)
  ]);
  for (const r of [meetings, items, attendees]) if (r.error) throw r.error;
  return sessions.map((session) => {
    // A meeting from another org with the same id is never shown (ingest refuses it too).
    const meeting = (meetings.data || []).find((m) => m.id === session.meeting_id && m.org_id === session.org_id) || null;
    return buildBotView({
      session,
      meeting,
      actionItems: meeting ? (items.data || []).filter((a) => a.meeting_id === meeting.id) : [],
      attendees: (attendees.data || []).filter((a) => a.session_id === session.id)
    });
  });
}

/**
 * GET /api/admin/bots/recent?workspaceId=<id> — the workspace's last bot runs
 * (live, scheduled and finished), newest first, for the Bot page and the
 * watcher that moves the app to a debrief when a call ends.
 */
router.get('/recent', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromQuery), async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 25);
    const { data, error } = await supabaseAdmin
      .from('bot_sessions')
      .select('*')
      .eq('org_id', req.orgId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ sessions: await viewsFor(data || []) });
  } catch (err) {
    log.error('Bot recent list failed', { error: err.message });
    res.status(500).json({ error: 'Bot list failed', message: err.message });
  }
});

/** GET /api/admin/bots/meeting/:meetingId — the bot run behind a meeting (live view or debrief). */
router.get('/meeting/:meetingId', authenticate, authorizeOrgRole(MEMBER_ROLES, orgFromMeeting), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_sessions')
      .select('*')
      .eq('org_id', req.orgId)
      .eq('meeting_id', req.params.meetingId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    const [view] = await viewsFor(data || []);
    if (!view) return res.status(404).json({ error: 'No bot session for this meeting' });
    res.json({ session: view, canControl: ADMIN_ROLES.includes(req.orgRole) });
  } catch (err) {
    log.error('Bot meeting view failed', { meetingId: req.params.meetingId, error: err.message });
    res.status(500).json({ error: 'Bot view failed', message: err.message });
  }
});

/** Lower-case emails of invitees who opted out, cached for a minute per session. */
const optOutCache = new Map();
async function optedOutFor(sessionId) {
  const hit = optOutCache.get(sessionId);
  if (hit && Date.now() - hit.at < 60 * 1000) return hit.emails;
  const { data, error } = await supabaseAdmin
    .from('bot_session_attendees')
    .select('email, opted_out_at')
    .eq('session_id', sessionId);
  // Unknown opt-outs: drop the caption rather than risk showing someone who opted out.
  if (error) throw error;
  const emails = new Set((data || []).filter((r) => r.opted_out_at && r.email).map((r) => String(r.email).trim().toLowerCase()));
  optOutCache.set(sessionId, { at: Date.now(), emails });
  if (optOutCache.size > 500) optOutCache.delete(optOutCache.keys().next().value);
  return emails;
}

/**
 * POST /api/admin/bots/realtime/:sessionId?token=<t> — Recall's real-time
 * transcript events (transcript.data) for live captions. Accepted with the
 * per-session token from the launch URL, or with Recall's workspace-secret
 * signature when RECALL_WORKSPACE_SECRET is set.
 */
router.post('/realtime/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const ok = captions.verifyToken(sessionId, req.query?.token)
    || captions.verifyWorkspaceSignature(req.headers, req.rawBody);
  if (!ok) return res.status(401).json({ error: 'Invalid realtime token' });
  try {
    if (req.body?.event === 'transcript.data') {
      captions.addTranscriptEvent(sessionId, req.body, await optedOutFor(sessionId));
    }
    res.json({ ok: true });
  } catch (err) {
    log.warn('Realtime caption event failed', { sessionId, error: err.message });
    res.json({ ok: false });
  }
});

/** GET /api/admin/bots/:sessionId/captions?after=<seq> — live caption lines since `after`. */
router.get('/:sessionId/captions', authenticate, authorizeOrgRole(MEMBER_ROLES, orgFromSession), async (req, res) => {
  try {
    const after = Math.max(0, Number(req.query.after) || 0);
    const optedOut = await optedOutFor(req.params.sessionId);
    res.json(captions.linesAfter(req.params.sessionId, after, { optOutsHidden: optedOut.size > 0 }));
  } catch (err) {
    log.error('Captions read failed', { error: err.message });
    res.status(500).json({ error: 'Captions failed' });
  }
});

/** POST /api/admin/bots/:sessionId/pause and /resume — pause or resume the recording. */
for (const action of ['pause', 'resume']) {
  router.post(`/:sessionId/${action}`, authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromSession), async (req, res) => {
    try {
      res.json(await orchestrator.setRecordingPaused(req.params.sessionId, action === 'pause'));
    } catch (err) {
      log.warn(`Bot ${action} failed`, { sessionId: req.params.sessionId, error: err.message });
      res.status(400).json({ error: `Bot ${action} failed`, message: err.message });
    }
  });
}

/** POST /api/admin/bots/:sessionId/marks — mark the current moment. Body: { note? }. */
router.post('/:sessionId/marks', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromSession), async (req, res) => {
  try {
    const mark = await orchestrator.addMark(req.params.sessionId, { note: req.body?.note, byUserId: req.user.id });
    res.status(201).json({ mark });
  } catch (err) {
    const unavailable = err.message === 'marks_unavailable';
    log.warn('Bot mark failed', { sessionId: req.params.sessionId, error: err.message });
    res.status(unavailable ? 503 : 400).json({ error: unavailable ? 'marks_unavailable' : 'Mark failed', message: err.message });
  }
});

/**
 * POST /api/admin/bots/launch — launch a new bot session.
 *
 * Body MUST include `consentAcknowledged: true` (strict boolean). This is
 * the P1.7 organizer-side consent gate: the launching user affirms they
 * have consent from all meeting participants before the bot is fired.
 * The acknowledgment (user_id + timestamp) is recorded on the
 * bot_sessions row for audit. See [docs/runbooks/BOT_OPS.md] for context.
 */
router.post('/launch', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromBody), async (req, res) => {
  try {
    const {
      workspaceId, meetingId, meetingUrl, platform, botName,
      consentAcknowledged, participantEmails
    } = req.body || {};
    if (consentAcknowledged !== true) {
      return res.status(400).json({
        error: 'consent_required',
        message: 'consentAcknowledged: true is required. The organizer must affirm participant consent before bot launch. See https://entomate.onrender.com/privacy for the recording disclosure.'
      });
    }
    const organizerName = req.user.firstName
      || (req.user.email ? req.user.email.split('@')[0] : null);
    const result = await orchestrator.launchBotSession({
      workspaceId, meetingId, meetingUrl, platform, botName,
      consentAcknowledgedBy: req.user.id,
      consentAcknowledgedByName: organizerName,
      consentAcknowledgedByEmail: req.user.email || null,
      participantEmails: Array.isArray(participantEmails) ? participantEmails : []
    });
    res.status(201).json(result);
  } catch (err) {
    log.error('Bot launch failed', { error: err.message });
    res.status(400).json({ error: 'Bot launch failed', message: err.message });
  }
});

/** GET /api/admin/bots?workspaceId=<id> — list active sessions for an org. */
router.get('/', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromQuery), async (req, res) => {
  try {
    const sessions = await orchestrator.listActiveSessions(req.orgId);
    res.json({ sessions });
  } catch (err) {
    log.error('Bot list failed', { error: err.message });
    res.status(500).json({ error: 'Bot list failed', message: err.message });
  }
});

/** DELETE /api/admin/bots/:sessionId — stop. */
router.delete('/:sessionId', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromSession), async (req, res) => {
  try {
    const reason = req.body?.reason || 'manual_stop';
    const result = await orchestrator.stopBotSession(req.params.sessionId, reason);
    res.json(result);
  } catch (err) {
    log.error('Bot stop failed', { error: err.message });
    res.status(400).json({ error: 'Bot stop failed', message: err.message });
  }
});

/** GET /api/admin/bots/:sessionId/state — fetch full Recall bot state. */
router.get('/:sessionId/state', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromSession), async (req, res) => {
  try {
    const state = await orchestrator.getRecallBotState(req.params.sessionId);
    res.json(state);
  } catch (err) {
    log.error('Bot state failed', { error: err.message });
    res.status(400).json({ error: 'Bot state failed', message: err.message });
  }
});

/**
 * POST /api/admin/bots/:sessionId/ingest — turn a finished session's transcript into a
 * meeting. Normally bot.done does this on its own; this is the retry for a missed or
 * failed ingest. Idempotent: a session already ingested answers `already_ingested`.
 */
router.post('/:sessionId/ingest', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromSession), async (req, res) => {
  try {
    const result = await orchestrator.ingestSessionTranscript(req.params.sessionId);
    const status = result.status === 'not_found' ? 404 : 200;
    res.status(status).json(result);
  } catch (err) {
    log.error('Bot transcript ingest failed', { sessionId: req.params.sessionId, error: err.message });
    res.status(502).json({ error: 'Transcript ingest failed', message: err.message });
  }
});

/**
 * POST /api/admin/bots/recall-webhook
 *
 * Recall posts status events here. The endpoint is workspace-wide — Recall
 * doesn't support per-bot webhook URLs (no `webhook_url` field on the bot
 * create endpoint). Configure the URL once in the Recall dashboard, paste
 * the Svix `whsec_…` secret it gives you into RECALL_WEBHOOK_SIGNING_SECRET
 * on this backend, and every bot in the workspace fires events here.
 *
 * Authentication is HMAC-SHA256 via Svix headers (svix-id, svix-timestamp,
 * svix-signature). The session is resolved from the payload itself, not
 * from URL query params.
 */
router.post('/recall-webhook', async (req, res) => {
  const secret = process.env.RECALL_WEBHOOK_SIGNING_SECRET || '';
  if (!secret) {
    log.error('Recall webhook rejected: RECALL_WEBHOOK_SIGNING_SECRET unset');
    return res.status(500).json({ error: 'Webhook signing secret not configured' });
  }

  // svix is loaded lazily so a missing dep doesn't crash the whole router on
  // boot — only this endpoint will 500 with a clear error.
  let Webhook;
  try {
    ({ Webhook } = require('svix'));
  } catch (err) {
    log.error('svix package missing — run `npm install svix`', { error: err.message });
    return res.status(500).json({ error: 'svix package not installed' });
  }

  // Signature is computed over the EXACT bytes Recall signed. server.js
  // stashes the buffer on req.rawBody via the express.json verify callback.
  const rawBody = req.rawBody;
  if (!rawBody) {
    log.error('Recall webhook rejected: req.rawBody missing — verify express.json setup');
    return res.status(500).json({ error: 'Raw body not captured' });
  }

  try {
    const wh = new Webhook(secret);
    // svix.verify throws on bad signature, missing headers, or stale timestamp.
    wh.verify(rawBody, req.headers);
  } catch (err) {
    log.warn('Recall webhook rejected: signature verification failed', { error: err.message });
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  try {
    const result = await orchestrator.handleRecallWebhook(req.body || {});
    res.json(result);
  } catch (err) {
    log.warn('Recall webhook handler failed', { error: err.message });
    res.status(400).json({ error: 'Webhook handler failed', message: err.message });
  }
});

module.exports = router;
