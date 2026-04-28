/**
 * GDPR data-deletion routes — mounted at /api/consent/data-deletion.
 *
 * - POST /              public; records a request and notifies platform admins.
 * - GET /admin          platform-admin-only; lists pending requests.
 * - POST /admin/:id/fulfill  platform-admin-only; fans the delete out.
 * - POST /admin/:id/deny      platform-admin-only; records denial reason.
 *
 * Admin endpoints are gated by the `platform_admins` table — see
 * backend/middleware/authorizePlatformAdmin.js. Bootstrap the first
 * admin row by SQL insert (no UI for this).
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authorizePlatformAdmin } = require('../middleware/authorizePlatformAdmin');
const gdpr = require('../services/gdprService');
const log = require('../utils/log');

const router = express.Router();

/**
 * POST /api/consent/data-deletion
 * Public. Body: { email, reason? }
 */
router.post('/', async (req, res) => {
  try {
    const { email, reason } = req.body || {};
    const result = await gdpr.submitDeletionRequest({
      email,
      reason,
      ip: req.ip || null,
      userAgent: req.headers['user-agent'] || null
    });
    if (!result.ok) {
      const status = result.error === 'invalid_email' ? 400 : 500;
      return res.status(status).json({ error: result.error });
    }
    res.json({
      ok: true,
      requestId: result.requestId,
      message: 'Your request has been recorded. The workspace admin has been notified and will action it within 72 hours.'
    });
  } catch (err) {
    log.error('Data-deletion submit failed', { error: err.message });
    res.status(500).json({ error: 'submit_failed' });
  }
});

/**
 * GET /api/consent/data-deletion/admin
 * Platform admin: list pending requests.
 */
router.get('/admin', authenticate, authorizePlatformAdmin, async (req, res) => {
  try {
    const requests = await gdpr.listPendingRequests();
    res.json({ ok: true, requests });
  } catch (err) {
    log.error('Pending list failed', { error: err.message });
    res.status(500).json({ error: 'list_failed' });
  }
});

/**
 * POST /api/consent/data-deletion/admin/:id/fulfill
 * Platform admin: fan the delete out across attendees + sessions for
 * this email and stamp the request as fulfilled.
 */
router.post('/admin/:id/fulfill', authenticate, authorizePlatformAdmin, async (req, res) => {
  try {
    const result = await gdpr.fulfillDeletionRequest(req.params.id, req.user.id);
    if (!result.ok) {
      const status = result.error === 'not_found' ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }
    res.json({ ok: true, summary: result.summary });
  } catch (err) {
    log.error('Fulfill failed', { error: err.message });
    res.status(500).json({ error: 'fulfill_failed', message: err.message });
  }
});

/**
 * POST /api/consent/data-deletion/admin/:id/deny
 * Platform admin: deny the request with a documented reason.
 * Body: { reason: string }   required — denials need an Art. 17(3) basis.
 */
router.post('/admin/:id/deny', authenticate, authorizePlatformAdmin, async (req, res) => {
  try {
    const reason = req.body?.reason;
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({
        error: 'reason_required',
        message: 'A denial reason is required (GDPR Art. 17(3)).'
      });
    }
    const result = await gdpr.denyDeletionRequest(req.params.id, req.user.id, reason);
    if (!result.ok) {
      const status = result.error === 'not_found' ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }
    res.json({ ok: true });
  } catch (err) {
    log.error('Deny failed', { error: err.message });
    res.status(500).json({ error: 'deny_failed', message: err.message });
  }
});

module.exports = router;
