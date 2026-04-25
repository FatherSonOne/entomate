/**
 * Bot admin routes — mounted at /api/admin/bots.
 *
 * Recall.ai-backed (after pivoting from in-house Fly bots, see
 * botOrchestrator.js header). Admin endpoints unchanged externally;
 * the callback endpoint is replaced by a Recall webhook receiver
 * authenticated by a shared token in the URL query string.
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const orchestrator = require('../services/botOrchestrator');
const log = require('../utils/log');

const router = express.Router();

/** POST /api/admin/bots/launch — launch a new bot session. */
router.post('/launch', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { workspaceId, meetingId, meetingUrl, platform, botName } = req.body || {};
    const result = await orchestrator.launchBotSession({
      workspaceId, meetingId, meetingUrl, platform, botName
    });
    res.status(201).json(result);
  } catch (err) {
    log.error('Bot launch failed', { error: err.message });
    res.status(400).json({ error: 'Bot launch failed', message: err.message });
  }
});

/** GET /api/admin/bots — list active sessions. */
router.get('/', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const sessions = await orchestrator.listActiveSessions();
    res.json({ sessions });
  } catch (err) {
    log.error('Bot list failed', { error: err.message });
    res.status(500).json({ error: 'Bot list failed', message: err.message });
  }
});

/** DELETE /api/admin/bots/:sessionId — stop. */
router.delete('/:sessionId', authenticate, authorize(['admin']), async (req, res) => {
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
router.get('/:sessionId/state', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const state = await orchestrator.getRecallBotState(req.params.sessionId);
    res.json(state);
  } catch (err) {
    log.error('Bot state failed', { error: err.message });
    res.status(400).json({ error: 'Bot state failed', message: err.message });
  }
});

/**
 * POST /api/admin/bots/recall-webhook?session=<id>&token=<secret>
 *
 * Recall posts status events here. Token in query string is matched
 * against RECALL_WEBHOOK_TOKEN env (set on this backend + as part of
 * webhook_url passed to Recall at bot launch).
 */
router.post('/recall-webhook', async (req, res) => {
  try {
    const { session, token } = req.query;
    const expected = process.env.RECALL_WEBHOOK_TOKEN || '';
    if (!session) {
      return res.status(400).json({ error: 'Missing session query param' });
    }
    if (expected && token !== expected) {
      log.warn('Recall webhook rejected: bad token', { session });
      return res.status(401).json({ error: 'Invalid webhook token' });
    }

    const result = await orchestrator.handleRecallWebhook(String(session), req.body || {});
    res.json(result);
  } catch (err) {
    log.warn('Recall webhook handler failed', { error: err.message });
    res.status(400).json({ error: 'Webhook handler failed', message: err.message });
  }
});

module.exports = router;
