/**
 * In-browser recorder tests.
 *
 * Covers:
 *   - Gemini's tagged transcript → timed lines (tags, bold, hours, continuation, no speaker)
 *   - start makes an org-scoped meeting; consent and workspace are required
 *   - pieces are stored under the org/meeting folder; repeats are fine; outsiders get 404
 *   - finish refuses while pieces are missing, then transcribes in the background into
 *     transcript_segments, summary, decisions, action items with timecodes, and keeps the audio
 *   - playback hands out a signed link to the seekable copy, or to the pieces in order,
 *     org-scoped; a member can remove the audio and keep the transcript
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
let mockFailActions = false;

function mockMakeQuery(table) {
  const filters = [];
  let mode = 'select';
  let payload = null;
  const field = (row, column) => {
    const [key, property] = column.split('->>');
    return property ? row[key]?.[property] : row[key];
  };
  const matches = (row) => filters.every((f) => f(row));
  const run = () => {
    const rows = mockDb[table] || (mockDb[table] = []);
    if (mode === 'insert') {
      if (table === 'action_items' && mockFailActions) {
        return { rows: null, error: { message: 'action write failed' } };
      }
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
    eq(col, val) { filters.push((r) => field(r, col) === val); return q; },
    in(col, vals) { filters.push((r) => vals.includes(r[col])); return q; },
    is(col, val) { filters.push((r) => (field(r, col) ?? null) === val); return q; },
    not(col, op, val) { filters.push((r) => (op === 'is' ? (r[col] ?? null) !== val : true)); return q; },
    lt(col, val) { filters.push((r) => r[col] < val); return q; },
    like(col, pattern) {
      const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`);
      filters.push((r) => re.test(String(r[col] ?? '')));
      return q;
    },
    order() { return q; },
    limit() { return q; },
    maybeSingle() { const { rows } = run(); return Promise.resolve({ data: rows[0] || null, error: null }); },
    single() {
      const { rows } = run();
      return Promise.resolve(rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { message: 'not single' } });
    },
    then(resolve, reject) {
      try { const { rows, error } = run(); resolve({ data: rows, error: error ?? null }); } catch (e) { reject(e); }
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
    async createSignedUrl(path, expiresIn) {
      return { data: { signedUrl: `https://signed.test/${path}?ttl=${expiresIn}` }, error: null };
    },
    async createSignedUrls(paths, expiresIn) {
      return { data: paths.map((p) => ({ path: p, signedUrl: `https://signed.test/${p}?ttl=${expiresIn}`, error: null })), error: null };
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
jest.mock('../services/playbackFile', () => ({
  makeSeekable: jest.fn(async (buf, ext) => Buffer.concat([Buffer.from(`seekable.${ext}:`), buf])),
  readWaveformPeaks: jest.fn(async () => [0, 0.6, 0.3]),
  readWaveformPeaksFromAudio: jest.fn(async () => [0.1, 0.6, 0.3]),
}));
jest.mock('../services/botRecording', () => ({
  freshRecordingLink: jest.fn(async () => 'https://signed.test/recording.mp4?token=fresh'),
}));
jest.mock('../config/geminiRecording', () => ({
  ...jest.requireActual('../config/geminiRecording'), isConfigured: jest.fn(() => true), transcribeRecording: jest.fn(),
}));
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
const playbackFile = require('../services/playbackFile');

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
  mockFailActions = false;
  mockDb.org_members = [
    { user_id: MEMBER, org_id: ORG_A },
    { user_id: OUTSIDER, org_id: ORG_B },
  ];
  mockDb.meetings = [];
  mockDb.action_items = [];
  geminiRecording.transcribeRecording.mockReset();
  geminiRecording.transcribeRecording.mockResolvedValue(geminiRecording.parseTimestampedTranscript(GEMINI_TEXT));
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
  const parse = geminiRecording.parseTimestampedTranscript;

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
  test('writing final live-room minutes keeps approved tasks and skips automatic action creation', async () => {
    const id = '00000000-0000-4000-8000-000000000047';
    mockDb.meetings.push({
      id, org_id: ORG_A, created_by: MEMBER, title: 'Live review', action_items_require_approval: true,
      transcript: 'Priya: I will send the checklist.',
      transcript_segments: [{ atMs: 14000, speaker: 'Priya', text: 'I will send the checklist.' }],
    });
    const approved = { id: 'approved', meeting_id: id, org_id: ORG_A, task_description: 'Send the checklist', manually_created: true };
    mockDb.action_items.push(approved);
    const ai = require('../config/ai');
    ai.extractActionItems.mockClear();
    await request(app()).post(`/api/meetings/${id}/reprocess`).set(as(MEMBER)).expect(200);
    expect(ai.extractActionItems).not.toHaveBeenCalled();
    expect(mockDb.action_items).toEqual([approved]);
    expect(meeting(id).summary).toBeTruthy();
  });

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
    expect(row.recording_job).toMatchObject({ status: 'done', speakers: 2, lines: 4, stage: null });
    expect(row.transcript_segments).toHaveLength(4);
    expect(row.transcript.split('\n')[0]).toBe('Speaker 1: Morning everyone, let us settle the launch date.');
    expect(row.summary).toBe('The team set the launch date.');
    expect(row.decisions).toEqual(['Ship the launch on the fourteenth']);
    expect(row.summary_moments.decisions[0]).toBe(7000);
    expect(row.duration_minutes).toBe(1);
    expect(row.attendees).toEqual(['Ann', 'Bo']);

    expect(mockDb.action_items).toHaveLength(1);
    expect(mockDb.action_items[0]).toMatchObject({ meeting_id: id, org_id: ORG_A, transcript_at_ms: 21000 });

    // The audio stays for playback (retention deletes it later), plus one seekable copy.
    expect(mockStorage.size).toBe(3);
    expect(row.recording_job).toMatchObject({ audioKept: true, playbackFile: `${ORG_A}/${id}/playback.webm`, waveformPeaks: [0.1, 0.6, 0.3] });
    expect(mockStorage.get(`meeting-recordings/${ORG_A}/${id}/playback.webm`).toString()).toBe('seekable.webm:piece-0|piece-1|');

    // The meeting page sees it.
    const page = await request(server).get(`/api/meetings/${id}`).set(as(MEMBER));
    expect(page.status).toBe(200);
    playbackFile.readWaveformPeaksFromAudio.mockClear();
    const waveform = await request(server).get(`/api/recordings/${id}/waveform`).set(as(MEMBER)).expect(200);
    expect(waveform.body.peaks).toEqual([0.1, 0.6, 0.3]);
    expect(playbackFile.readWaveformPeaksFromAudio).not.toHaveBeenCalled();
  });

  test('an existing browser recording can rebuild the missing later transcript without republishing its recap', async () => {
    const server = app();
    const id = await startAndUpload(server);
    await request(server).post(`/api/recordings/${id}/finish`).set(as(MEMBER)).send({ pieces: 2 }).expect(202);
    await settle(id);
    const previous = meeting(id);
    previous.summary = 'Edited summary';
    const beforeActions = JSON.stringify(mockDb.action_items);
    let announceProgress;
    let resume;
    const progressSaved = new Promise(resolve => { announceProgress = resolve; });
    const resumeTranscription = new Promise(resolve => { resume = resolve; });
    geminiRecording.transcribeRecording.mockImplementationOnce(async (_audio, _mime, report) => {
      await report({ processedMs: 30_000, totalMs: 60_000 });
      announceProgress();
      await resumeTranscription;
      return [
        { atMs: 1000, endMs: 3000, speaker: 'Speaker 1', text: 'Opening remarks.' },
        { atMs: 54000, endMs: 59000, speaker: 'Speaker 2', text: 'Ship the launch on the fourteenth.' },
      ];
    });

    const path = `/api/recordings/${id}/rebuild-transcript`;
    await request(server).post(path).set(as(OUTSIDER)).expect(404);
    await request(server).post(path).set(as(MEMBER)).expect(202);
    await progressSaved;
    try {
      expect(meeting(id).recording_job.transcriptRebuildProgress).toEqual({
        stage: 'transcribing', processedMs: 30_000, totalMs: 60_000,
      });
    } finally {
      resume();
    }
    await settle(id);

    const row = meeting(id);
    expect(row.transcript_segments.at(-1)).toMatchObject({ atMs: 54000, endMs: 59000, speaker: 'Speaker 2' });
    expect(row.summary).toBe('Edited summary');
    expect(row.summary_moments.decisions).toEqual([54000]);
    expect(row.recording_job).toMatchObject({
      status: 'done', transcriptRebuildAt: null, transcriptRebuildProgress: null,
      transcriptRebuiltAt: expect.any(String), audioKept: true,
    });
    expect(JSON.stringify(mockDb.action_items)).toBe(beforeActions);
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

  test('a failed summary keeps the transcript and records why', async () => {
    const server = app();
    const ai = require('../config/ai');
    ai.generateSummary.mockRejectedValueOnce(new Error('Summary generation failed: Unexpected token'));
    const id = await startAndUpload(server, 1);
    await request(server).post(`/api/recordings/${id}/finish`).set(as(MEMBER)).send({ pieces: 1 });
    await settle(id);
    expect(meeting(id).recording_job).toMatchObject({ status: 'done', summaryError: 'Summary generation failed: Unexpected token' });
    expect(meeting(id).transcript_segments).toHaveLength(4);
    expect(meeting(id).summary).toBeNull();
  });

  test('retries a failed action write from the transcript without resending audio', async () => {
    const server = app();
    const id = await startAndUpload(server, 1);
    mockFailActions = true;
    await request(server).post('/api/recordings/' + id + '/finish').set(as(MEMBER)).send({ pieces: 1 }).expect(202);
    await settle(id);
    expect(meeting(id)).toMatchObject({ summary: null, recording_job: { status: 'done', summaryError: 'Could not save the meeting action items' } });
    expect(meeting(id).transcript_segments).toHaveLength(4);
    expect(mockDb.action_items).toEqual([]);

    mockFailActions = false;
    await request(server).post('/api/meetings/' + id + '/reprocess').set(as(MEMBER)).expect(200);
    expect(meeting(id).recording_job.summaryError).toBeNull();
    expect(mockDb.action_items).toHaveLength(1);
    expect(mockDb.action_items[0].transcript_at_ms).toBe(21000);
    expect(geminiRecording.transcribeRecording).toHaveBeenCalledTimes(1);
  });

  test('silence is a failure that says so', async () => {
    const server = app();
    const id = await startAndUpload(server, 1);
    geminiRecording.transcribeRecording.mockResolvedValueOnce([]);
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

  test('playback signs the seekable copy for the meeting org only', async () => {
    const server = app();
    const id = await startAndUpload(server, 2);
    await request(server).post(`/api/recordings/${id}/finish`).set(as(MEMBER)).send({ pieces: 2 });
    await settle(id);

    const res = await request(server).get(`/api/recordings/${id}/playback`).set(as(MEMBER));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({ mimeType: 'audio/webm', durationMs: 60000, url: `https://signed.test/${ORG_A}/${id}/playback.webm?ttl=3600` });
    expect(res.body.pieces).toBeUndefined();

    const outsider = await request(server).get(`/api/recordings/${id}/playback`).set(as(OUTSIDER));
    expect(outsider.status).toBe(404);
    expect(outsider.body.url).toBeUndefined();
  });

  test('without a seekable copy, playback signs the pieces in order', async () => {
    playbackFile.makeSeekable.mockRejectedValueOnce(new Error('spawn ffmpeg ENOENT'));
    const server = app();
    const id = await startAndUpload(server, 2);

    const tooSoon = await request(server).get(`/api/recordings/${id}/playback`).set(as(MEMBER));
    expect(tooSoon.status).toBe(404); // still recording

    await request(server).post(`/api/recordings/${id}/finish`).set(as(MEMBER)).send({ pieces: 2 });
    await settle(id);
    expect(meeting(id).recording_job).toMatchObject({ status: 'done', playbackFile: null });

    const res = await request(server).get(`/api/recordings/${id}/playback`).set(as(MEMBER));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mimeType: 'audio/webm', durationMs: 60000 });
    expect(res.body.pieces.map((p) => p.seq)).toEqual([0, 1]);
    expect(res.body.pieces[0].url).toBe(`https://signed.test/${ORG_A}/${id}/000000-30000.webm?ttl=600`);

    // Older rows have no persisted peaks and can be measured from the complete stream.
    delete meeting(id).recording_job.waveformPeaks;
    playbackFile.readWaveformPeaksFromAudio.mockImplementationOnce(async (audio) => {
      const pieces = [];
      for await (const part of audio) pieces.push(part);
      expect(Buffer.concat(pieces).toString()).toBe('piece-0|piece-1|');
      return [0.2, 0.5];
    });
    const waveform = await request(server).get(`/api/recordings/${id}/waveform`).set(as(MEMBER)).expect(200);
    expect(waveform.body.peaks).toEqual([0.2, 0.5]);

    const outsider = await request(server).get(`/api/recordings/${id}/playback`).set(as(OUTSIDER));
    expect(outsider.status).toBe(404);
    expect(outsider.body.pieces).toBeUndefined();

    meeting(id).recording_job.retentionDeletedAt = new Date().toISOString();
    const expired = await request(server).get(`/api/recordings/${id}/playback`).set(as(MEMBER));
    expect(expired.status).toBe(404);
  });

  test('a linked bot recording advertises server peaks, scoped to retained audio in the meeting org', async () => {
    const server = app();
    const id = '00000000-0000-4000-8000-000000000044';
    const url = 'https://signed.test/recording.mp4?token=fresh';
    const job = { status: 'done', source: 'bot', botSessionId: 'session-1', audioKept: true, durationMs: 3215044 };
    mockDb.meetings.push({ id, org_id: ORG_A, created_by: MEMBER, recording_job: job });
    const playback = await request(server).get(`/api/recordings/${id}/playback`).set(as(MEMBER));
    expect(playback.body).toMatchObject({ url, serverWaveform: true, durationMs: 3215044 });

    const endpoint = `/api/recordings/${id}/waveform`;
    expect((await request(server).get(endpoint).set(as(OUTSIDER))).status).toBe(404);
    expect(playbackFile.readWaveformPeaks).not.toHaveBeenCalled();
    const results = await Promise.all([request(server).get(endpoint).set(as(MEMBER)), request(server).get(endpoint).set(as(MEMBER))]);
    for (const result of results) {
      expect(result.status).toBe(200);
      expect(result.headers['cache-control']).toBe('no-store');
      expect(result.body).toEqual({ success: true, peaks: [0, 0.6, 0.3] });
    }
    expect(playbackFile.readWaveformPeaks).toHaveBeenCalledTimes(1);
    expect(playbackFile.readWaveformPeaks).toHaveBeenCalledWith(url);

    job.audioRemovedAt = new Date().toISOString();
    expect((await request(server).get(endpoint).set(as(MEMBER))).status).toBe(404);
  });

  test('a member can remove the audio and keep the transcript; outsiders cannot', async () => {
    const server = app();
    const id = await startAndUpload(server, 2);
    const tooSoon = await request(server).delete(`/api/recordings/${id}/audio`).set(as(MEMBER));
    expect(tooSoon.status).toBe(409); // still recording

    await request(server).post(`/api/recordings/${id}/finish`).set(as(MEMBER)).send({ pieces: 2 });
    await settle(id);
    const outsider = await request(server).delete(`/api/recordings/${id}/audio`).set(as(OUTSIDER));
    expect(outsider.status).toBe(404);
    expect(mockStorage.size).toBe(3);

    const res = await request(server).delete(`/api/recordings/${id}/audio`).set(as(MEMBER));
    expect(res.status).toBe(200);
    expect(res.body.recordingJob).toMatchObject({ status: 'done', audioKept: false, playbackFile: null, audioRemovedAt: expect.any(String) });
    expect(mockStorage.size).toBe(0);
    expect(meeting(id).transcript).toEqual(expect.any(String));
    expect((await request(server).get(`/api/recordings/${id}/playback`).set(as(MEMBER))).status).toBe(404);
  });

  test('separate browser tracks recover and play their aligned prefixes without entering transcription', async () => {
    const server = app();
    const start = await request(server).post('/api/recordings').set(as(MEMBER)).send({
      title: 'Track test', mode: 'tab', mimeType: 'audio/webm', consentAcknowledged: true, splitAudio: true,
    }).expect(201);
    const id = start.body.meetingId;
    const upload = (track, seq, durationMs = 30000, user = MEMBER) => request(server)
      .put(`/api/recordings/${id}/pieces/${seq}${track === 'mix' ? '' : '/' + track}`)
      .query({ durationMs })
      .set(as(user)).set('Content-Type', 'audio/webm').send(Buffer.from(`${track}-${seq}|`));
    await upload('mic', 0, 30000, OUTSIDER).expect(404);
    await upload('unknown', 0).expect(400);
    for (const track of ['mix', 'mic', 'tab']) await upload(track, 0).expect(204);
    await upload('mix', 1).expect(204);
    await upload('mic', 1).expect(204);
    await upload('tab', 1, 29500).expect(204);
    const recovery = await request(server).get(`/api/recordings/${id}/recovery`).set(as(MEMBER)).expect(200);
    expect(recovery.body).toMatchObject({ pieces: 2, durationMs: 60000, audioTracks: {
      mic: { pieces: 2, durationMs: 60000 }, tab: { pieces: 2, durationMs: 59500 },
    } });
    await request(server).post(`/api/recordings/${id}/finish`).set(as(MEMBER)).send({ pieces: 2 }).expect(202);
    await settle(id);
    expect(geminiRecording.transcribeRecording.mock.calls[0][0].toString()).toBe('mix-0|mix-1|');
    expect(meeting(id).recording_job.audioTracks).toEqual({
      mic: { pieces: 2, durationMs: 60000, playbackFile: `${ORG_A}/${id}/mic-playback.webm` },
      tab: { pieces: 1, durationMs: 30000, playbackFile: `${ORG_A}/${id}/tab-playback.webm` },
    });
    const path = `/api/recordings/${id}/playback`;
    const combined = await request(server).get(path).set(as(MEMBER)).expect(200);
    expect(combined.body.url).toContain('/playback.webm');
    const mic = await request(server).get(path).query({ track: 'mic' }).set(as(MEMBER)).expect(200);
    expect(mic.body).toMatchObject({ durationMs: 60000, url: expect.stringContaining('/mic-playback.webm') });
    expect(mockStorage.get(`meeting-recordings/${ORG_A}/${id}/mic-playback.webm`).toString()).toBe('seekable.webm:mic-0|mic-1|');
    const indexedTab = await request(server).get(path).query({ track: 'tab' }).set(as(MEMBER)).expect(200);
    expect(indexedTab.body).toMatchObject({ durationMs: 30000, url: expect.stringContaining('/tab-playback.webm') });
    meeting(id).recording_job.audioTracks.tab.playbackFile = null;
    const tab = await request(server).get(path).query({ track: 'tab' }).set(as(MEMBER)).expect(200);
    expect(tab.body.pieces).toEqual([{ seq: 0, durationMs: 30000, url: expect.stringContaining('/tab-000000-30000.webm') }]);
    await request(server).get(path).query({ track: 'mic' }).set(as(OUTSIDER)).expect(404);
    await request(server).delete(`/api/recordings/${id}/audio`).set(as(MEMBER)).expect(200);
    expect(mockStorage.size).toBe(0);
    await request(server).get(path).query({ track: 'tab' }).set(as(MEMBER)).expect(404);
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

describe('retention for browser recordings', () => {
  const OLD = '2026-01-01T00:00:00.000Z';

  test('an expired recording loses its transcript and leftover audio, once; the meeting stays', async () => {
    const { sweepRecordings, runRetentionSweep } = require('../services/retentionService');
    const done = '00000000-0000-4000-8000-00000000f101';
    const abandoned = '00000000-0000-4000-8000-00000000f102';
    const fresh = '00000000-0000-4000-8000-00000000f103';
    mockDb.meetings.push(
      { id: done, org_id: ORG_A, created_at: OLD, summary: 'Kept', transcript: 'Speaker 1: hi', transcript_segments: [{ atMs: 0, speaker: 'Speaker 1', text: 'hi' }], summary_moments: { keyPoints: [0], decisions: [] }, recording_job: { status: 'done' } },
      { id: abandoned, org_id: ORG_A, created_at: OLD, recording_job: { status: 'recording', mimeType: 'audio/webm' } },
      { id: fresh, org_id: ORG_A, created_at: new Date().toISOString(), transcript: 'new', recording_job: { status: 'done' } },
    );
    mockDb.action_items.push({ id: 'ai-1', meeting_id: done, transcript_at_ms: 0 });
    mockDb.embeddings = [
      { source_id: done, source_type: 'meeting', content_type: 'transcript_chunk_0' },
      { source_id: done, source_type: 'meeting', content_type: 'summary' },
    ];
    mockStorage.set(`meeting-recordings/${ORG_A}/${abandoned}/000000-30000.webm`, Buffer.from('a'));
    mockStorage.set(`meeting-recordings/${ORG_A}/${done}/playback.webm`, Buffer.from('p'));

    const out = await sweepRecordings(ORG_A, 30);
    expect(out).toEqual({ visited: 2, deleted: 2, failed: 0 });

    const kept = meeting(done);
    expect(kept).toMatchObject({ summary: 'Kept', transcript: null, transcript_segments: null, summary_moments: null });
    expect(kept.recording_job.retentionDeletedAt).toEqual(expect.any(String));
    expect(mockDb.action_items[0].transcript_at_ms).toBeNull();
    expect(mockDb.embeddings.map((e) => e.content_type)).toEqual(['summary']);
    expect(mockStorage.size).toBe(0);
    expect(meeting(fresh).transcript).toBe('new');

    // Already swept rows are not visited again.
    expect(await sweepRecordings(ORG_A, 30)).toEqual({ visited: 0, deleted: 0, failed: 0 });

    // The daily sweep finds workspaces that only have browser recordings.
    mockDb.bot_sessions = [];
    mockDb.workspace_settings = [];
    meeting(abandoned).recording_job = { status: 'failed' };
    const total = await runRetentionSweep();
    expect(total.workspaces).toBe(1);
    expect(total.totals.deleted).toBe(1);
  });
});

describe('beside the bot (one call, one meeting)', () => {
  const SESSION = '00000000-0000-4000-8000-0000000000c1';
  const BOT_MEETING = '00000000-0000-4000-8000-0000000000d1';
  const startBody = { title: '', mode: 'tab', mimeType: 'audio/webm', consentAcknowledged: true };
  const botSession = (patch = {}) => ({
    id: SESSION, org_id: ORG_A, meeting_id: BOT_MEETING, title: 'Weekly sync', platform: 'meet',
    status: 'in_call', join_at: null, started_at: new Date().toISOString(), ended_at: null,
    created_at: new Date().toISOString(), consent_acknowledged_by: MEMBER, ...patch,
  });

  async function uploadPiece(server, id, seq = 0) {
    const put = await request(server).put(`/api/recordings/${id}/pieces/${seq}?durationMs=30000`).set(as(MEMBER)).set('Content-Type', 'audio/webm').send(Buffer.from(`piece-${seq}|`));
    expect(put.status).toBe(204);
  }

  test('bot-check finds my bot in a call, but not someone else\'s or a finished one', async () => {
    const server = app();
    mockDb.bot_sessions = [
      botSession(),
      botSession({ id: 'other-user', consent_acknowledged_by: OUTSIDER, org_id: ORG_B }),
      botSession({ id: 'done', status: 'completed' }),
    ];
    const res = await request(server).get('/api/recordings/bot-check').set(as(MEMBER));
    expect(res.status).toBe(200);
    expect(res.body.bot).toMatchObject({ sessionId: SESSION, meetingId: BOT_MEETING, title: 'Weekly sync', phase: 'live' });

    mockDb.bot_sessions = [botSession({ status: 'pending', join_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), started_at: null })];
    const later = await request(server).get('/api/recordings/bot-check').set(as(MEMBER));
    expect(later.body.bot).toBeNull(); // a bot three hours out is not this call
  });

  test('start refuses with the bot until I choose; "same call" records into the bot\'s meeting', async () => {
    const server = app();
    mockDb.bot_sessions = [botSession()];
    const blind = await request(server).post('/api/recordings').set(as(MEMBER)).send(startBody);
    expect(blind.status).toBe(409);
    expect(blind.body).toMatchObject({ code: 'bot_in_call', bot: { sessionId: SESSION } });
    expect(mockDb.meetings).toHaveLength(0);

    const same = await request(server).post('/api/recordings').set(as(MEMBER)).send({ ...startBody, botSessionId: SESSION });
    expect(same.status).toBe(201);
    expect(same.body.meetingId).toBe(BOT_MEETING);
    expect(meeting(BOT_MEETING)).toMatchObject({ title: 'Weekly sync', recording_job: { status: 'recording', botSessionId: SESSION } });

    const twice = await request(server).post('/api/recordings').set(as(MEMBER)).send({ ...startBody, botSessionId: SESSION });
    expect(twice.status).toBe(409);

    const separate = await request(server).post('/api/recordings').set(as(MEMBER)).send({ ...startBody, separate: true });
    expect(separate.status).toBe(201);
    expect(separate.body.meetingId).not.toBe(BOT_MEETING);
  });

  test('stopping beside a working bot keeps the audio as a backup and writes nothing', async () => {
    const server = app();
    mockDb.bot_sessions = [botSession()];
    await request(server).post('/api/recordings').set(as(MEMBER)).send({ ...startBody, botSessionId: SESSION });
    await uploadPiece(server, BOT_MEETING);
    const fin = await request(server).post(`/api/recordings/${BOT_MEETING}/finish`).set(as(MEMBER)).send({ pieces: 1 });
    expect(fin.body.status).toBe('backup');
    await settle(BOT_MEETING);
    expect(geminiRecording.transcribeRecording).not.toHaveBeenCalled();
    expect(meeting(BOT_MEETING).recording_job).toMatchObject({ status: 'backup', pieces: 1 });
    expect(mockDb.action_items).toHaveLength(0);

    // The bot fails: the backup takes over and writes the one set of minutes.
    mockDb.bot_sessions[0].status = 'failed';
    expect((await recorder.botCouldNotDeliver({ sessionId: SESSION })).status).toBe('transcribing');
    await settle(BOT_MEETING);
    expect(meeting(BOT_MEETING).recording_job).toMatchObject({ status: 'done', source: 'browser' });
    expect(mockDb.action_items).toHaveLength(1);
    expect(mockDb.meetings).toHaveLength(1);

    // A second "could not deliver" (a repeated webhook) does nothing.
    expect((await recorder.botCouldNotDeliver({ sessionId: SESSION })).status).toBe('skipped');
  });

  test('stopping after the bot already wrote the minutes just keeps the audio', async () => {
    const server = app();
    mockDb.bot_sessions = [botSession()];
    await request(server).post('/api/recordings').set(as(MEMBER)).send({ ...startBody, botSessionId: SESSION });
    await uploadPiece(server, BOT_MEETING);
    meeting(BOT_MEETING).transcript_segments = [{ atMs: 0, speaker: 'Ann', text: 'Hi' }];
    const fin = await request(server).post(`/api/recordings/${BOT_MEETING}/finish`).set(as(MEMBER)).send({ pieces: 1 });
    expect(fin.body.status).toBe('done');
    expect(geminiRecording.transcribeRecording).not.toHaveBeenCalled();
  });

  test('stopping beside a bot that failed transcribes the recording at once; a backup can be used on request', async () => {
    const server = app();
    mockDb.bot_sessions = [botSession()];
    await request(server).post('/api/recordings').set(as(MEMBER)).send({ ...startBody, botSessionId: SESSION });
    await uploadPiece(server, BOT_MEETING);
    mockDb.bot_sessions[0].status = 'timeout';
    const fin = await request(server).post(`/api/recordings/${BOT_MEETING}/finish`).set(as(MEMBER)).send({ pieces: 1 });
    expect(fin.body.status).toBe('transcribing');
    await settle(BOT_MEETING);
    expect(meeting(BOT_MEETING).recording_job.status).toBe('done');

    expect(await recorder._internal.botHandOff('nope', 'missing-session')).toBe('record');
  });

  test('"use my recording instead" writes a backup up now', async () => {
    const server = app();
    mockDb.bot_sessions = [botSession()];
    await request(server).post('/api/recordings').set(as(MEMBER)).send({ ...startBody, botSessionId: SESSION });
    await uploadPiece(server, BOT_MEETING);
    await request(server).post(`/api/recordings/${BOT_MEETING}/finish`).set(as(MEMBER)).send({ pieces: 1 });
    const use = await request(server).post(`/api/recordings/${BOT_MEETING}/retry`).set(as(MEMBER)).send();
    expect(use.status).toBe(202);
    await settle(BOT_MEETING);
    expect(meeting(BOT_MEETING).recording_job).toMatchObject({ status: 'done', source: 'browser' });
  });
});
