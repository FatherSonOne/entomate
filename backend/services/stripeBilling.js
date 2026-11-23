/**
 * Stripe billing (billing rebuild, Phase 3).
 *
 * Prices are found by lookup key, so the backend needs only STRIPE_SECRET_KEY
 * and STRIPE_WEBHOOK_SECRET; test mode and live mode use the same keys below.
 * scripts/stripe-bootstrap-prices.js creates the products and prices.
 *
 * The webhook is the only writer of tenant_organizations.plan / stripe_* for
 * paid plans (as service_role; the billing guard trigger refuses user JWTs).
 */
const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');

// Checkout item -> Stripe price lookup key and what it buys.
const ITEMS = {
  solo_monthly: { lookupKey: 'entomate_solo_monthly', mode: 'subscription', plan: 'solo' },
  solo_yearly: { lookupKey: 'entomate_solo_yearly', mode: 'subscription', plan: 'solo' },
  team_monthly: { lookupKey: 'entomate_team_monthly', mode: 'subscription', plan: 'team' },
  team_yearly: { lookupKey: 'entomate_team_yearly', mode: 'subscription', plan: 'team' },
  bot_pack_10: { lookupKey: 'entomate_bot_pack_10', mode: 'payment', hours: 10 },
};

const PLAN_BY_LOOKUP_KEY = Object.fromEntries(
  Object.values(ITEMS).filter((i) => i.plan).map((i) => [i.lookupKey, i.plan])
);

// A subscription in one of these states keeps its plan. past_due keeps it while
// Stripe retries the card; canceled / unpaid / incomplete_expired drop to free.
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

let client;
function getStripe() {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? require('stripe')(key) : null;
  return client;
}

/** Tests only. */
function _setStripe(c) {
  client = c;
  priceCache.clear();
}

const priceCache = new Map();
const PRICE_TTL_MS = 10 * 60 * 1000;

async function priceIdFor(lookupKey) {
  const hit = priceCache.get(lookupKey);
  if (hit && Date.now() - hit.ts < PRICE_TTL_MS) return hit.id;
  const { data } = await getStripe().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const id = data[0]?.id || null;
  if (id) priceCache.set(lookupKey, { id, ts: Date.now() });
  return id;
}

async function loadOrg(orgId) {
  const { data, error } = await supabaseAdmin
    .from('tenant_organizations')
    .select('id, name, plan, stripe_customer_id, stripe_subscription_id, deleted_at')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw new Error(`org lookup failed: ${error.message}`);
  return data;
}

async function updateOrg(orgId, fields) {
  const { error } = await supabaseAdmin.from('tenant_organizations').update(fields).eq('id', orgId);
  if (error) throw new Error(`org update failed: ${error.message}`);
}

/** The org's Stripe customer; made (and saved) the first time it buys. */
async function ensureCustomer(org, email) {
  if (org.stripe_customer_id) {
    // A customer from the other Stripe mode (test vs live) or a deleted one
    // cannot check out; replace it.
    try {
      const existing = await getStripe().customers.retrieve(org.stripe_customer_id);
      if (!existing.deleted) return existing.id;
    } catch (err) {
      if (err.code !== 'resource_missing') throw err;
    }
    log.warn('[Billing] Saved Stripe customer not found; making a new one', { orgId: org.id });
    await updateOrg(org.id, { stripe_customer_id: null });
  }
  const customer = await getStripe().customers.create(
    { name: org.name, email: email || undefined, metadata: { org_id: org.id } },
    { idempotencyKey: `entomate-org-customer-${org.id}-${org.stripe_customer_id || 'new'}` }
  );
  // Only fill an empty column, so two checkouts at once cannot swap customers.
  const { error } = await supabaseAdmin
    .from('tenant_organizations')
    .update({ stripe_customer_id: customer.id })
    .eq('id', org.id)
    .is('stripe_customer_id', null);
  if (error) throw new Error(`saving the Stripe customer failed: ${error.message}`);
  const fresh = await loadOrg(org.id);
  return fresh?.stripe_customer_id || customer.id;
}

/**
 * Why this org may not buy this item, or null. Returns { status, message }.
 */
function refusal(org, item) {
  if (org.deleted_at) return { status: 409, message: 'This workspace is deleted.' };
  if (org.plan === 'ecosystem') {
    return { status: 409, message: 'This workspace is on the ecosystem bundle. Contact us to change it.' };
  }
  if (item.mode === 'payment' && !['solo', 'team'].includes(org.plan)) {
    return { status: 403, message: 'Extra bot hours are for the Solo and Team plans. Choose a plan first.' };
  }
  if (item.mode === 'subscription' && org.stripe_subscription_id && ['solo', 'team'].includes(org.plan)) {
    return { status: 409, message: 'This workspace already has a plan. Change it from the billing portal.' };
  }
  return null;
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/**
 * Make a Checkout session for an org. Throws { status, message } errors for
 * the route to return.
 */
async function createCheckoutSession({ orgId, itemKey, email }) {
  const item = Object.prototype.hasOwnProperty.call(ITEMS, itemKey) ? ITEMS[itemKey] : null;
  if (!item) throw Object.assign(new Error(`Unknown item. Use one of: ${Object.keys(ITEMS).join(', ')}`), { status: 400 });
  if (!getStripe()) throw Object.assign(new Error('Billing is not configured on this server.'), { status: 503 });

  const org = await loadOrg(orgId);
  if (!org) throw Object.assign(new Error('Workspace not found.'), { status: 404 });
  const refused = refusal(org, item);
  if (refused) throw Object.assign(new Error(refused.message), { status: refused.status });

  const price = await priceIdFor(item.lookupKey);
  if (!price) {
    log.error('[Billing] Stripe price missing; run scripts/stripe-bootstrap-prices.js', { lookupKey: item.lookupKey });
    throw Object.assign(new Error('This plan is not available yet.'), { status: 503 });
  }

  const customer = await ensureCustomer(org, email);
  const metadata = { org_id: org.id, item: itemKey };
  const base = frontendUrl();
  const session = await getStripe().checkout.sessions.create({
    mode: item.mode,
    customer,
    client_reference_id: org.id,
    line_items: [{ price, quantity: 1 }],
    metadata,
    ...(item.mode === 'subscription'
      ? { subscription_data: { metadata } }
      : { payment_intent_data: { metadata } }),
    success_url: `${base}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/settings?billing=cancelled`,
  });
  return { id: session.id, url: session.url };
}

/**
 * Set the org's plan from the subscription's current state in Stripe. The
 * subscription is re-read, so a retried or out-of-order event gives the same
 * result.
 */
async function syncSubscription(subscriptionId, hintOrgId) {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;

  let orgId = sub.metadata?.org_id || hintOrgId || null;
  if (!orgId && customerId) {
    const { data } = await supabaseAdmin
      .from('tenant_organizations').select('id').eq('stripe_customer_id', customerId).maybeSingle();
    orgId = data?.id || null;
  }
  const org = orgId ? await loadOrg(orgId) : null;
  if (!org) {
    log.error('[Billing] Subscription has no known org; ignored', { subscriptionId, customerId });
    return { ignored: 'no_org' };
  }

  const lookupKey = sub.items?.data?.[0]?.price?.lookup_key;
  const plan = PLAN_BY_LOOKUP_KEY[lookupKey];

  if (LIVE_STATUSES.has(sub.status)) {
    if (!plan) {
      log.error('[Billing] Subscription price is not an Entomate plan; ignored', { subscriptionId, lookupKey });
      return { ignored: 'unknown_price' };
    }
    await updateOrg(org.id, { plan, stripe_customer_id: customerId, stripe_subscription_id: sub.id });
    return { orgId: org.id, plan };
  }

  // Ended. Drop to free only if this is still the org's subscription, so the
  // end of an old one cannot undo a newer one.
  if (org.stripe_subscription_id !== sub.id) return { ignored: 'not_current' };
  await updateOrg(org.id, { plan: 'free', stripe_subscription_id: null });
  return { orgId: org.id, plan: 'free' };
}

async function grantPack(session) {
  const item = ITEMS[session.metadata?.item];
  const orgId = session.metadata?.org_id;
  if (!item?.hours || !orgId) return { ignored: 'not_a_pack' };
  if (session.payment_status !== 'paid') return { ignored: 'not_paid' };
  const { data, error } = await supabaseAdmin.rpc('grant_stripe_bot_pack', {
    p_session_id: session.id,
    p_org_id: orgId,
    p_hours: item.hours,
  });
  if (error) throw new Error(`grant_stripe_bot_pack failed: ${error.message}`);
  return { orgId, granted: data === true };
}

/** Apply one verified Stripe event. Throws on a failure Stripe should retry. */
async function handleEvent(event) {
  const obj = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (obj.mode === 'payment') return grantPack(obj);
      if (obj.mode === 'subscription' && obj.subscription) {
        const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id;
        return syncSubscription(subId, obj.metadata?.org_id || obj.client_reference_id);
      }
      return { ignored: 'mode' };
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return syncSubscription(obj.id);
    default:
      return { ignored: 'event_type' };
  }
}

module.exports = { ITEMS, getStripe, createCheckoutSession, handleEvent, syncSubscription, _setStripe };
