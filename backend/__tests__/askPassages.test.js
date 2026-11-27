const express = require('express');
const request = require('supertest');

jest.mock('../config/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../config/ai', () => ({ isConfigured: jest.fn(() => true), chat: jest.fn() }));
jest.mock('../utils/cache', () => ({}));
jest.mock('../services/aiUsage', () => ({ meterAi: (req, res, next) => next() }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => next() }));
jest.mock('../services/embeddingService', () => ({}));

const { supabase } = require('../config/supabase');
const ai = require('../config/ai');
const app = express();
const orgId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const meetingId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const revision = 'cccccccc-cccc-4ccc-accc-cccccccccccc';
const userId = 'dddddddd-dddd-4ddd-addd-dddddddddddd';
const conversationId = 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee';
const title = 'Old launch review';
const source = { meeting_id: meetingId, title, revision, chunk_start: 1, at_ms: 3_000_000 };
const vendor = { ...source, source_line: 92, body: 'The vendor needed another week.', speaker: 'Ana' };
const update = { ...source, source_line: 93, body: 'I will update the launch plan.', speaker: 'Pat' };

app.use(express.json());
app.use((req, res, next) => { req.user = { id: userId }; next(); });
app.use('/search', require('../routes/search'));

const evidence = (id, quote) => [{ id, quote }];
const modelAnswer = (claims) => JSON.stringify({ claims });
const writeMessages = jest.fn();
const extractEvents = (res) => res.text.split('\n\n').filter(Boolean).map((line) => JSON.parse(line.slice(6)));

beforeEach(() => {
  jest.clearAllMocks();
  supabase.rpc.mockResolvedValue({ data: [vendor, update] });
  writeMessages.mockResolvedValue({});
  supabase.from.mockImplementation((table) => {
    if (table === 'org_members') {
      return { select: () => ({ eq: async () => ({ data: [{ org_id: orgId }] }) }) };
    }
    if (table === 'conversations') {
      return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: conversationId } }) }) }) };
    }
    if (table === 'conversation_messages') return { insert: writeMessages };
    throw new Error('Unexpected table: ' + table);
  });
});

test('the SSE route emits only grounded claims and maps same-time passages to separate source lines', async () => {
  ai.chat.mockResolvedValue(modelAnswer([
    { text: 'The vendor needed more time.', evidence: evidence('p1', vendor.body) },
    { text: 'Pat will update the launch plan.', evidence: evidence('p2', update.body) },
    { text: 'Invented source ID.', evidence: evidence('p99', vendor.body) },
    { text: 'Invented quote with a real source ID.', evidence: evidence('p1', 'The vendor cancelled.') },
    { text: 'Partially cited claim.', evidence: [...evidence('p1', vendor.body), { id: 'p2', quote: 'I quit.' }] },
    { text: 'No citation.', evidence: [] },
  ]));
  const res = await request(app).post('/search/ask/stream').send({
    question: 'Why did launch move?', meetingIds: [meetingId], orgIds: ['untrusted'],
  });
  expect(res.status).toBe(200);
  expect(res.headers['cache-control']).toBe('no-store');
  const events = extractEvents(res);
  expect(events.map((event) => event.type)).toEqual(['start', 'citations', 'chunk', 'followUp', 'complete']);
  const result = events.at(-1);
  expect(result.answer).toBe('The vendor needed more time.\n\nPat will update the launch plan.');
  expect(result.claims).toMatchObject([
    { citations: [{ id: meetingId, title, quote: vendor.body, atMs: vendor.at_ms,
      passage: { kind: 'segment', position: 92, revision } }] },
    { citations: [{ id: meetingId, title, quote: update.body, atMs: vendor.at_ms,
      passage: { kind: 'segment', position: 93, revision } }] },
  ]);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(supabase.rpc).toHaveBeenCalledWith('find_meeting_passages', {
    p_org_ids: [orgId], p_terms: ['launch', 'move'], p_limit: 14, p_per_meeting: 4, p_meeting_ids: [meetingId],
  });
  expect(ai.chat).toHaveBeenCalledTimes(1);
  expect(ai.chat.mock.calls[0][0]).toContain(vendor.body);
  expect(writeMessages).toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ role: 'assistant', content: result.answer, citations: result.citations }),
  ]));
});

test('untimed citations locate the precise Unicode quote and reject ambiguous repeated quotes', async () => {
  const body = '🙂🙂 start. Approval stays. End. End.';
  supabase.rpc.mockResolvedValue({ data: [{ ...source, source_line: 0, at_ms: null, body, chunk_start: 1001 }] });
  ai.chat.mockResolvedValue(modelAnswer([
    { text: 'Approval remains in place.', evidence: evidence('p1', 'Approval stays.') },
    { text: 'Unclear which occurrence.', evidence: evidence('p1', 'End.') },
  ]));
  const res = await request(app).post('/search/ask').send({ question: 'Does approval stay?' });
  expect(res.status).toBe(200);
  expect(res.body.claims).toHaveLength(1);
  expect(res.body.citations).toMatchObject([
    { atMs: null, passage: { revision, kind: 'text', position: 1011, length: 15 } },
  ]);
});

test('an empty index result skips generation and returns an evidence-specific answer', async () => {
  supabase.rpc.mockResolvedValue({ data: [] });
  const res = await request(app).post('/search/ask').send({ question: 'What about Zircon?' });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ claims: [], citations: [], answer: expect.stringContaining('transcript evidence') });
  expect(ai.chat).not.toHaveBeenCalled();
  expect(writeMessages).not.toHaveBeenCalled();
});

test('a failed passage lookup gives the stream an error without generating an uncited answer', async () => {
  supabase.rpc.mockResolvedValue({ error: { code: 'PGRST202' } });
  const res = await request(app).post('/search/ask/stream').send({ question: 'What about Zircon?' });
  expect(extractEvents(res).map((event) => event.type)).toEqual(['start', 'error']);
  expect(ai.chat).not.toHaveBeenCalled();
});
