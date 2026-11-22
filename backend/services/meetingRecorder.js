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
 *                decisions, action items and timecodes as a bot meeting.
 *   4. playback  the audio is kept so the meeting page can play it beside the transcript
 *                (signed URLs, `getPlayback`). Retention (`retentionService.sweepRecordings`)
 *                deletes it after the workspace's retention days, with the transcript.
 *
 * The service-role client bypasses RLS: callers check meeting access first.
 */

'use strict';

const { supabase } = require('../config/supabase');
const ai = require('../config/ai');
const geminiRecording = require('../config/geminiRecording');
const summaryTemplates = require('./summaryTemplates');
const speakerNames = require('./speakerNames');
const transcriptMoments = require('./transcriptMoments');
const log = require('../utils/log');

const BUCKET = 'meeting-recordings';
const MODES = ['mic', 'camera', 'tab'];
const PIECE_MAX_BYTES = 10 * 1024 * 1024;
/** 1,000 pieces of 30 s is 8 h 20 min. */
const MAX_PIECES = 1000;
const MAX_PIECE_MS = 120000;
/** A job still marked transcribing after this long died with the server; it may be retried. */
const STALE_JOB_MS = 20 * 60 * 1000;
const MAX_TITLE = 200;

const EMPTY_SUMMARY = { summary: null, keyPoints: [], decisions: [], topics: [], sentiment: null, sentimentScore: null };

/** Lazy: routes/meetings.js requires services that would make this a require cycle. */
function pipeline() {
  return require('../routes/meetings')._pipeline;
}

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
function piecePath(orgId, meetingId, { seq, durationMs, mimeType }) {
  const ext = EXT[baseMime(mimeType)] || 'webm';
  return `${recordingFolder(orgId, meetingId)}/${String(seq).padStart(6, '0')}-${Math.max(0, Math.round(durationMs))}.${ext}`;
}

const PIECE_NAME = /^(\d{6})-(\d+)\.[a-z0-9]+$/;

function parsePieceName(name) {
  const m = String(name).match(PIECE_NAME);
  return m ? { seq: Number(m[1]), durationMs: Number(m[2]) } : null;
}

// ── Transcript parsing (port of LV `parseTimestampedTranscript`) ─────────────

const STAMPED_LINE = /^\s*\**\s*\[\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*\]\s*\**\s*(.*)$/;
const SPEAKER_PREFIX = /^\**(Speaker \d+|[A-Z][\w.'-]*(?: [A-Z][\w.'-]*){0,3})\**:\**\s+(.+)$/;

/**
 * The timed lines of a transcript Gemini wrote as `[MM:SS] Speaker 1: words`. Gemini writes
 * the tag as `[00:12]`, `[ 00:12 ]` or `[1:02:03]`, sometimes bolds it, and leaves the
 * speaker out when it hears one voice. A line without a tag continues the line before it.
 * A line with no speaker keeps the previous speaker (or "Speaker 1" at the start).
 *
 * @returns {Array<{atMs: number, speaker: string, text: string}>} in time order.
 */
function parseTimestampedTranscript(text) {
  const out = [];
  if (typeof text !== 'string') return out;
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(STAMPED_LINE);
    if (!m) {
      const more = raw.trim();
      if (more && out.length) out[out.length - 1].text += ` ${more}`;
      continue;
    }
    const body = m[4].trim();
    if (!body) continue;
    const who = body.match(SPEAKER_PREFIX);
    const speaker = who ? who[1] : out.length ? out[out.length - 1].speaker : 'Speaker 1';
    const words = (who ? who[2] : body).trim();
    if (!words) continue;
    out.push({
      atMs: ((Number(m[1] ?? 0) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000,
      speaker,
      text: words,
    });
  }
  // Gemini's times are monotonic in practice; a stray earlier tag must not reorder speech.
  for (let i = 1; i < out.length; i++) {
    if (out[i].atMs < out[i - 1].atMs) out[i].atMs = out[i - 1].atMs;
  }
  return out;
}

function buildTranscriptText(segments) {
  return segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
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

async function listPieces(orgId, meetingId) {
  const bucket = supabase.storage.from(BUCKET);
  const folder = recordingFolder(orgId, meetingId);
  const pieces = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(folder, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    for (const f of data || []) {
      const parsed = parsePieceName(f.name);
      if (parsed) pieces.push({ ...parsed, path: `${folder}/${f.name}`, createdAt: f.created_at || null });
    }
    if ((data || []).length < 1000) break;
  }
  return pieces.sort((a, b) => a.seq - b.seq);
}

/** Deletes a meeting's saved audio. Idempotent. */
async function purgeRecordingAudio(orgId, meetingId) {
  if (!supabase || !orgId || !meetingId) return { removed: 0 };
  const pieces = await listPieces(orgId, meetingId);
  if (!pieces.length) return { removed: 0 };
  const bucket = supabase.storage.from(BUCKET);
  for (let i = 0; i < pieces.length; i += 100) {
    const { error } = await bucket.remove(pieces.slice(i, i + 100).map((p) => p.path));
    if (error) throw error;
  }
  return { removed: pieces.length };
}

// ── Job state ────────────────────────────────────────────────────────────

async function loadMeeting(meetingId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('id, org_id, title, created_by, start_time, attendees, recording_job, summary_template')
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

function isStale(job, now = Date.now()) {
  const at = Date.parse(job?.updatedAt || job?.finishedAt || '');
  return !Number.isFinite(at) || now - at > STALE_JOB_MS;
}

/** Meetings this server is transcribing right now. */
const running = new Set();

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Make the meeting a recording will fill.
 * @returns {Promise<{meetingId: string, recordingJob: object}>}
 */
async function startRecording({ userId, orgId, title, attendees, mode, mimeType }) {
  if (!MODES.includes(mode)) throw new RecorderError(400, 'Choose microphone, camera or browser tab.');
  const mime = baseMime(mimeType);
  if (!mime) throw new RecorderError(400, 'This browser records in a format Entomate cannot transcribe.');

  const now = new Date().toISOString();
  const name = String(title || '').trim().slice(0, MAX_TITLE);
  const recordingJob = { status: 'recording', mode, mimeType: mime, startedAt: now, startedBy: userId, updatedAt: now };
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      title: name || `Recording, ${new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      org_id: orgId,
      created_by: userId,
      attendees: cleanAttendees(attendees),
      start_time: now,
      recording_job: recordingJob,
      created_at: now,
      updated_at: now,
    })
    .select('id, recording_job')
    .single();
  if (error) throw error;
  return { meetingId: data.id, recordingJob: data.recording_job };
}

/** Save one piece. A piece already saved (a retry after a lost response) is success. */
async function savePiece({ orgId, meetingId, seq, durationMs, buffer }) {
  if (!Number.isInteger(seq) || seq < 0 || seq >= MAX_PIECES) throw new RecorderError(400, 'Invalid piece number.');
  if (!Number.isInteger(durationMs) || durationMs < 0 || durationMs > MAX_PIECE_MS) throw new RecorderError(400, 'Invalid piece length.');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new RecorderError(400, 'The piece is empty.');
  if (buffer.length > PIECE_MAX_BYTES) throw new RecorderError(413, 'The piece is too large.');

  const meeting = await loadMeeting(meetingId);
  const job = meeting?.recording_job;
  if (!job || job.status !== 'recording') throw new RecorderError(409, 'This meeting is not recording.');

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(piecePath(orgId, meetingId, { seq, durationMs, mimeType: job.mimeType }), buffer, {
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

  const saved = await listPieces(meeting.org_id, meetingId);
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

  const durationMs = saved.filter((p) => p.seq < pieces).reduce((sum, p) => sum + p.durationMs, 0);
  await setJob(meeting, { status: 'transcribing', pieces, durationMs, finishedAt: new Date().toISOString(), error: null });
  runInBackground(meetingId);
  return { status: 'transcribing' };
}

/** Try a failed (or abandoned) transcription again from the saved audio. */
async function retryTranscription({ meetingId }) {
  const meeting = await loadMeeting(meetingId);
  const job = meeting?.recording_job;
  if (!job) throw new RecorderError(409, 'This meeting was not recorded here.');
  const retryable = job.status === 'failed' || (job.status === 'transcribing' && !running.has(meetingId) && isStale(job));
  if (!retryable) throw new RecorderError(409, job.status === 'transcribing' ? 'The transcript is still being written.' : 'There is nothing to retry.');
  await setJob(meeting, { status: 'transcribing', error: null });
  runInBackground(meetingId);
  return { status: 'transcribing' };
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

    const pieces = (await listPieces(meeting.org_id, meetingId)).filter((p) => p.seq < (job.pieces || MAX_PIECES));
    const bucket = supabase.storage.from(BUCKET);
    const parts = [];
    for (const piece of pieces) {
      const { data, error } = await bucket.download(piece.path);
      if (error || !data) throw error || new Error(`Missing piece ${piece.seq}`);
      parts.push(Buffer.from(await data.arrayBuffer()));
    }
    if (!parts.length) {
      const err = new Error('No audio pieces found');
      err.userMessage = 'No audio was saved for this recording.';
      throw err;
    }

    const text = await geminiRecording.transcribeRecording(Buffer.concat(parts), job.mimeType || 'audio/webm');
    let segments = parseTimestampedTranscript(text);
    let transcript = segments.length ? buildTranscriptText(segments) : String(text || '').trim();
    if (!transcript) {
      const err = new Error('Empty transcript');
      err.userMessage = 'No speech was heard in this recording. Check that the right microphone or tab audio was shared.';
      throw err;
    }

    // Real names for "Speaker N" before the summary, so owners and carry-forward use them.
    // Strong evidence renames; weaker guesses wait on the meeting page as suggestions.
    let speakerSuggestions = [];
    if (segments.length) {
      try {
        const candidates = await speakerNames.loadCandidates(meeting);
        const { apply, suggestions } = await speakerNames.suggestNames(segments, candidates);
        if (Object.keys(apply).length) {
          segments = speakerNames.applyNames(segments, apply);
          transcript = buildTranscriptText(segments);
        }
        speakerSuggestions = suggestions;
      } catch (err) {
        log.warn('Recording: speaker naming failed, keeping Speaker labels', { meetingId, error: err.message });
      }
    }

    const { runAIPipeline, saveActionItems, firePostProcessing } = pipeline();
    let summaryData = EMPTY_SUMMARY;
    let actionItems = [];
    let embedding = null;
    // Saved on the job so a missing summary can be diagnosed from the database.
    let summaryError = null;
    if (!ai.isConfigured()) {
      summaryError = 'AI provider not configured';
    } else {
      try {
        ({ summaryData, actionItems, embedding } = await runAIPipeline(transcript, meeting.title, { attendees: meeting.attendees, template: meeting.summary_template }));
      } catch (err) {
        // The transcript is the valuable part; the summary can be rebuilt with Reprocess.
        summaryError = String(err?.message || err).slice(0, 500);
        log.warn('Recording: AI pipeline failed, saving transcript only', { meetingId, error: err.message });
      }
    }
    actionItems = transcriptMoments.withActionItemMoments(segments, actionItems);
    const keyPoints = summaryData.keyPoints || [];
    const decisions = summaryData.decisions || [];
    const speakers = [...new Set(segments.map((s) => s.speaker))];

    const now = new Date().toISOString();
    const durationMs = job.durationMs || 0;
    const startMs = Date.parse(meeting.start_time || job.startedAt || now);
    const update = {
      transcript,
      transcript_segments: segments.length ? segments : null,
      summary: summaryData.summary || null,
      key_points: keyPoints,
      decisions,
      summary_moments: segments.length ? transcriptMoments.summaryMoments(segments, keyPoints, decisions) : null,
      topics: summaryData.topics || [],
      ...summaryTemplates.summaryFields(summaryData),
      sentiment_label: summaryData.sentiment || null,
      sentiment_score: summaryData.sentimentScore ?? null,
      // Names typed before recording win; otherwise the speakers Gemini heard.
      attendees: Array.isArray(meeting.attendees) && meeting.attendees.length ? meeting.attendees : speakers,
      duration_minutes: durationMs ? Math.max(1, Math.round(durationMs / 60000)) : null,
      end_time: Number.isFinite(startMs) && durationMs ? new Date(startMs + durationMs).toISOString() : now,
      recording_job: { ...job, status: 'done', error: null, summaryError, speakerSuggestions, audioKept: true, speakers: speakers.length, lines: segments.length, updatedAt: now },
      updated_at: now,
    };
    if (embedding) update.transcript_embedding = embedding;

    const { data: saved, error } = await supabase
      .from('meetings')
      .update(update)
      .eq('id', meetingId)
      .eq('org_id', meeting.org_id)
      .select()
      .single();
    if (error) throw error;

    // A retry replaces the action items an earlier, half-finished run may have saved.
    await supabase.from('action_items').delete().eq('meeting_id', meetingId);
    const savedActionItems = await saveActionItems(meetingId, actionItems);
    firePostProcessing(saved, summaryData, savedActionItems, { userId: job.startedBy || meeting.created_by || null });

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

/** Signed playback links last this long; the page fetches the pieces at once. */
const PLAYBACK_URL_TTL_S = 10 * 60;

/**
 * Signed links to a finished recording's pieces, in order. Joined in that order they are
 * one playable file (a later piece alone is not: only the first carries the header).
 * The caller has checked meeting access; `orgId` is the caller's org, which owns the folder.
 */
async function getPlayback({ orgId, meetingId }) {
  const meeting = await loadMeeting(meetingId);
  const job = meeting?.recording_job;
  if (!job || meeting.org_id !== orgId || job.status === 'recording' || job.retentionDeletedAt) {
    throw new RecorderError(404, 'There is no recording to play.');
  }
  const pieces = (await listPieces(orgId, meetingId)).filter((p) => p.seq < (job.pieces || MAX_PIECES));
  if (!pieces.length || pieces[0].seq !== 0) throw new RecorderError(404, 'There is no recording to play.');
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(pieces.map((p) => p.path), PLAYBACK_URL_TTL_S);
  if (error) throw error;
  const urls = new Map((data || []).map((d) => [d.path, d.signedUrl]));
  if (pieces.some((p) => !urls.get(p.path))) throw new Error('A playback link could not be signed');
  return {
    mimeType: job.mimeType || 'audio/webm',
    durationMs: pieces.reduce((sum, p) => sum + p.durationMs, 0),
    pieces: pieces.map((p) => ({ seq: p.seq, durationMs: p.durationMs, url: urls.get(p.path) })),
  };
}

module.exports = {
  BUCKET,
  MODES,
  PIECE_MAX_BYTES,
  RecorderError,
  startRecording,
  savePiece,
  finishRecording,
  retryTranscription,
  discardRecording,
  purgeRecordingAudio,
  getPlayback,
  transcribeMeeting,
  parseTimestampedTranscript,
  _internal: { baseMime, piecePath, parsePieceName, listPieces, isStale, cleanAttendees, running, STALE_JOB_MS },
};
