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
const ai = require('../config/ai');
const log = require('../utils/log');

const MAX_TRANSCRIPT_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30 * 1000;
const MAX_SPEAKER_LENGTH = 120;

const PLATFORM_LABEL = { meet: 'Google Meet', zoom: 'Zoom', teams: 'Microsoft Teams' };

const db = () => {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_KEY is not set');
  return supabaseAdmin;
};

/** The meetings route owns the AI pipeline; required lazily so load order never matters. */
function pipeline() {
  return require('../routes/meetings')._pipeline;
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
    if (!p) continue;
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
  const label = PLATFORM_LABEL[session.platform] || 'Bot';
  const when = new Date(session.started_at || session.created_at || Date.now());
  const date = Number.isNaN(when.getTime())
    ? ''
    : when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return date ? `${label} meeting, ${date}` : `${label} meeting`;
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

const EMPTY_SUMMARY = { summary: null, keyPoints: [], decisions: [], topics: [], sentiment: null, sentimentScore: null };

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
    .select('id, org_id, meeting_id, platform, created_at, started_at, ended_at, consent_acknowledged_by')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionErr) throw sessionErr;
  if (!session?.meeting_id || !session.org_id) return { status: 'not_found' };

  const { data: existing, error: existingErr } = await db()
    .from('meetings')
    .select('id, org_id, transcript_segments')
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

  const raw = await downloadTranscript(transcriptUrl);
  const segments = parseRecallTranscript(raw);
  if (segments.length === 0) {
    log.info('Transcript ingest: no speech in transcript', { sessionId });
    return { status: 'empty' };
  }
  const transcript = buildTranscriptText(segments);
  const title = meetingTitle(session);
  const { runAIPipeline, saveActionItems, firePostProcessing } = pipeline();

  // An AI failure must not lose the transcript: save the meeting without a summary, and
  // it can be reprocessed later from the meeting page.
  let summaryData = EMPTY_SUMMARY;
  let actionItems = [];
  let embedding = null;
  if (ai.isConfigured()) {
    try {
      ({ summaryData, actionItems, embedding } = await runAIPipeline(transcript, title));
    } catch (err) {
      log.warn('Transcript ingest: AI pipeline failed, saving transcript only', { sessionId, error: err.message });
    }
  }

  const now = new Date().toISOString();
  const meetingData = {
    title,
    transcript,
    transcript_segments: segments,
    summary: summaryData.summary || null,
    key_points: summaryData.keyPoints || [],
    decisions: summaryData.decisions || [],
    topics: summaryData.topics || [],
    sentiment_label: summaryData.sentiment || null,
    sentiment_score: summaryData.sentimentScore ?? null,
    attendees: attendeesFromTranscript(raw),
    duration_minutes: durationMinutes(segments),
    start_time: session.started_at || session.created_at || null,
    end_time: session.ended_at || null,
    updated_at: now,
  };
  if (embedding) meetingData.transcript_embedding = embedding;

  let saved;
  if (existing) {
    const { data, error } = await db()
      .from('meetings')
      .update(meetingData)
      .eq('id', existing.id)
      .eq('org_id', session.org_id)
      .is('transcript_segments', null)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return { status: 'already_ingested', meetingId: existing.id };
    saved = data;
  } else {
    const { data, error } = await db()
      .from('meetings')
      .insert({
        ...meetingData,
        id: session.meeting_id,
        org_id: session.org_id,
        created_by: session.consent_acknowledged_by || 'system',
        created_at: now,
      })
      .select()
      .single();
    if (error?.code === '23505') return { status: 'already_ingested', meetingId: session.meeting_id };
    if (error) throw error;
    saved = data;
  }

  const savedActionItems = await saveActionItems(saved.id, actionItems);
  firePostProcessing(saved, summaryData, savedActionItems, { userId: session.consent_acknowledged_by || null });

  log.info('Transcript ingested', { sessionId, meetingId: saved.id, segments: segments.length });
  return { status: 'ingested', meetingId: saved.id, segments: segments.length };
}

module.exports = {
  ingestBotTranscript,
  parseRecallTranscript,
  buildTranscriptText,
  attendeesFromTranscript,
  _internal: { downloadTranscript, meetingTitle, durationMinutes, speakerFor, MAX_TRANSCRIPT_BYTES },
};
