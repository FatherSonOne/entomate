const express = require('express');
const request = require('supertest');
const evaluation = require('./fixtures/askRetrievalEvaluation.json');

jest.mock('../config/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
jest.mock('../config/ai', () => ({
  isConfigured: jest.fn(() => true),
  chat: jest.fn(),
  getPassageEmbeddingModel: jest.fn(),
  generatePassageEmbeddings: jest.fn(),
}));
jest.mock('../utils/cache', () => ({}));
jest.mock('../services/aiUsage', () => ({ meterAi: (req, res, next) => next() }));
jest.mock('../middleware/auth', () => ({ authenticate: (req, res, next) => next() }));
jest.mock('../services/embeddingService', () => ({}));

const { supabase } = require('../config/supabase');
const ai = require('../config/ai');
const { backfillPassageEmbeddings } = require('../services/meetingPassageRetrieval');
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

const model = 'fixture:768';
const pad = (vector) => [...vector, ...Array(768 - vector.length).fill(0)];
const indexed = evaluation.meetings.flatMap((meeting) => meeting.lines.map((line, index) => ({
  meeting_id: meeting.id,
  org_id: meeting.workspace === 'allowed' ? orgId : 'ffffffff-ffff-4fff-afff-ffffffffffff',
  title: meeting.title, revision, chunk_start: 1, source_line: index + 1,
  at_ms: line.atMs, body: line.text, vector: pad(evaluation.vectors[line.vector]),
})));

const coverageQuery = {};

beforeEach(() => {
  jest.clearAllMocks();
  ai.getPassageEmbeddingModel.mockReturnValue(null);
  for (const method of ['select', 'in', 'eq', 'not', 'limit']) coverageQuery[method] = jest.fn().mockReturnValue(coverageQuery);
  coverageQuery.abortSignal = jest.fn().mockResolvedValue({ data: [{ meeting_id: meetingId }] });
  supabase.rpc.mockReset();
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
    if (table === 'meeting_passages') return coverageQuery;
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

test.each(evaluation.questions)('retrieval evaluation finds the exact evidence for $name', async (scenario) => {
  const expected = scenario.expected.map(({ meeting, line }) => {
    const record = evaluation.meetings[meeting];
    return { id: record.id, line, quote: record.lines[line - 1].text, atMs: record.lines[line - 1].atMs };
  });
  const meetingIds = scenario.meetingScope?.map((index) => evaluation.meetings[index].id);
  const queryVector = pad(evaluation.vectors[scenario.vector]);
  const scoped = ({ p_org_ids, p_meeting_ids }) => indexed.filter((row) =>
    p_org_ids.includes(row.org_id) && (!p_meeting_ids || p_meeting_ids.includes(row.meeting_id)));
  let keywordHits;
  ai.getPassageEmbeddingModel.mockReturnValue(model);
  ai.generatePassageEmbeddings.mockResolvedValue([queryVector]);
  supabase.rpc.mockImplementation((rpc, params) => {
    if (rpc === 'find_meeting_passages') {
      keywordHits = scoped(params).filter((row) => row.body.toLowerCase().split(/\W+/).some((word) =>
        params.p_terms.some((term) => word.startsWith(term))));
      return Promise.resolve({ data: keywordHits });
    }
    expect(rpc).toBe('find_semantic_meeting_passages');
    expect(params).toMatchObject({
      p_org_ids: [orgId], p_meeting_ids: meetingIds || null, p_model: model, p_embedding: JSON.stringify(queryVector),
    });
    const data = scoped(params).filter((row) =>
      row.vector.reduce((sum, value, index) => sum + value * queryVector[index], 0) >= 0.5);
    return { abortSignal: jest.fn().mockResolvedValue({ data }) };
  });
  ai.chat.mockImplementation(async (prompt) => {
    const passages = JSON.parse(prompt.slice(prompt.indexOf('\n{') + 1)).passages;
    expect(passages.map(({ text }) => text)).not.toContain('The manufactured delay is private.');
    return modelAnswer(expected.map(({ quote }) => {
      const anchors = passages.filter((p) => p.text === quote);
      expect(anchors).toHaveLength(1);
      return { text: quote, evidence: evidence(anchors[0].id, quote) };
    }));
  });

  const res = await request(app).post('/search/ask/stream').send({ question: scenario.question, meetingIds });
  expect(res.status).toBe(200);
  const result = extractEvents(res).at(-1);
  expect(result.type).toBe('complete');
  expect(result.citations).toMatchObject(expected.map(({ id, line, quote, atMs }) =>
    ({ id, quote, atMs, passage: { kind: 'segment', position: line, revision } })));
  expect(result.citations).toHaveLength(expected.length);
  if (scenario.keywordMiss) expect(keywordHits).not.toEqual(expect.arrayContaining([expect.objectContaining({ body: expected[0].quote })]));
  if (!expected.length) expect(ai.chat).not.toHaveBeenCalled();
  expect(ai.generatePassageEmbeddings).toHaveBeenCalledWith([scenario.question], 'query', expect.any(AbortSignal));
  expect(coverageQuery.in).toHaveBeenCalledWith('org_id', [orgId]);
  if (meetingIds) expect(coverageQuery.in).toHaveBeenCalledWith('meeting_id', meetingIds);
});

test.each(['catching up', 'embedding outage'])('Ask keeps keyword evidence while semantic retrieval is %s', async (condition) => {
  ai.getPassageEmbeddingModel.mockReturnValue(model);
  ai.generatePassageEmbeddings.mockRejectedValue(Object.assign(new Error('Provider unavailable'), { name: 'TimeoutError' }));
  if (condition === 'catching up') coverageQuery.abortSignal.mockResolvedValue({ data: [] });
  ai.chat.mockResolvedValue(modelAnswer([{ text: 'The vendor needed more time.', evidence: evidence('p1', vendor.body) }]));
  const res = await request(app).post('/search/ask').send({ question: 'What did the vendor need?' });
  expect(res.body.citations).toMatchObject([{ id: meetingId, passage: { revision, position: 92 } }]);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  if (condition === 'catching up') expect(ai.generatePassageEmbeddings).not.toHaveBeenCalled();
});

test('the worker embeds a batch of passages and submits each original revision for the write check', async () => {
  ai.getPassageEmbeddingModel.mockReturnValue(model);
  const embedding = pad(evaluation.vectors.delay);
  ai.generatePassageEmbeddings.mockResolvedValue([embedding, embedding]);
  supabase.rpc.mockImplementation(async (rpc) => rpc === 'next_meeting_passage_embeddings'
    ? { data: [vendor, update] }
    : { data: 1 });
  expect(await backfillPassageEmbeddings()).toEqual({ indexed: 1 });
  expect(ai.generatePassageEmbeddings).toHaveBeenCalledWith([vendor.body, update.body], 'document', expect.any(AbortSignal));
  expect(supabase.rpc).toHaveBeenCalledWith('save_meeting_passage_embeddings', {
    p_model: model, p_updates: [vendor, update].map(({ meeting_id, source_line, chunk_start }) =>
      ({ meeting_id, source_line, chunk_start, revision, embedding })),
  });
});
