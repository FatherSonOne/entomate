/**
 * Public consent / opt-out routes — mounted at /api/consent.
 *
 * No auth: the opt-out token IS the auth. The token is generated at
 * launch time (botOrchestrator.sendOptOutEmailsForSession), embedded in
 * the email link, and never persisted in raw form — only the sha256
 * hash is stored on bot_session_attendees.
 *
 * The companion frontend page lives at frontend/src/pages/OptOut.jsx
 * and is routed under React Router's public branch in App.jsx at
 * /opt-out/:token.
 */

const express = require('express');
const orchestrator = require('../services/botOrchestrator');
const log = require('../utils/log');

const router = express.Router();

/**
 * GET /api/consent/opt-out/:token
 *
 * Return the minimum context the opt-out page needs to render:
 *   - the recipient's own email address
 *   - the organizer's display name
 *   - whether they've already opted out (and when)
 *   - meeting platform + launch time
 *
 * Deliberately does NOT return: meeting URL (would let anyone with the
 * link crash the meeting), session id (no benefit, mild leak), workspace
 * id, attendee id.
 */
router.get('/opt-out/:token', async (req, res) => {
  try {
    const ctx = await orchestrator.resolveAttendeeFromToken(req.params.token);
    if (!ctx) return res.status(404).json({ error: 'invalid_or_expired_token' });
    res.json({
      email: ctx.email,
      organizerName: ctx.organizerName,
      meetingPlatform: ctx.meetingPlatform,
      meetingTime: ctx.meetingTime,
      alreadyOptedOut: ctx.alreadyOptedOut,
      optedOutAt: ctx.optedOutAt
    });
  } catch (err) {
    log.error('Opt-out lookup failed', { error: err.message });
    res.status(500).json({ error: 'lookup_failed' });
  }
});

/**
 * POST /api/consent/opt-out/:token
 *
 * Record the opt-out. Idempotent — re-clicking the same link returns
 * { ok: true, alreadyOptedOut: true } without re-firing the organizer
 * notification.
 *
 * Body (all optional):
 *   { reason?: string }   free-text, capped at 1000 chars by the orchestrator
 */
router.post('/opt-out/:token', async (req, res) => {
  try {
    const reason = req.body?.reason || null;
    // Express's req.ip respects trust proxy when configured (server.js
    // sets it via TRUST_PROXY env). Fine to record as-is for audit.
    const ip = req.ip || null;

    const result = await orchestrator.recordAttendeeOptOut(req.params.token, {
      reason, ip
    });
    if (!result.ok) {
      const status = result.error === 'not_found' ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }
    res.json({ ok: true, alreadyOptedOut: result.alreadyOptedOut });
  } catch (err) {
    log.error('Opt-out record failed', { error: err.message });
    res.status(500).json({ error: 'record_failed' });
  }
});

module.exports = router;
