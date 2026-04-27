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
const log = require('../utils/log');

const router = express.Router();

const ADMIN_ROLES = ['owner', 'admin'];

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
