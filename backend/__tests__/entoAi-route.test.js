/**
 * Entomate AI agent loop + read tools (EAI-04).
 *
 * Guards docs/app-dev/entomate-ai-APP-PRODUCT.md D1/D2 and §6 P3:
 *   - POST /api/ento-ai/query rejects anonymous and forged callers (401).
 *   - Every tool query goes through the caller's user-JWT client and carries
 *     the org fence (.in('org_id', orgIds)); the service client reads nothing.
 *   - The loop runs tool rounds, emits tool_start / tool_end, then answers.
 *   - A bad record id never reaches the database.
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

// Chainable PostgREST stand-in that records every query (table + calls).
function mockClient(log, results = {}) {
  return {
    from(table) {
      const entry = { table, calls: [] };
      log.push(entry);
      const result = results[table] || { data: table === 'conversations' ? { id: 'conv-1' } : [], count: 0, error: null };
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

// Scripted Gemini: each generateContent returns the next scripted response.
// mockSent holds a copy of the turn list each call was given.
const mockScript = [];
const mockSent = [];
const mockModelParams = [];
function mockResponse(step) {
  const parts = step.calls ? step.calls.map((c) => ({ functionCall: c })) : [{ text: step.text || '' }];
  return {
    response: {
      candidates: [{ content: { role: 'model', parts } }],
      functionCalls: () => (step.calls ? step.calls : undefined),
      text: () => step.text || '',
    },
  };
}
jest.mock('../config/gemini', () => ({
  isConfigured: jest.fn(() => true),
  genAI: {
    getGenerativeModel: (params) => {
      mockModelParams.push(params);
      return {
        generateContent: async ({ contents }) => {
          mockSent.push(JSON.parse(JSON.stringify(contents)));
          const step = mockScript.shift() || { text: 'fallback answer' };
          return mockResponse(step);
        },
      };
    },
  },
}));
jest.mock('../services/askService', () => ({ ownedConversationId: jest.fn(async () => null) }));
jest.mock('../utils/orgContext', () => ({ getOrgIdsForUser: jest.fn(async () => ['org-a']) }));
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../services/calendarService', () => ({ isConfigured: () => false, getEvents: jest.fn() }));

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
  expect(ev.at(-1)).toMatchObject({ type: 'complete', answer: 'You have **1** open task: **Ship it**.', conversationId: 'conv-1' });

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
  for (const q of mockUserQueries.filter((x) => !x.table.startsWith('conversation'))) {
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

test('a model error after start ends the stream with an error event', async () => {
  mockScript.push({ calls: [{ name: 'list_tasks', args: {} }] });
  const original = gemini.genAI.getGenerativeModel;
  gemini.genAI.getGenerativeModel = () => ({ generateContent: async () => { throw new Error('404 model'); } });
  try {
    const res = await request(app).post('/api/ento-ai/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'x' });
    // The model fails on the first send, which is after the stream started.
    expect(events(res.text).map((e) => e.type)).toEqual(['start', 'error']);
  } finally {
    gemini.genAI.getGenerativeModel = original;
  }
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
