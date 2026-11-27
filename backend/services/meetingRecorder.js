/**
 * Meeting recorder: meetings recorded in the browser, no bot.
 *
 * Ported from Logos Vision's notetaker recorder (`notetakerCapture.ts`,
 * `notetakerRecordingService.ts`, `meetingTranscript.ts`), reduced to one take per meeting.
 *
 *   1. start     a meeting row is made with `recording_job.status = 'recording'`.
 *   2. pieces    the browser sends the audio in 30-second pieces while it records, so a
 *                closed tab or a crash loses at most one piece. Each piece is stored in
 *                the private `meeting-recordings` bucket as {org}/{meeting}/{seq}-{ms}.webm;
 *                the listing of that folder is the record of what has arrived.
 *   3. finish    once every piece is there, the pieces are joined (they are one recorder's
 *                output, so joined in order they are one valid file), Gemini transcribes it
 *                with speaker turns and times, and the meeting gets the same summary,
 *                decisions, action items and timecodes as a bot meeting. Waveform peaks
 *                are measured from the joined audio while the transcript is written.
 *   4. playback  the audio is kept so the meeting page can play it beside the transcript
 *                (signed URLs, `getPlayback`). After the transcript is written, ffmpeg also
 *                makes one seekable copy, {org}/{meeting}/playback.webm, which the browser
 *                streams; without it the browser joins the pieces. Retention
 *                (`retentionService.sweepRecordings`) deletes the whole folder after the
 *                workspace's retention days, and a member can remove it sooner (`removeAudio`).
 *
 * The service-role client bypasses RLS: callers check meeting access first.
 */

'use strict';

const { supabase } = require('../config/supabase');
const geminiRecording = require('../config/geminiRecording');
const meetingFinish = require('./meetingFinish');
const transcriptMoments = require('./transcriptMoments');
const playbackFile = require('./playbackFile');
const log = require('../utils/log');

const BUCKET = 'meeting-recordings';
const MODES = ['mic', 'camera', 'tab'];
const ISOLATED_TRACKS = ['mic', 'tab'];
const PIECE_MAX_BYTES = 10 * 1024 * 1024;
/** 1,000 pieces of 30 s is 8 h 20 min. */
const MAX_PIECES = 1000;
const MAX_PIECE_MS = 120000;
/** A job still marked transcribing after this long died with the server; it may be retried. */
const STALE_JOB_MS = 20 * 60 * 1000;
const MAX_TITLE = 200;

class RecorderError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

/** The container type without codec parameters: 'audio/webm;codecs=opus' → 'audio/webm'. */
function baseMime(mimeType) {
  const base = String(mimeType || '').split(';')[0].trim().toLowerCase();
  return ['audio/webm', 'audio/ogg', 'audio/mp4'].includes(base) ? base : null;
}

const EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' };

function recordingFolder(orgId, meetingId) {
  return `${orgId}/${meetingId}`;
}

/** `{org}/{meeting}/{seq:06}-{durationMs}.{ext}`: sorts by name, and carries its own length. */
function piecePath(orgId, meetingId, { seq, durationMs, mimeType, track = 'mix' }) {
  const ext = EXT[baseMime(mimeType)] || 'webm';
  const prefix = track === 'mix' ? '' : `${track}-`;
  return `${recordingFolder(orgId, meetingId)}/${prefix}${String(seq).padStart(6, '0')}-${Math.max(0, Math.round(durationMs))}.${ext}`;
}

/** The seekable copy made for playback; `listPieces` skips it (its name has no number). */
function playbackPath(orgId, meetingId, mimeType, track = 'mix') {
  const prefix = track === 'mix' ? '' : `${track}-`;
  return `${recordingFolder(orgId, meetingId)}/${prefix}playback.${EXT[baseMime(mimeType)] || 'webm'}`;
}

const PIECE_NAME = /^(\d{6})-(\d+)\.[a-z0-9]+$/;

function parsePieceName(name) {
  const m = String(name).match(PIECE_NAME);
  return m ? { seq: Number(m[1]), durationMs: Number(m[2]) } : null;
}

function cleanAttendees(input) {
  const list = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(',')
      : [];
  return [...new Set(list.map((a) => String(a ?? '').trim()).filter(Boolean))].slice(0, 100).map((a) => a.slice(0, 200));
}

// ── Storage ──────────────────────────────────────────────────────────────

/** Every file in a meeting's recording folder: the pieces and the playback copy. */
async function listFolder(orgId, meetingId) {
  const bucket = supabase.storage.from(BUCKET);
  const folder = recordingFolder(orgId, meetingId);
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(folder, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    for (const f of data || []) files.push({ name: f.name, path: `${folder}/${f.name}`, createdAt: f.created_at || null });
    if ((data || []).length < 1000) break;
  }
  return files;
}

function piecesForTrack(files, track = 'mix') {
  const pieces = [];
  for (const f of files) {
    const name = track === 'mix' ? f.name : f.name.startsWith(`${track}-`) ? f.name.slice(track.length + 1) : '';
    const parsed = parsePieceName(name);
    if (parsed) pieces.push({ ...parsed, path: f.path, createdAt: f.createdAt });
  }
  return pieces.sort((a, b) => a.seq - b.seq);
}

async function listPieces(orgId, meetingId) {
  return piecesForTrack(await listFolder(orgId, meetingId));
}

async function* recordingPieceBytes(pieces) {
  const bucket = supabase.storage.from(BUCKET);
  for (const piece of pieces) {
    const { data, error } = await bucket.download(piece.path);
    if (error || !data) throw error || new Error(`Missing piece ${piece.seq}`);
    yield Buffer.from(await data.arrayBuffer());
  }
}

async function downloadRecordingPieces(pieces) {
  const parts = [];
  for await (const bytes of recordingPieceBytes(pieces)) parts.push(bytes);
  return Buffer.concat(parts);
}

/** Deletes a meeting's saved audio: the pieces and the playback copy. Idempotent. */
async function purgeRecordingAudio(orgId, meetingId) {
  if (!supabase || !orgId || !meetingId) return { removed: 0 };
  const files = await listFolder(orgId, meetingId);
  if (!files.length) return { removed: 0 };
  const bucket = supabase.storage.from(BUCKET);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await bucket.remove(files.slice(i, i + 100).map((f) => f.path));
    if (error) throw error;
  }
  return { removed: files.length };
}

/**
 * Save the seekable copy for playback. Returns its path, or null when it could not be made
 * (no ffmpeg, a damaged file); playback then joins the pieces, so this never fails the job.
 */
async function savePlaybackFile(meeting, audio, mimeType, track = 'mix') {
  const path = playbackPath(meeting.org_id, meeting.id, mimeType, track);
  try {
    const file = await playbackFile.makeSeekable(audio, EXT[baseMime(mimeType)] || 'webm');
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: baseMime(mimeType) || 'audio/webm', upsert: true });
    if (error) throw error;
    return path;
  } catch (err) {
    log.warn('Recording: no seekable playback copy, the pieces will be joined instead', { meetingId: meeting.id, track, error: err.message });
    return null;
  }
}

// ── Job state ────────────────────────────────────────────────────────────

async function loadMeeting(meetingId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('id, org_id, title, created_by, start_time, attendees, recording_job, summary_template, updated_at, key_points, decisions')
    .eq('id', meetingId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setJob(meeting, patch) {
  const job = { ...(meeting.recording_job || {}), ...patch, updatedAt: new Date().toISOString() };
  const { error } = await supabase
    .from('meetings')
    .update({ recording_job: job, updated_at: job.updatedAt })
    .eq('id', meeting.id)
    .eq('org_id', meeting.org_id);
  if (error) throw error;
  meeting.recording_job = job;
  return job;
}

/**
 * Where a transcription run has got to (transcript, speakers, summary, saving),
 * for the meeting page's writing loader. Best effort: a failed write here never
 * stops the run.
 */
async function markStage(meeting, stage) {
  try {
    await setJob(meeting, { stage, stageAt: new Date().toISOString() });
  } catch (err) {
    log.warn('Recording: could not save the stage', { meetingId: meeting.id, stage, error: err.message });
  }
}

function isStale(job, now = Date.now()) {
  const at = Date.parse(job?.updatedAt || job?.finishedAt || '');
  return !Number.isFinite(at) || now - at > STALE_JOB_MS;
}

/** Meetings this server is transcribing right now. */
const running = new Set();

// ── Beside the bot ───────────────────────────────────────────────────────
//
// The Recall bot and this recorder are two ways to hear one call. Recording a call the
// bot is in would make two meetings, two summaries and every action item twice, so the
// recorder adds its audio to the bot's meeting instead and lets the bot write the minutes.

/** bot_sessions statuses before the bot has finished. */
const BOT_ACTIVE = ['pending', 'launching', 'joining', 'in_call'];
/** A scheduled bot this close to its start counts as in the call. */
const BOT_SOON_MS = 15 * 60 * 1000;
/** A bot still "joining" this long after its start never got in. */
const BOT_NO_SHOW_MS = 30 * 60 * 1000;
/** A finished bot with no minutes after this long will not write any. */
const BOT_INGEST_WAIT_MS = 20 * 60 * 1000;
const BOT_RETRY_FAILED = "The bot's transcript could not be turned into minutes. Try again in a minute.";

function botPhase(session, now) {
  if (session.status === 'in_call') return 'live';
  const joinAt = Date.parse(session.join_at || '');
  return Number.isFinite(joinAt) && joinAt > now + 60 * 1000 ? 'scheduled' : 'joining';
}

/**
 * This person's bots that are in a call now or about to join one, the likeliest first.
 * @returns {Promise<Array<{ sessionId, meetingId, title, platform, phase, joinAt }>>}
 */
async function botsInCall({ orgId, userId, now = Date.now() }) {
  if (!orgId || !userId) return [];
  const { data, error } = await supabase
    .from('bot_sessions')
    .select('id, meeting_id, title, platform, status, join_at, started_at, created_at')
    .eq('org_id', orgId)
    .eq('consent_acknowledged_by', userId)
    .in('status', BOT_ACTIVE)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  const rank = { live: 0, joining: 1, scheduled: 2 };
  return (data || [])
    .filter((s) => {
      if (!s.meeting_id) return false;
      const joinAt = Date.parse(s.join_at || s.created_at || '');
      if (!Number.isFinite(joinAt)) return s.status === 'in_call';
      if (s.status === 'in_call') return true;
      return joinAt <= now + BOT_SOON_MS && now - joinAt <= BOT_NO_SHOW_MS;
    })
    .map((s) => ({
      sessionId: s.id,
      meetingId: s.meeting_id,
      title: s.title || null,
      platform: s.platform || null,
      phase: botPhase(s, now),
      joinAt: s.join_at || null,
    }))
    .sort((a, b) => rank[a.phase] - rank[b.phase]);
}

/**
 * What a recording made beside a bot does when it stops:
 *   'done'    the bot has already written the minutes; the audio is simply kept
 *   'backup'  the bot will write them; the audio waits in case it cannot
 *   'record'  the bot cannot (it failed, never joined, or left nothing): transcribe this
 */
async function botHandOff(meetingId, botSessionId, now = Date.now()) {
  const [{ data: written }, { data: session }] = await Promise.all([
    supabase.from('meetings').select('transcript_segments').eq('id', meetingId).maybeSingle(),
    supabase.from('bot_sessions').select('status, join_at, started_at, ended_at').eq('id', botSessionId).maybeSingle(),
  ]);
  if (Array.isArray(written?.transcript_segments) && written.transcript_segments.length) return 'done';
  if (!session) return 'record';
  if (['failed', 'timeout'].includes(session.status)) return 'record';
  if (session.status === 'stopped' && !session.started_at) return 'record';
  if (BOT_ACTIVE.includes(session.status) && session.status !== 'in_call') {
    const joinAt = Date.parse(session.join_at || '');
    if (Number.isFinite(joinAt) && now - joinAt > BOT_NO_SHOW_MS) return 'record';
  }
  if (['completed', 'stopped'].includes(session.status)) {
    const ended = Date.parse(session.ended_at || '');
    if (Number.isFinite(ended) && now - ended > BOT_INGEST_WAIT_MS) return 'record';
  }
  return 'backup';
}

/**
 * The bot could not write the minutes (it failed, heard nothing, or its transcript would
 * not ingest). A recording made beside it takes over: its audio is transcribed instead.
 * Does nothing when there is no such recording, or the minutes already exist.
 */
async function botCouldNotDeliver({ sessionId, meetingId = null }) {
  let id = meetingId;
  if (!id) {
    const { data } = await supabase.from('bot_sessions').select('meeting_id').eq('id', sessionId).maybeSingle();
    id = data?.meeting_id || null;
  }
  if (!id) return { status: 'skipped' };
  const meeting = await loadMeeting(id);
  const job = meeting?.recording_job;
  if (!job || job.botSessionId !== sessionId || !(job.pieces > 0)) return { status: 'skipped' };
  if (!['backup', 'failed', 'transcribing'].includes(job.status) || running.has(id)) return { status: 'skipped' };
  const { data: written } = await supabase.from('meetings').select('transcript_segments').eq('id', id).maybeSingle();
  if (Array.isArray(written?.transcript_segments) && written.transcript_segments.length) return { status: 'skipped' };
  log.info('Recording: the bot could not deliver, transcribing the recording made beside it', { meetingId: id, sessionId });
  await setJob(meeting, { status: 'transcribing', source: 'browser', error: null, stage: null, stageAt: null });
  runInBackground(id);
  return { status: 'transcribing' };
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Make the meeting a recording will fill.
 * @returns {Promise<{meetingId: string, recordingJob: object}>}
 */
async function startRecording({ userId, orgId, title, attendees, mode, mimeType, botSessionId = null, separate = false, splitAudio = false, now = Date.now() }) {
  if (!MODES.includes(mode)) throw new RecorderError(400, 'Choose microphone, camera or browser tab.');
  const mime = baseMime(mimeType);
  if (!mime) throw new RecorderError(400, 'This browser records in a format Entomate cannot transcribe.');

  // One call, one meeting: a bot of this person's in a call now gets the recording added
  // to its meeting (as a backup), unless they say this is a different meeting.
  let bot = null;
  if (botSessionId) {
    bot = (await botsInCall({ orgId, userId, now })).find((b) => b.sessionId === botSessionId) || null;
    if (!bot) throw new RecorderError(409, 'The bot has left that call. Start again to record on your own.');
    const { data: taken, error: takenErr } = await supabase.from('meetings').select('id').eq('id', bot.meetingId).maybeSingle();
    if (takenErr) throw takenErr;
    if (taken) throw new RecorderError(409, 'That meeting is already being recorded.');
  } else if (!separate) {
    const [live] = await botsInCall({ orgId, userId, now });
    if (live) throw new RecorderError(409, 'The bot is already in this call.', { code: 'bot_in_call', bot: live });
  }

  const at = new Date(now).toISOString();
  const name = String(title || '').trim().slice(0, MAX_TITLE) || (bot?.title ? String(bot.title).slice(0, MAX_TITLE) : '');
  const recordingJob = { status: 'recording', mode, mimeType: mime, startedAt: at, startedBy: userId, updatedAt: at };
  if (bot) recordingJob.botSessionId = bot.sessionId;
  if (splitAudio && mode === 'tab' && !bot) recordingJob.splitAudio = true;
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      ...(bot ? { id: bot.meetingId } : {}),
      title: name || `Recording, ${new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      org_id: orgId,
      created_by: userId,
      attendees: cleanAttendees(attendees),
      start_time: at,
      recording_job: recordingJob,
      created_at: at,
      updated_at: at,
    })
    .select('id, recording_job')
    .single();
  if (error?.code === '23505') throw new RecorderError(409, 'That meeting is already being recorded.');
  if (error) throw error;
  return { meetingId: data.id, recordingJob: data.recording_job };
}

/** Save one piece. A piece already saved (a retry after a lost response) is success. */
async function savePiece({ orgId, meetingId, seq, durationMs, buffer, track = 'mix' }) {
  if (!Number.isInteger(seq) || seq < 0 || seq >= MAX_PIECES) throw new RecorderError(400, 'Invalid piece number.');
  if (!Number.isInteger(durationMs) || durationMs < 0 || durationMs > MAX_PIECE_MS) throw new RecorderError(400, 'Invalid piece length.');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new RecorderError(400, 'The piece is empty.');
  if (buffer.length > PIECE_MAX_BYTES) throw new RecorderError(413, 'The piece is too large.');

  const meeting = await loadMeeting(meetingId);
  const job = meeting?.recording_job;
  if (!job || meeting.org_id !== orgId || job.status !== 'recording') throw new RecorderError(409, 'This meeting is not recording.');
  if (track !== 'mix' && (!job.splitAudio || !ISOLATED_TRACKS.includes(track))) {
    throw new RecorderError(400, 'This recording does not have that audio track.');
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(piecePath(orgId, meetingId, { seq, durationMs, mimeType: job.mimeType, track }), buffer, {
      contentType: job.mimeType,
      upsert: false,
    });
  if (error && !/exists|duplicate/i.test(error.message || '')) throw error;
}

/** A piece this recent means a browser may still be recording this meeting. */
const SALVAGE_QUIET_MS = 90 * 1000;

/** How many pieces run unbroken from the first: what can be joined into one file. */
function contiguousCount(saved) {
  let n = 0;
  while (saved.some((p) => p.seq === n)) n += 1;
  return n;
}

function trackCoverage(files, mixed) {
  const tracks = {};
  const durations = mixed && new Map(mixed.map(piece => [piece.seq, piece.durationMs]));
  for (const track of ISOLATED_TRACKS) {
    let pieces = 0;
    let durationMs = 0;
    for (const piece of piecesForTrack(files, track)) {
      if (piece.seq < pieces) continue;
      if (piece.seq !== pieces || (durations && durations.get(piece.seq) !== piece.durationMs)) break;
      pieces += 1;
      durationMs += piece.durationMs;
    }
    if (pieces > 0) tracks[track] = { pieces, durationMs };
  }
  return tracks;
}

async function recordingRecovery(meetingId) {
  const meeting = await loadMeeting(meetingId);
  const job = meeting?.recording_job;
  if (!job) throw new RecorderError(409, 'This meeting was not recorded here.');
  if (job.status !== 'recording') return { status: job.status };
  const files = await listFolder(meeting.org_id, meetingId);
  const saved = piecesForTrack(files);
  const pieces = contiguousCount(saved);
  return {
    status: job.status,
    pieces,
    durationMs: saved.filter(piece => piece.seq < pieces).reduce((total, piece) => total + piece.durationMs, 0),
    ...(job.splitAudio ? { audioTracks: trackCoverage(files) } : {}),
  };
}

/**
 * Close the recording and start transcribing it in the background.
 * @param {{ pieces?: number, salvage?: boolean }} opts  `pieces`: how many the browser
 *   recorded. `salvage`: the browser closed mid-recording; transcribe what was saved.
 */
async function finishRecording({ meetingId, pieces, salvage = false, now = Date.now() }) {
  if (!salvage && (!Number.isInteger(pieces) || pieces < 1 || pieces > MAX_PIECES)) throw new RecorderError(400, 'Nothing was recorded.');
  const meeting = await loadMeeting(meetingId);
  const job = meeting?.recording_job;
  if (!job) throw new RecorderError(409, 'This meeting was not recorded here.');
  if (job.status !== 'recording') return { status: job.status };

  const files = await listFolder(meeting.org_id, meetingId);
  const saved = piecesForTrack(files);
  if (salvage) {
    const newest = Math.max(0, ...saved.map((p) => Date.parse(p.createdAt || '') || 0));
    if (newest && now - newest < SALVAGE_QUIET_MS) {
      throw new RecorderError(409, 'This meeting is still being recorded somewhere. Stop it there first.');
    }
    pieces = contiguousCount(saved);
    if (pieces === 0) throw new RecorderError(409, 'No audio was saved for this recording.');
  }
  const have = new Set(saved.map((p) => p.seq));
  const missing = [];
  for (let seq = 0; seq < pieces; seq++) if (!have.has(seq)) missing.push(seq);
  if (missing.length) {
    throw new RecorderError(409, 'Some of the recording is still uploading.', { missing: missing.slice(0, 50) });
  }

  const mixed = saved.filter(piece => piece.seq < pieces);
  const durationMs = mixed.reduce((sum, piece) => sum + piece.durationMs, 0);
  const finishedAt = new Date(now).toISOString();
  // Recorded beside the bot: the bot writes the minutes, and this audio waits as a
  // backup, transcribed only if the bot cannot deliver (botCouldNotDeliver).
  if (job.botSessionId) {
    const handOff = await botHandOff(meetingId, job.botSessionId, now);
    if (handOff !== 'record') {
      await setJob(meeting, { status: handOff, pieces, durationMs, finishedAt, error: null, stage: null, stageAt: null });
      return { status: handOff };
    }
  }
  await setJob(meeting, {
    status: 'transcribing', source: 'browser', pieces, durationMs, finishedAt, error: null, stage: null, stageAt: null,
    ...(job.splitAudio ? { audioTracks: trackCoverage(files, mixed) } : {}),
  });
  runInBackground(meetingId);
  return { status: 'transcribing' };
}

/**
 * Try a failed (or abandoned) transcription again. A browser recording is transcribed
 * from its saved audio; a bot meeting with no audio of its own asks Recall again.
 * A backup recording beside a bot can be written up now instead of waiting on the bot.
 */
async function retryTranscription({ meetingId }) {
  const meeting = await loadMeeting(meetingId);
  const job = meeting?.recording_job;
  if (!job) throw new RecorderError(409, 'This meeting was not recorded here.');
  const stuck = job.status === 'transcribing' && !running.has(meetingId) && isStale(job);
  const retryable = job.status === 'failed' || job.status === 'backup' || stuck;
  if (!retryable) throw new RecorderError(409, job.status === 'transcribing' ? 'The transcript is still being written.' : 'There is nothing to retry.');
  if (!(job.pieces > 0) && job.source === 'bot' && job.botSessionId) {
    await setJob(meeting, { status: 'transcribing', error: null, stage: null, stageAt: null });
    require('./botOrchestrator')
      .ingestSessionTranscript(job.botSessionId)
      .then((r) => (['ingested', 'already_ingested', 'in_progress'].includes(r?.status) ? null : setJob(meeting, { status: 'failed', error: BOT_RETRY_FAILED })))
      .catch((err) => {
        log.error('Recording: bot transcript retry failed', { meetingId, error: err.message });
        return setJob(meeting, { status: 'failed', error: BOT_RETRY_FAILED }).catch(() => {});
      });
    return { status: 'transcribing' };
  }
  await setJob(meeting, { status: 'transcribing', source: 'browser', error: null, stage: null, stageAt: null });
  runInBackground(meetingId);
  return { status: 'transcribing' };
}

function isTranscriptRebuilding(job) {
  const started = Date.parse(job?.transcriptRebuildAt);
  const lastProgress = Date.parse(job?.updatedAt) || 0;
  return Number.isFinite(started) && Date.now() - Math.max(started, lastProgress) < STALE_JOB_MS;
}

/** Replace an old browser transcript from its retained audio without writing the minutes again. */
async function rebuildTranscript({ meetingId, orgId }) {
  const meeting = await loadPlaybackMeeting(orgId, meetingId);
  const job = meeting.recording_job;
  const browser = job.source === 'browser' || (!job.source && !job.botSessionId && MODES.includes(job.mode));
  if (!browser || job.status !== 'done' || !job.audioKept) {
    throw new RecorderError(409, 'The transcript can only be rebuilt from a saved browser recording.');
  }
  if (!geminiRecording.isConfigured()) throw new RecorderError(503, 'Transcription is unavailable.');
  if (running.has(meetingId) || isTranscriptRebuilding(job)) {
    throw new RecorderError(409, 'The transcript is already being rebuilt.');
  }

  const startedAt = new Date().toISOString();
  let claim = supabase.from('meetings').update({
    recording_job: { ...job, transcriptRebuildAt: startedAt, transcriptRebuildError: null, transcriptRebuildProgress: null, updatedAt: startedAt },
    updated_at: startedAt,
  }).eq('id', meetingId).eq('org_id', orgId);
  claim = meeting.updated_at ? claim.eq('updated_at', meeting.updated_at) : claim.is('updated_at', null);
  const { data, error } = await claim.select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new RecorderError(409, 'The meeting changed. Try again.');
  running.add(meetingId);
  void runTranscriptRebuild(meeting, startedAt)
    .catch(err => log.error('Recording transcript rebuild failed', { meetingId, error: err.message }))
    .finally(() => running.delete(meetingId));
  return { status: 'transcribing' };
}

async function writeTranscriptRebuild({ id, org_id: orgId }, startedAt, changes) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await loadMeeting(id);
    const current = latest?.recording_job;
    if (current?.transcriptRebuildAt !== startedAt || current.audioRemovedAt || current.retentionDeletedAt) return null;
    const updatedAt = new Date().toISOString();
    const { job, ...fields } = changes(latest, updatedAt);
    const { data, error } = await supabase.from('meetings').update({
      ...fields,
      recording_job: { ...current, ...job, updatedAt },
      updated_at: updatedAt,
    }).eq('id', id).eq('org_id', orgId).eq('updated_at', latest.updated_at)
      .eq('recording_job->>transcriptRebuildAt', startedAt)
      .is('recording_job->>retentionDeletedAt', null).is('recording_job->>audioRemovedAt', null)
      .select('id').maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  throw new Error('The meeting changed while updating the transcript rebuild');
}

async function runTranscriptRebuild(meeting, startedAt) {
  const { id, org_id: orgId, recording_job: job } = meeting;
  let segments;
  let transcriptRebuildError = null;
  let progress = { processedMs: 0, totalMs: 0 };
  const report = async (stage) => {
    try {
      await writeTranscriptRebuild(meeting, startedAt, () => ({
        job: { transcriptRebuildProgress: { ...progress, stage } },
      }));
    } catch (err) {
      log.warn('Recording transcript rebuild progress could not be saved', { meetingId: id, error: err.message });
    }
  };
  try {
    const pieces = (await listPieces(orgId, id)).filter(piece => piece.seq < (job.pieces || MAX_PIECES));
    if (!pieces.length || pieces.some((piece, index) => piece.seq !== index) || (job.pieces && pieces.length !== job.pieces)) {
      throw new Error('The saved recording is missing audio pieces');
    }
    const audio = await downloadRecordingPieces(pieces);
    segments = await geminiRecording.transcribeRecording(audio, job.mimeType || 'audio/webm', async (clipProgress) => {
      if (!clipProgress) return;
      progress = clipProgress;
      await report('transcribing');
    });
    if (!segments.length) throw new Error('No speech found');
    await report('saving');
  } catch (err) {
    log.warn('Recording transcript could not be rebuilt', { meetingId: id, error: err.message });
    transcriptRebuildError = 'The transcript could not be rebuilt. Try again.';
  }

  const transcript = transcriptRebuildError ? null : meetingFinish.buildTranscriptText(segments);
  const saved = await writeTranscriptRebuild(meeting, startedAt, (latest, updatedAt) => ({
    ...(transcript === null ? {} : {
      transcript,
      transcript_segments: segments,
      transcript_embedding: null,
      summary_moments: transcriptMoments.summaryMoments(segments, latest.key_points || [], latest.decisions || []),
    }),
    job: {
      ...(transcript === null ? {} : {
        lines: segments.length,
        speakers: new Set(segments.map(line => line.speaker)).size,
        speakerSuggestions: [],
        transcriptRebuiltAt: updatedAt,
      }),
      transcriptRebuildAt: null,
      transcriptRebuildProgress: null,
      transcriptRebuildError,
    },
  }));
  if (saved && transcript !== null) await require('./embeddingService').generateEmbeddingsForMeeting(id, { transcript });
}

/** Throw away a recording that never became a meeting: its audio and its row. */
async function discardRecording({ orgId, meetingId }) {
  const meeting = await loadMeeting(meetingId);
  const status = meeting?.recording_job?.status;
  if (status !== 'recording' && status !== 'failed') throw new RecorderError(409, 'Only an unfinished recording can be discarded.');
  await purgeRecordingAudio(orgId, meetingId);
  const { error } = await supabase.from('meetings').delete().eq('id', meetingId).eq('org_id', orgId);
  if (error) throw error;
}

function runInBackground(meetingId) {
  if (running.has(meetingId)) return;
  running.add(meetingId);
  transcribeMeeting(meetingId)
    .catch((err) => log.error('Recording transcription crashed', { meetingId, error: err.message }))
    .finally(() => running.delete(meetingId));
}

/** User-facing reason for a failure; the details go to the log. */
function failureMessage(err) {
  if (err?.userMessage) return err.userMessage;
  return 'The transcript could not be written. Try again; if it keeps failing, the recording may be damaged.';
}

/**
 * The job: join the pieces, transcribe, summarise, save. The audio stays for playback.
 * Exported for tests; `runInBackground` is the caller.
 */
async function transcribeMeeting(meetingId) {
  const meeting = await loadMeeting(meetingId);
  if (!meeting || meeting.recording_job?.status !== 'transcribing') return { status: 'skipped' };
  const job = meeting.recording_job;
  try {
    if (!geminiRecording.isConfigured()) {
      const err = new Error('GEMINI_API_KEY not set');
      err.userMessage = 'Transcription is not set up on this server yet.';
      throw err;
    }

    const files = await listFolder(meeting.org_id, meetingId);
    const pieces = piecesForTrack(files).filter(piece => piece.seq < (job.pieces || MAX_PIECES));
    if (!pieces.length) {
      const err = new Error('No audio pieces found');
      err.userMessage = 'No audio was saved for this recording.';
      throw err;
    }

    const audio = await downloadRecordingPieces(pieces);
    await markStage(meeting, 'transcript');
    const waveform = playbackFile.readWaveformPeaksFromAudio(audio).catch((err) => {
      log.warn('Recording: waveform could not be prepared', { meetingId, error: err.message });
      return null;
    });
    let segments = await geminiRecording.transcribeRecording(audio, job.mimeType || 'audio/webm', async () => {
      if (Date.now() - Date.parse(meeting.recording_job.updatedAt) >= 60_000) await setJob(meeting, {});
    });
    if (!segments.length) {
      const err = new Error('Empty transcript');
      err.userMessage = 'No speech was heard in this recording. Check that the right microphone or tab audio was shared.';
      throw err;
    }
    const playback = await savePlaybackFile(meeting, audio, job.mimeType || 'audio/webm');

    const minutes = await meetingFinish.writeMinutes({
      meeting,
      segments,
      title: meeting.title,
      attendees: meeting.attendees,
      onStage: (stage) => markStage(meeting, stage),
    });
    segments = minutes.segments;
    const speakers = [...new Set(segments.map((s) => s.speaker))];

    await markStage(meeting, 'saving');
    const savedActions = await meetingFinish.saveMinutesActions(meeting, minutes);
    const waveformPeaks = await waveform;
    const audioTracks = { ...job.audioTracks };
    for (const track of ISOLATED_TRACKS) {
      const coverage = audioTracks[track];
      if (!coverage?.durationMs) continue;
      const sourcePieces = piecesForTrack(files, track).filter(piece => piece.seq < coverage.pieces);
      if (sourcePieces.length !== coverage.pieces || sourcePieces.some((piece, index) => piece.seq !== index)) continue;
      try {
        const file = await savePlaybackFile(meeting, await downloadRecordingPieces(sourcePieces), job.mimeType, track);
        if (file) audioTracks[track] = { ...coverage, playbackFile: file };
      } catch (err) {
        log.warn('Recording: separate audio could not be indexed', { meetingId, track, error: err.message });
      }
    }
    const now = new Date().toISOString();
    const durationMs = job.durationMs || 0;
    const startMs = Date.parse(meeting.start_time || job.startedAt || now);
    const update = {
      ...minutes.fields,
      // Names typed before recording win; otherwise the speakers Gemini heard.
      attendees: Array.isArray(meeting.attendees) && meeting.attendees.length ? meeting.attendees : speakers,
      duration_minutes: durationMs ? Math.max(1, Math.round(durationMs / 60000)) : null,
      end_time: Number.isFinite(startMs) && durationMs ? new Date(startMs + durationMs).toISOString() : now,
      recording_job: {
        ...meeting.recording_job, source: 'browser', status: 'done', stage: null, stageAt: null, error: null,
        summaryError: minutes.summaryError, speakerSuggestions: minutes.speakerSuggestions, audioKept: true,
        playbackFile: playback, waveformPeaks, speakers: speakers.length, lines: segments.length, updatedAt: now,
        ...(job.audioTracks ? { audioTracks } : {}),
      },
      updated_at: now,
    };

    const { data: saved, error } = await supabase
      .from('meetings')
      .update(update)
      .eq('id', meetingId)
      .eq('org_id', meeting.org_id)
      .select()
      .single();
    if (error) throw error;

    meetingFinish.publishMinutes(saved, minutes, savedActions, { userId: job.startedBy || meeting.created_by || null });

    log.info('Recording transcribed', { meetingId, lines: segments.length, speakers: speakers.length });
    return { status: 'done', lines: segments.length };
  } catch (err) {
    log.error('Recording transcription failed', { meetingId, error: err.message });
    await setJob(meeting, { status: 'failed', error: failureMessage(err) }).catch((e) =>
      log.error('Recording: could not record the failure', { meetingId, error: e.message }),
    );
    return { status: 'failed' };
  }
}

/** Signed links to the pieces last this long; the page fetches them all at once. */
const PLAYBACK_URL_TTL_S = 10 * 60;
/** The playback copy streams while it plays; the page asks for a new link if this one ends. */
const PLAYBACK_FILE_TTL_S = 60 * 60;
const WAVEFORM_CACHE_TTL_MS = 30 * 60 * 1000;
const waveformCache = new Map();
let activeWaveforms = 0;

/**
 * A signed link to the seekable playback copy (`url`) when there is one. Otherwise signed
 * links to the pieces, in order (`pieces`): joined in that order they are one playable file
 * (a later piece alone is not: only the first carries the header).
 * The caller has checked meeting access; `orgId` is the caller's org, which owns the folder.
 */
async function loadPlaybackMeeting(orgId, meetingId) {
  const meeting = await loadMeeting(meetingId);
  const job = meeting?.recording_job;
  if (!job || meeting.org_id !== orgId || job.status === 'recording' || job.retentionDeletedAt || job.audioRemovedAt) {
    throw new RecorderError(404, 'There is no recording to play.');
  }
  return meeting;
}

async function getPlayback({ orgId, meetingId, track = 'mix' }) {
  const meeting = await loadPlaybackMeeting(orgId, meetingId);
  const job = meeting.recording_job;
  const coverage = track === 'mix' ? null : ISOLATED_TRACKS.includes(track) && job.audioTracks?.[track];
  if (track !== 'mix' && (job.source !== 'browser' || !coverage?.pieces || !coverage.durationMs)) {
    throw new RecorderError(404, 'This audio track is unavailable.');
  }
  const file = coverage ? coverage.playbackFile : job.playbackFile;
  if (typeof file === 'string' && file.startsWith(`${recordingFolder(orgId, meetingId)}/`)) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file, PLAYBACK_FILE_TTL_S);
    if (!error && data?.signedUrl) {
      return { mimeType: job.mimeType || 'audio/webm', durationMs: coverage?.durationMs ?? (job.durationMs || 0), url: data.signedUrl };
    }
    log.warn('Recording: playback copy could not be signed, using the pieces', { meetingId, error: error?.message });
  }
  if (coverage) {
    const pieces = piecesForTrack(await listFolder(orgId, meetingId), track).filter(piece => piece.seq < coverage.pieces);
    return signedPieces(pieces, job.mimeType, coverage.pieces);
  }
  // A bot meeting without a saved copy plays from Recall's own (fresh) link.
  if (job.source === 'bot' && job.botSessionId) {
    const url = await require('./botRecording').freshRecordingLink(job.botSessionId).catch(() => null);
    if (url) return { mimeType: 'video/mp4', durationMs: job.durationMs || 0, url, serverWaveform: true };
    throw new RecorderError(404, 'The bot recording is no longer available.');
  }
  const pieces = (await listPieces(orgId, meetingId)).filter((p) => p.seq < (job.pieces || MAX_PIECES));
  return signedPieces(pieces, job.mimeType);
}

async function signedPieces(pieces, mimeType, expectedCount) {
  if (!pieces.length || pieces[0].seq !== 0) throw new RecorderError(404, 'There is no recording to play.');
  if (expectedCount && (pieces.length !== expectedCount || pieces.some((piece, index) => piece.seq !== index))) {
    throw new RecorderError(404, 'This audio track is incomplete.');
  }
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(pieces.map((p) => p.path), PLAYBACK_URL_TTL_S);
  if (error) throw error;
  const urls = new Map((data || []).map((d) => [d.path, d.signedUrl]));
  if (pieces.some((p) => !urls.get(p.path))) throw new Error('A playback link could not be signed');
  return {
    mimeType: mimeType || 'audio/webm',
    durationMs: pieces.reduce((sum, p) => sum + p.durationMs, 0),
    pieces: pieces.map((p) => ({ seq: p.seq, durationMs: p.durationMs, url: urls.get(p.path) })),
  };
}

/** Use the same authorized media source as playback. Coalesce simultaneous requests for it. */
async function getRecordingWaveform({ orgId, meetingId }) {
  const meeting = await loadPlaybackMeeting(orgId, meetingId);
  const job = meeting.recording_job;
  if (Array.isArray(job.waveformPeaks) && job.waveformPeaks.length) return job.waveformPeaks;
  const key = `${orgId}/${meetingId}:${job.playbackFile ?? job.finishedAt ?? job.botSessionId ?? ''}`;
  const cached = waveformCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.peaks;
  if (activeWaveforms >= 2) throw new RecorderError(429, 'Waveform processing is busy. Try again.');
  for (const [id, entry] of waveformCache) {
    if (entry.expiresAt <= Date.now()) waveformCache.delete(id);
  }
  if (waveformCache.size >= 24) {
    const completed = [...waveformCache].find(([, entry]) => Number.isFinite(entry.expiresAt));
    if (completed) waveformCache.delete(completed[0]);
  }

  const peaks = measureSavedRecording(meeting);
  const entry = { peaks, expiresAt: Infinity };
  waveformCache.set(key, entry);
  activeWaveforms++;
  try {
    const result = await peaks;
    entry.expiresAt = Date.now() + WAVEFORM_CACHE_TTL_MS;
    return result;
  } catch {
    waveformCache.delete(key);
    throw new RecorderError(422, 'Waveform unavailable for this recording.');
  } finally {
    activeWaveforms--;
  }
}

async function measureSavedRecording(meeting) {
  const { org_id: orgId, id: meetingId, recording_job: job } = meeting;
  if (typeof job.playbackFile === 'string' && job.playbackFile.startsWith(`${recordingFolder(orgId, meetingId)}/`)) {
    const { data, error } = await supabase.storage.from(BUCKET).download(job.playbackFile);
    if (!error && data) return playbackFile.readWaveformPeaksFromAudio(Buffer.from(await data.arrayBuffer()));
  }
  if (job.source === 'bot' && job.botSessionId) {
    const url = await require('./botRecording').freshRecordingLink(job.botSessionId);
    if (!url) throw new Error('Bot recording unavailable');
    return playbackFile.readWaveformPeaks(url);
  }
  const pieces = (await listPieces(orgId, meetingId)).filter((piece) => piece.seq < (job.pieces || MAX_PIECES));
  if (!pieces.length || pieces[0].seq !== 0) throw new Error('Recording unavailable');
  return playbackFile.readWaveformPeaksFromAudio(recordingPieceBytes(pieces));
}

/**
 * Remove a finished recording's audio now; the transcript, summary and notes stay.
 * The caller has checked meeting access. This cannot be undone.
 */
async function removeAudio({ orgId, meetingId }) {
  const meeting = await loadMeeting(meetingId);
  const job = meeting?.recording_job;
  if (!job || meeting.org_id !== orgId || job.status !== 'done') {
    throw new RecorderError(409, 'Only the audio of a finished recording can be removed.');
  }
  await purgeRecordingAudio(orgId, meetingId);
  return setJob(meeting, { audioKept: false, audioRemovedAt: new Date().toISOString(), playbackFile: null, waveformPeaks: null });
}

module.exports = {
  BUCKET,
  MODES,
  PIECE_MAX_BYTES,
  RecorderError,
  startRecording,
  botsInCall,
  botCouldNotDeliver,
  savePiece,
  recordingRecovery,
  finishRecording,
  retryTranscription,
  rebuildTranscript,
  isTranscriptRebuilding,
  discardRecording,
  purgeRecordingAudio,
  getPlayback,
  getRecordingWaveform,
  removeAudio,
  transcribeMeeting,
  _internal: { botHandOff, baseMime, piecePath, parsePieceName, listPieces, isStale, cleanAttendees, running, STALE_JOB_MS },
};
