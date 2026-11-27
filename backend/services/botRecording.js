/**
 * Audio for meetings the bot recorded.
 *
 * Recall keeps the bot's recording (an MP4 with video) behind a pre-signed
 * link that expires, and keeps the file itself only for its retention period,
 * so the meeting page could not play bot meetings. After the transcript has
 * become a meeting, this downloads the recording, keeps speech-quality audio
 * only (services/playbackFile.extractSpeechAudio, ~7 MB an hour) and saves it
 * as the meeting's playback file in the private meeting-recordings bucket,
 * where the recorder's files live. The meeting's recording_job then reads
 * { status: 'done', source: 'bot', audioKept: true, playbackFile }, so the
 * existing playback, "remove audio" and retention paths all apply.
 *
 * If the copy fails (no ffmpeg, too large for the bucket, Recall down), the
 * job still records the bot session, and playback asks Recall for a fresh
 * link instead for as long as Recall keeps the file.
 */

'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');
const playbackFile = require('./playbackFile');

const BUCKET = 'meeting-recordings';
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB of video is far past any meeting

const db = () => supabaseAdmin;
const orchestrator = () => require('./botOrchestrator');

/** The freshest download link Recall has for this bot's recording. */
function recordingLinkFrom(bot) {
  const rec = Array.isArray(bot?.recordings) ? bot.recordings[0] : null;
  const m = rec?.media_shortcuts || {};
  return m.audio_mixed?.data?.download_url || m.video_mixed?.data?.download_url || rec?.media_url || null;
}

async function freshRecordingLink(sessionId) {
  return recordingLinkFrom(await orchestrator().getRecallBotState(sessionId));
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`recording download failed: HTTP ${res.status}`);
  const size = Number(res.headers.get('content-length') || 0);
  if (size > MAX_DOWNLOAD_BYTES) throw new Error(`recording too large to copy (${size} bytes)`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(file));
}

/**
 * Merge into the meeting's job as it is now (the copy takes minutes, and a browser
 * recording beside the bot may have stopped meanwhile). A recording still running
 * keeps its own state until it stops; anything else is done.
 */
async function setJob(meetingId, patch) {
  const { data, error: readErr } = await db().from('meetings').select('recording_job').eq('id', meetingId).maybeSingle();
  if (readErr) throw readErr;
  const current = data?.recording_job || {};
  const job = { ...current, ...patch, status: current.status === 'recording' ? 'recording' : 'done' };
  const { error } = await db().from('meetings').update({ recording_job: job }).eq('id', meetingId);
  if (error) throw error;
}

/**
 * Copy a finished bot session's recording into the meeting. Never throws:
 * a failure leaves playback on Recall's own link.
 * @returns {Promise<{ status: 'saved'|'linked'|'skipped', reason?: string }>}
 */
async function copyBotRecording(sessionId) {
  const { data: session } = await db()
    .from('bot_sessions')
    .select('id, org_id, meeting_id, recall_bot_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session?.meeting_id || !session.recall_bot_id) return { status: 'skipped', reason: 'no_session' };

  const { data: meeting } = await db()
    .from('meetings')
    .select('id, org_id, recording_job')
    .eq('id', session.meeting_id)
    .maybeSingle();
  if (!meeting || meeting.org_id !== session.org_id) return { status: 'skipped', reason: 'no_meeting' };
  if (meeting.recording_job?.audioRemovedAt || meeting.recording_job?.playbackFile) {
    return { status: 'skipped', reason: 'already_done' };
  }

  // Without a saved copy, playback falls back to Recall's link (see getPlayback).
  const base = { source: 'bot', botSessionId: sessionId, audioKept: true, playbackFile: null, updatedAt: new Date().toISOString() };

  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'entomate-bot-'));
  try {
    const url = await freshRecordingLink(sessionId);
    if (!url) {
      await setJob(meeting.id, base);
      return { status: 'linked', reason: 'no_recording_link' };
    }
    const input = path.join(dir, 'recording');
    const output = path.join(dir, 'playback.webm');
    await download(url, input);
    const durationMs = await playbackFile.extractSpeechAudio(input, output);
    const audio = await fsp.readFile(output);
    const storagePath = `${meeting.org_id}/${meeting.id}/playback.webm`;
    const { error } = await db().storage.from(BUCKET).upload(storagePath, audio, { contentType: 'audio/webm', upsert: true });
    if (error) throw new Error(`upload failed: ${error.message}`);
    const waveformPeaks = await playbackFile.readWaveformPeaksFromAudio(audio).catch((err) => {
      log.warn('Bot recording waveform could not be prepared', { sessionId, error: err.message });
      return null;
    });
    await setJob(meeting.id, { ...base, playbackFile: storagePath, mimeType: 'audio/webm', durationMs, bytes: audio.length, waveformPeaks });
    log.info('Bot recording saved for playback', { sessionId, meetingId: meeting.id, bytes: audio.length, durationMs });
    return { status: 'saved' };
  } catch (err) {
    log.warn('Bot recording not copied; playback will use the Recall link', { sessionId, error: err.message });
    await setJob(meeting.id, base).catch(() => {});
    return { status: 'linked', reason: err.message };
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

module.exports = { copyBotRecording, freshRecordingLink, recordingLinkFrom };
