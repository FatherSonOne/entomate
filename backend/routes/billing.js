const express = require('express');
const { authenticate, authorizeOrgRole } = require('../middleware/auth');
const billing = require('../services/stripeBilling');
const log = require('../utils/log');

const router = express.Router();

const ADMIN_ROLES = ['owner', 'admin'];
const MEMBER_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];
const orgFromBody = (req) => req.body?.workspaceId || null;
const orgFromQuery = (req) => req.query?.workspaceId || null;

function sendError(res, err, what, orgId) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  log.error(`[Billing] ${what} failed`, { orgId, error: err.message });
  return res.status(500).json({ error: `Could not ${what.toLowerCase()}. Try again.` });
}

/**
 * GET /api/billing/status?workspaceId=
 * Plan, bot hours this month, subscription state, and whether the caller may
 * manage billing. Any member of the org.
 */
router.get('/status', authenticate, authorizeOrgRole(MEMBER_ROLES, orgFromQuery), async (req, res) => {
  try {
    res.json(await billing.getStatus({ orgId: req.orgId, role: req.orgRole }));
  } catch (err) {
    sendError(res, err, 'Load billing', req.orgId);
  }
});

/**
 * POST /api/billing/portal  { workspaceId }
 * Returns { url } of a Stripe Customer Portal session. Owners and admins only.
 */
router.post('/portal', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromBody), async (req, res) => {
  try {
    res.json(await billing.createPortalSession({ orgId: req.orgId }));
  } catch (err) {
    sendError(res, err, 'Open the billing portal', req.orgId);
  }
});

/**
 * POST /api/billing/checkout  { workspaceId, item }
 * item: solo_monthly | solo_yearly | team_monthly | team_yearly | bot_pack_10.
 * Returns { id, url } of a Stripe Checkout session. Owners and admins only.
 */
router.post('/checkout', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromBody), async (req, res) => {
  try {
    const session = await billing.createCheckoutSession({
      orgId: req.orgId,
      itemKey: req.body?.item,
      email: req.user?.email,
    });
    res.json(session);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    log.error('[Billing] Checkout failed', { orgId: req.orgId, error: err.message });
    res.status(500).json({ error: 'Could not start checkout. Try again.' });
  }
});

/**
 * POST /api/billing/webhook — Stripe events. Public: the Stripe-Signature
 * header is checked over the exact request bytes (req.rawBody, server.js).
 */
router.post('/webhook', async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const stripe = billing.getStripe();
  if (!secret || !stripe) {
    log.error('Stripe webhook rejected: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET unset');
    return res.status(500).json({ error: 'Stripe webhook not configured' });
  }
  if (!req.rawBody) {
    log.error('Stripe webhook rejected: req.rawBody missing — verify express.json setup');
    return res.status(500).json({ error: 'Raw body not captured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], secret);
  } catch (err) {
    log.warn('Stripe webhook rejected: signature verification failed', { error: err.message });
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const result = await billing.handleEvent(event);
    log.info('[Billing] Stripe event handled', { id: event.id, type: event.type, result });
    res.json({ received: true });
  } catch (err) {
    // A 5xx makes Stripe retry the event later.
    log.error('[Billing] Stripe event failed', { id: event.id, type: event.type, error: err.message });
    res.status(500).json({ error: 'Event not processed' });
  }
});

module.exports = router;
