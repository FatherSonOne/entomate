/**
 * Bot admin routes — mounted at /api/admin/bots.
 *
 * All management endpoints are admin-only; the callback endpoint is
 * authenticated by the bearer token baked into the Machine at launch
 * (verified inside the orchestrator).
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const orchestrator = require('../services/botOrchestrator');
const log = require('../utils/log');

const router = express.Router();

/** POST /api/admin/bots/launch — manually launch a bot session. */
router.post('/launch', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { workspaceId, meetingId, meetingUrl, platform, botName, maxDurationMs } = req.body || {};
    const result = await orchestrator.launchBotSession({
      workspaceId, meetingId, meetingUrl, platform, botName, maxDurationMs
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

/** DELETE /api/admin/bots/:sessionId — manual kill. */
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

/** GET /api/admin/bots/:sessionId/logs — recent Fly logs. */
router.get('/:sessionId/logs', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 5000);
    const logs = await orchestrator.getSessionLogs(req.params.sessionId, limit);
    res.json({ logs });
  } catch (err) {
    log.error('Bot logs failed', { error: err.message });
    res.status(400).json({ error: 'Bot logs failed', message: err.message });
  }
});

/**
 * POST /api/admin/bots/:sessionId/callback — bot status ping.
 *
 * Called from inside the running Machine with its bearer token. Not gated by
 * the Supabase auth middleware — token is matched against the row's
 * callback_token_hash inside the orchestrator.
 */
router.post('/:sessionId/callback', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }
    const token = auth.slice(7);
    const result = await orchestrator.handleBotCallback(req.params.sessionId, token, req.body || {});
    res.json(result);
  } catch (err) {
    log.warn('Bot callback rejected', { error: err.message });
    res.status(401).json({ error: 'Callback rejected', message: err.message });
  }
});

module.exports = router;
