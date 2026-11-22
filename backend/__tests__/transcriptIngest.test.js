/**
 * Transcript ingestion + meeting org-scoping tests.
 *
 * Covers:
 *   - Recall transcript JSON → timed segments (seconds → ms, empty entries dropped, order)
 *   - bot.done ingestion creates the meeting under the bot session's org and meeting id
 *   - ingestion is idempotent (repeat webhook, insert race) and refuses another org's id
 *   - an AI failure still saves the transcript
 *   - meeting routes are org-scoped: an outsider gets 404 / an empty list
 *   - speaker rename rewrites both the timed lines and the flat text
 */

'use strict';

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-00000000000b';
const MEMBER = '00000000-0000-4000-8000-0000000000a1';
const OUTSIDER = '00000000-0000-4000-8000-0000000000b3';
const SESSION = '00000000-0000-4000-8000-0000000000c1';
const BOT_MEETING = '00000000-0000-4000-8000-0000000000d1';
const MEETING_A = '00000000-0000-4000-8000-0000000000e1';
const MEETING_B = '00000000-0000-4000-8000-0000000000e2';

// ── In-memory fake of the subset of supabase-js these modules use ──────────
const mockDb = {};
let mockInsertError = null;

function mockMakeQuery(table) {
  const filters = [];
  let mode = 'select';
  let payload = null;
  let range = null;

  const matches = (row) => filters.every((f) => f(row));
  const run = () => {
    const rows = mockDb[table] || (mockDb[table] = []);
    if (mode === 'insert') {
      if (mockInsertError && table === 'meetings') {
        const err = mockInsertError;
        mockInsertError = null;
        return { error: err };
      }
      const row = { id: payload.id || `gen-${rows.length + 1}`, ...payload };
      rows.push(row);
      return { rows: [row] };
    }
    if (mode === 'update') {
      const hit = rows.filter(matches);
      hit.forEach((r) => Object.assign(r, payload));
      return { rows: hit };
    }
    if (mode === 'delete') {
      const hit = rows.filter(matches);
      mockDb[table] = rows.filter((r) => !matches(r));
      return { rows: hit };
    }
    let out = rows.filter(matches);
    if (range) out = out.slice(range[0], range[1] + 1);
    return { rows: out };
  };

  const q = {
    select() { return q; },
    insert(p) { mode = 'insert'; payload = p; return q; },
    update(p) { mode = 'update'; payload = p; return q; },
    delete() { mode = 'delete'; return q; },
    eq(col, val) { filters.push((r) => r[col] === val); return q; },
    in(col, vals) { filters.push((r) => vals.includes(r[col])); return q; },
    is(col, val) { filters.push((r) => (r[col] ?? null) === val); return q; },
    not(col, op, val) {
      if (op === 'in') {
        const list = String(val).replace(/^\(|\)$/g, '').split(',');
        filters.push((r) => !list.includes(String(r[col])));
      } else if (op === 'is') {
        filters.push((r) => (r[col] ?? null) !== val);
      }
      return q;
    },
    like(col, pattern) {
      const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`);
      filters.push((r) => re.test(String(r[col] ?? '')));
      return q;
    },
    or() { return q; },
    gte() { return q; },
    lt(col, val) { filters.push((r) => r[col] < val); return q; },
    lte() { return q; },
    order() { return q; },
    limit() { return q; },
    range(a, b) { range = [a, b]; return q; },
    maybeSingle() {
      const { rows, error } = run();
      return Promise.resolve(error ? { data: null, error } : { data: rows[0] || null, error: null });
    },
    single() {
      const { rows, error } = run();
      if (error) return Promise.resolve({ data: null, error });
      return Promise.resolve(rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'not single' } });
    },
    then(resolve, reject) {
      try {
        const { rows, error } = run();
        resolve(error ? { data: null, error } : { data: rows, error: null, count: rows.length });
      } catch (e) { reject(e); }
    }
  };
  return q;
}

jest.mock('../config/supabase', () => {
  const client = { from: (table) => mockMakeQuery(table) };
  return { supabase: client, supabaseAdmin: client, supabaseAnon: null };
});
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../config/ai', () => ({
  isConfigured: jest.fn(() => true),
  generateSummary: jest.fn(async () => ({ summary: 'We agreed to ship.', keyPoints: ['Ship it'], decisions: [], topics: [], sentiment: 'Positive', sentimentScore: 0.8 })),
  extractActionItems: jest.fn(async () => [{ task: 'Send the deck', owner: 'Ann', priority: 'High' }]),
  generateEmbedding: jest.fn(async () => null),
  answerQuestion: jest.fn(async () => ({ answer: 'ok' })),
}));
jest.mock('../services/embeddingService', () => ({ generateEmbeddingsForMeeting: jest.fn(async () => {}) }));
jest.mock('../services/hubEventPublisher', () => ({ meetingCompleted: jest.fn(async () => {}) }));
jest.mock('../services/ecosystemBridge', () => ({ getEcosystemBridge: jest.fn(async () => ({ isConnected: () => false })) }));
jest.mock('../services/calendarService', () => ({ isConfigured: () => false }));
jest.mock('../services/meetingEvents', () => ({ handleMeetingProcessed: jest.fn(async () => {}) }));
jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    const id = req.headers['x-test-user'];
    if (!id) return res.status(401).json({ error: 'Authentication required' });
    req.user = { id, email: 'u@example.com' };
    next();
  },
  authorizeOrgRole: () => (req, res, next) => next(),
}));

const express = require('express');
const request = require('supertest');
const ai = require('../config/ai');
const meetingEvents = require('../services/meetingEvents');
const ingest = require('../services/transcriptIngest');

const RECALL_TRANSCRIPT = [
  {
    participant: { id: 100, name: 'Ann Lee', is_host: true, email: 'Ann@Example.com' },
    language_code: 'en',
    words: [
      { text: 'Hello', start_timestamp: { relative: 1.25, absolute: null }, end_timestamp: { relative: 1.6, absolute: null } },
      { text: 'team.', start_timestamp: { relative: 1.7 }, end_timestamp: { relative: 2.0 } },
    ],
  },
  { participant: { id: 200, name: null }, language_code: 'en', words: [] },
  {
    participant: { id: 200, name: '' },
    language_code: 'en',
    words: [{ text: 'Hi', start_timestamp: { relative: 0.5 }, end_timestamp: { relative: 0.9 } }],
  },
  {
    participant: { id: 100, name: 'Ann Lee' },
    language_code: 'en',
    words: [{ text: "Let's ship.", start_timestamp: { relative: 125 }, end_timestamp: { relative: 126.5 } }],
  },
];

function mockFetchJson(body, init = {}) {
  global.fetch = jest.fn(async () => ({
    ok: init.ok !== false,
    status: init.status || 200,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
  }));
}

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.clearAllMocks();
  mockInsertError = null;
  ai.isConfigured.mockReturnValue(true);
  mockDb.bot_sessions = [{
    id: SESSION, org_id: ORG_A, meeting_id: BOT_MEETING, platform: 'zoom',
    created_at: '2026-11-21T15:00:00Z', started_at: '2026-11-21T15:01:00Z', ended_at: '2026-11-21T15:30:00Z',
    consent_acknowledged_by: MEMBER, recall_bot_id: 'bot_1',
  }];
  mockDb.meetings = [
    { id: MEETING_A, org_id: ORG_A, title: 'A', transcript: 'Speaker 1: hi', transcript_segments: [{ atMs: 0, speaker: 'Speaker 1', text: 'hi' }, { atMs: 5000, speaker: 'Bo', text: 'yo' }] },
    { id: MEETING_B, org_id: ORG_B, title: 'B', transcript: 'secret' },
  ];
  mockDb.org_members = [{ org_id: ORG_A, user_id: MEMBER }, { org_id: ORG_B, user_id: OUTSIDER }];
  mockDb.action_items = [];
  mockDb.bot_session_attendees = [];
  mockDb.embeddings = [];
});

describe('parseRecallTranscript', () => {
  test('seconds become ms, empty entries drop, lines sort by time, unnamed speakers get a label', () => {
    const segs = ingest.parseRecallTranscript(RECALL_TRANSCRIPT);
    expect(segs).toEqual([
      { atMs: 500, endMs: 900, speaker: 'Speaker 200', text: 'Hi' },
      { atMs: 1250, endMs: 2000, speaker: 'Ann Lee', text: 'Hello team.' },
      { atMs: 125000, endMs: 126500, speaker: 'Ann Lee', text: "Let's ship." },
    ]);
  });

  test('an unexpected shape yields no segments instead of throwing', () => {
    expect(ingest.parseRecallTranscript({ parts: [] })).toEqual([]);
    expect(ingest.parseRecallTranscript([null, { words: 'x' }])).toEqual([]);
  });

  test('attendees are one per participant, emails lowercased, none invented', () => {
    expect(ingest.attendeesFromTranscript(RECALL_TRANSCRIPT)).toEqual([
      { name: 'Ann Lee', email: 'ann@example.com' },
      { name: 'Speaker 200' },
    ]);
  });
});

describe('ingestBotTranscript', () => {
  test('creates the meeting under the session org and meeting id, then runs post-processing', async () => {
    mockFetchJson(RECALL_TRANSCRIPT);
    const result = await ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'https://recall.example/t.json' });
    expect(result).toEqual({ status: 'ingested', meetingId: BOT_MEETING, segments: 3 });

    const meeting = mockDb.meetings.find((m) => m.id === BOT_MEETING);
    expect(meeting.org_id).toBe(ORG_A);
    expect(meeting.created_by).toBe(MEMBER);
    expect(meeting.title).toBe('Zoom meeting, Nov 21, 2026');
    expect(meeting.transcript).toBe("Speaker 200: Hi\nAnn Lee: Hello team.\nAnn Lee: Let's ship.");
    expect(meeting.transcript_segments).toHaveLength(3);
    expect(meeting.summary).toBe('We agreed to ship.');
    expect(meeting.duration_minutes).toBe(3);
    expect(meeting.summary_moments).toEqual({ keyPoints: [null], decisions: [] });
    expect(mockDb.action_items).toHaveLength(1);
    expect(mockDb.action_items[0].org_id).toBe(ORG_A);

    await flush(); await flush();
    expect(meetingEvents.handleMeetingProcessed).toHaveBeenCalledTimes(1);
  });

  test('decisions and action items are linked to the transcript line they came from', async () => {
    const words = (t, at) => t.split(' ').map((w, i) => ({ text: w, start_timestamp: { relative: at + i * 0.3 }, end_timestamp: { relative: at + i * 0.3 + 0.2 } }));
    mockFetchJson([
      { participant: { id: 1, name: 'Ann' }, words: words('Thanks everyone for joining today', 1) },
      { participant: { id: 2, name: 'Bo' }, words: words('We will move the product launch to March fifteenth', 40) },
      { participant: { id: 3, name: 'Cy' }, words: words('I will send the vendor quote to finance by Friday', 80) },
    ]);
    ai.generateSummary.mockResolvedValueOnce({ summary: 's', keyPoints: [], decisions: ['Product launch moved to March'], topics: [] });
    ai.extractActionItems.mockResolvedValueOnce([{ task: 'Send vendor quote to finance', context: 'by Friday', owner: 'Cy' }]);
    await ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'https://recall.example/t.json' });
    const meeting = mockDb.meetings.find((m) => m.id === BOT_MEETING);
    expect(meeting.summary_moments).toEqual({ keyPoints: [], decisions: [40000] });
    expect(mockDb.action_items[0].transcript_at_ms).toBe(80000);
  });

  test('a repeated bot.done does nothing the second time', async () => {
    mockFetchJson(RECALL_TRANSCRIPT);
    await ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'https://recall.example/t.json' });
    const again = await ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'https://recall.example/t.json' });
    expect(again.status).toBe('already_ingested');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockDb.meetings.filter((m) => m.id === BOT_MEETING)).toHaveLength(1);
    expect(mockDb.action_items).toHaveLength(1);
  });

  test('losing an insert race stops cleanly without duplicating action items', async () => {
    mockFetchJson(RECALL_TRANSCRIPT);
    mockInsertError = { code: '23505', message: 'duplicate key' };
    const result = await ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'https://recall.example/t.json' });
    expect(result.status).toBe('already_ingested');
    expect(mockDb.action_items).toHaveLength(0);
  });

  test("never writes into a meeting id that belongs to another org", async () => {
    mockDb.bot_sessions[0].meeting_id = MEETING_B;
    mockFetchJson(RECALL_TRANSCRIPT);
    const result = await ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'https://recall.example/t.json' });
    expect(result.status).toBe('conflict');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockDb.meetings.find((m) => m.id === MEETING_B).transcript).toBe('secret');
  });

  test('an AI failure still saves the transcript', async () => {
    ai.generateSummary.mockRejectedValueOnce(new Error('quota'));
    mockFetchJson(RECALL_TRANSCRIPT);
    const result = await ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'https://recall.example/t.json' });
    expect(result.status).toBe('ingested');
    const meeting = mockDb.meetings.find((m) => m.id === BOT_MEETING);
    expect(meeting.summary).toBeNull();
    expect(meeting.transcript_segments).toHaveLength(3);
  });

  test('a transcript with no speech creates no meeting', async () => {
    mockFetchJson([{ participant: { id: 1 }, words: [] }]);
    const result = await ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'https://recall.example/t.json' });
    expect(result.status).toBe('empty');
    expect(mockDb.meetings.find((m) => m.id === BOT_MEETING)).toBeUndefined();
  });

  test('only https transcript URLs are fetched', async () => {
    mockFetchJson(RECALL_TRANSCRIPT);
    await expect(ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'http://recall.example/t.json' }))
      .rejects.toThrow('https');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('privacy', () => {
  test("an opted-out attendee's words never reach the AI, the transcript or the attendee list", async () => {
    mockDb.bot_session_attendees = [
      { session_id: SESSION, email: 'ann@example.com', opted_out_at: '2026-11-21T14:00:00Z' },
      { session_id: SESSION, email: 'bo@example.com', opted_out_at: null },
    ];
    mockFetchJson(RECALL_TRANSCRIPT); // Ann (Ann@Example.com) speaks twice
    await ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'https://recall.example/t.json' });

    const meeting = mockDb.meetings.find((m) => m.id === BOT_MEETING);
    expect(meeting.transcript).not.toMatch(/Hello team|ship/);
    expect(meeting.transcript).toContain(ingest._internal.REMOVED_TEXT);
    expect(meeting.attendees.map((a) => a.name)).toEqual(['Speaker 200']);
    const aiInput = ai.generateSummary.mock.calls[0][0];
    expect(aiInput).not.toMatch(/Hello team|ship/);
  });

  test('back-to-back removed lines collapse into one placeholder', () => {
    const raw = [
      { participant: { id: 1, email: 'x@e.com' }, words: [{ text: 'a', start_timestamp: { relative: 1 } }] },
      { participant: { id: 1, email: 'x@e.com' }, words: [{ text: 'b', start_timestamp: { relative: 2 } }] },
      { participant: { id: 2, email: 'y@e.com', name: 'Y' }, words: [{ text: 'c', start_timestamp: { relative: 3 } }] },
    ];
    const out = ingest._internal.redactOptedOut(raw, new Set(['x@e.com']));
    expect(out.removed).toBe(2);
    expect(ingest.parseRecallTranscript(out.entries).map((s) => s.text)).toEqual([ingest._internal.REMOVED_TEXT, 'c']);
  });

  test('without participant emails nothing can be matched, and that is reported', () => {
    const out = ingest._internal.redactOptedOut([{ participant: { id: 1, name: 'Ann' }, words: [] }], new Set(['ann@example.com']));
    expect(out).toMatchObject({ removed: 0, unmatched: true });
  });

  test('retention purge removes the transcript, timed lines, timecodes and search chunks, and keeps the meeting', async () => {
    mockFetchJson(RECALL_TRANSCRIPT);
    await ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'https://recall.example/t.json' });
    mockDb.embeddings = [
      { source_id: BOT_MEETING, source_type: 'meeting', content_type: 'transcript_chunk_0' },
      { source_id: BOT_MEETING, source_type: 'meeting', content_type: 'summary' },
      { source_id: MEETING_A, source_type: 'meeting', content_type: 'transcript_chunk_0' },
    ];
    mockDb.action_items.forEach((i) => { i.transcript_at_ms = 1000; });

    expect(await ingest.purgeSessionTranscript(SESSION)).toEqual({ purged: true, meetingId: BOT_MEETING });
    const meeting = mockDb.meetings.find((m) => m.id === BOT_MEETING);
    expect(meeting.transcript).toBeNull();
    expect(meeting.transcript_segments).toBeNull();
    expect(meeting.summary_moments).toBeNull();
    expect(meeting.summary).toBe('We agreed to ship.');
    expect(mockDb.action_items.every((i) => i.transcript_at_ms === null)).toBe(true);
    expect(mockDb.embeddings.map((e) => `${e.source_id}:${e.content_type}`)).toEqual([
      `${BOT_MEETING}:summary`,
      `${MEETING_A}:transcript_chunk_0`,
    ]);
  });

  test('the daily retention sweep reaches the meeting transcript too', async () => {
    process.env.RECALL_API_KEY = process.env.RECALL_API_KEY || 'test-key';
    mockFetchJson(RECALL_TRANSCRIPT);
    await ingest.ingestBotTranscript(SESSION, { transcriptUrl: 'https://recall.example/t.json' });
    Object.assign(mockDb.bot_sessions[0], { created_at: '2020-01-01T00:00:00Z', transcript_url: 'https://x', retention_deleted_at: null });
    global.fetch = jest.fn(async () => ({ ok: true, status: 204, headers: { get: () => null }, text: async () => '' }));

    const { sweepWorkspace } = require('../services/retentionService');
    const out = await sweepWorkspace(ORG_A, 30);
    expect(out).toMatchObject({ deleted: 1, failed: 0 });
    expect(mockDb.meetings.find((m) => m.id === BOT_MEETING).transcript).toBeNull();
    expect(mockDb.bot_sessions[0].transcript_url).toBeNull();
  });

  test('purge never touches a meeting in another org', async () => {
    mockDb.bot_sessions[0].meeting_id = MEETING_B;
    expect(await ingest.purgeSessionTranscript(SESSION)).toEqual({ purged: false });
    expect(mockDb.meetings.find((m) => m.id === MEETING_B).transcript).toBe('secret');
  });
});

describe('bot.done webhook', () => {
  test('stores the URLs and kicks off ingestion', async () => {
    process.env.RECALL_API_KEY = process.env.RECALL_API_KEY || 'test-key';
    const bot = {
      recordings: [{ media_shortcuts: { transcript: { data: { download_url: 'https://recall.example/t.json' } } } }],
    };
    global.fetch = jest.fn(async (url) => {
      const body = String(url).includes('/bot/') ? bot : RECALL_TRANSCRIPT;
      return { ok: true, status: 200, headers: { get: (h) => (h === 'content-type' ? 'application/json' : null) }, text: async () => JSON.stringify(body), json: async () => body };
    });
    const orchestrator = require('../services/botOrchestrator');
    const out = await orchestrator.handleRecallWebhook({
      event: 'bot.done',
      data: { bot: { id: 'bot_1', metadata: { session_id: SESSION } } },
    });
    expect(out).toEqual({ ok: true, sessionId: SESSION });
    expect(mockDb.bot_sessions[0].transcript_url).toBe('https://recall.example/t.json');
    for (let i = 0; i < 5; i++) await flush();
    expect(mockDb.meetings.find((m) => m.id === BOT_MEETING)?.transcript_segments).toHaveLength(3);
  });
});

describe('meeting routes are org-scoped', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/meetings', require('../routes/meetings'));
  const as = (user) => ({ 'x-test-user': user });

  test("an outsider cannot read, edit, delete or ask about another org's meeting", async () => {
    expect((await request(app).get(`/api/meetings/${MEETING_A}`).set(as(OUTSIDER))).status).toBe(404);
    expect((await request(app).put(`/api/meetings/${MEETING_A}`).set(as(OUTSIDER)).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).post(`/api/meetings/${MEETING_A}/ask`).set(as(OUTSIDER)).send({ question: 'what?' })).status).toBe(404);
    expect((await request(app).delete(`/api/meetings/${MEETING_A}`).set(as(OUTSIDER))).status).toBe(404);
    expect(mockDb.meetings.find((m) => m.id === MEETING_A).title).toBe('A');
  });

  test('a member reads their own meeting, segments included', async () => {
    const res = await request(app).get(`/api/meetings/${MEETING_A}`).set(as(MEMBER));
    expect(res.status).toBe(200);
    expect(res.body.transcript_segments).toHaveLength(2);
  });

  test("the list only holds the caller's orgs", async () => {
    const res = await request(app).get('/api/meetings').set(as(MEMBER));
    expect(res.status).toBe(200);
    expect(res.body.meetings.map((m) => m.id)).toEqual([MEETING_A]);
  });

  test("an outsider cannot toggle another org's action item", async () => {
    mockDb.action_items = [{ id: 'ai-1', meeting_id: MEETING_A, status: 'open' }];
    const res = await request(app).patch('/api/meetings/action-items/ai-1').set(as(OUTSIDER)).send({ status: 'done' });
    expect(res.status).toBe(404);
    expect(mockDb.action_items[0].status).toBe('open');
  });

  test('editing decisions recomputes their timecodes', async () => {
    const m = mockDb.meetings.find((x) => x.id === MEETING_A);
    m.transcript_segments = [{ atMs: 0, speaker: 'A', text: 'hello' }, { atMs: 9000, speaker: 'B', text: 'We will move the product launch to March' }];
    m.summary_moments = { keyPoints: [], decisions: [123] };
    const res = await request(app).put(`/api/meetings/${MEETING_A}`).set(as(MEMBER)).send({ decisions: ['Launch moves to March for the product'] });
    expect(res.status).toBe(200);
    expect(m.summary_moments).toEqual({ keyPoints: [], decisions: [9000] });
  });

  test('renaming a speaker rewrites the timed lines and the flat text', async () => {
    const res = await request(app).patch(`/api/meetings/${MEETING_A}/speakers`).set(as(MEMBER)).send({ from: 'Speaker 1', to: 'Ann' });
    expect(res.status).toBe(200);
    const m = mockDb.meetings.find((x) => x.id === MEETING_A);
    expect(m.transcript_segments.map((s) => s.speaker)).toEqual(['Ann', 'Bo']);
    expect(m.transcript).toBe('Ann: hi\nBo: yo');
  });

  test('rename rejects a colon, an unknown speaker and an outsider', async () => {
    const url = `/api/meetings/${MEETING_A}/speakers`;
    expect((await request(app).patch(url).set(as(MEMBER)).send({ from: 'Bo', to: 'Bo: CEO' })).status).toBe(400);
    expect((await request(app).patch(url).set(as(MEMBER)).send({ from: 'Nobody', to: 'X' })).status).toBe(404);
    expect((await request(app).patch(url).set(as(OUTSIDER)).send({ from: 'Bo', to: 'X' })).status).toBe(404);
  });
});

describe('ingestBotTranscript: one finishing step with the browser recorder', () => {
  const url = { transcriptUrl: 'https://recall.example/t.json' };
  const botMeeting = () => mockDb.meetings.find((m) => m.id === BOT_MEETING);

  test('the meeting appears as soon as the transcript arrives, with real writing stages', async () => {
    mockFetchJson(RECALL_TRANSCRIPT);
    const seen = [];
    ai.generateSummary.mockImplementationOnce(async () => {
      seen.push({ ...botMeeting().recording_job });
      return { summary: 'We agreed to ship.', keyPoints: [], decisions: [], topics: [] };
    });
    await ingest.ingestBotTranscript(SESSION, url);
    expect(seen[0]).toMatchObject({ status: 'transcribing', source: 'bot', stage: 'summary', botSessionId: SESSION });
    expect(botMeeting().recording_job).toMatchObject({ status: 'done', source: 'bot', stage: null, lines: 3, speakers: 2 });
  });

  test('a run already writing stops a repeated webhook', async () => {
    mockFetchJson(RECALL_TRANSCRIPT);
    mockDb.meetings.push({ id: BOT_MEETING, org_id: ORG_A, transcript_segments: null, recording_job: { status: 'transcribing', source: 'bot', updatedAt: new Date().toISOString() } });
    expect(await ingest.ingestBotTranscript(SESSION, url)).toEqual({ status: 'in_progress', meetingId: BOT_MEETING });
    expect(mockDb.action_items).toHaveLength(0);
  });

  test('a backup recording beside the bot gets the bot\'s minutes in the same meeting, keeping its title and template', async () => {
    mockFetchJson(RECALL_TRANSCRIPT);
    mockDb.meetings.push({
      id: BOT_MEETING, org_id: ORG_A, title: 'Weekly sync', created_by: MEMBER, attendees: [], summary_template: 'standup',
      transcript_segments: null, recording_job: { status: 'backup', pieces: 3, durationMs: 90000, botSessionId: SESSION, mode: 'tab' },
    });
    const result = await ingest.ingestBotTranscript(SESSION, url);
    expect(result.status).toBe('ingested');
    expect(mockDb.meetings.filter((m) => m.id === BOT_MEETING)).toHaveLength(1);
    expect(botMeeting()).toMatchObject({ title: 'Weekly sync', summary: 'We agreed to ship.' });
    expect(botMeeting().recording_job).toMatchObject({ status: 'done', source: 'bot', pieces: 3, mode: 'tab' });
    expect(ai.generateSummary.mock.calls[0][1].addon).toBeDefined();
    expect(mockDb.action_items).toHaveLength(1);
  });

  test('a browser recording still running keeps its state while the bot writes the minutes', async () => {
    mockFetchJson(RECALL_TRANSCRIPT);
    mockDb.meetings.push({ id: BOT_MEETING, org_id: ORG_A, title: 'Weekly sync', transcript_segments: null, recording_job: { status: 'recording', botSessionId: SESSION } });
    await ingest.ingestBotTranscript(SESSION, url);
    expect(botMeeting().recording_job.status).toBe('recording');
    expect(botMeeting().transcript_segments).toHaveLength(3);
  });

  test('a failure while writing marks the meeting failed instead of leaving it writing', async () => {
    mockFetchJson(RECALL_TRANSCRIPT);
    const finish = require('../services/meetingFinish');
    const spy = jest.spyOn(finish, 'writeMinutes').mockRejectedValueOnce(new Error('db down'));
    await expect(ingest.ingestBotTranscript(SESSION, url)).rejects.toThrow('db down');
    expect(botMeeting().transcript_segments ?? null).toBeNull();
    expect(botMeeting().recording_job).toMatchObject({ status: 'failed', stage: null });
    spy.mockRestore();
  });
});
