'use strict';

const fs = require('node:fs/promises');
const { createWriteStream } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { supabase } = require('../config/supabase');
const { RecorderError, loadAlignedRecording, alignedDownloads } = require('./meetingRecorder');
const { exportAudioRange } = require('./playbackFile');

const TABLE = 'meeting_recording_clips';
const FIELDS = 'id,title,start_ms,end_ms';
let activeExports = 0;

const toClip = row => ({ id: row.id, title: row.title, startMs: row.start_ms, endMs: row.end_ms });

async function readClip(meetingId, clipId) {
  if (typeof clipId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(clipId)) {
    throw new RecorderError(404, 'Clip not found.');
  }
  const { data, error } = await supabase.from(TABLE).select(FIELDS)
    .eq('meeting_id', meetingId).eq('id', clipId).maybeSingle();
  if (error) throw error;
  if (!data) throw new RecorderError(404, 'Clip not found.');
  return toClip(data);
}

async function listClips(orgId, meetingId) {
  await loadAlignedRecording(orgId, meetingId);
  const { data, error } = await supabase.from(TABLE).select(FIELDS)
    .eq('meeting_id', meetingId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100);
  if (error) throw error;
  return data.map(toClip);
}

async function getClip(orgId, meetingId, clipId) {
  await loadAlignedRecording(orgId, meetingId);
  return readClip(meetingId, clipId);
}

async function saveClip(orgId, meetingId, { title, startMs, endMs }) {
  const { recording_job: job } = await loadAlignedRecording(orgId, meetingId);
  const name = typeof title === 'string' ? title.trim() : '';
  if (!name || name.length > 120) throw new RecorderError(400, 'Enter a clip name of up to 120 characters.');
  if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) ||
      startMs < 0 || startMs >= endMs || !Number.isSafeInteger(job.durationMs) || endMs > job.durationMs) {
    throw new RecorderError(400, 'Choose a start and end within the recording.');
  }
  const { data, error } = await supabase.from(TABLE).insert({
    meeting_id: meetingId, title: name, start_ms: startMs, end_ms: endMs,
  }).select(FIELDS).single();
  if (error) throw error;
  return toClip(data);
}

async function downloadClip(orgId, meetingId, clipId, track, send) {
  if (!/^(mix|p[1-9]\d{0,2})$/.test(track)) throw new RecorderError(404, 'This audio track is unavailable.');
  const clip = await getClip(orgId, meetingId, clipId);
  if (activeExports >= 2) throw new RecorderError(429, 'Clip export is busy. Try again shortly.');
  activeExports++;
  let dir;
  try {
    const [source] = await alignedDownloads(orgId, meetingId, track);
    dir = await fs.mkdtemp(path.join(tmpdir(), 'entomate-clip-'));
    const input = path.join(dir, 'source.webm');
    const output = path.join(dir, 'clip.webm');
    const response = await fetch(source.url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok || !response.body) throw new RecorderError(503, 'The clip audio could not be loaded.');
    await pipeline(Readable.fromWeb(response.body), createWriteStream(input));
    await exportAudioRange(input, output, clip.startMs, clip.endMs);
    await send(output);
  } finally {
    activeExports--;
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  }
}

module.exports = { listClips, getClip, saveClip, downloadClip };
