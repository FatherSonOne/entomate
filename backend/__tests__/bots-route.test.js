/**
 * Bot routes regression tests (issue #8 tier 3).
 *
 * Covers:
 *   - POST /api/admin/bots/launch — consent gate enforcement (P1.7 Slice 1)
 *   - POST /api/admin/bots/recall-webhook — signature verification variants
 *
 * Auth + supabase + the Recall API client are all mocked via jest.mock
 * before the bots router is imported. Each test mounts the router on a
 * minimal Express app via supertest.
 */

'use strict';

// ── Mock the auth middleware to inject a fake admin user ────────────────
//
// authenticate sets req.user; authorizeOrgRole confirms the user has the
// requested org role. For tier 3 launch tests we want both to pass so we
// can exercise the consent gate logic specifically.
jest.mock('../middleware/auth', () => {
  const authenticate = (req, res, next) => {
    req.user = {
      id: 'test-user-id',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'Person',
      role: 'admin',
      teamId: 'default'
    };
    next();
  };
  const authorizeOrgRole = () => (req, res, next) => {
    req.orgId = req.body?.workspaceId || req.query?.workspaceId || 'test-workspace-id';
    req.orgRole = 'admin';
    next();
  };
  const optionalAuth = (req, res, next) => next();
  return { authenticate, authorizeOrgRole, optionalAuth };
});

jest.mock('../config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({ select: jest.fn(), insert: jest.fn(), update: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() }))
  },
  supabase: {}
}));

jest.mock('../utils/log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Stub the orchestrator entirely — route tests aren't testing orchestrator
// internals, just that the route layer hands off correctly.
jest.mock('../services/botOrchestrator', () => ({
  launchBotSession: jest.fn(() => Promise.resolve({
    sessionId: 'fake-session',
    recallBotId: 'fake-recall-bot',
    attendees: []
  })),
  stopBotSession: jest.fn(),
  listActiveSessions: jest.fn(),
  getRecallBotState: jest.fn(),
  handleRecallWebhook: jest.fn(() => Promise.resolve({ ok: true }))
}));

const express = require('express');
const request = require('supertest');

function makeApp() {
  const app = express();
  // Match server.js — verify callback stashes raw body for HMAC.
  app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buf) => { req.rawBody = buf; }
  }));
  app.use('/api/admin/bots', require('../routes/bots'));
  return app;
}

// ─────────────────────────────────────────────────────────────────────────
// /launch — consent gate variants
// ─────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/bots/launch — consent gate', () => {
  let app;
  beforeAll(() => { app = makeApp(); });

  const VALID_BODY = {
    workspaceId: 'test-workspace-id',
    meetingId: '00000000-0000-0000-0000-000000000001',
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
    platform: 'meet'
  };

  test('missing consentAcknowledged → 400 consent_required', async () => {
    const res = await request(app)
      .post('/api/admin/bots/launch')
      .send(VALID_BODY);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('consent_required');
    expect(res.body.message).toMatch(/consentAcknowledged: true is required/);
  });

  test('consentAcknowledged: false → 400 consent_required', async () => {
    const res = await request(app)
      .post('/api/admin/bots/launch')
      .send({ ...VALID_BODY, consentAcknowledged: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('consent_required');
  });

  test('consentAcknowledged: "true" string → 400 (strict equality, not truthy)', async () => {
    // Defensive contract: only the boolean true passes, not truthy strings.
    // This matters because curl users routinely pass strings instead of
    // bools and we want the launch to fail visibly rather than silently
    // accept "true" / "yes" / "1".
    const res = await request(app)
      .post('/api/admin/bots/launch')
      .send({ ...VALID_BODY, consentAcknowledged: 'true' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('consent_required');
  });

  test('consentAcknowledged: 1 → 400 (strict equality)', async () => {
    const res = await request(app)
      .post('/api/admin/bots/launch')
      .send({ ...VALID_BODY, consentAcknowledged: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('consent_required');
  });

  test('consentAcknowledged: true → 201 + result body', async () => {
    const res = await request(app)
      .post('/api/admin/bots/launch')
      .send({ ...VALID_BODY, consentAcknowledged: true });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      sessionId: 'fake-session',
      recallBotId: 'fake-recall-bot'
    });
  });

  test('orchestrator receives consentAcknowledgedBy + ByEmail from authenticate', async () => {
    const orchestrator = require('../services/botOrchestrator');
    orchestrator.launchBotSession.mockClear();

    await request(app)
      .post('/api/admin/bots/launch')
      .send({ ...VALID_BODY, consentAcknowledged: true });

    const callArgs = orchestrator.launchBotSession.mock.calls[0][0];
    expect(callArgs).toMatchObject({
      consentAcknowledgedBy: 'test-user-id',
      consentAcknowledgedByName: 'Admin',
      consentAcknowledgedByEmail: 'admin@example.com'
    });
  });

  test('participantEmails array threads through to orchestrator', async () => {
    const orchestrator = require('../services/botOrchestrator');
    orchestrator.launchBotSession.mockClear();

    await request(app)
      .post('/api/admin/bots/launch')
      .send({
        ...VALID_BODY,
        consentAcknowledged: true,
        participantEmails: ['alice@x.com', 'bob@y.com']
      });

    const callArgs = orchestrator.launchBotSession.mock.calls[0][0];
    expect(callArgs.participantEmails).toEqual(['alice@x.com', 'bob@y.com']);
  });

  test('non-array participantEmails defaulted to empty array', async () => {
    const orchestrator = require('../services/botOrchestrator');
    orchestrator.launchBotSession.mockClear();

    await request(app)
      .post('/api/admin/bots/launch')
      .send({
        ...VALID_BODY,
        consentAcknowledged: true,
        participantEmails: 'not-an-array'
      });

    const callArgs = orchestrator.launchBotSession.mock.calls[0][0];
    expect(callArgs.participantEmails).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// /recall-webhook — signature verification variants
// ─────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/bots/recall-webhook — signature gate', () => {
  let app;
  beforeAll(() => { app = makeApp(); });

  const ORIGINAL_SECRET = process.env.RECALL_WEBHOOK_SIGNING_SECRET;
  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.RECALL_WEBHOOK_SIGNING_SECRET;
    } else {
      process.env.RECALL_WEBHOOK_SIGNING_SECRET = ORIGINAL_SECRET;
    }
  });

  test('signing secret unset → 500', async () => {
    delete process.env.RECALL_WEBHOOK_SIGNING_SECRET;
    const res = await request(app)
      .post('/api/admin/bots/recall-webhook')
      .send({ event: 'bot.in_call_recording', data: {} });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/signing secret not configured/i);
  });

  test('valid secret + bad signature → 401', async () => {
    // Use a plausible whsec_ format so the Svix Webhook ctor accepts the
    // secret on construction; signature verification should still fail
    // because we sent garbage headers.
    process.env.RECALL_WEBHOOK_SIGNING_SECRET = 'whsec_dGVzdF9zZWNyZXRfZm9yX2plc3RfdGVzdHNfb25seQ==';
    const res = await request(app)
      .post('/api/admin/bots/recall-webhook')
      .set('svix-id', 'msg_test')
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', 'v1,not-a-real-signature')
      .send({ event: 'bot.in_call_recording', data: {} });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid webhook signature/i);
  });

  test('valid secret + missing svix headers → 401 (svix verify rejects)', async () => {
    process.env.RECALL_WEBHOOK_SIGNING_SECRET = 'whsec_dGVzdF9zZWNyZXRfZm9yX2plc3RfdGVzdHNfb25seQ==';
    const res = await request(app)
      .post('/api/admin/bots/recall-webhook')
      .send({ event: 'bot.in_call_recording', data: {} });
    expect(res.status).toBe(401);
  });
});
