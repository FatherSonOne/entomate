/**
 * Transcript ingestion — turns a finished Recall bot session into an Entomate meeting.
 *
 * Before this existed, `bot.done` stored a pre-signed `transcript_url` on `bot_sessions`
 * and stopped: no meeting was created, and the URL expired. Now the transcript is
 * downloaded while the URL is fresh, parsed into timed lines (`meetings.transcript_segments`,
 * the shape Logos Vision uses), and the meeting runs through the same AI pipeline and
 * post-processing (embeddings, ecosystem sync, agents, workflow triggers) as an upload.
 *
 * The meeting reuses `bot_sessions.meeting_id` as its id, so ingestion is idempotent:
 * a repeated webhook finds the meeting already carrying segments and does nothing, and
 * two concurrent webhooks race on the primary key, where the loser stops cleanly.
 *
 * Recall transcript download format (docs.recall.ai/docs/download-schemas, 2026-11-21):
 *   [{ participant: { id, name, is_host, platform, extra_data, email },
 *      language_code,
 *      words: [{ text, start_timestamp: { relative, absolute }, end_timestamp: {...} }] }]
 * `relative` is SECONDS from the start of the recording; `absolute` is null for async
 * transcripts, so only `relative` is read.
 */

'use strict';

const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');

const MAX_TRANSCRIPT_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30 * 1000;
const MAX_SPEAKER_LENGTH = 120;

const PLATFORM_LABEL = { meet: 'Google Meet', zoom: 'Zoom', teams: 'Microsoft Teams' };

const db = () => {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_KEY is not set');
  return supabaseAdmin;
};

/** Lazy: meetingFinish requires the meetings route, which must not load at require time here. */
function meetingFinish() {
  return require('./meetingFinish');
}

/** A claimed run that has not moved for this long died with the server; another may take over. */
const STALE_RUN_MS = 20 * 60 * 1000;
const INGEST_FAILED = "The bot's transcript could not be turned into minutes. Try again in a minute.";

function isStale(job, now = Date.now()) {
  const at = Date.parse(job?.updatedAt || '');
  return !Number.isFinite(at) || now - at > STALE_RUN_MS;
}

function secondsToMs(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : null;
}

function speakerFor(participant) {
  const name = typeof participant?.name === 'string' ? participant.name.trim() : '';
  if (name) return name.slice(0, MAX_SPEAKER_LENGTH);
  const id = participant?.id;
  return id === undefined || id === null || id === '' ? 'Speaker' : `Speaker ${id}`;
}

/**
 * Recall transcript JSON → timed lines, oldest first. Entries with no words are dropped:
 * they would become blank "Speaker:" rows. Anything that is not the documented shape
 * yields an empty list rather than a throw, so a format change cannot crash the webhook.
 *
 * @param {unknown} raw
 * @returns {Array<{atMs: number, endMs?: number, speaker: string, text: string}>}
 */
function parseRecallTranscript(raw) {
  if (!Array.isArray(raw)) return [];
  const segments = [];
  for (const entry of raw) {
    const words = Array.isArray(entry?.words) ? entry.words : [];
    const text = words
      .map((w) => (typeof w?.text === 'string' ? w.text.trim() : ''))
      .filter(Boolean)
      .join(' ');
    if (!text) continue;
    const atMs = secondsToMs(words[0]?.start_timestamp?.relative);
    const endMs = secondsToMs(words[words.length - 1]?.end_timestamp?.relative);
    segments.push({
      atMs: atMs ?? 0,
      ...(endMs !== null && endMs >= (atMs ?? 0) ? { endMs } : {}),
      speaker: speakerFor(entry.participant),
      text,
    });
  }
  // Stable sort: entries Recall already ordered keep their order on a tie.
  return segments
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.atMs - b.s.atMs || a.i - b.i)
    .map(({ s }) => s);
}

/** The flat "Speaker: words" text that the summarizer, Ask and recaps read. */
function buildTranscriptText(segments) {
  return segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
}

/** One attendee per Recall participant, with an email only when Recall identified one. */
function attendeesFromTranscript(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Map();
  for (const entry of raw) {
    const p = entry?.participant;
    if (!p || entry.__removed) continue;
    const key = p.id ?? p.name;
    if (key === undefined || key === null || seen.has(key)) continue;
    const name = speakerFor(p);
    const email = typeof p.email === 'string' && p.email.includes('@') ? p.email.trim().toLowerCase() : null;
    seen.set(key, email ? { name, email } : { name });
  }
  return [...seen.values()];
}

function durationMinutes(segments) {
  const last = segments[segments.length - 1];
  if (!last) return null;
  const ms = last.endMs ?? last.atMs;
  return ms > 0 ? Math.max(1, Math.ceil(ms / 60000)) : null;
}

function meetingTitle(session) {
  // Bots scheduled from the calendar carry the event's own title.
  if (session.title && String(session.title).trim()) return String(session.title).trim();
  const label = PLATFORM_LABEL[session.platform] || 'Bot';
  const when = new Date(session.started_at || session.created_at || Date.now());
  const date = Number.isNaN(when.getTime())
    ? ''
    : when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return date ? `${label} meeting, ${date}` : `${label} meeting`;
}

const REMOVED_SPEAKER = 'Removed';
const REMOVED_TEXT = "[Removed at this participant's request]";

/**
 * Opt-outs (bot_session_attendees.opted_out_at) are honoured BEFORE anything else reads
 * the transcript: an opted-out attendee's words never reach the AI, the saved text, the
 * search index or the attendee list. Matching is by email (then by that participant's
 * Recall id), which Recall supplies only when participant identification is on; when it
 * is off the transcript cannot be matched, and that is logged rather than guessed at by
 * display name.
 *
 * Each run of removed entries becomes one placeholder line, so the transcript stays
 * honest about a gap instead of silently closing it.
 *
 * @returns {{ entries: unknown[], removed: number, unmatched: boolean }}
 */
function redactOptedOut(raw, optedOutEmails) {
  if (!Array.isArray(raw) || optedOutEmails.size === 0) return { entries: raw, removed: 0, unmatched: false };
  const emailOf = (entry) =>
    typeof entry?.participant?.email === 'string' ? entry.participant.email.trim().toLowerCase() : '';
  // A participant identified once by email is removed everywhere, even on entries
  // where Recall left the email off.
  const optedOutIds = new Set();
  for (const entry of raw) {
    const id = entry?.participant?.id;
    if (id !== undefined && id !== null && optedOutEmails.has(emailOf(entry))) optedOutIds.add(id);
  }
  let removed = 0;
  let sawEmail = false;
  const entries = [];
  for (const entry of raw) {
    const email = emailOf(entry);
    if (email) sawEmail = true;
    if ((email && optedOutEmails.has(email)) || optedOutIds.has(entry?.participant?.id)) {
      removed += 1;
      const prev = entries[entries.length - 1];
      if (prev?.participant?.name === REMOVED_SPEAKER && prev.__removed) continue;
      const firstWord = Array.isArray(entry.words) ? entry.words[0] : null;
      entries.push({
        __removed: true,
        participant: { id: 'removed', name: REMOVED_SPEAKER },
        words: [{ text: REMOVED_TEXT, start_timestamp: firstWord?.start_timestamp, end_timestamp: firstWord?.start_timestamp }],
      });
      continue;
    }
    entries.push(entry);
  }
  return { entries, removed, unmatched: !sawEmail };
}

async function optedOutEmailsFor(sessionId) {
  const { data, error } = await db()
    .from('bot_session_attendees')
    .select('email, opted_out_at')
    .eq('session_id', sessionId);
  if (error) throw error;
  return new Set(
    (data || [])
      .filter((r) => r.opted_out_at && typeof r.email === 'string')
      .map((r) => r.email.trim().toLowerCase())
  );
}

/**
 * Download the transcript JSON. The URL is a pre-signed Recall/S3 link, so no auth header
 * is sent, and only https is accepted. The body is capped so a bad link cannot exhaust memory.
 */
async function downloadTranscript(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Transcript URL is not a valid URL');
  }
  if (parsed.protocol !== 'https:') throw new Error('Transcript URL must be https');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`Transcript download failed: HTTP ${res.status}`);
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_TRANSCRIPT_BYTES) {
      throw new Error('Transcript is too large to ingest');
    }
    const body = await res.text();
    if (body.length > MAX_TRANSCRIPT_BYTES) throw new Error('Transcript is too large to ingest');
    return JSON.parse(body);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ingest one finished bot session. Never throws for "nothing to do" outcomes; it throws
 * only for a failure worth retrying (download or database error).
 *
 * @param {string} sessionId  bot_sessions.id
 * @param {{ transcriptUrl: string }} opts  A fresh download URL from Recall.
 * @returns {Promise<{status: 'ingested'|'already_ingested'|'empty'|'not_found'|'conflict', meetingId?: string, segments?: number}>}
 */
async function ingestBotTranscript(sessionId, { transcriptUrl } = {}) {
  if (!transcriptUrl) throw new Error('ingestBotTranscript: transcriptUrl is required');

  const { data: session, error: sessionErr } = await db()
    .from('bot_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionErr) throw sessionErr;
  if (!session?.meeting_id || !session.org_id) return { status: 'not_found' };

  const { data: existing, error: existingErr } = await db()
    .from('meetings')
    .select('id, org_id, title, created_by, attendees, summary_template, transcript_segments, recording_job')
    .eq('id', session.meeting_id)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing && existing.org_id !== session.org_id) {
    // A meeting id reused across workspaces must never receive another tenant's transcript.
    log.error('Transcript ingest refused: meeting belongs to another org', { sessionId, meetingId: session.meeting_id });
    return { status: 'conflict', meetingId: session.meeting_id };
  }
  if (Array.isArray(existing?.transcript_segments) && existing.transcript_segments.length > 0) {
    return { status: 'already_ingested', meetingId: existing.id };
  }
  const priorJob = existing?.recording_job || null;
  if (priorJob?.status === 'transcribing' && !isStale(priorJob)) {
    // Another run (a repeated webhook, or the browser recording beside the bot) is writing it now.
    return { status: 'in_progress', meetingId: existing.id };
  }

  const downloaded = await downloadTranscript(transcriptUrl);
  const optedOut = await optedOutEmailsFor(sessionId);
  const { entries: raw, removed, unmatched } = redactOptedOut(downloaded, optedOut);
  if (optedOut.size > 0 && unmatched) {
    log.warn('Transcript ingest: attendees opted out but Recall sent no participant emails; nothing could be removed', {
      sessionId, optedOut: optedOut.size,
    });
  } else if (removed > 0) {
    log.info('Transcript ingest: removed opted-out attendees', { sessionId, entries: removed });
  }
  const segments = parseRecallTranscript(raw);
  if (segments.length === 0) {
    log.info('Transcript ingest: no speech in transcript', { sessionId });
    return { status: 'empty', meetingId: session.meeting_id };
  }
  const title = meetingTitle(session);
  const attendees = attendeesFromTranscript(raw);
  const userId = session.consent_acknowledged_by || null;

  // Claim the meeting before the slow part, so the meeting page shows the minutes being
  // written (with real stages) and a second webhook stops. The row's id is the session's
  // meeting id: two concurrent webhooks race on the primary key, and the loser stops.
  // A browser recording still running beside the bot keeps its own job state.
  const browserRecording = priorJob?.status === 'recording';
  const startedAt = new Date().toISOString();
  const claimJob = {
    ...(priorJob || {}),
    status: 'transcribing', source: 'bot', botSessionId: sessionId,
    stage: 'transcript', stageAt: startedAt, error: null, finishedAt: session.ended_at || startedAt, updatedAt: startedAt,
    durationMs: priorJob?.durationMs || segments.reduce((m, x) => Math.max(m, Number(x.endMs ?? x.atMs) || 0), 0),
  };
  const meeting = existing
    ? { ...existing }
    : { id: session.meeting_id, org_id: session.org_id, created_by: userId || 'system', attendees, summary_template: null };
  if (existing) {
    if (!browserRecording) {
      const { error } = await db().from('meetings').update({ recording_job: claimJob }).eq('id', existing.id).eq('org_id', session.org_id);
      if (error) throw error;
      meeting.recording_job = claimJob;
    }
  } else {
    const { error } = await db()
      .from('meetings')
      .insert({
        id: session.meeting_id,
        org_id: session.org_id,
        title,
        created_by: meeting.created_by,
        start_time: session.started_at || session.created_at || null,
        end_time: session.ended_at || null,
        recording_job: claimJob,
        created_at: startedAt,
        updated_at: startedAt,
      });
    if (error?.code === '23505') return { status: 'already_ingested', meetingId: session.meeting_id };
    if (error) throw error;
    meeting.recording_job = claimJob;
  }

  const markStage = async (stage) => {
    if (browserRecording) return;
    meeting.recording_job = { ...meeting.recording_job, stage, stageAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const { error } = await db().from('meetings').update({ recording_job: meeting.recording_job }).eq('id', meeting.id);
    if (error) log.warn('Transcript ingest: could not save the stage', { sessionId, stage, error: error.message });
  };

  let minutes;
  let saved;
  let savedActions;
  try {
    minutes = await meetingFinish().writeMinutes({ meeting, segments, title, attendees, onStage: markStage });
    await markStage('saving');
    savedActions = await meetingFinish().saveMinutesActions(meeting, minutes);

    const now = new Date().toISOString();
    const lines = minutes.segments;
    const doneJob = browserRecording
      ? { ...priorJob, botSessionId: sessionId, summaryError: minutes.summaryError }
      : {
        ...meeting.recording_job, status: 'done', source: 'bot', stage: null, stageAt: null, error: null,
        summaryError: minutes.summaryError, speakerSuggestions: minutes.speakerSuggestions,
        speakers: new Set(lines.map((s) => s.speaker)).size, lines: lines.length, updatedAt: now,
      };
    const meetingData = {
      ...minutes.fields,
      title: existing?.title && !/^Recording, /.test(existing.title) ? existing.title : title,
      attendees: Array.isArray(existing?.attendees) && existing.attendees.length ? existing.attendees : attendees,
      duration_minutes: durationMinutes(lines),
      start_time: session.started_at || session.created_at || null,
      end_time: session.ended_at || null,
      recording_job: doneJob,
      updated_at: now,
    };
    const { data, error } = await db()
      .from('meetings')
      .update(meetingData)
      .eq('id', meeting.id)
      .eq('org_id', session.org_id)
      .is('transcript_segments', null)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return { status: 'already_ingested', meetingId: meeting.id };
    saved = data;
  } catch (err) {
    // The meeting page must not show "writing" forever. A recording made beside the bot
    // takes over (botOrchestrator → meetingRecorder.botCouldNotDeliver); otherwise the
    // page offers Try again, which asks Recall for the transcript again.
    if (!browserRecording) {
      const failed = { ...meeting.recording_job, status: 'failed', stage: null, stageAt: null, error: INGEST_FAILED, updatedAt: new Date().toISOString() };
      await db().from('meetings').update({ recording_job: failed }).eq('id', meeting.id).then(null, () => {});
    }
    throw err;
  }

  meetingFinish().publishMinutes(saved, minutes, savedActions, { userId });
  log.info('Transcript ingested', { sessionId, meetingId: saved.id, segments: saved.transcript_segments.length });
  return { status: 'ingested', meetingId: saved.id, segments: saved.transcript_segments.length };
}

/**
 * Retention / deletion: remove the transcript a finished bot session left in its meeting.
 * The workspace retention setting promises the recording AND transcript are deleted after
 * N days, and ingestion copied the transcript into `meetings`, so the sweep must reach it:
 * the flat text, the timed lines, the timecodes derived from them, the transcript
 * embedding, and the transcript chunks in the search index. The meeting itself (summary,
 * decisions, action items) stays, as the settings page says.
 *
 * Idempotent. Throws on a database error so the caller records it and retries.
 *
 * @param {string} sessionId
 * @returns {Promise<{ purged: boolean, meetingId?: string }>}
 */
async function purgeSessionTranscript(sessionId) {
  const { data: session, error: sessionErr } = await db()
    .from('bot_sessions')
    .select('id, org_id, meeting_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionErr) throw sessionErr;
  if (!session?.meeting_id || !session.org_id) return { purged: false };
  return purgeMeetingTranscript(session.org_id, session.meeting_id);
}

/**
 * Remove one meeting's transcript: the flat text, timed lines, timecodes, transcript
 * embedding and search chunks. Summary, decisions and action items stay. Idempotent.
 * Used for bot sessions (above) and for browser recordings (retention sweep).
 */
async function purgeMeetingTranscript(orgId, meetingId) {
  const { data: meeting, error: meetingErr } = await db()
    .from('meetings')
    .update({
      transcript: null,
      transcript_segments: null,
      summary_moments: null,
      transcript_embedding: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', meetingId)
    .eq('org_id', orgId)
    .select('id')
    .maybeSingle();
  if (meetingErr) throw meetingErr;
  if (!meeting) return { purged: false };

  const { error: itemsErr } = await db()
    .from('action_items')
    .update({ transcript_at_ms: null })
    .eq('meeting_id', meeting.id);
  if (itemsErr) throw itemsErr;

  const { error: embErr } = await db()
    .from('embeddings')
    .delete()
    .eq('source_id', meeting.id)
    .eq('source_type', 'meeting')
    .like('content_type', 'transcript_chunk_%');
  // 42P01: no embeddings table in this environment, so nothing to delete.
  if (embErr && embErr.code !== '42P01') throw embErr;

  return { purged: true, meetingId: meeting.id };
}

module.exports = {
  purgeMeetingTranscript,
  ingestBotTranscript,
  purgeSessionTranscript,
  parseRecallTranscript,
  buildTranscriptText,
  attendeesFromTranscript,
  _internal: { redactOptedOut, REMOVED_TEXT, downloadTranscript, meetingTitle, durationMinutes, speakerFor, MAX_TRANSCRIPT_BYTES },
};
