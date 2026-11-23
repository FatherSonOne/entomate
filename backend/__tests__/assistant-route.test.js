/**
 * Assistant route perimeter tests (EAI-01).
 *
 * Guards docs/app-dev/entomate-ai-APP-PRODUCT.md §2 / D2:
 *   - POST /api/assistant/query rejects anonymous and forged callers (401).
 *   - Every org table (tasks, meetings, workflows, projects, agents) and the
 *     conversation writes go through the caller's user-JWT client, never the
 *     service-role client, so RLS is the perimeter (EAI-01 + EAI-01b).
 *   - Only calendar_events (no table yet) may still use the service client.
 *
 * The real authenticate middleware runs; only @supabase/supabase-js's
 * getUser is faked so no network call is made.
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

// Chainable stand-in for a PostgREST query builder that records table names.
function mockClient(tables) {
  return {
    from(table) {
      tables.push(table);
      const result = { data: table === 'conversations' ? { id: 'conv-1' } : [], count: 0, error: null };
      const builder = new Proxy({}, {
        get: (_, prop) => prop === 'then' ? (resolve) => resolve(result) : () => builder,
      });
      return builder;
    },
  };
}
const mockUserTables = [];
const mockServiceTables = [];

jest.mock('../config/supabase', () => ({
  supabase: mockClient(mockServiceTables),
  supabaseAdmin: mockClient(mockServiceTables),
  createUserClient: jest.fn(() => mockClient(mockUserTables)),
}));

jest.mock('../config/ai', () => ({
  isConfigured: () => true,
  getProviderName: () => 'test',
  answerQuestionStreaming: jest.fn(async (_q, _c, { onChunk }) => { onChunk('ok'); }),
}));
jest.mock('../services/askService', () => ({ ownedConversationId: jest.fn(async () => null) }));
jest.mock('../utils/orgContext', () => ({ getOrgIdsForUser: jest.fn(async () => ['org-a']) }));
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
// EAI-07 metering reads billing tables on the service client; it has its own test (aiUsage.test.js).
jest.mock('../services/aiUsage', () => ({ meterAi: jest.fn((req, res, next) => next()), addUsage: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { createUserClient } = require('../config/supabase');
const ai = require('../config/ai');

const app = express();
app.use(express.json());
app.use('/api/assistant', require('../routes/assistant'));

const SERVICE_ALLOWED = ['calendar_events'];

beforeEach(() => { mockUserTables.length = 0; mockServiceTables.length = 0; jest.clearAllMocks(); });

test('anonymous query → 401, no data read, no AI call', async () => {
  const res = await request(app).post('/api/assistant/query').send({ question: 'list tasks', section: 'tasks' });
  expect(res.status).toBe(401);
  expect(createUserClient).not.toHaveBeenCalled();
  expect(ai.answerQuestionStreaming).not.toHaveBeenCalled();
});

test('forged token → 401', async () => {
  const res = await request(app).post('/api/assistant/query')
    .set('Authorization', 'Bearer forged').send({ question: 'list tasks' });
  expect(res.status).toBe(401);
  expect(createUserClient).not.toHaveBeenCalled();
});

test.each(['dashboard', 'tasks', 'meetings', 'workflows', 'automations', 'analytics', 'projects', 'agents', 'calendar'])(
  '%s: org tables and conversation writes use the caller-JWT client only',
  async (section) => {
    const res = await request(app).post('/api/assistant/query')
      .set('Authorization', 'Bearer good-token').send({ question: 'what is due', section });
    expect(res.status).toBe(200);
    expect(createUserClient).toHaveBeenCalledWith('good-token');
    expect(mockUserTables).toEqual(expect.arrayContaining(['conversations', 'conversation_messages']));
    expect(mockServiceTables.filter(t => !SERVICE_ALLOWED.includes(t))).toEqual([]);
    expect(res.text).toContain('"type":"complete"');
  }
);
