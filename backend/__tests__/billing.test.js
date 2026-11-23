/**
 * Stripe billing (billing rebuild, Phases 3 and 4): checkout refusals, webhook
 * signature check, pack grant once per session, plan set from the
 * subscription's state in Stripe, the drawer's status read and the portal.
 */
'use strict';

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';

// The caller's role in the org; the mock applies each route's real role list.
const mockAuth = { role: 'owner' };
jest.mock('../middleware/auth', () => ({
  authenticate: (req, _res, next) => { req.user = { id: 'user-1', email: 'owner@example.com' }; next(); },
  authorizeOrgRole: (roles, resolveOrgId) => async (req, res, next) => {
    if (!roles.includes(mockAuth.role)) return res.status(403).json({ error: 'Forbidden' });
    req.orgId = await resolveOrgId(req);
    req.orgRole = mockAuth.role;
    next();
  },
  optionalAuth: (_req, _res, next) => next(),
}));

jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

// In-memory tenant_organizations + rpc.
const mockDb = { orgs: {}, grants: new Set(), rpcCalls: [], updates: [], hours: null, hoursError: null };
jest.mock('../config/supabase', () => {
  const query = (table) => {
    const filters = [];
    let patch = null;
    const rows = () => Object.values(mockDb.orgs).filter((r) => filters.every(([op, c, v]) => (op === 'eq' ? r[c] === v : r[c] == null)));
    const q = {
      select: () => q,
      update: (p) => { patch = p; return q; },
      eq: (c, v) => { filters.push(['eq', c, v]); return q; },
      is: (c) => { filters.push(['is', c]); return q; },
      maybeSingle: async () => ({ data: rows()[0] ? { ...rows()[0] } : null, error: null }),
      then: (resolve) => {
        if (patch) { rows().forEach((r) => Object.assign(r, patch)); mockDb.updates.push({ table, patch }); }
        resolve({ error: null });
      },
    };
    return q;
  };
  const rpc = async (name, args) => {
    mockDb.rpcCalls.push({ name, args });
    if (name === 'get_org_bot_hours') return { data: mockDb.hours, error: mockDb.hoursError };
    if (mockDb.grants.has(args.p_session_id)) return { data: false, error: null };
    mockDb.grants.add(args.p_session_id);
    return { data: true, error: null };
  };
  return { supabaseAdmin: { from: query, rpc }, supabase: { from: query, rpc } };
});

const express = require('express');
const request = require('supertest');
const Stripe = require('stripe');
const billing = require('../services/stripeBilling');

const realStripe = Stripe('sk_test_dummy');
const subs = {};
const fakeStripe = {
  webhooks: realStripe.webhooks,
  prices: { list: jest.fn(async ({ lookup_keys }) => ({ data: [{ id: `price_${lookup_keys[0]}` }] })) },
  customers: {
    create: jest.fn(async () => ({ id: 'cus_new' })),
    retrieve: jest.fn(async (id) => {
      if (id === 'cus_gone') throw Object.assign(new Error('No such customer'), { code: 'resource_missing' });
      return { id };
    }),
  },
  checkout: { sessions: { create: jest.fn(async (p) => ({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1', params: p })) } },
  subscriptions: { retrieve: jest.fn(async (id) => subs[id]) },
  billingPortal: { sessions: { create: jest.fn(async () => ({ url: 'https://billing.stripe.test/p_1' })) } },
};

function app() {
  const a = express();
  a.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
  a.use('/api/billing', require('../routes/billing'));
  return a;
}

function signed(event) {
  const payload = JSON.stringify(event);
  const header = realStripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return { payload, header };
}

function postEvent(event) {
  const { payload, header } = signed(event);
  return request(app()).post('/api/billing/webhook')
    .set('Content-Type', 'application/json').set('Stripe-Signature', header).send(payload);
}

const ORG = '11111111-1111-4111-8111-111111111111';
function seedOrg(fields) {
  mockDb.orgs = { [ORG]: { id: ORG, name: 'Acme', plan: 'free', stripe_customer_id: null, stripe_subscription_id: null, deleted_at: null, ...fields } };
}

beforeEach(() => {
  mockDb.grants = new Set(); mockDb.rpcCalls = []; mockDb.updates = []; mockDb.hours = null; mockDb.hoursError = null;
  mockAuth.role = 'owner';
  billing._setStripe(fakeStripe);
  jest.clearAllMocks();
  seedOrg({});
});

describe('POST /api/billing/checkout', () => {
  test('503 when Stripe is not configured', async () => {
    billing._setStripe(null);
    const res = await request(app()).post('/api/billing/checkout').send({ workspaceId: ORG, item: 'solo_monthly' });
    expect(res.status).toBe(503);
  });

  test('400 for an unknown item', async () => {
    const res = await request(app()).post('/api/billing/checkout').send({ workspaceId: ORG, item: 'enterprise' });
    expect(res.status).toBe(400);
  });

  test('a Free org cannot buy a pack', async () => {
    const res = await request(app()).post('/api/billing/checkout').send({ workspaceId: ORG, item: 'bot_pack_10' });
    expect(res.status).toBe(403);
    expect(fakeStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  test('an org with a plan cannot open a second subscription', async () => {
    seedOrg({ plan: 'solo', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });
    const res = await request(app()).post('/api/billing/checkout').send({ workspaceId: ORG, item: 'team_monthly' });
    expect(res.status).toBe(409);
  });

  test('the ecosystem bundle cannot check out', async () => {
    seedOrg({ plan: 'ecosystem' });
    const res = await request(app()).post('/api/billing/checkout').send({ workspaceId: ORG, item: 'solo_monthly' });
    expect(res.status).toBe(409);
  });

  test('a Free org gets a subscription session tagged with its org, and its customer is saved', async () => {
    const res = await request(app()).post('/api/billing/checkout').send({ workspaceId: ORG, item: 'team_yearly' });
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:\/\/checkout/);
    const params = fakeStripe.checkout.sessions.create.mock.calls[0][0];
    expect(params).toMatchObject({
      mode: 'subscription',
      customer: 'cus_new',
      client_reference_id: ORG,
      line_items: [{ price: 'price_entomate_team_yearly', quantity: 1 }],
      subscription_data: { metadata: { org_id: ORG, item: 'team_yearly' } },
    });
    // Back to Settings with the Plan and billing drawer open.
    expect(params.success_url).toMatch(/\/settings\?s=workspace&dr=billing&billing=success&session_id=\{CHECKOUT_SESSION_ID\}$/);
    expect(params.cancel_url).toMatch(/\/settings\?s=workspace&dr=billing&billing=cancelled$/);
    expect(mockDb.orgs[ORG].stripe_customer_id).toBe('cus_new');
  });

  test('a Solo org gets a one-time pack session', async () => {
    seedOrg({ plan: 'solo', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });
    const res = await request(app()).post('/api/billing/checkout').send({ workspaceId: ORG, item: 'bot_pack_10' });
    expect(res.status).toBe(200);
    const params = fakeStripe.checkout.sessions.create.mock.calls[0][0];
    expect(params).toMatchObject({ mode: 'payment', customer: 'cus_1', payment_intent_data: { metadata: { org_id: ORG } } });
    expect(fakeStripe.customers.create).not.toHaveBeenCalled();
  });

  test('a member who is not an owner or admin cannot check out', async () => {
    mockAuth.role = 'member';
    const res = await request(app()).post('/api/billing/checkout').send({ workspaceId: ORG, item: 'solo_monthly' });
    expect(res.status).toBe(403);
    expect(fakeStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  test('a saved customer that Stripe cannot find (other mode) is replaced', async () => {
    seedOrg({ plan: 'solo', stripe_customer_id: 'cus_gone', stripe_subscription_id: 'sub_1' });
    const res = await request(app()).post('/api/billing/checkout').send({ workspaceId: ORG, item: 'bot_pack_10' });
    expect(res.status).toBe(200);
    expect(fakeStripe.customers.create).toHaveBeenCalledTimes(1);
    expect(fakeStripe.checkout.sessions.create.mock.calls[0][0].customer).toBe('cus_new');
    expect(mockDb.orgs[ORG].stripe_customer_id).toBe('cus_new');
  });
});

describe('POST /api/billing/webhook', () => {
  test('a bad signature is rejected', async () => {
    const res = await request(app()).post('/api/billing/webhook')
      .set('Content-Type', 'application/json').set('Stripe-Signature', 't=1,v1=bad').send('{"id":"evt_x"}');
    expect(res.status).toBe(400);
  });

  test('a body changed after signing is rejected', async () => {
    const { header } = signed({ id: 'evt_1', type: 'ping', data: { object: {} } });
    const res = await request(app()).post('/api/billing/webhook')
      .set('Content-Type', 'application/json').set('Stripe-Signature', header)
      .send(JSON.stringify({ id: 'evt_1', type: 'ping', data: { object: { tampered: true } } }));
    expect(res.status).toBe(400);
  });

  const packSession = (status = 'paid') => ({
    id: 'evt_pack', type: 'checkout.session.completed',
    data: { object: { id: 'cs_pack', mode: 'payment', payment_status: status, metadata: { org_id: ORG, item: 'bot_pack_10' } } },
  });

  test('a paid pack grants 10 hours once, however often the event comes', async () => {
    expect((await postEvent(packSession())).status).toBe(200);
    expect((await postEvent(packSession())).status).toBe(200);
    expect(mockDb.rpcCalls).toHaveLength(2);
    expect(mockDb.rpcCalls[0]).toEqual({ name: 'grant_stripe_bot_pack', args: { p_session_id: 'cs_pack', p_org_id: ORG, p_hours: 10 } });
    expect(mockDb.grants.size).toBe(1);
  });

  test('an unpaid pack session grants nothing', async () => {
    expect((await postEvent(packSession('unpaid'))).status).toBe(200);
    expect(mockDb.rpcCalls).toHaveLength(0);
  });

  const subEvent = (type, sub) => ({ id: `evt_${type}`, type, data: { object: sub } });

  test('a completed subscription checkout sets the plan from Stripe', async () => {
    subs.sub_1 = { id: 'sub_1', status: 'active', customer: 'cus_1', metadata: { org_id: ORG },
      items: { data: [{ price: { lookup_key: 'entomate_team_monthly' } }] } };
    const res = await postEvent({ id: 'evt_cs', type: 'checkout.session.completed',
      data: { object: { id: 'cs_sub', mode: 'subscription', subscription: 'sub_1', metadata: { org_id: ORG } } } });
    expect(res.status).toBe(200);
    expect(mockDb.orgs[ORG]).toMatchObject({ plan: 'team', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });
  });

  test('an event is applied from the current subscription, not the event body', async () => {
    seedOrg({ plan: 'team', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });
    subs.sub_1 = { id: 'sub_1', status: 'active', customer: 'cus_1', metadata: { org_id: ORG },
      items: { data: [{ price: { lookup_key: 'entomate_solo_yearly' } }] } };
    // Stale body says team; Stripe now says solo.
    await postEvent(subEvent('customer.subscription.updated', { id: 'sub_1', items: { data: [{ price: { lookup_key: 'entomate_team_monthly' } }] } }));
    expect(mockDb.orgs[ORG].plan).toBe('solo');
  });

  test('an org is found by its customer when the subscription has no org metadata', async () => {
    seedOrg({ stripe_customer_id: 'cus_9' });
    subs.sub_9 = { id: 'sub_9', status: 'active', customer: 'cus_9', metadata: {},
      items: { data: [{ price: { lookup_key: 'entomate_solo_monthly' } }] } };
    await postEvent(subEvent('customer.subscription.created', { id: 'sub_9' }));
    expect(mockDb.orgs[ORG]).toMatchObject({ plan: 'solo', stripe_subscription_id: 'sub_9' });
  });

  test('past_due keeps the plan', async () => {
    seedOrg({ plan: 'team', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });
    subs.sub_1 = { id: 'sub_1', status: 'past_due', customer: 'cus_1', metadata: { org_id: ORG },
      items: { data: [{ price: { lookup_key: 'entomate_team_monthly' } }] } };
    await postEvent(subEvent('customer.subscription.updated', { id: 'sub_1' }));
    expect(mockDb.orgs[ORG].plan).toBe('team');
  });

  test('the end of the current subscription drops the org to free', async () => {
    seedOrg({ plan: 'team', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });
    subs.sub_1 = { id: 'sub_1', status: 'canceled', customer: 'cus_1', metadata: { org_id: ORG },
      items: { data: [{ price: { lookup_key: 'entomate_team_monthly' } }] } };
    await postEvent(subEvent('customer.subscription.deleted', { id: 'sub_1' }));
    expect(mockDb.orgs[ORG]).toMatchObject({ plan: 'free', stripe_subscription_id: null, stripe_customer_id: 'cus_1' });
  });

  test('the end of an OLD subscription does not undo the current one', async () => {
    seedOrg({ plan: 'team', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_new' });
    subs.sub_old = { id: 'sub_old', status: 'canceled', customer: 'cus_1', metadata: { org_id: ORG },
      items: { data: [{ price: { lookup_key: 'entomate_solo_monthly' } }] } };
    await postEvent(subEvent('customer.subscription.deleted', { id: 'sub_old' }));
    expect(mockDb.orgs[ORG]).toMatchObject({ plan: 'team', stripe_subscription_id: 'sub_new' });
  });

  test('a price that is not an Entomate plan changes nothing', async () => {
    subs.sub_x = { id: 'sub_x', status: 'active', customer: 'cus_1', metadata: { org_id: ORG },
      items: { data: [{ price: { lookup_key: 'pulse_team' } }] } };
    await postEvent(subEvent('customer.subscription.created', { id: 'sub_x' }));
    expect(mockDb.orgs[ORG].plan).toBe('free');
    expect(mockDb.updates).toHaveLength(0);
  });

  test('a failure while applying an event returns 500 so Stripe retries', async () => {
    fakeStripe.subscriptions.retrieve.mockRejectedValueOnce(new Error('stripe down'));
    const res = await postEvent(subEvent('customer.subscription.updated', { id: 'sub_1' }));
    expect(res.status).toBe(500);
  });

  test('other event types are acknowledged and ignored', async () => {
    const res = await postEvent({ id: 'evt_i', type: 'invoice.paid', data: { object: {} } });
    expect(res.status).toBe(200);
    expect(mockDb.updates).toHaveLength(0);
  });
});

describe('GET /api/billing/status', () => {
  const HOURS = { plan: 'solo', limited: true, included_hours: 15, used_hours: 3.5, pack_hours: 10, remaining_hours: 21.5, resets_at: '2026-12-01T00:00:00+00:00' };

  test('a Free org: plan and hours, no subscription, Stripe not called', async () => {
    mockDb.hours = { ...HOURS, plan: 'free', included_hours: 2, pack_hours: 0, used_hours: 0, remaining_hours: 2 };
    const res = await request(app()).get('/api/billing/status').query({ workspaceId: ORG });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      plan: 'free', botHours: mockDb.hours, hasSubscription: false, subscription: null, canManage: true, configured: true,
    });
    expect(mockDb.rpcCalls).toEqual([{ name: 'get_org_bot_hours', args: { p_org_id: ORG } }]);
    expect(fakeStripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  test('a subscribed org gets its renewal date from the subscription item', async () => {
    seedOrg({ plan: 'solo', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_s' });
    mockDb.hours = HOURS;
    subs.sub_s = { id: 'sub_s', status: 'active', cancel_at_period_end: true,
      items: { data: [{ current_period_end: 1796083200, price: { recurring: { interval: 'year' } } }] } };
    const res = await request(app()).get('/api/billing/status').query({ workspaceId: ORG });
    expect(res.status).toBe(200);
    expect(res.body.hasSubscription).toBe(true);
    expect(res.body.subscription).toEqual({
      status: 'active', interval: 'year', currentPeriodEnd: new Date(1796083200 * 1000).toISOString(), cancelAtPeriodEnd: true,
    });
  });

  test('any member may read it, but only owners and admins may manage', async () => {
    mockAuth.role = 'viewer';
    const res = await request(app()).get('/api/billing/status').query({ workspaceId: ORG });
    expect(res.status).toBe(200);
    expect(res.body.canManage).toBe(false);
  });

  test('a failed bot-hours or Stripe read leaves that part empty, not a 500', async () => {
    seedOrg({ plan: 'team', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_s' });
    mockDb.hoursError = { message: 'db down' };
    fakeStripe.subscriptions.retrieve.mockRejectedValueOnce(new Error('stripe down'));
    const res = await request(app()).get('/api/billing/status').query({ workspaceId: ORG });
    expect(res.status).toBe(200);
    expect(res.body.botHours).toBeNull();
    expect(res.body.hasSubscription).toBe(true);
    expect(res.body.subscription.status).toBeNull();
  });

  test('without Stripe the status still loads and says so', async () => {
    billing._setStripe(null);
    const res = await request(app()).get('/api/billing/status').query({ workspaceId: ORG });
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
  });
});

describe('POST /api/billing/portal', () => {
  test('an org with a Stripe customer gets a portal session that returns to the drawer', async () => {
    seedOrg({ plan: 'solo', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });
    const res = await request(app()).post('/api/billing/portal').send({ workspaceId: ORG });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: 'https://billing.stripe.test/p_1' });
    const params = fakeStripe.billingPortal.sessions.create.mock.calls[0][0];
    expect(params.customer).toBe('cus_1');
    expect(params.return_url).toMatch(/\/settings\?s=workspace&dr=billing$/);
  });

  test('an org with no Stripe customer gets 409', async () => {
    const res = await request(app()).post('/api/billing/portal').send({ workspaceId: ORG });
    expect(res.status).toBe(409);
    expect(fakeStripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  test('a member who is not an owner or admin cannot open it', async () => {
    mockAuth.role = 'member';
    seedOrg({ plan: 'solo', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });
    const res = await request(app()).post('/api/billing/portal').send({ workspaceId: ORG });
    expect(res.status).toBe(403);
  });

  test('a Stripe failure is a 500 with a plain message', async () => {
    seedOrg({ plan: 'solo', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' });
    fakeStripe.billingPortal.sessions.create.mockRejectedValueOnce(new Error('No configuration provided'));
    const res = await request(app()).post('/api/billing/portal').send({ workspaceId: ORG });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Could not open the billing portal. Try again.');
  });
});
