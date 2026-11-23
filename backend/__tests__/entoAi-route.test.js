/**
 * Entomate AI agent loop + read tools (EAI-04).
 *
 * Guards docs/app-dev/entomate-ai-APP-PRODUCT.md D1/D2 and §6 P3:
 *   - POST /api/ento-ai/query rejects anonymous and forged callers (401).
 *   - Every tool query goes through the caller's user-JWT client and carries
 *     the org fence (.in('org_id', orgIds)); the service client reads nothing.
 *   - The loop runs tool rounds, emits tool_start / tool_end, then answers.
 *   - A bad record id never reaches the database.
 *   - EAI-03: text streams as the model writes it; a preamble before a tool
 *     call is taken back (chunk_reset); raw streamed parts (thought
 *     signatures) go back to the model; the thread is read and appended
 *     under the user client, and GET /threads/latest reopens it.
 *
 * The real authenticate middleware runs; getUser and Gemini are faked.
 */

'use strict';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token) => token === 'good-token'
        ? { data: { user: { id: 'user-a', email: 'a@example.com', user_metadata: {} } }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } },
    },
  }),
}));

// Chainable PostgREST stand-in that records every query (table + calls) and rpc.
function mockClient(log, results = {}) {
  return {
    rpc: async (fn, args) => {
      log.push({ rpc: fn, args });
      return results[`rpc:${fn}`] || { data: 'thread-1', error: null };
    },
    from(table) {
      const entry = { table, calls: [] };
      log.push(entry);
      const result = results[table] || { data: [], count: 0, error: null };
      const builder = new Proxy({}, {
        get: (_, prop) => {
          if (prop === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
          return (...args) => { entry.calls.push([prop, args]); return builder; };
        },
      });
      return builder;
    },
  };
}
const mockUserQueries = [];
const mockServiceQueries = [];
const mockResults = {};

jest.mock('../config/supabase', () => ({
  supabase: mockClient(mockServiceQueries),
  supabaseAdmin: mockClient(mockServiceQueries),
  createUserClient: jest.fn(() => mockClient(mockUserQueries, mockResults)),
}));

// Scripted Gemini: each generateContentStream streams the next scripted step.
// A step is { text } (one chunk), { chunks: [parts...] } (raw parts, one chunk each),
// or { calls } (function calls in one chunk). mockSent holds a copy of the turn
// list each call was given.
const mockScript = [];
const mockSent = [];
const mockModelParams = [];
function mockChunks(step) {
  if (step.chunks) return step.chunks.map((part) => [part]);
  if (step.calls) return [step.calls.map((c) => ({ functionCall: c }))];
  return [[{ text: step.text || '' }]];
}
jest.mock('../config/gemini', () => ({
  isConfigured: jest.fn(() => true),
  genAI: {
    getGenerativeModel: (params) => {
      mockModelParams.push(params);
      return {
        generateContentStream: async ({ contents }) => {
          mockSent.push(JSON.parse(JSON.stringify(contents)));
          const step = mockScript.shift() || { text: 'fallback answer' };
          async function* stream() {
            const chunks = mockChunks(step);
            // { usage }: the last chunk carries the call's totals; earlier chunks a partial count, as Gemini sends.
            for (const [i, parts] of chunks.entries()) {
              const usageMetadata = !step.usage ? null
                : i === chunks.length - 1 ? step.usage : { promptTokenCount: step.usage.promptTokenCount };
              yield { candidates: [{ content: { role: 'model', parts } }], ...(usageMetadata ? { usageMetadata } : {}) };
            }
          }
          // The SDK's aggregate promise; the route must not depend on it.
          return { stream: stream(), response: Promise.reject(new Error('aggregate not used')) };
        },
      };
    },
  },
}));
// aiLimiter (10/min per IP) has its own test; this file sends more questions than that.
jest.mock('../middleware/rateLimiter', () => ({ aiLimiter: (req, res, next) => next() }));
jest.mock('../utils/orgContext',() => ({ getOrgIdsForUser: jest.fn(async () => ['org-a']) }));
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../services/calendarService', () => ({ isConfigured: () => false, getEvents: jest.fn() }));
// EAI-07 metering reads billing tables on the service client; it has its own test (aiUsage.test.js).
jest.mock('../services/aiUsage', () => ({ meterAi: jest.fn((req, res, next) => next()), addUsage: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { createUserClient } = require('../config/supabase');
const gemini = require('../config/gemini');
const { runTool, declarations, TOOLS } = require('../services/entoAi/tools');

const app = express();
app.use(express.json());
app.use('/api/ento-ai', require('../routes/entoAi'));

const ORG = { db: null, orgIds: ['org-a'], userId: 'user-a' };
const ID = '11111111-2222-4333-8444-555555555555';

function events(text) {
  return text.split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));
}

beforeEach(() => {
  mockUserQueries.length = 0;
  mockServiceQueries.length = 0;
  mockScript.length = 0;
  mockSent.length = 0;
  mockModelParams.length = 0;
  for (const k of Object.keys(mockResults)) delete mockResults[k];
  jest.clearAllMocks();
  gemini.isConfigured.mockReturnValue(true);
  ORG.db = mockClient(mockUserQueries, mockResults);
});

test('anonymous query → 401, no data read, no model call', async () => {
  const res = await request(app).post('/api/ento-ai/query').send({ question: 'list tasks' });
  expect(res.status).toBe(401);
  expect(createUserClient).not.toHaveBeenCalled();
  expect(mockSent).toEqual([]);
});

test('forged token → 401', async () => {
  const res = await request(app).post('/api/ento-ai/query')
    .set('Authorization', 'Bearer forged').send({ question: 'list tasks' });
  expect(res.status).toBe(401);
  expect(createUserClient).not.toHaveBeenCalled();
});

test('Gemini not configured → 503 before any stream (the panel falls back)', async () => {
  gemini.isConfigured.mockReturnValue(false);
  const res = await request(app).post('/api/ento-ai/query')
    .set('Authorization', 'Bearer good-token').send({ question: 'list tasks' });
  expect(res.status).toBe(503);
});

test('one tool round: events in order, tools on the user client with the org fence', async () => {
  mockResults.tasks = { data: [{ id: ID, title: 'Ship it', status: 'todo' }], count: 1, error: null };
  mockScript.push(
    { calls: [{ name: 'list_tasks', args: { status: 'open' }, id: 'call-1' }, { name: 'list_projects', args: {} }] },
    { text: 'You have **1** open task: **Ship it**.' },
  );
  const res = await request(app).post('/api/ento-ai/query')
    .set('Authorization', 'Bearer good-token').send({ question: 'how many open tasks?', section: 'tasks' });

  expect(res.status).toBe(200);
  expect(createUserClient).toHaveBeenCalledWith('good-token');
  const ev = events(res.text);
  expect(ev.map((e) => e.type)).toEqual(['start', 'tool_start', 'tool_end', 'answering', 'chunk', 'followUp', 'complete']);
  expect(ev[1]).toEqual({ type: 'tool_start', turn: 1, tools: ['list_tasks', 'list_projects'] });
  expect(ev[2].tools).toEqual([{ name: 'list_tasks', ok: true, count: 1 }, { name: 'list_projects', ok: true, count: 0 }]);
  expect(ev.at(-1)).toMatchObject({ type: 'complete', answer: 'You have **1** open task: **Ship it**.', threadId: 'thread-1' });

  // The model turn went back unchanged, then the results in a USER turn carrying the call id
  // (current models refuse role "function").
  const second = mockSent[1];
  expect(second.map((c) => c.role)).toEqual(['user', 'model', 'user']);
  expect(second[1].parts[0].functionCall).toMatchObject({ name: 'list_tasks', id: 'call-1' });
  expect(second[2].parts).toEqual([
    { functionResponse: { id: 'call-1', name: 'list_tasks', response: expect.objectContaining({ total: 1 }) } },
    { functionResponse: { name: 'list_projects', response: expect.objectContaining({ total: 0 }) } },
  ]);
  expect(JSON.stringify(mockSent)).not.toMatch(/"role":"function"/);
  // Declared tools reached the model; nothing was read with the service client.
  expect(mockModelParams[0].tools[0].functionDeclarations.map((d) => d.name)).toEqual(Object.keys(TOOLS));
  expect(mockServiceQueries).toEqual([]);
  for (const q of mockUserQueries.filter((x) => x.table)) {
    expect(q.calls).toContainEqual(['in', ['org_id', ['org-a']]]);
  }
});

test('no tool call: answers directly, no follow-ups invented', async () => {
  mockScript.push({ text: 'Hello.' });
  const res = await request(app).post('/api/ento-ai/query')
    .set('Authorization', 'Bearer good-token').send({ question: 'hi' });
  const ev = events(res.text);
  expect(ev.map((e) => e.type)).toEqual(['start', 'answering', 'chunk', 'complete']);
  expect(ev.at(-1).tools).toEqual([]);
});

test('rounds are capped at 5, then the model is asked for the answer', async () => {
  for (let i = 0; i < 6; i += 1) mockScript.push({ calls: [{ name: 'list_tasks', args: {} }] });
  mockScript.push({ text: 'Done looking.' });
  const res = await request(app).post('/api/ento-ai/query')
    .set('Authorization', 'Bearer good-token').send({ question: 'loop forever' });
  const ev = events(res.text);
  expect(ev.filter((e) => e.type === 'tool_start')).toHaveLength(5);
  expect(ev.at(-1)).toMatchObject({ type: 'complete', answer: 'Done looking.' });
  expect(mockSent.at(-1).at(-1).parts[0].text).toMatch(/Do not call any more tools/);
});

test('EAI-07: the route is metered and each model turn reports its usageMetadata', async () => {
  const { meterAi, addUsage } = require('../services/aiUsage');
  const first = { promptTokenCount: 900, candidatesTokenCount: 20, thoughtsTokenCount: 30 };
  const second = { promptTokenCount: 1500, candidatesTokenCount: 120 };
  mockScript.push({ calls: [{ name: 'list_tasks', args: {} }], usage: first });
  mockScript.push({ chunks: [{ text: 'You have ' }, { text: 'none.' }], usage: second });
  const res = await request(app).post('/api/ento-ai/query')
    .set('Authorization', 'Bearer good-token').send({ question: 'tasks?' });
  expect(events(res.text).at(-1).type).toBe('complete');
  expect(meterAi).toHaveBeenCalledTimes(1);
  expect(addUsage.mock.calls).toEqual([[first], [second]]);
});

test('a model error after start ends the stream with an error event', async () => {
  mockScript.push({ calls: [{ name: 'list_tasks', args: {} }] });
  const original = gemini.genAI.getGenerativeModel;
  gemini.genAI.getGenerativeModel = () => ({ generateContentStream: async () => { throw new Error('404 model'); } });
  try {
    const res = await request(app).post('/api/ento-ai/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'x' });
    // The model fails on the first send, which is after the stream started.
    expect(events(res.text).map((e) => e.type)).toEqual(['start', 'error']);
  } finally {
    gemini.genAI.getGenerativeModel = original;
  }
});

describe('streaming (EAI-03)', () => {
  test('text goes out chunk by chunk as the model writes it', async () => {
    mockScript.push({ chunks: [{ text: 'You have ' }, { text: '**3** ' }, { text: 'meetings.' }] });
    const res = await request(app).post('/api/ento-ai/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'meetings?' });
    const ev = events(res.text);
    expect(ev.map((e) => e.type)).toEqual(['start', 'answering', 'chunk', 'chunk', 'chunk', 'complete']);
    expect(ev.filter((e) => e.type === 'chunk').map((e) => e.content)).toEqual(['You have ', '**3** ', 'meetings.']);
    expect(ev.at(-1).answer).toBe('You have **3** meetings.');
  });

  test('a preamble before a tool call is taken back; raw parts go back to the model', async () => {
    mockScript.push(
      { chunks: [{ text: 'Let me check. ' }, { functionCall: { name: 'list_tasks', args: {}, id: 'c1' }, thoughtSignature: 'sig-1' }] },
      { chunks: [{ text: 'Working on it', thought: true }, { text: 'No open tasks.' }] },
    );
    const res = await request(app).post('/api/ento-ai/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'open tasks?' });
    const ev = events(res.text);
    expect(ev.map((e) => e.type)).toEqual(['start', 'answering', 'chunk', 'chunk_reset', 'tool_start', 'tool_end', 'answering', 'chunk', 'complete']);
    // A thought part is never shown as the answer.
    expect(ev.filter((e) => e.type === 'chunk').map((e) => e.content)).toEqual(['Let me check. ', 'No open tasks.']);
    expect(ev.at(-1).answer).toBe('No open tasks.');
    // The model turn went back with every streamed part, thought signature included
    // (the SDK aggregate would have dropped it).
    expect(mockSent[1][1]).toEqual({
      role: 'model',
      parts: [{ text: 'Let me check. ' }, { functionCall: { name: 'list_tasks', args: {}, id: 'c1' }, thoughtSignature: 'sig-1' }],
    });
  });

  test('an empty answer after the retry is still sent as text', async () => {
    mockScript.push({ text: '' }, { text: '   ' });
    const res = await request(app).post('/api/ento-ai/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'x' });
    const ev = events(res.text);
    expect(ev.filter((e) => e.type === 'chunk').map((e) => e.content).join('')).toMatch(/could not put an answer together/);
    expect(ev.at(-1).type).toBe('complete');
  });
});

describe('threads (EAI-03)', () => {
  const THREAD = '99999999-2222-4333-8444-555555555555';

  test('a thread id reads that thread on the user client and feeds its turns as history', async () => {
    mockResults.ento_ai_threads = {
      data: { id: THREAD, messages: [
        { role: 'assistant', content: 'stray opener' },
        { role: 'user', content: 'list my tasks', section: 'tasks', ts: 1 },
        { role: 'assistant', content: 'You have **Ship it**.', tools: [], ts: 2 },
      ] },
      error: null,
    };
    mockScript.push({ text: 'It is due Friday.' });
    const res = await request(app).post('/api/ento-ai/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'when is it due?', section: 'tasks', threadId: THREAD });
    expect(events(res.text).at(-1)).toMatchObject({ type: 'complete', threadId: 'thread-1' });

    const read = mockUserQueries.find((q) => q.table === 'ento_ai_threads');
    expect(read.calls).toContainEqual(['eq', ['id', THREAD]]);
    // History starts with a user turn: the leading assistant message is dropped.
    expect(mockSent[0].map((c) => [c.role, c.parts[0].text])).toEqual([
      ['user', 'list my tasks'], ['model', 'You have **Ship it**.'], ['user', 'when is it due?'],
    ]);
    const save = mockUserQueries.find((q) => q.rpc);
    expect(save.rpc).toBe('ento_ai_append_thread');
    expect(save.args).toMatchObject({ p_thread_id: THREAD, p_org_id: 'org-a', p_title: 'when is it due?' });
    expect(save.args.p_messages).toEqual([
      { role: 'user', content: 'when is it due?', ts: expect.any(Number), section: 'tasks' },
      { role: 'assistant', content: 'It is due Friday.', tools: [], followUp: [], ts: expect.any(Number), section: 'tasks' },
    ]);
    expect(mockServiceQueries).toEqual([]);
  });

  test('a thread id that is not a uuid is never read and starts a new thread', async () => {
    mockScript.push({ text: 'Hi.' });
    await request(app).post('/api/ento-ai/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'hi', threadId: "x' or 1=1" });
    expect(mockUserQueries.find((q) => q.table === 'ento_ai_threads')).toBeUndefined();
    expect(mockUserQueries.find((q) => q.rpc).args.p_thread_id).toBeNull();
  });

  test('a failed save still completes the answer and keeps the requested thread id', async () => {
    mockResults['rpc:ento_ai_append_thread'] = { data: null, error: { message: 'permission denied' } };
    mockScript.push({ text: 'Done.' });
    const res = await request(app).post('/api/ento-ai/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'q', threadId: THREAD });
    expect(events(res.text).at(-1)).toMatchObject({ type: 'complete', answer: 'Done.', threadId: THREAD });
  });

  test('GET /threads/latest: anonymous → 401', async () => {
    const res = await request(app).get('/api/ento-ai/threads/latest');
    expect(res.status).toBe(401);
    expect(createUserClient).not.toHaveBeenCalled();
  });

  test('GET /threads/latest reads the newest thread on the user client with the org fence', async () => {
    mockResults.ento_ai_threads = { data: { id: THREAD, title: 't', messages: [], updated_at: 'now' }, error: null };
    const res = await request(app).get('/api/ento-ai/threads/latest').set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(200);
    expect(res.body.thread).toMatchObject({ id: THREAD });
    expect(createUserClient).toHaveBeenCalledWith('good-token');
    expect(mockUserQueries[0].calls).toEqual(expect.arrayContaining([
      ['in', ['org_id', ['org-a']]], ['order', ['updated_at', { ascending: false }]], ['limit', [1]],
    ]));
    expect(mockServiceQueries).toEqual([]);
  });

  test('GET /threads/latest: a failed read is a 502, never "no thread"', async () => {
    mockResults.ento_ai_threads = { data: null, error: { message: 'relation does not exist' } };
    const res = await request(app).get('/api/ento-ai/threads/latest').set('Authorization', 'Bearer good-token');
    expect(res.status).toBe(502);
  });
});

describe('History rail (EAI-02b)', () => {
  const THREAD = '99999999-2222-4333-8444-555555555555';
  const as = (req) => req.set('Authorization', 'Bearer good-token');
  const callsOf = (table) => mockUserQueries.find((q) => q.table === table)?.calls || [];

  test.each([
    ['get', '/api/ento-ai/threads'],
    ['get', `/api/ento-ai/threads/${THREAD}`],
    ['delete', `/api/ento-ai/threads/${THREAD}`],
  ])('anonymous %s %s → 401, nothing read', async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
    expect(mockUserQueries).toEqual([]);
  });

  test('GET /threads lists the newest 20 (no messages) on the user client with the org fence', async () => {
    mockResults.ento_ai_threads = { data: [{ id: THREAD, title: 'Q1 plan', updated_at: 'now' }], error: null };
    const res = await as(request(app).get('/api/ento-ai/threads'));
    expect(res.status).toBe(200);
    expect(res.body.threads).toEqual([{ id: THREAD, title: 'Q1 plan', updated_at: 'now' }]);
    expect(callsOf('ento_ai_threads')).toEqual([
      ['select', ['id, title, updated_at']],
      ['in', ['org_id', ['org-a']]],
      ['order', ['updated_at', { ascending: false }]],
      ['limit', [20]],
    ]);
    expect(mockServiceQueries).toEqual([]);
  });

  test('GET /threads/:id reads that thread with the fence; one the caller cannot see is 404', async () => {
    mockResults.ento_ai_threads = { data: { id: THREAD, title: 't', messages: [{ role: 'user', content: 'hi' }], updated_at: 'now' }, error: null };
    const res = await as(request(app).get(`/api/ento-ai/threads/${THREAD}`));
    expect(res.status).toBe(200);
    expect(res.body.thread.messages).toHaveLength(1);
    expect(callsOf('ento_ai_threads')).toEqual(expect.arrayContaining([['eq', ['id', THREAD]], ['in', ['org_id', ['org-a']]]]));

    mockResults.ento_ai_threads = { data: null, error: null }; // RLS hid it
    expect((await as(request(app).get(`/api/ento-ai/threads/${THREAD}`))).status).toBe(404);
  });

  test('DELETE /threads/:id deletes with the fence and reports a row RLS hid as 404, not success', async () => {
    mockResults.ento_ai_threads = { data: [{ id: THREAD }], error: null };
    const res = await as(request(app).delete(`/api/ento-ai/threads/${THREAD}`));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(callsOf('ento_ai_threads')).toEqual([
      ['delete', []], ['eq', ['id', THREAD]], ['in', ['org_id', ['org-a']]], ['select', ['id']],
    ]);

    mockUserQueries.length = 0;
    mockResults.ento_ai_threads = { data: [], error: null };
    expect((await as(request(app).delete(`/api/ento-ai/threads/${THREAD}`))).status).toBe(404);
  });

  test.each([['get'], ['delete']])('%s with an id that is not a uuid → 400, never queried', async (method) => {
    expect((await as(request(app)[method]('/api/ento-ai/threads/not-a-uuid'))).status).toBe(400);
    expect(mockUserQueries).toEqual([]);
  });

  test('a failed read or delete is a 502, never an empty list or a success', async () => {
    mockResults.ento_ai_threads = { data: null, error: { message: 'boom' } };
    expect((await as(request(app).get('/api/ento-ai/threads'))).status).toBe(502);
    expect((await as(request(app).delete(`/api/ento-ai/threads/${THREAD}`))).status).toBe(502);
  });
});

describe('tools', () => {
  test('every declared tool has a label and an object schema', () => {
    expect(declarations).toHaveLength(9);
    for (const d of declarations) {
      expect(TOOLS[d.name].label).toEqual(expect.any(String));
      expect(d.parameters.type).toBe('object');
    }
    // Goals were removed upstream (5264fec), so no list_goals (spec §9).
    expect(Object.keys(TOOLS)).not.toContain('list_goals');
  });

  test('a bad record id is refused before any query', async () => {
    for (const [name, key] of [['get_meeting', 'meeting_id'], ['get_task', 'task_id'], ['get_project', 'project_id']]) {
      const out = await runTool(name, { [key]: "x' or 1=1" }, ORG);
      expect(out).toMatchObject({ name, ok: false, count: 0 });
      expect(out.response.error).toMatch(/must be a record id/);
    }
    expect(mockUserQueries).toEqual([]);
  });

  test('another org’s record reads as not found (RLS + fence return no row)', async () => {
    mockResults.meetings = { data: null, error: null };
    const out = await runTool('get_meeting', { meeting_id: ID }, ORG);
    expect(out).toEqual({ name: 'get_meeting', ok: true, count: 0, response: { found: false } });
    expect(mockUserQueries[0].calls).toEqual(expect.arrayContaining([['eq', ['id', ID]], ['in', ['org_id', ['org-a']]]]));
  });

  test('open status excludes every finished status', async () => {
    await runTool('list_tasks', {}, ORG);
    expect(mockUserQueries[0].calls).toContainEqual(['not', ['status', 'in', '("done","completed","complete","cancelled")']]);
  });

  test('a database error is a failed step, not "nothing found"', async () => {
    mockResults.tasks = { data: null, error: { message: 'column x does not exist' } };
    const out = await runTool('list_tasks', {}, ORG);
    expect(out.ok).toBe(false);
    expect(out.response.error).toMatch(/Lookup failed: column x does not exist/);
  });

  test('unknown tool and bad dates are reported, not thrown', async () => {
    expect((await runTool('drop_tables', {}, ORG)).ok).toBe(false);
    const out = await runTool('get_calendar', { from: 'next tuesday' }, ORG);
    expect(out.response.error).toMatch(/YYYY-MM-DD/);
  });

  test('get_calendar caps the range and reports an unconfigured Google calendar', async () => {
    const out = await runTool('get_calendar', { from: '2026-01-01', to: '2026-12-31' }, ORG);
    expect(out.ok).toBe(true);
    expect(out.response).toMatchObject({ from: '2026-01-01', to: '2026-03-04', googleCalendar: 'not_configured' });
  });

  test('search_everything reads through the user client', async () => {
    await runTool('search_everything', { query: 'budget review', types: ['tasks'] }, ORG);
    expect(mockUserQueries.map((q) => q.table)).toEqual(['tasks']);
    expect(mockServiceQueries).toEqual([]);
  });
});

describe('record links (EAI-02c slice 3)', () => {
  const { recordLinksOf, recordLinksForAnswer } = require('../services/entoAi/tools');
  const M1 = 'aaaaaaaa-1111-4111-8111-111111111111';
  const M2 = 'aaaaaaaa-2222-4222-8222-222222222222';
  const P1 = 'bbbbbbbb-1111-4111-8111-111111111111';

  test('complete carries the meetings and projects the answer names; the message saves them', async () => {
    mockResults.meetings = { data: [{ id: M1, title: 'Budget review' }, { id: M2, title: 'Standup' }], count: 2, error: null };
    mockResults.projects = { data: [{ id: P1, name: 'Website relaunch' }], count: 1, error: null };
    mockResults.tasks = { data: [{ id: ID, title: 'Ship it', status: 'todo' }], count: 1, error: null };
    mockScript.push(
      { calls: [{ name: 'search_meetings', args: {} }, { name: 'list_projects', args: {} }, { name: 'list_tasks', args: {} }] },
      { text: 'The **budget review** covered the Website relaunch. Ship it is still open.' },
    );
    const res = await request(app).post('/api/ento-ai/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'what happened?' });
    const links = [
      { kind: 'meeting', id: M1, label: 'Budget review' },
      { kind: 'project', id: P1, label: 'Website relaunch' },
    ];
    // Standup is not named; the task has no detail page.
    expect(events(res.text).at(-1).recordLinks).toEqual(links);
    expect(mockUserQueries.find((q) => q.rpc).args.p_messages[1].recordLinks).toEqual(links);
  });

  test('no tool call → recordLinks is an empty list on complete', async () => {
    mockScript.push({ text: 'Hello.' });
    const res = await request(app).post('/api/ento-ai/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'hi' });
    expect(events(res.text).at(-1).recordLinks).toEqual([]);
  });

  test('a failed read adds no links', async () => {
    mockResults.meetings = { data: null, error: { message: 'boom' } };
    mockScript.push({ calls: [{ name: 'search_meetings', args: {} }] }, { text: 'Budget review failed to load.' });
    const res = await request(app).post('/api/ento-ai/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'x' });
    expect(events(res.text).at(-1).recordLinks).toEqual([]);
  });

  test('recordLinksOf reads every result shape and drops a non-uuid id or empty label', () => {
    expect(recordLinksOf({ meeting: { id: M1, title: 'Kickoff', actionItems: [{ meetingId: M1, meetingTitle: 'Kickoff' }] } }))
      .toEqual([{ kind: 'meeting', id: M1, label: 'Kickoff' }, { kind: 'meeting', id: M1, label: 'Kickoff' }]);
    expect(recordLinksOf({ project: { id: P1, name: 'Site', meetings: [{ id: M2, title: 'Sync' }] } }))
      .toEqual([{ kind: 'meeting', id: M2, label: 'Sync' }, { kind: 'project', id: P1, label: 'Site' }]);
    expect(recordLinksOf({ actionItemsDue: [{ meetingId: M2, meetingTitle: ' Sync ' }] }))
      .toEqual([{ kind: 'meeting', id: M2, label: 'Sync' }]);
    expect(recordLinksOf({ groups: {
      meetings: [{ type: 'meeting', id: M1, title: 'Kickoff' }],
      tasks: [{ type: 'task', id: ID, title: 'Ship it' }],
      decisions: [{ type: 'decision', id: ID, title: 'Go', meetingId: M2, meetingTitle: 'Sync' }],
      projects: [{ type: 'project', id: P1, title: 'Site' }],
    } })).toEqual([
      { kind: 'meeting', id: M1, label: 'Kickoff' },
      { kind: 'meeting', id: M2, label: 'Sync' },
      { kind: 'project', id: P1, label: 'Site' },
    ]);
    expect(recordLinksOf({ meetings: [{ id: 'not-a-uuid', title: 'X' }, { id: M1, title: '  ' }, { id: M1 }] })).toEqual([]);
    expect(recordLinksOf(null)).toEqual([]);
  });

  test('recordLinksForAnswer keeps named records once, case-blind, at most 20', () => {
    const k = { kind: 'meeting', id: M1, label: 'Kickoff' };
    expect(recordLinksForAnswer('The KICKOFF ran long.', [k, { ...k }, { kind: 'project', id: P1, label: 'Site' }])).toEqual([k]);
    expect(recordLinksForAnswer('', [k])).toEqual([]);
    const many = Array.from({ length: 25 }, (_, i) => ({ kind: 'project', id: `bbbbbbbb-1111-4111-8111-${String(i).padStart(12, '0')}`, label: `P${i}` }));
    expect(recordLinksForAnswer(many.map((l) => l.label).join(' '), many)).toHaveLength(20);
  });
});

describe('history page search (EAI-02c slice 4)', () => {
  const THREAD = '99999999-2222-4333-8444-555555555555';
  const as = (req) => req.set('Authorization', 'Bearer good-token');
  const rpcCalls = () => mockUserQueries.filter((q) => q.rpc === 'ento_ai_search_threads');

  test('anonymous → 401, nothing read', async () => {
    expect((await request(app).get('/api/ento-ai/threads/search?q=plan')).status).toBe(401);
    expect(mockUserQueries).toEqual([]);
  });

  test('reads through the RPC on the user client with the org fence, trimmed query and page', async () => {
    mockResults['rpc:ento_ai_search_threads'] = {
      data: [{ id: THREAD, title: 'Q1 plan', created_at: 'c', updated_at: 'u', message_count: '4', snippet: 'the plan', total_count: '61' }],
      error: null,
    };
    const res = await as(request(app).get('/api/ento-ai/threads/search?q=%20plan%20&offset=50'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      threads: [{ id: THREAD, title: 'Q1 plan', created_at: 'c', updated_at: 'u', message_count: 4, snippet: 'the plan' }],
      total: 61,
    });
    expect(createUserClient).toHaveBeenCalledWith('good-token');
    expect(rpcCalls()).toEqual([{ rpc: 'ento_ai_search_threads', args: { p_org_ids: ['org-a'], p_query: 'plan', p_limit: 50, p_offset: 50 } }]);
    expect(mockServiceQueries).toEqual([]);
  });

  test('no query lists everything (p_query null); a bad offset reads the first page', async () => {
    mockResults['rpc:ento_ai_search_threads'] = { data: [], error: null };
    const res = await as(request(app).get('/api/ento-ai/threads/search?offset=-7'));
    expect(res.body).toEqual({ threads: [], total: 0 });
    expect(rpcCalls()[0].args).toEqual({ p_org_ids: ['org-a'], p_query: null, p_limit: 50, p_offset: 0 });
  });

  test('a caller in no org gets an empty page and the RPC is never called', async () => {
    require('../utils/orgContext').getOrgIdsForUser.mockResolvedValueOnce([]);
    const res = await as(request(app).get('/api/ento-ai/threads/search?q=x'));
    expect(res.body).toEqual({ threads: [], total: 0 });
    expect(rpcCalls()).toEqual([]);
  });

  test('a failed read is a 502, never an empty list', async () => {
    mockResults['rpc:ento_ai_search_threads'] = { data: null, error: { message: 'boom' } };
    expect((await as(request(app).get('/api/ento-ai/threads/search'))).status).toBe(502);
  });
});

test('the history page names itself to the model, not "Dashboard" (EAI-02c slice 4 fix)', async () => {
  mockScript.push({ text: 'Done.' });
  const res = await request(app).post('/api/ento-ai/query')
    .set('Authorization', 'Bearer good-token').send({ question: 'hi', section: 'assistant' });
  expect(res.status).toBe(200);
  expect(events(res.text)[0]).toMatchObject({ type: 'start', section: 'AI conversations' });
});
