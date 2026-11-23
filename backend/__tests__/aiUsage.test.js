/**
 * EAI-07: AI usage per org (services/aiUsage.js).
 *
 *   - A question is refused (429 ai_quota) once the org's questions this month
 *     reach its limit; under the limit it goes through.
 *   - The plan sets the floor of the limit (Stripe changes `plan`, never
 *     ai_monthly_limit); a higher ai_monthly_limit still counts.
 *   - A failed quota read lets the question through.
 *   - Each model call inside the request records itself: the first adds one
 *     request, later rounds add tokens only; thinking tokens count as output.
 *   - Outside a metered request, addUsage writes nothing.
 */

'use strict';

const mockRpc = [];
const mockRows = {};
jest.mock('../config/supabase', () => {
  const from = (table) => {
    const builder = {
      select: () => builder, eq: () => builder,
      maybeSingle: async () => mockRows[table] || { data: null, error: null },
    };
    return builder;
  };
  return { supabase: { from, rpc: async (fn, args) => { mockRpc.push({ fn, args }); return { error: null }; } } };
});
jest.mock('../utils/orgContext', () => ({ getOrgIdsForUser: jest.fn(async () => ['org-a']) }));
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { meterAi, addUsage, usageOf, limitFor, monthStart } = require('../services/aiUsage');
const { getOrgIdsForUser } = require('../utils/orgContext');

// A route that makes two model calls (one agent tool round, then the answer).
const app = express();
app.post('/ask', (req, res, next) => { req.user = { id: 'user-a' }; next(); }, meterAi, async (req, res) => {
  await addUsage({ promptTokenCount: 1000, candidatesTokenCount: 10, thoughtsTokenCount: 40 });
  await addUsage({ promptTokenCount: 2000, candidatesTokenCount: 200 });
  res.json({ ok: true });
});

function usage(plan, limit, used) {
  mockRows.tenant_organizations = { data: { plan, ai_monthly_limit: limit }, error: null };
  mockRows.org_ai_usage_monthly = used === null ? { data: null, error: null } : { data: { request_count: used }, error: null };
}

beforeEach(() => {
  mockRpc.length = 0;
  for (const k of Object.keys(mockRows)) delete mockRows[k];
  getOrgIdsForUser.mockResolvedValue(['org-a']);
});

test('at the limit → 429 ai_quota with the limit in the message, no model call recorded', async () => {
  usage('free', 100, 100);
  const res = await request(app).post('/ask');
  expect(res.status).toBe(429);
  expect(res.body).toMatchObject({ code: 'ai_quota', used: 100, limit: 100 });
  expect(res.body.error).toMatch(/used all 100 AI questions/);
  expect(mockRpc).toEqual([]);
});

test('under the limit → answered; one request, both calls\' tokens and cost recorded', async () => {
  usage('free', 100, 99);
  const res = await request(app).post('/ask');
  expect(res.status).toBe(200);
  expect(mockRpc).toEqual([
    { fn: 'record_ai_usage', args: { p_org_id: 'org-a', p_requests: 1, p_tokens_input: 1000, p_tokens_output: 50, p_cost: 0.000425 } },
    { fn: 'record_ai_usage', args: { p_org_id: 'org-a', p_requests: 0, p_tokens_input: 2000, p_tokens_output: 200, p_cost: 0.0011 } },
  ]);
});

test('first question of the month (no usage row) goes through', async () => {
  usage('free', 100, null);
  expect((await request(app).post('/ask')).status).toBe(200);
});

test('the plan sets the floor: a Solo org whose column still says 100 is not stopped at 100', async () => {
  usage('solo', 100, 100);
  expect((await request(app).post('/ask')).status).toBe(200);
  expect(limitFor({ plan: 'solo', ai_monthly_limit: 100 })).toBeGreaterThan(100);
  // A hand-set higher limit still counts; an unknown plan falls to the free floor.
  expect(limitFor({ plan: 'free', ai_monthly_limit: 99999 })).toBe(99999);
  expect(limitFor({ plan: 'nope', ai_monthly_limit: null })).toBe(100);
});

test('a failed quota read lets the question through and still records it', async () => {
  mockRows.tenant_organizations = { data: null, error: { message: 'timeout' } };
  const res = await request(app).post('/ask');
  expect(res.status).toBe(200);
  expect(mockRpc).toHaveLength(2);
});

test('a user with no org is answered and nothing is recorded', async () => {
  getOrgIdsForUser.mockResolvedValue([]);
  expect((await request(app).post('/ask')).status).toBe(200);
  expect(mockRpc).toEqual([]);
});

test('outside a metered request addUsage writes nothing', async () => {
  await addUsage({ promptTokenCount: 5 });
  expect(mockRpc).toEqual([]);
});

test('usageOf: thinking tokens are output; missing metadata is zero', () => {
  expect(usageOf({ promptTokenCount: 1e6, candidatesTokenCount: 5e5, thoughtsTokenCount: 5e5 })).toEqual({ input: 1e6, output: 1e6, cost: 2.8 });
  expect(usageOf(undefined)).toEqual({ input: 0, output: 0, cost: 0 });
});

test('monthStart is the first of the UTC month', () => {
  expect(monthStart(new Date('2026-12-01T03:00:00Z'))).toBe('2026-12-01');
  expect(monthStart(new Date('2026-11-30T23:59:59Z'))).toBe('2026-11-01');
});
