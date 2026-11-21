/**
 * In-browser recorder tests.
 *
 * Covers:
 *   - Gemini's tagged transcript → timed lines (tags, bold, hours, continuation, no speaker)
 *   - start makes an org-scoped meeting; consent and workspace are required
 *   - pieces are stored under the org/meeting folder; repeats are fine; outsiders get 404
 *   - finish refuses while pieces are missing, then transcribes in the background into
 *     transcript_segments, summary, decisions, action items with timecodes, and deletes audio
 *   - a Gemini failure marks the job failed with a readable reason; retry recovers
 *   - discard removes the unfinished meeting and its audio
 */

'use strict';

const ORG_A = '00000000-0000-4000-8000-00000000000a';
const ORG_B = '00000000-0000-4000-8000-00000000000b';
const MEMBER = '00000000-0000-4000-8000-0000000000a1';
const OUTSIDER = '00000000-0000-4000-8000-0000000000b3';

const mockDb = {};
const mockStorage = new Map(); // `${bucket}/${path}` -> Buffer
let mockIdSeq = 0;

function mockMakeQuery(table) {
  const filters = [];
  let mode = 'select';
  let payload = null;
  const matches = (row) => filters.every((f) => f(row));
  const run = () => {
    const rows = mockDb[table] || (mockDb[table] = []);
    if (mode === 'insert') {
      const list = Array.isArray(payload) ? payload : [payload];
      const made = list.map((p) => ({ id: p.id || `00000000-0000-4000-8000-${String(++mockIdSeq).padStart(12, '0')}`, ...p }));
      rows.push(...made);
      return { rows: made };
    }
    if (mode === 'update') {
      const hit = rows.filter(matches);
      hit.forEach((r) => Object.assign(r, JSON.parse(JSON.stringify(payload))));
      return { rows: hit };
    }
    if (mode === 'delete') {
      const hit = rows.filter(matches);
      mockDb[table] = rows.filter((r) => !matches(r));
      return { rows: hit };
    }
    return { rows: rows.filter(matches) };
  };
  const q = {
    select() { return q; },
    insert(p) { mode = 'insert'; payload = p; return q; },
    update(p) { mode = 'update'; payload = p; return q; },
    delete() { mode = 'delete'; return q; },
    eq(col, val) { filters.push((r) => r[col] === val); return q; },
    in(col, vals) { filters.push((r) => vals.includes(r[col])); return q; },
    is(col, val) { filters.push((r) => (r[col] ?? null) === val); return q; },
    order() { return q; },
    limit() { return q; },
    maybeSingle() { const { rows } = run(); return Promise.resolve({ data: rows[0] || null, error: null }); },
    single() {
      const { rows } = run();
      return Promise.resolve(rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'not single' } });
    },
    then(resolve, reject) {
      try { const { rows } = run(); resolve({ data: rows, error: null }); } catch (e) { reject(e); }
    },
  };
  return q;
}

function mockBucket(bucket) {
  const key = (p) => `${bucket}/${p}`;
  return {
    async upload(path, buffer, opts) {
      if (mockStorage.has(key(path)) && !opts?.upsert) return { data: null, error: { message: 'The resource already exists' } };
      mockStorage.set(key(path), Buffer.from(buffer));
      return { data: { path }, error: null };
    },
    async list(folder, { limit = 100, offset = 0 } = {}) {
      const prefix = key(`${folder}/`);
      const names = [...mockStorage.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).sort();
      return { data: names.slice(offset, offset + limit).map((name) => ({ name })), error: null };
    },
    async download(path) {
      const buf = mockStorage.get(key(path));
      if (!buf) return { data: null, error: { message: 'not found' } };
      return { data: { arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) }, error: null };
    },
    async remove(paths) {
      paths.forEach((p) => mockStorage.delete(key(p)));
      return { data: paths, error: null };
    },
  };
}

jest.mock('../config/supabase', () => {
  const client = { from: (table) => mockMakeQuery(table), storage: { from: (b) => mockBucket(b) } };
  return { supabase: client, supabaseAdmin: client, supabaseAnon: null };
});
jest.mock('../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), http: jest.fn() }));
jest.mock('../config/geminiRecording', () => ({ isConfigured: jest.fn(() => true), transcribeRecording: jest.fn() }));
jest.mock('../config/ai', () => ({
  isConfigured: jest.fn(() => true),
  generateSummary: jest.fn(async () => ({
    summary: 'The team set the launch date.',
    keyPoints: ['QA signs off on Friday'],
    decisions: ['Ship the launch on the fourteenth'],
    topics: ['launch'],
    sentiment: 'Positive',
    sentimentScore: 0.8,
  })),
  extractActionItems: jest.fn(async () => [{ task: 'Book the QA signoff review for Friday', owner: 'Speaker 2', priority: 'High' }]),
  generateEmbedding: jest.fn(async () => null),
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
const geminiRecording = require('../config/geminiRecording');
const recorder = require('../services/meetingRecorder');

const GEMINI_TEXT = [
  '[00:00] Speaker 1: Morning everyone, let us settle the launch date.',
  '**[00:07] Speaker 2:** We can ship the launch on the fourteenth if QA signs off on Friday.',
  'That is the only blocker.',
  '[00:15] Speaker 1: Agreed, ship it on the fourteenth.',
  '[00:21] Speaker 2: I will book the QA signoff review for Friday.',
].join('\n');

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/recordings', require('../routes/recordings'));
  a.use('/api/meetings', require('../routes/meetings'));
  return a;
}

const as = (user) => ({ 'x-test-user': user });
const flush = () => new Promise((r) => setImmediate(r));
async function settle(meetingId) {
  for (let i = 0; i < 50 && recorder._internal.running.has(meetingId); i++) await flush();
  await flush();
}
const meeting = (id) => mockDb.meetings.find((m) => m.id === id);

beforeEach(() => {
  for (const k of Object.keys(mockDb)) delete mockDb[k];
  mockStorage.clear();
  mockDb.org_members = [
    { user_id: MEMBER, org_id: ORG_A },
    { user_id: OUTSIDER, org_id: ORG_B },
  ];
  mockDb.meetings = [];
  mockDb.action_items = [];
  geminiRecording.transcribeRecording.mockReset();
  geminiRecording.transcribeRecording.mockResolvedValue(GEMINI_TEXT);
  geminiRecording.isConfigured.mockReturnValue(true);
});

async function startAndUpload(server, pieces = 2) {
  const start = await request(server)
    .post('/api/recordings')
    .set(as(MEMBER))
    .send({ title: 'Launch sync', mode: 'tab', mimeType: 'audio/webm;codecs=opus', consentAcknowledged: true, attendees: 'Ann, Bo' });
  expect(start.status).toBe(201);
  const id = start.body.meetingId;
  for (let seq = 0; seq < pieces; seq++) {
    const put = await request(server)
      .put(`/api/recordings/${id}/pieces/${seq}?durationMs=30000`)
      .set(as(MEMBER))
      .set('Content-Type', 'audio/webm')
      .send(Buffer.from(`piece-${seq}|`));
    expect(put.status).toBe(204);
  }
  return id;
}

describe('parseTimestampedTranscript', () => {
  const parse = recorder.parseTimestampedTranscript;

  test('reads tags, bold markup, continuations and hours', () => {
    const lines = parse(`${GEMINI_TEXT}\n[1:02:03] Speaker 3: Late arrival.`);
    expect(lines).toEqual([
      { atMs: 0, speaker: 'Speaker 1', text: 'Morning everyone, let us settle the launch date.' },
      { atMs: 7000, speaker: 'Speaker 2', text: 'We can ship the launch on the fourteenth if QA signs off on Friday. That is the only blocker.' },
      { atMs: 15000, speaker: 'Speaker 1', text: 'Agreed, ship it on the fourteenth.' },
      { atMs: 21000, speaker: 'Speaker 2', text: 'I will book the QA signoff review for Friday.' },
      { atMs: 3723000, speaker: 'Speaker 3', text: 'Late arrival.' },
    ]);
  });

  test('a line with no speaker keeps the previous one; the first is Speaker 1', () => {
    expect(parse('[ 00:01 ] Hello there.\n[00:04] Still me.').map((l) => l.speaker)).toEqual(['Speaker 1', 'Speaker 1']);
  });

  test('ignores preamble and empty tags, and never lets time run backwards', () => {
    const lines = parse('Here is the transcript:\n[00:10] Speaker 1: A.\n[00:05] Speaker 2: B.\n[00:12]');
    expect(lines.map((l) => l.atMs)).toEqual([10000, 10000]);
  });
});

describe('recorder routes', () => {
  test('start needs consent and a workspace, and makes an org-scoped meeting', async () => {
    const server = app();
    const noConsent = await request(server).post('/api/recordings').set(as(MEMBER)).send({ mode: 'mic', mimeType: 'audio/webm' });
    expect(noConsent.status).toBe(400);
    const badMode = await request(server).post('/api/recordings').set(as(MEMBER)).send({ mode: 'fax', mimeType: 'audio/webm', consentAcknowledged: true });
    expect(badMode.status).toBe(400);
    const noOrg = await request(server).post('/api/recordings').set(as('00000000-0000-4000-8000-000000000999')).send({ mode: 'mic', mimeType: 'audio/webm', consentAcknowledged: true });
    expect(noOrg.status).toBe(403);

    const id = await startAndUpload(server, 0);
    const row = meeting(id);
    expect(row).toMatchObject({ org_id: ORG_A, created_by: MEMBER, title: 'Launch sync', attendees: ['Ann', 'Bo'] });
    expect(row.recording_job).toMatchObject({ status: 'recording', mode: 'tab', mimeType: 'audio/webm' });
  });

  test('pieces land in the org folder; a repeat is fine; an outsider gets 404', async () => {
    const server = app();
    const id = await startAndUpload(server, 1);
    expect([...mockStorage.keys()]).toEqual([`meeting-recordings/${ORG_A}/${id}/000000-30000.webm`]);

    const again = await request(server).put(`/api/recordings/${id}/pieces/0?durationMs=30000`).set(as(MEMBER)).set('Content-Type', 'audio/webm').send(Buffer.from('x'));
    expect(again.status).toBe(204);
    const outsider = await request(server).put(`/api/recordings/${id}/pieces/1?durationMs=30000`).set(as(OUTSIDER)).set('Content-Type', 'audio/webm').send(Buffer.from('x'));
    expect(outsider.status).toBe(404);
    const badSeq = await request(server).put(`/api/recordings/${id}/pieces/-1?durationMs=30000`).set(as(MEMBER)).set('Content-Type', 'audio/webm').send(Buffer.from('x'));
    expect(badSeq.status).toBe(400);
    const empty = await request(server).put(`/api/recordings/${id}/pieces/1?durationMs=30000`).set(as(MEMBER)).set('Content-Type', 'audio/webm').send(Buffer.alloc(0));
    expect(empty.status).toBe(400);
  });

  test('finish waits for missing pieces, then transcribes into a full meeting', async () => {
    const server = app();
    const id = await startAndUpload(server, 2);

    const early = await request(server).post(`/api/recordings/${id}/finish`).set(as(MEMBER)).send({ pieces: 3 });
    expect(early.status).toBe(409);
    expect(early.body.missing).toEqual([2]);

    const done = await request(server).post(`/api/recordings/${id}/finish`).set(as(MEMBER)).send({ pieces: 2 });
    expect(done.status).toBe(202);
    await settle(id);

    // The pieces were joined in order into one file for Gemini.
    expect(geminiRecording.transcribeRecording).toHaveBeenCalledTimes(1);
    const [joined, mime] = geminiRecording.transcribeRecording.mock.calls[0];
    expect(joined.toString()).toBe('piece-0|piece-1|');
    expect(mime).toBe('audio/webm');

    const row = meeting(id);
    expect(row.recording_job).toMatchObject({ status: 'done', speakers: 2, lines: 4 });
    expect(row.transcript_segments).toHaveLength(4);
    expect(row.transcript.split('\n')[0]).toBe('Speaker 1: Morning everyone, let us settle the launch date.');
    expect(row.summary).toBe('The team set the launch date.');
    expect(row.decisions).toEqual(['Ship the launch on the fourteenth']);
    expect(row.summary_moments.decisions[0]).toBe(7000);
    expect(row.duration_minutes).toBe(1);
    expect(row.attendees).toEqual(['Ann', 'Bo']);

    expect(mockDb.action_items).toHaveLength(1);
    expect(mockDb.action_items[0]).toMatchObject({ meeting_id: id, org_id: ORG_A, transcript_at_ms: 21000 });

    // Audio is gone once the transcript is saved.
    expect(mockStorage.size).toBe(0);

    // The meeting page sees it.
    const page = await request(server).get(`/api/meetings/${id}`).set(as(MEMBER));
    expect(page.status).toBe(200);
  });

  test('a Gemini failure is recorded with a readable reason; retry recovers', async () => {
    const server = app();
    const id = await startAndUpload(server, 1);
    geminiRecording.transcribeRecording.mockRejectedValueOnce(new Error('503 overloaded'));
    await request(server).post(`/api/recordings/${id}/finish`).set(as(MEMBER)).send({ pieces: 1 });
    await settle(id);

    expect(meeting(id).recording_job.status).toBe('failed');
    expect(meeting(id).recording_job.error).toMatch(/could not be written/);
    expect(mockStorage.size).toBe(1); // audio kept for the retry

    const retry = await request(server).post(`/api/recordings/${id}/retry`).set(as(MEMBER)).send();
    expect(retry.status).toBe(202);
    await settle(id);
    expect(meeting(id).recording_job.status).toBe('done');

    const again = await request(server).post(`/api/recordings/${id}/retry`).set(as(MEMBER)).send();
    expect(again.status).toBe(409);
  });

  test('silence is a failure that says so', async () => {
    const server = app();
    const id = await startAndUpload(server, 1);
    geminiRecording.transcribeRecording.mockResolvedValueOnce('   ');
    await request(server).post(`/api/recordings/${id}/finish`).set(as(MEMBER)).send({ pieces: 1 });
    await settle(id);
    expect(meeting(id).recording_job).toMatchObject({ status: 'failed' });
    expect(meeting(id).recording_job.error).toMatch(/No speech/);
  });

  test('a stale transcribing job can be retried, a fresh one cannot', async () => {
    const { isStale, STALE_JOB_MS } = recorder._internal;
    const now = Date.now();
    expect(isStale({ updatedAt: new Date(now - STALE_JOB_MS - 1).toISOString() }, now)).toBe(true);
    expect(isStale({ updatedAt: new Date(now - 1000).toISOString() }, now)).toBe(false);
  });

  test('discard removes the unfinished meeting and its audio; outsiders cannot', async () => {
    const server = app();
    const id = await startAndUpload(server, 2);
    const outsider = await request(server).delete(`/api/recordings/${id}`).set(as(OUTSIDER));
    expect(outsider.status).toBe(404);
    const res = await request(server).delete(`/api/recordings/${id}`).set(as(MEMBER));
    expect(res.status).toBe(200);
    expect(meeting(id)).toBeUndefined();
    expect(mockStorage.size).toBe(0);
  });

  test('deleting a meeting also deletes leftover recording audio', async () => {
    const server = app();
    const id = await startAndUpload(server, 1);
    const res = await request(server).delete(`/api/meetings/${id}`).set(as(MEMBER));
    expect(res.status).toBe(200);
    await flush();
    expect(mockStorage.size).toBe(0);
  });
});

describe('salvage after a closed tab', () => {
  test('transcribes the pieces saved from the start, and refuses while one just arrived', async () => {
    const server = app();
    const id = await startAndUpload(server, 3);
    // Piece 1 never arrived: only piece 0 can be joined.
    for (const k of [...mockStorage.keys()]) if (k.includes('/000001-')) mockStorage.delete(k);

    const res = await request(server).post(`/api/recordings/${id}/finish`).set(as(MEMBER)).send({ salvage: true });
    expect(res.status).toBe(202);
    await settle(id);
    expect(geminiRecording.transcribeRecording.mock.calls[0][0].toString()).toBe('piece-0|');
    expect(meeting(id).recording_job).toMatchObject({ status: 'done', pieces: 1 });
  });

  test('a piece saved moments ago means someone is still recording', async () => {
    const id = '00000000-0000-4000-8000-00000000f001';
    mockDb.meetings.push({ id, org_id: ORG_A, recording_job: { status: 'recording', mimeType: 'audio/webm' } });
    const now = Date.now();
    mockStorage.set(`meeting-recordings/${ORG_A}/${id}/000000-30000.webm`, Buffer.from('a'));
    const supabase = require('../config/supabase').supabase;
    const original = supabase.storage.from;
    supabase.storage.from = (b) => {
      const bucket = original(b);
      return { ...bucket, list: async (...args) => {
        const out = await bucket.list(...args);
        return { ...out, data: out.data.map((f) => ({ ...f, created_at: new Date(now - 10_000).toISOString() })) };
      } };
    };
    try {
      await expect(recorder.finishRecording({ meetingId: id, salvage: true, now })).rejects.toMatchObject({ status: 409 });
    } finally {
      supabase.storage.from = original;
    }
  });
});
