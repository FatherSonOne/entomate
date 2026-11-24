/**
 * Entomate AI write spine (EAI-05, D6/D7).
 *
 * Guards docs/app-dev/entomate-ai-APP-PRODUCT.md §6 P4:
 *   - ENTO_AI_WRITE_TOOLS off: no write declaration reaches the model, a write
 *     call is an unknown tool, and every /actions endpoint is 404.
 *   - On: a write call only PROPOSES (a row in ento_ai_action_log, a `proposal`
 *     event); nothing changes until Confirm. Confirm runs once; Undo reverses
 *     it only while the record is as the agent left it.
 *   - Every read and write runs on the caller's user client with the org fence.
 *
 * The database is an in-memory stand-in with per-user RLS for the tables the
 * verbs touch (the real policies and the lifecycle trigger are proven on PG17
 * against migration 20261122200000). getUser and Gemini are faked.
 */

'use strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';

const USERS = { 'token-a': 'user-a', 'token-b': 'user-b' };
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token) => (USERS[token]
        ? { data: { user: { id: USERS[token], email: `${USERS[token]}@example.com`, user_metadata: {} } }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } }),
    },
  }),
}));

// ── In-memory PostgREST with RLS ─────────────────────────────────────
// failOn(table, q) → an error message makes that one query fail (EAI-06 mid-plan failures).
const mockDb = { tables: {}, members: {}, clock: 0, queries: [], failOn: null };
const mockTick = () => new Date(Date.UTC(2026, 10, 22, 12, 0, 0, mockDb.clock++)).toISOString();
const NEXT = { proposed: ['confirmed', 'rejected'], confirmed: ['executed', 'failed'], executed: ['undone'] };

function mockPolicy(table, uid, op, row) {
  if (uid === 'service') return true;
  const inOrg = (mockDb.members[uid] || []).includes(row.org_id);
  switch (table) {
    case 'user_settings': return row.user_id === uid;
    case 'ento_ai_brief_schedules': return false;
    case 'ento_ai_action_log': return row.user_id === uid && inOrg;
    case 'projects': return op === 'select' ? inOrg : row.owner_id === uid && inOrg;
    case 'meeting_notes': return op === 'select' ? inOrg && (row.visibility === 'team' || row.author_id === uid) : row.author_id === uid && inOrg;
    default: return inOrg;
  }
}

function mockTrigger(table, oldRow, row) {
  if (table === 'ento_ai_action_log') {
    if (!oldRow) {
      if (row.status !== 'proposed') return 'a new row must be a bare proposal';
    } else if (row.status !== oldRow.status && !(NEXT[oldRow.status] || []).includes(row.status)) {
      return `${oldRow.status} -> ${row.status} is not allowed`;
    } else if (['rejected', 'failed', 'undone'].includes(oldRow.status)) {
      return 'final';
    }
  }
  if (oldRow && ['tasks', 'projects', 'meeting_notes'].includes(table)) row.updated_at = mockTick();
  return null;
}

function mockClient(uid) {
  return {
    from(table) {
      const q = { table, op: 'select', filters: [], opts: {}, single: false };
      mockDb.queries.push({ uid, q });
      const rowsOf = () => (mockDb.tables[table] = mockDb.tables[table] || []);
      // 'col->>key' reads a jsonb key as text, as PostgREST does.
      const val = (r, k) => { const [c, f] = k.split('->>'); if (!f) return r[c]; const o = r[c]; return o && o[f] != null ? String(o[f]) : null; };
      const OPS = {
        eq: (a, v) => a === v,
        neq: (a, v) => a !== v,
        in: (a, v) => v.includes(a),
        notIn: (a, v) => !v.includes(a),
        lt: (a, v) => a != null && a < v,
        gte: (a, v) => a != null && a >= v,
      };
      const match = (r) => q.filters.every(([k, op, v]) => OPS[op](val(r, k), v));
      const run = () => {
        const all = rowsOf();
        const failed = mockDb.failOn && mockDb.failOn(table, q);
        if (failed) return { data: null, error: { message: failed } };
        let out = [];
        if (q.op === 'insert') {
          // An array is one statement: every row lands, or none does.
          const defaults = table === 'ento_ai_action_log' ? { status: 'proposed', result: null, undo: null } : {};
          const made = (Array.isArray(q.value) ? q.value : [q.value])
            .map((v) => ({ id: require('crypto').randomUUID(), created_at: mockTick(), updated_at: mockTick(), ...defaults, ...v }));
          if (q.ignoreDuplicates && all.some((row) => q.conflicts.every((key) => row[key] === made[0][key]))) return { data: null, error: null };
          for (const row of made) {
            if (!mockPolicy(table, uid, 'insert', row)) return { data: null, error: { message: 'new row violates row-level security policy' } };
            const bad = mockTrigger(table, null, row);
            if (bad) return { data: null, error: { message: bad } };
          }
          all.push(...made);
          out = made;
        } else {
          const seen = all.filter((r) => mockPolicy(table, uid, q.op === 'select' ? 'select' : q.op, r) && mockPolicy(table, uid, 'select', r) && match(r));
          if (q.op === 'select') out = q.order ? [...seen].sort((x, y) => (x[q.order[0]] > y[q.order[0]] ? 1 : -1) * (q.order[1] ? 1 : -1)) : seen;
          if (q.op === 'update') {
            for (const r of seen) {
              const next = { ...r, ...q.value };
              const bad = mockTrigger(table, r, next);
              if (bad) return { data: null, error: { message: bad } };
              Object.assign(r, next);
            }
            out = seen;
          }
          if (q.op === 'delete') {
            mockDb.tables[table] = all.filter((r) => !seen.includes(r));
            out = seen;
          }
        }
        if (q.opts.head) return { data: null, count: out.length, error: null };
        const data = out.map((r) => ({ ...r }));
        if (q.single) return data.length > 1 ? { data: null, error: { message: 'multiple rows' } } : { data: data[0] || null, error: null };
        return { data, count: data.length, error: null };
      };
      const b = {
        select(_cols, opts) { q.opts = opts || {}; q.selected = true; return b; },
        insert(v) { q.op = 'insert'; q.value = v; return b; },
        upsert(v, opts) { q.ignoreDuplicates = opts.ignoreDuplicates; q.conflicts = opts.onConflict.split(','); return b.insert(v); },
        update(v) { q.op = 'update'; q.value = v; return b; },
        delete() { q.op = 'delete'; return b; },
        eq(k, v) { q.filters.push([k, 'eq', v]); return b; },
        neq(k, v) { q.filters.push([k, 'neq', v]); return b; },
        match(v) { for (const [k, value] of Object.entries(v)) b.eq(k, value); return b; },
        in(k, v) { q.filters.push([k, 'in', v]); return b; },
        not(k, op, list) { q.filters.push([k, 'notIn', list.slice(1, -1).split(',').map((x) => x.replace(/"/g, ''))]); return b; },
        lt(k, v) { q.filters.push([k, 'lt', v]); return b; },
        gte(k, v) { q.filters.push([k, 'gte', v]); return b; },
        order(k, o) { q.order = [k, o?.ascending !== false]; return b; },
        maybeSingle() { q.single = true; return b; },
        limit() { return b; },
        // One macrotask per query, like a network round trip, so two requests can interleave.
        then(resolve, reject) { return new Promise((r) => setImmediate(r)).then(run).then(resolve, reject); },
      };
      return b;
    },
    rpc: async () => ({ data: 'thread-1', error: null }),
  };
}

jest.mock('../config/supabase', () => ({
  supabase: { from: () => { throw new Error('service client used'); } },
  supabaseAdmin: { from: (table) => {
    if (['ento_ai_brief_schedules', 'user_settings'].includes(table)) return mockClient('service').from(table);
    if (!['org_members', 'bot_sessions'].includes(table)) throw new Error('service client used');
    return mockClient('user-a').from(table);
  } },
  createUserClient: jest.fn((token) => mockClient(USERS[token])),
}));

const mockScript = [];
const mockModelParams = [];
jest.mock('../config/gemini', () => ({
  isConfigured: jest.fn(() => true),
  genAI: {
    getGenerativeModel: (params) => {
      mockModelParams.push(params);
      return {
        generateContentStream: async () => {
          const step = mockScript.shift() || { text: 'ok' };
          const parts = step.calls ? step.calls.map((c) => ({ functionCall: c })) : [{ text: step.text }];
          async function* stream() { yield { candidates: [{ content: { role: 'model', parts } }] }; }
          return { stream: stream(), response: Promise.reject(new Error('aggregate not used')) };
        },
      };
    },
  },
}));
jest.mock('../middleware/rateLimiter', () => ({ aiLimiter: (req, res, next) => next() }));
jest.mock('../utils/orgContext', () => ({ getOrgIdsForUser: jest.fn(async (uid) => mockDb.members[uid] || []) }));
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
// EAI-07 metering reads billing tables on the service client; it has its own test (aiUsage.test.js).
jest.mock('../services/aiUsage', () => ({ meterAi: jest.fn((req, res, next) => next()), addUsage: jest.fn() }));
jest.mock('../services/calendarService', () => ({ initialize: jest.fn(), isConfigured: jest.fn(() => false), getEvents: jest.fn(), getEvent: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { VERBS } = require('../services/entoAi/writeTools');

const app = express();
app.use(express.json());
app.use('/api/ento-ai', require('../routes/entoAi'));

const PROJECT_A = '0000000a-0000-4000-8000-00000000a001';
const PROJECT_B = '0000000b-0000-4000-8000-00000000b001';
const TASK_A = '0000000a-0000-4000-8000-00000000a002';
const TASK_B = '0000000b-0000-4000-8000-00000000b002';
const MEETING_A = '0000000a-0000-4000-8000-00000000a003';

const sse = (text) => text.split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));
const rows = (t) => mockDb.tables[t] || [];
const ask = (question, token = 'token-a', context) => request(app).post('/api/ento-ai/query').set('Authorization', `Bearer ${token}`).send({ question, ...context });
const act = (method, path, body, token = 'token-a') => request(app)[method](`/api/ento-ai/actions${path}`).set('Authorization', `Bearer ${token}`).send(body);

/** Asks once with a scripted write call; returns the proposal the route emitted. */
async function proposeVia(name, args, token, context) {
  mockScript.push({ calls: [{ name, args }] }, { text: 'Proposed. It waits for your Confirm.' });
  const res = await ask(`please ${name}`, token, context);
  const ev = sse(res.text);
  return { ev, proposal: ev.find((e) => e.type === 'proposal')?.proposal };
}

beforeEach(() => {
  process.env.ENTO_AI_WRITE_TOOLS = 'true';
  mockScript.length = 0;
  mockModelParams.length = 0;
  mockDb.queries.length = 0;
  mockDb.failOn = null;
  mockDb.members = { 'user-a': ['org-a'], 'user-b': ['org-a', 'org-b'] };
  mockDb.tables = {
    projects: [
      { id: PROJECT_A, org_id: 'org-a', name: 'Launch', owner_id: 'user-a', status: 'active', end_date: null, updated_at: mockTick() },
      { id: PROJECT_B, org_id: 'org-b', name: 'Secret', owner_id: 'user-b', status: 'active', updated_at: mockTick() },
    ],
    tasks: [
      { id: TASK_A, org_id: 'org-a', title: 'Ship it', status: 'open', priority: 'medium', due_date: null, completed_at: null, assigned_to: null, updated_at: mockTick() },
      { id: TASK_B, org_id: 'org-b', title: 'Hidden', status: 'open', updated_at: mockTick() },
    ],
    meetings: [{ id: MEETING_A, org_id: 'org-a', title: 'Weekly sync' }],
    action_items: [],
    meeting_notes: [],
    ento_ai_action_log: [],
  };
});
afterAll(() => { delete process.env.ENTO_AI_WRITE_TOOLS; });

describe('flag off (D6: writes ship off)', () => {
  beforeEach(() => { process.env.ENTO_AI_WRITE_TOOLS = 'false'; });

  test('no write declaration reaches the model; the prompt says read-only', async () => {
    mockScript.push({ text: 'hi' });
    await ask('hi');
    const names = mockModelParams[0].tools[0].functionDeclarations.map((d) => d.name);
    for (const verb of Object.keys(VERBS)) expect(names).not.toContain(verb);
    expect(mockModelParams[0].systemInstruction).toMatch(/You can only read/);
  });

  test('a write call is an unknown tool: no proposal, no row', async () => {
    const { ev, proposal } = await proposeVia('create_task', { title: 'X' });
    expect(proposal).toBeUndefined();
    expect(ev.find((e) => e.type === 'tool_end').tools).toEqual([{ name: 'create_task', ok: false, count: 0 }]);
    expect(rows('ento_ai_action_log')).toEqual([]);
    expect(rows('tasks')).toHaveLength(2);
  });

  test.each([['get', '?ids=x'], ['post', '/x/confirm'], ['post', '/x/reject'], ['post', '/x/undo'], ['patch', '/x']])(
    '%s /actions%s → 404', async (method, path) => {
      expect((await act(method, path, {})).status).toBe(404);
    });
});

test('anonymous and forged callers → 401 on the action endpoints', async () => {
  expect((await request(app).post(`/api/ento-ai/actions/${TASK_A}/confirm`)).status).toBe(401);
  expect((await act('post', `/${TASK_A}/confirm`, {}, 'forged')).status).toBe(401);
});

test('a calendar bot proposal requires typed consent and updates only the caller’s settings', async () => {
  const calendar = require('../services/calendarService');
  const originalKey = process.env.RECALL_API_KEY;
  process.env.RECALL_API_KEY = 'fake-key';
  calendar.isConfigured.mockReturnValue(true);
  calendar.getEvents.mockRejectedValue(new Error('fake provider'));
  const existing = { user_id: 'user-a', updated_at: mockTick(), calendar_json: {
    tokens: { access_token: 'private-token' }, auto_join_health: { missed: [] },
  } };
  const other = { user_id: 'user-b', updated_at: mockTick(), calendar_json: { tokens: { access_token: 'other' } } };
  mockDb.tables.user_settings = [existing, other];
  mockDb.tables.org_members = [{ org_id: 'org-a', user_id: 'user-a', role: 'owner' }];
  try {
    const { proposal } = await proposeVia('configure_bot_auto_join', { leadMinutes: 5 });
    expect(proposal).toMatchObject({ riskClass: 'sensitive', confirmToken: 'I will notify attendees', status: 'proposed' });
    expect(proposal.summary).toContain('5 minutes before the start of eligible meetings you organize');
    expect(JSON.stringify(proposal)).not.toContain('private-token');
    expect(existing.calendar_json.auto_join).toBeUndefined();
    expect((await act('post', `/${proposal.id}/confirm`, { confirmationText: 'Wrong' })).status).toBe(400);
    expect(existing.calendar_json.auto_join).toBeUndefined();

    mockDb.tables.org_members[0].role = 'member';
    expect((await act('post', `/${proposal.id}/confirm`, { confirmationText: proposal.confirmToken })).status).toBe(422);
    expect(existing.calendar_json.auto_join).toBeUndefined();

    mockDb.tables.org_members[0].role = 'owner';
    const done = await act('post', `/${proposal.id}/confirm`, { confirmationText: proposal.confirmToken });
    expect(done.body).toMatchObject({ ok: true, proposal: { canUndo: false, status: 'executed', result: { leadMinutes: 5 } } });
    expect(existing.calendar_json).toMatchObject({
      tokens: { access_token: 'private-token' }, auto_join_health: { missed: [] },
      auto_join: { enabled: true, scope: 'organized', lead_minutes: 5, org_id: 'org-a', consent_at: expect.any(String) },
    });
    expect(other.calendar_json.auto_join).toBeUndefined();
  } finally {
    calendar.isConfigured.mockReturnValue(false);
    if (originalKey === undefined) delete process.env.RECALL_API_KEY;
    else process.env.RECALL_API_KEY = originalKey;
  }
});

test('Upcoming and Ask Entomate share typed confirmation for a single booking while recurring auto-join is off', async () => {
  const calendar = require('../services/calendarService');
  const originalKey = process.env.RECALL_API_KEY;
  process.env.RECALL_API_KEY = 'fake-key';
  calendar.isConfigured.mockReturnValue(true);
  calendar.getEvents.mockRejectedValue(new Error('fake provider'));
  const occurrence = {
    id: 'series_123', etag: 'initial', summary: 'Thursday review',
    start: { dateTime: new Date(Date.now() + 3_600_000).toISOString() },
    hangoutLink: 'https://meet.google.com/abc-defg-hij',
  };
  calendar.getEvent.mockResolvedValue(occurrence);
  const eventKey = `${occurrence.id}@${occurrence.start.dateTime}`;
  const existing = { user_id: 'user-a', updated_at: mockTick(), calendar_json: { tokens: { access_token: 'fake' } } };
  mockDb.tables.user_settings = [existing];
  mockDb.tables.org_members = [{ org_id: 'org-a', user_id: 'user-a', role: 'owner' }];
  const manual = (path, body) => request(app).post('/api/ento-ai/calendar-bookings' + path)
    .set('Authorization', 'Bearer token-a').send(body);
  try {
    const { proposal: task } = await proposeVia('create_task', { title: 'Unrelated task' });
    process.env.ENTO_AI_WRITE_TOOLS = 'false';
    expect((await manual(`/${task.id}/confirm`, {})).status).toBe(404);
    expect(rows('tasks').some((row) => row.title === 'Unrelated task')).toBe(false);
    const proposed = await manual('', { eventKey, decision: 'schedule', leadMinutes: 5, timeZone: 'America/New_York' });
    expect(proposed.body).toMatchObject({ ok: true, proposal: { confirmToken: 'I will notify attendees', payload: { leadMinutes: 5 } } });
    const p = proposed.body.proposal;
    expect(existing.calendar_json.auto_join).toBeUndefined();
    expect((await manual(`/${p.id}/confirm`, { confirmationText: 'wrong' })).status).toBe(400);
    calendar.getEvent.mockResolvedValueOnce({ ...occurrence, etag: 'changed' });
    expect((await manual(`/${p.id}/confirm`, { confirmationText: p.confirmToken })).status).toBe(422);
    expect(existing.calendar_json.auto_join).toBeUndefined();

    const result = await manual(`/${p.id}/confirm`, { confirmationText: p.confirmToken });
    expect(result.body).toMatchObject({ ok: true, proposal: { status: 'executed', view: { path: '/meetings?tab=upcoming&event=series_123' } } });
    expect(existing.calendar_json.auto_join).toMatchObject({
      enabled: false, bookings: { series_123: { decision: 'schedule', leadMinutes: 5 } },
    });

    process.env.ENTO_AI_WRITE_TOOLS = 'true';
    const { proposal } = await proposeVia('change_calendar_bot_booking', { eventKey, decision: 'cancel' });
    expect(proposal).toMatchObject({ confirmToken: 'Cancel this bot' });
    expect((await act('post', `/${proposal.id}/confirm`, { confirmationText: proposal.confirmToken })).body.ok).toBe(true);
    expect(existing.calendar_json.auto_join).toMatchObject({ enabled: false, bookings: { series_123: { decision: 'cancel' } } });
  } finally {
    calendar.isConfigured.mockReturnValue(false);
    if (originalKey === undefined) delete process.env.RECALL_API_KEY;
    else process.env.RECALL_API_KEY = originalKey;
  }
});

test('Ask Entomate schedules and cancels the exact brief from the active workspace without changing the bot', async () => {
  const calendar = require('../services/calendarService');
  const occurrence = { id: 'series_987', summary: 'Friday review', start: { dateTime: new Date(Date.now() + 3_600_000).toISOString() } };
  calendar.getEvent.mockResolvedValue(occurrence);
  const eventKey = `${occurrence.id}@${occurrence.start.dateTime}`;
  const calendarJson = { connected_at: 'original', tokens: { refresh_token: 'private' }, auto_join: { enabled: false, lead_minutes: 5 } };
  mockDb.tables.user_settings = [{ user_id: 'user-b', calendar_json: calendarJson }];
  const brief = (decision, leadMinutes) => proposeVia('change_calendar_brief_schedule', { eventKey, decision, leadMinutes }, 'token-b', { workspaceId: 'org-b' });
  const upcoming = (method, body) => request(app)[method](`/api/ento-ai/meeting-briefs/${occurrence.id}?orgId=org-b`).set('Authorization', 'Bearer token-b').send(body);

  expect((await brief('schedule', 10)).proposal).toBeUndefined();
  const { proposal } = await brief('schedule');
  expect(proposal).toMatchObject({ riskClass: 'write', confirmToken: null, payload: { leadMinutes: 15 } });
  expect(proposal.summary).toMatch(/Friday review.*15 minutes before/);
  expect(mockDb.tables.ento_ai_action_log[0].org_id).toBe('org-b');
  expect(rows('ento_ai_brief_schedules')).toHaveLength(0);
  expect((await act('post', `/${proposal.id}/confirm`, {}, 'token-a')).status).toBe(404);

  calendar.getEvent.mockResolvedValueOnce({ ...occurrence, start: { dateTime: new Date(Date.now() + 7_200_000).toISOString() } });
  expect((await act('post', `/${proposal.id}/confirm`, {}, 'token-b')).status).toBe(422);
  const confirmed = await act('post', `/${proposal.id}/confirm`, {}, 'token-b');
  expect(confirmed.body).toMatchObject({ ok: true, proposal: { result: { status: 'scheduled', leadMinutes: 15 }, view: { path: '/meetings?tab=upcoming&event=series_987' } } });
  expect((await upcoming('get')).body.schedule).toMatchObject({ status: 'scheduled', leadMinutes: 15 });

  const stale = (await brief('cancel')).proposal;
  expect(stale.summary).toMatch(/Cancel the pending pre-meeting brief/);
  await upcoming('delete').expect(200);
  await upcoming('put', { orgId: 'org-b', leadMinutes: 30 }).expect(200);
  expect((await act('post', `/${stale.id}/confirm`, {}, 'token-b')).status).toBe(422);
  expect((await upcoming('get')).body.schedule.leadMinutes).toBe(30);

  const cancel = (await brief('cancel')).proposal;
  expect((await act('post', `/${cancel.id}/confirm`, {}, 'token-b')).body).toMatchObject({ ok: true, proposal: { result: { status: 'cancelled' } } });
  expect((await upcoming('get')).body.schedule).toBeNull();
  expect(mockDb.tables.user_settings[0].calendar_json.auto_join).toEqual({ enabled: false, lead_minutes: 5 });
  expect(rows('bot_sessions')).toHaveLength(0);
});

test('a write call only proposes: one row, a proposal event, nothing created, no chip', async () => {
  const { ev, proposal } = await proposeVia('create_task', { title: 'Write the brief', dueDate: '2026-11-30', projectId: PROJECT_A });
  expect(ev.map((e) => e.type)).toEqual(['start', 'tool_start', 'tool_end', 'proposal', 'answering', 'chunk', 'complete']);
  expect(proposal).toMatchObject({
    toolName: 'create_task', status: 'proposed', riskClass: 'write',
    summary: 'Create task "Write the brief" · due 2026-11-30 · in "Launch"',
    editable: expect.arrayContaining([expect.objectContaining({ key: 'title' })]),
  });
  expect(proposal).not.toHaveProperty('undo');
  expect(rows('tasks')).toHaveLength(2);
  expect(rows('ento_ai_action_log')).toHaveLength(1);
  expect(rows('ento_ai_action_log')[0]).toMatchObject({ user_id: 'user-a', org_id: 'org-a', status: 'proposed' });
  const complete = ev.at(-1);
  expect(complete.tools).toEqual([]);
  expect(complete.proposals.map((p) => p.id)).toEqual([proposal.id]);
  expect(mockModelParams[0].systemInstruction).toMatch(/Never say it is done/);
});

test('confirm executes once on the user client with the org fence; a second confirm is 409', async () => {
  const { proposal } = await proposeVia('create_task', { title: 'Write the brief', projectId: PROJECT_A });
  const first = await act('post', `/${proposal.id}/confirm`, {});
  expect(first.status).toBe(200);
  expect(first.body).toMatchObject({ ok: true, proposal: { status: 'executed', view: { path: '/tasks' } } });
  const created = rows('tasks').filter((t) => t.title === 'Write the brief');
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ org_id: 'org-a', project_id: PROJECT_A, status: 'open' });

  const second = await act('post', `/${proposal.id}/confirm`, {});
  expect(second.status).toBe(409);
  expect(rows('tasks').filter((t) => t.title === 'Write the brief')).toHaveLength(1);
  // Every business query carried the fence or was scoped to the proposal's org.
  for (const { q } of mockDb.queries.filter((x) => ['tasks', 'projects'].includes(x.q.table) && x.q.op !== 'insert')) {
    expect(q.filters.some(([k]) => k === 'org_id')).toBe(true);
  }
});

test('two confirms at the same time (double click, two tabs) execute once', async () => {
  const { proposal } = await proposeVia('create_task', { title: 'Once only' });
  const both = await Promise.all([act('post', `/${proposal.id}/confirm`, {}), act('post', `/${proposal.id}/confirm`, {})]);
  expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(rows('tasks').filter((t) => t.title === 'Once only')).toHaveLength(1);
});

test('undo removes the created task once; a second undo is 409', async () => {
  const { proposal } = await proposeVia('create_task', { title: 'Temp' });
  await act('post', `/${proposal.id}/confirm`, {});
  const res = await act('post', `/${proposal.id}/undo`, {});
  expect(res.body).toMatchObject({ ok: true, proposal: { status: 'undone' } });
  expect(rows('tasks').find((t) => t.title === 'Temp')).toBeUndefined();
  expect((await act('post', `/${proposal.id}/undo`, {})).status).toBe(409);
});

test('undo is refused when the record changed after the agent; nothing is overwritten', async () => {
  const { proposal } = await proposeVia('update_task', { taskId: TASK_A, status: 'done' });
  await act('post', `/${proposal.id}/confirm`, {});
  const task = rows('tasks').find((t) => t.id === TASK_A);
  expect(task).toMatchObject({ status: 'done' });
  expect(task.completed_at).toBeTruthy();
  // Someone edits the task afterwards.
  Object.assign(task, { title: 'Ship it v2', updated_at: mockTick() });

  const res = await act('post', `/${proposal.id}/undo`, {});
  expect(res.body).toMatchObject({ ok: false, proposal: { status: 'executed' } });
  expect(res.body.error).toMatch(/changed after Entomate AI/);
  expect(task).toMatchObject({ status: 'done', title: 'Ship it v2' });
});

test('undo in reverse order: create, change, undo the change, then undo the create', async () => {
  const create = (await proposeVia('create_task', { title: 'Chain', priority: 'high' })).proposal;
  await act('post', `/${create.id}/confirm`, {});
  const id = rows('tasks').find((t) => t.title === 'Chain').id;
  const change = (await proposeVia('update_task', { taskId: id, priority: 'low' })).proposal;
  await act('post', `/${change.id}/confirm`, {});
  expect((await act('post', `/${change.id}/undo`, {})).body).toMatchObject({ ok: true });
  expect(rows('tasks').find((t) => t.id === id)).toMatchObject({ priority: 'high' });

  const res = await act('post', `/${create.id}/undo`, {});
  expect(res.body).toMatchObject({ ok: true, proposal: { status: 'undone' } });
  expect(rows('tasks').find((t) => t.id === id)).toBeUndefined();
});

test('a human edit after the undone change still blocks undo of the create', async () => {
  const create = (await proposeVia('create_task', { title: 'Chain2' })).proposal;
  await act('post', `/${create.id}/confirm`, {});
  const task = rows('tasks').find((t) => t.title === 'Chain2');
  const change = (await proposeVia('update_task', { taskId: task.id, priority: 'low' })).proposal;
  await act('post', `/${change.id}/confirm`, {});
  await act('post', `/${change.id}/undo`, {});
  Object.assign(task, { title: 'Chain2 edited', updated_at: mockTick() });

  const res = await act('post', `/${create.id}/undo`, {});
  expect(res.body).toMatchObject({ ok: false, proposal: { status: 'executed' } });
  expect(res.body.error).toMatch(/changed after Entomate AI/);
  expect(rows('tasks').find((t) => t.id === task.id)).toBeTruthy();
});

test('update_task undo puts back the previous status and completed_at', async () => {
  const { proposal } = await proposeVia('update_task', { taskId: TASK_A, status: 'done', priority: 'high' });
  expect(proposal.summary).toBe('Update "Ship it": status → done, priority → high');
  await act('post', `/${proposal.id}/confirm`, {});
  await act('post', `/${proposal.id}/undo`, {});
  expect(rows('tasks').find((t) => t.id === TASK_A)).toMatchObject({ status: 'open', priority: 'medium', completed_at: null });
});

test('undo restores only the verb\'s own columns, whatever the undo record names', async () => {
  const { proposal } = await proposeVia('assign_task', { taskId: TASK_A, assignedTo: 'Sam' });
  await act('post', `/${proposal.id}/confirm`, {});
  const log = rows('ento_ai_action_log')[0];
  log.undo.previous.title = 'Hijacked';
  await act('post', `/${proposal.id}/undo`, {});
  expect(rows('tasks').find((t) => t.id === TASK_A)).toMatchObject({ title: 'Ship it', assigned_to: null });
});

test('a project with tasks is not removed by undo', async () => {
  const { proposal } = await proposeVia('create_project', { name: 'New thing' });
  const done = await act('post', `/${proposal.id}/confirm`, {});
  const projectId = done.body.proposal.result.projectId;
  expect(rows('projects').find((p) => p.id === projectId)).toMatchObject({ owner_id: 'user-a', org_id: 'org-a', status: 'planning' });
  rows('tasks').push({ id: 'child', org_id: 'org-a', project_id: projectId, title: 'Child', updated_at: mockTick() });
  const res = await act('post', `/${proposal.id}/undo`, {});
  expect(res.body).toMatchObject({ ok: false, proposal: { status: 'executed' } });
  expect(res.body.error).toMatch(/has tasks/);
  expect(rows('projects').find((p) => p.id === projectId)).toBeDefined();
});

test('another org\'s record is never proposed against (RLS + fence read nothing)', async () => {
  const { ev, proposal } = await proposeVia('update_task', { taskId: TASK_B, status: 'done' });
  expect(proposal).toBeUndefined();
  expect(ev.find((e) => e.type === 'tool_end').tools[0]).toEqual({ name: 'update_task', ok: false, count: 0 });
  expect(rows('ento_ai_action_log')).toEqual([]);
  const { proposal: p2 } = await proposeVia('create_task', { title: 'x', projectId: PROJECT_B });
  expect(p2).toBeUndefined();
});

test('confirm validates the stored payload again: a payload moved to another org is refused', async () => {
  const { proposal } = await proposeVia('create_task', { title: 'x', projectId: PROJECT_A });
  // A direct PostgREST edit of the caller's own row.
  rows('ento_ai_action_log')[0].payload.projectId = PROJECT_B;
  const res = await act('post', `/${proposal.id}/confirm`, {});
  expect(res.status).toBe(422);
  expect(rows('tasks')).toHaveLength(2);
  expect(rows('ento_ai_action_log')[0].status).toBe('proposed');
});

test('a teammate cannot see, confirm or undo another user\'s proposal (D7 owner rule)', async () => {
  const { proposal } = await proposeVia('create_task', { title: 'Mine' });
  expect((await act('post', `/${proposal.id}/confirm`, {}, 'token-b')).status).toBe(404);
  const list = await act('get', `?ids=${proposal.id}`, undefined, 'token-b');
  expect(list.body.proposals).toEqual([]);
  expect(rows('tasks').find((t) => t.title === 'Mine')).toBeUndefined();
  expect((await act('get', `?ids=${proposal.id}`)).body.proposals.map((p) => p.status)).toEqual(['proposed']);
});

test('reject is final', async () => {
  const { proposal } = await proposeVia('log_meeting_note', { meetingId: MEETING_A, body: 'Follow up with legal' });
  expect(proposal.summary).toBe('Add a private note to "Weekly sync": Follow up with legal');
  expect((await act('post', `/${proposal.id}/reject`, {})).body.proposal.status).toBe('rejected');
  expect((await act('post', `/${proposal.id}/confirm`, {})).status).toBe(409);
  expect(rows('meeting_notes')).toEqual([]);
});

test('edit changes only editable fields, re-validates, and stops after confirm', async () => {
  const { proposal } = await proposeVia('create_task', { title: 'Draft' });
  const bad = await act('patch', `/${proposal.id}`, { projectId: PROJECT_B });
  expect(bad.status).toBe(400);
  const invalid = await act('patch', `/${proposal.id}`, { dueDate: 'next week' });
  expect(invalid.status).toBe(400);
  const ok = await act('patch', `/${proposal.id}`, { title: 'Final title', dueDate: '2026-12-01' });
  expect(ok.body.proposal).toMatchObject({ summary: 'Create task "Final title" · due 2026-12-01', payload: { title: 'Final title' } });
  await act('post', `/${proposal.id}/confirm`, {});
  expect(rows('tasks').find((t) => t.title === 'Final title')).toMatchObject({ due_date: '2026-12-01' });
  expect((await act('patch', `/${proposal.id}`, { title: 'Late' })).status).toBe(409);
});

test('action item: needs a meeting, completes like the Meetings page, undo reopens it', async () => {
  const { proposal: none } = await proposeVia('create_action_item', { description: 'x' });
  expect(none).toBeUndefined();
  const { proposal } = await proposeVia('create_action_item', { meetingId: MEETING_A, description: 'Send the deck', ownerName: 'Ana' });
  const made = await act('post', `/${proposal.id}/confirm`, {});
  expect(made.body.proposal.view).toEqual({ path: `/meetings/${MEETING_A}`, label: 'the meeting' });
  const itemId = made.body.proposal.result.actionItemId;
  expect(rows('action_items')[0]).toMatchObject({ org_id: 'org-a', meeting_id: MEETING_A, status: 'open', assigned_to_name: 'Ana' });

  mockDb.clock += 5;
  const { proposal: done } = await proposeVia('complete_action_item', { actionItemId: itemId });
  await act('post', `/${done.id}/confirm`, {});
  expect(rows('action_items')[0]).toMatchObject({ status: 'done' });
  expect(rows('action_items')[0].completed_at).toBeTruthy();
  const undone = await act('post', `/${done.id}/undo`, {});
  expect(undone.body.ok).toBe(true);
  expect(rows('action_items')[0]).toMatchObject({ status: 'open', completed_at: null });
});

test('update_project is refused for a project the caller does not own', async () => {
  rows('projects').push({ id: '0000000a-0000-4000-8000-00000000a009', org_id: 'org-a', name: 'Theirs', owner_id: 'user-b', updated_at: mockTick() });
  const { ev, proposal } = await proposeVia('update_project', { projectId: '0000000a-0000-4000-8000-00000000a009', status: 'completed' });
  expect(proposal).toBeUndefined();
  expect(ev.find((e) => e.type === 'tool_end').tools[0].ok).toBe(false);
});

test('a failed execute marks the proposal failed and says why', async () => {
  const { proposal } = await proposeVia('update_task', { taskId: TASK_A, status: 'done' });
  rows('tasks').splice(rows('tasks').findIndex((t) => t.id === TASK_A), 1);
  const res = await act('post', `/${proposal.id}/confirm`, {});
  // prepare() runs again first and finds no task: refused before the claim.
  expect(res.status).toBe(422);
  expect(rows('ento_ai_action_log')[0].status).toBe('proposed');
});

test('an execute that fails after the claim is stamped failed, never executed', async () => {
  const { proposal } = await proposeVia('create_task', { title: 'Will fail' });
  const original = VERBS.create_task.execute;
  VERBS.create_task.execute = async () => { throw new Error('insert refused'); };
  try {
    const res = await act('post', `/${proposal.id}/confirm`, {});
    expect(res.body).toMatchObject({ ok: false, proposal: { status: 'failed', result: { error: 'It could not be done: insert refused' } } });
    expect(rows('ento_ai_action_log')[0].status).toBe('failed');
    expect((await act('post', `/${proposal.id}/undo`, {})).status).toBe(409);
  } finally {
    VERBS.create_task.execute = original;
  }
});

test('a sensitive verb needs the typed token on the server, not only on the card', async () => {
  VERBS.test_sensitive = {
    ...VERBS.create_task,
    risk: 'sensitive',
    confirmToken: (p) => p.title,
  };
  try {
    const { proposal } = await proposeVia('test_sensitive', { title: 'Board deck' });
    expect(proposal).toMatchObject({ riskClass: 'sensitive', confirmToken: 'Board deck' });
    const none = await act('post', `/${proposal.id}/confirm`, {});
    expect(none.status).toBe(400);
    expect(rows('ento_ai_action_log')[0].status).toBe('proposed');
    const ok = await act('post', `/${proposal.id}/confirm`, { confirmationText: '  board   DECK ' });
    expect(ok.body.ok).toBe(true);
  } finally {
    delete VERBS.test_sensitive;
  }
});

test('a bad action id is a 400, never a query', async () => {
  const before = mockDb.queries.length;
  expect((await act('post', '/not-a-uuid/confirm', {})).status).toBe(400);
  expect(mockDb.queries.length).toBe(before);
});

// ── EAI-06: multi-step plans ─────────────────────────────────────────
const plan = (method, path, token = 'token-a') => request(app)[method](`/api/ento-ai/plans${path}`).set('Authorization', `Bearer ${token}`).send({});
const PROJECT_AND_TASKS = {
  steps: [
    { tool: 'create_project', name: 'Q1 launch' },
    { tool: 'create_task', title: 'Book the venue', arg_bindings: { projectId: '{{step0.result.projectId}}' } },
    { tool: 'create_task', title: 'Draft the invite', dueDate: '2026-12-01', arg_bindings: { projectId: '{{step0.result.projectId}}' } },
  ],
};

/** Asks once with a scripted propose_plan call; returns the steps the route emitted. */
async function proposePlanVia(args) {
  mockScript.push({ calls: [{ name: 'propose_plan', args }] }, { text: 'Planned. It waits for your Confirm plan.' });
  const ev = sse((await ask('set it up')).text);
  return { ev, steps: ev.filter((e) => e.type === 'proposal').map((e) => e.proposal) };
}

describe('EAI-06 plans', () => {
  test('flag off: no propose_plan for the model, and the plan endpoints are 404', async () => {
    process.env.ENTO_AI_WRITE_TOOLS = 'false';
    mockScript.push({ text: 'hi' });
    await ask('hi');
    expect(mockModelParams[0].tools[0].functionDeclarations.map((d) => d.name)).not.toContain('propose_plan');
    for (const path of ['/x/confirm', '/x/reject', '/x/undo']) expect((await plan('post', path)).status).toBe(404);
  });

  test('propose_plan records every step under one plan_id and creates nothing', async () => {
    const { ev, steps } = await proposePlanVia(PROJECT_AND_TASKS);
    expect(steps).toHaveLength(3);
    expect(new Set(steps.map((s) => s.planId)).size).toBe(1);
    expect(steps.map((s) => [s.stepOrder, s.toolName, s.status])).toEqual([
      [0, 'create_project', 'proposed'], [1, 'create_task', 'proposed'], [2, 'create_task', 'proposed'],
    ]);
    expect(steps[1].summary).toBe('Create task "Book the venue" · in the new project');
    expect(rows('ento_ai_action_log')[1].arg_bindings).toEqual({ projectId: '{{step0.result.projectId}}' });
    expect(rows('projects')).toHaveLength(2);
    expect(rows('tasks')).toHaveLength(2);
    expect(ev.at(-1).tools).toEqual([]); // a plan is cards, not a chip
  });

  test('a step cannot be confirmed, dismissed, edited or undone on its own', async () => {
    const { steps } = await proposePlanVia(PROJECT_AND_TASKS);
    for (const [method, path] of [['post', '/confirm'], ['post', '/reject'], ['post', '/undo'], ['patch', '']]) {
      const res = await act(method, `/${steps[1].id}${path}`, method === 'patch' ? { title: 'x' } : {});
      expect(res.status).toBe(409);
    }
    expect(rows('tasks')).toHaveLength(2);
  });

  test('Confirm plan runs the steps in order and fills the binding; Undo plan reverses all of it', async () => {
    const { steps } = await proposePlanVia(PROJECT_AND_TASKS);
    const res = await plan('post', `/${steps[0].planId}/confirm`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.proposals.map((p) => p.status)).toEqual(['executed', 'executed', 'executed']);
    const project = rows('projects').find((p) => p.name === 'Q1 launch');
    const made = rows('tasks').filter((t) => ['Book the venue', 'Draft the invite'].includes(t.title));
    expect(made).toHaveLength(2);
    for (const t of made) expect(t).toMatchObject({ project_id: project.id, org_id: 'org-a' });

    expect((await plan('post', `/${steps[0].planId}/confirm`)).status).toBe(409); // not twice

    const undone = await plan('post', `/${steps[0].planId}/undo`);
    expect(undone.body.ok).toBe(true);
    expect(undone.body.proposals.map((p) => p.status)).toEqual(['undone', 'undone', 'undone']);
    expect(rows('projects')).toHaveLength(2);
    expect(rows('tasks')).toHaveLength(2);
  });

  test('a plan of three updates undoes in reverse, including two changes to the same task', async () => {
    const { steps } = await proposePlanVia({ steps: [
      { tool: 'update_task', taskId: TASK_A, priority: 'high' },
      { tool: 'update_task', taskId: TASK_A, dueDate: '2026-12-05' },
      { tool: 'assign_task', taskId: TASK_A, assignedTo: 'Sam' },
    ] });
    expect((await plan('post', `/${steps[0].planId}/confirm`)).body.ok).toBe(true);
    expect(rows('tasks').find((t) => t.id === TASK_A)).toMatchObject({ priority: 'high', due_date: '2026-12-05', assigned_to: 'Sam' });
    const undone = await plan('post', `/${steps[0].planId}/undo`);
    expect(undone.body).toMatchObject({ ok: true });
    expect(rows('tasks').find((t) => t.id === TASK_A)).toMatchObject({ priority: 'medium', due_date: null, assigned_to: null });
  });

  test('a step that fails stops the plan; done steps stay done and Undo plan reverses them', async () => {
    const { steps } = await proposePlanVia(PROJECT_AND_TASKS);
    mockDb.failOn = (table, q) => (table === 'tasks' && q.op === 'insert' && q.value.title === 'Draft the invite' ? 'insert failed' : null);
    const res = await plan('post', `/${steps[0].planId}/confirm`);
    expect(res.body).toMatchObject({ ok: false, failedStep: 3 });
    expect(res.body.error).toMatch(/Step 3 stopped the plan/);
    expect(res.body.proposals.map((p) => p.status)).toEqual(['executed', 'executed', 'failed']);
    mockDb.failOn = null;
    const undone = await plan('post', `/${steps[0].planId}/undo`);
    expect(undone.body.proposals.map((p) => p.status)).toEqual(['undone', 'undone', 'failed']);
    expect(rows('projects')).toHaveLength(2);
    expect(rows('tasks')).toHaveLength(2);
  });

  test('a step that is no longer valid stops the plan before anything runs', async () => {
    const { steps } = await proposePlanVia({ steps: [
      { tool: 'create_task', title: 'First' },
      { tool: 'update_task', taskId: TASK_A, status: 'done' },
    ] });
    mockDb.tables.tasks = mockDb.tables.tasks.filter((t) => t.id !== TASK_A);
    const res = await plan('post', `/${steps[0].planId}/confirm`);
    expect(res.status).toBe(422);
    expect(rows('tasks').filter((t) => t.title === 'First')).toHaveLength(0);
    expect(rows('ento_ai_action_log').map((r) => r.status)).toEqual(['proposed', 'proposed']);
  });

  test('two tabs confirming at once run each step once', async () => {
    const { steps } = await proposePlanVia(PROJECT_AND_TASKS);
    const [a, b] = await Promise.all([plan('post', `/${steps[0].planId}/confirm`), plan('post', `/${steps[0].planId}/confirm`)]);
    expect([a.body.ok, b.body.ok].filter(Boolean)).toHaveLength(1);
    expect(rows('projects').filter((p) => p.name === 'Q1 launch')).toHaveLength(1);
    expect(rows('tasks').filter((t) => t.title === 'Book the venue')).toHaveLength(1);
  });

  test('Dismiss rejects every step and writes nothing else', async () => {
    const { steps } = await proposePlanVia(PROJECT_AND_TASKS);
    const res = await plan('post', `/${steps[0].planId}/reject`);
    expect(res.body.proposals.map((p) => p.status)).toEqual(['rejected', 'rejected', 'rejected']);
    expect((await plan('post', `/${steps[0].planId}/confirm`)).status).toBe(409);
    expect(rows('projects')).toHaveLength(2);
  });

  test('another user cannot see or run the plan', async () => {
    const { steps } = await proposePlanVia(PROJECT_AND_TASKS);
    expect((await plan('post', `/${steps[0].planId}/confirm`, 'token-b')).status).toBe(404);
    expect(rows('projects')).toHaveLength(2);
  });

  test.each([
    ['one step', { steps: [{ tool: 'create_task', title: 'Only' }] }, /at least 2 steps/],
    ['an unknown tool', { steps: [{ tool: 'send_email' }, { tool: 'create_task', title: 'x' }] }, /unknown tool/],
    ['a binding to a later step', { steps: [{ tool: 'create_task', title: 'x', arg_bindings: { projectId: '{{step1.result.projectId}}' } }, { tool: 'create_project', name: 'P' }] }, /runs before it/],
    ['a binding from the wrong tool', { steps: [{ tool: 'create_task', title: 'a' }, { tool: 'create_task', title: 'b', arg_bindings: { projectId: '{{step0.result.projectId}}' } }] }, /create_project step/],
    ['a key that cannot be bound', { steps: [{ tool: 'create_project', name: 'P' }, { tool: 'update_task', taskId: TASK_A, status: 'done', arg_bindings: { taskId: '{{step0.result.projectId}}' } }] }, /cannot come from an earlier step/],
    ['a step in another org', { steps: [{ tool: 'create_task', title: 'a' }, { tool: 'update_task', taskId: TASK_B, status: 'done' }] }, /No task with that id/],
  ])('refuses %s, and writes no row', async (_name, args, message) => {
    const { ev, steps } = await proposePlanVia(args);
    expect(steps).toHaveLength(0);
    expect(ev.find((e) => e.type === 'tool_end').tools).toEqual([{ name: 'propose_plan', ok: false, count: 0 }]);
    expect(rows('ento_ai_action_log')).toEqual([]);
    const direct = await require('../services/entoAi/actionLog').proposePlan(args, { db: mockClient('user-a'), orgIds: ['org-a'], userId: 'user-a' });
    expect(direct).toMatchObject({ ok: false, response: { error: expect.stringMatching(message) } });
  });

  test('resolveBindings refuses a step that produced no value', () => {
    const { resolveBindings } = require('../services/entoAi/actionLog');
    expect(resolveBindings({ title: 'a' }, { projectId: '{{step0.result.projectId}}' }, { 0: { projectId: 'p1' } })).toEqual({ title: 'a', projectId: 'p1' });
    expect(() => resolveBindings({}, { projectId: '{{step0.result.projectId}}' }, {})).toThrow(/did not produce/);
  });
});

// ── EAI-06: proactive signals ────────────────────────────────────────
describe('EAI-06 signals', () => {
  const signals = (token = 'token-a') => request(app).get('/api/ento-ai/signals').set('Authorization', `Bearer ${token}`);
  const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  test('an overdue open task and a meeting within the hour are signals; done, future and other-org records are not', async () => {
    process.env.ENTO_AI_WRITE_TOOLS = 'false'; // read-only, so it answers whatever the flag says
    mockDb.tables.tasks.push(
      { id: 'late', org_id: 'org-a', title: 'Send the deck', status: 'open', due_date: day(-3) },
      { id: 'done', org_id: 'org-a', title: 'Old', status: 'done', due_date: day(-3) },
      { id: 'future', org_id: 'org-a', title: 'Later', status: 'open', due_date: day(2) },
      { id: 'other', org_id: 'org-b', title: 'Not yours', status: 'open', due_date: day(-3) },
    );
    mockDb.tables.meetings.push({ id: 'soon', org_id: 'org-a', title: 'Client call', start_time: new Date(Date.now() + 20 * 60000).toISOString() });
    const res = await signals();
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.signals.map((s) => s.id)).toEqual(['meeting:soon', 'task:late']);
    expect(res.body.signals[1]).toMatchObject({ kind: 'overdue_task', label: '"Send the deck" is 3 days overdue' });
    expect(res.body.signals[1].query).toMatch(/Send the deck/);
    // RLS alone hides 'other' here, so check the second fence on the queries themselves.
    const reads = mockDb.queries.filter((x) => ['tasks', 'meetings', 'action_items'].includes(x.q.table));
    expect(reads).toHaveLength(3);
    for (const { q } of reads) expect(q.filters.some(([k, op]) => k === 'org_id' && op === 'in')).toBe(true);
  });

  test('a failed read is a 502, never an empty list', async () => {
    mockDb.failOn = (table) => (table === 'tasks' ? 'boom' : null);
    expect((await signals()).status).toBe(502);
  });

  test('anonymous → 401', async () => {
    expect((await request(app).get('/api/ento-ai/signals')).status).toBe(401);
  });
});
