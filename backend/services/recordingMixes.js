'use strict';

const fs = require('node:fs/promises');
const { createWriteStream } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { supabase } = require('../config/supabase');
const { RecorderError, loadAlignedRecording, alignedDownloadSources, alignedParticipantTracks } = require('./meetingRecorder');
const { measureAudioLoudness, renderAlignedAudio, exportAudioRange } = require('./playbackFile');

const TABLE = 'meeting_recording_mixes';
const MIN_GAIN = -24;
const MAX_GAIN = 12;
let processing = false;

function normalizeGains(job, gains) {
  const keys = alignedParticipantTracks(job).map(([key]) => key);
  if (!keys.length) throw new RecorderError(404, 'Participant audio is unavailable.');
  if (!gains || typeof gains !== 'object' || Array.isArray(gains) || Object.entries(gains).some(([key, value]) =>
    !keys.includes(key) || !Number.isFinite(value) || value < MIN_GAIN || value > MAX_GAIN)) {
    throw new RecorderError(400, 'Choose a valid volume for each participant track.');
  }
  return Object.fromEntries(keys.map(key => [key, Math.round((gains[key] ?? 0) * 10) / 10]));
}

async function getMix(orgId, meetingId) {
  await loadAlignedRecording(orgId, meetingId);
  const { data, error } = await supabase.from(TABLE).select('gains').eq('meeting_id', meetingId).maybeSingle();
  if (error) throw error;
  return data;
}

async function saveMix(orgId, meetingId, gains) {
  const { recording_job: job } = await loadAlignedRecording(orgId, meetingId);
  const mix = { gains: normalizeGains(job, gains) };
  const { error } = await supabase.from(TABLE).upsert({ meeting_id: meetingId, ...mix }, { onConflict: 'meeting_id' });
  if (error) throw error;
  return mix;
}

async function withParticipants(orgId, meetingId, work) {
  if (processing) throw new RecorderError(429, 'The audio mixer is busy. Try again shortly.');
  processing = true;
  let dir;
  try {
    const sources = await alignedDownloadSources(orgId, meetingId, 'participants');
    dir = await fs.mkdtemp(path.join(tmpdir(), 'entomate-mix-'));
    const tracks = [];
    for (const { track, url } of sources) {
      const file = path.join(dir, track + '.webm');
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok || !res.body) throw new RecorderError(503, 'Participant audio could not be loaded.');
      await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
      tracks.push({ track, file });
    }
    return await work(tracks, dir);
  } finally {
    try {
      if (dir) await fs.rm(dir, { recursive: true, force: true });
    } finally {
      processing = false;
    }
  }
}

async function balanceVoices(orgId, meetingId) {
  return withParticipants(orgId, meetingId, async tracks => {
    const measured = [];
    for (const { track, file } of tracks) measured.push([track, await measureAudioLoudness(file)]);
    const levels = measured.flatMap(([, stats]) => stats ? [stats.loudness] : []).sort((a, b) => a - b);
    const target = levels[Math.floor(levels.length / 2)];
    if (levels.length < 2) return Object.fromEntries(tracks.map(({ track }) => [track, 0]));
    const suggested = measured.map(([track, stats]) => ({
      track, stats,
      gain: stats ? Math.max(MIN_GAIN, Math.min(MAX_GAIN, Math.round(target - stats.loudness))) : 0,
    }));
    const peak = Math.max(...suggested.flatMap(({ stats, gain }) => stats ? [stats.peak + gain] : []));
    const headroom = Math.min(0, Math.floor(-3 - peak));
    return Object.fromEntries(suggested.map(({ track, stats, gain }) => [track,
      stats ? Math.max(MIN_GAIN, gain + headroom) : 0,
    ]));
  });
}

async function renderMix(orgId, meetingId, gains, send, clip) {
  const { recording_job: job } = await loadAlignedRecording(orgId, meetingId);
  const volume = normalizeGains(job, gains);
  const { durationMs } = job;
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0 ||
      (clip && (clip.startMs < 0 || clip.endMs > durationMs || clip.endMs <= clip.startMs))) {
    throw new RecorderError(400, 'The adjusted mix range is unavailable.');
  }
  return withParticipants(orgId, meetingId, async (tracks, dir) => {
    const file = path.join(dir, 'adjusted.webm');
    const inputs = tracks.map(track => ({ ...track, startMs: 0, endMs: durationMs, gainDb: volume[track.track] ?? 0 }));
    await renderAlignedAudio(inputs, durationMs, file, true);
    if (!clip) return send(file);
    const segment = path.join(dir, 'adjusted-clip.webm');
    await exportAudioRange(file, segment, clip.startMs, clip.endMs);
    return send(segment);
  });
}

async function downloadMix(orgId, meetingId, send, clip) {
  const mix = await getMix(orgId, meetingId);
  if (!mix) throw new RecorderError(404, 'Save an adjusted mix before downloading it.');
  return renderMix(orgId, meetingId, mix.gains, send, clip);
}

module.exports = { getMix, saveMix, balanceVoices, renderMix, downloadMix };
