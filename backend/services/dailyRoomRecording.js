'use strict';

const fs = require('node:fs/promises');
const { createWriteStream } = require('node:fs');
const { pipeline } = require('node:stream/promises');
const { tmpdir } = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const recorder = require('./meetingRecorder');
const playback = require('./playbackFile');
const { readManifest, coverageGaps } = require('./roomRecordingManifest');
const log = require('../utils/log');

function bucket() {
  const bucket_name = process.env.DAILY_ROOM_RECORDING_BUCKET?.trim();
  const bucket_region = process.env.DAILY_ROOM_RECORDING_REGION?.trim();
  const assume_role_arn = process.env.DAILY_ROOM_RECORDING_ROLE_ARN?.trim();
  return bucket_name && bucket_region && assume_role_arn ? { bucket_name, bucket_region, assume_role_arn } : null;
}

const operations = new Map();
function share(key, run) {
  const existing = operations.get(key);
  if (existing) return existing;
  const operation = run().finally(() => operations.delete(key));
  operations.set(key, operation);
  return operation;
}

const recordingPath = room => '/rooms/' + encodeURIComponent(room.provider_name) + '/recordings';
async function list(room, daily) {
  return (await daily('/recordings?room_name=' + encodeURIComponent(room.provider_name)))?.data ?? [];
}

function start(room, daily) {
  return share(room.id + ':start', async () => {
    const meeting = await recorder.roomRecordingJob(room);
    const current = meeting?.recording_job;
    if (current?.status === 'recording') return current;
    if (!current || current.roomCapture !== 'daily' || !['ready', 'starting'].includes(current.status)) {
      throw new recorder.RecorderError(409, 'The room recording cannot start.');
    }
    if (current.status !== 'starting') await recorder.patchRoomRecording(meeting, {
      status: 'starting', startedAt: new Date().toISOString(), mimeType: 'audio/webm',
    });
    // If the start response was lost, resume the same recording instance.
    const relevant = recordings => recordings.find(recording => ['in-progress', 'finished'].includes(recording.status));
    let confirmed = current.status === 'starting' ? relevant(await list(room, daily)) : null;
    if (!confirmed) {
      await daily(recordingPath(room) + '/start', 'POST', {
        type: 'raw-tracks', instanceId: room.id, dataOutputs: ['event-json'], maxDuration: 7200,
      });
      for (const wait of [0, 500, 1000, 2000]) {
        if (wait) await delay(wait);
        confirmed = relevant(await list(room, daily));
        if (confirmed) break;
      }
    }
    if (!confirmed) throw new recorder.RecorderError(502, 'Daily has not confirmed recording. Select Start audio recording to check again.');
    if (confirmed.status === 'finished') {
      const job = await recorder.patchRoomRecording(meeting, { status: 'processing', stopRequestedAt: new Date().toISOString() });
      refresh(room, daily);
      return job;
    }
    return recorder.patchRoomRecording(meeting, { status: 'recording' });
  });
}

function stop(room, daily) {
  return share(room.id + ':stop', async () => {
    await operations.get(room.id + ':start')?.catch(() => {});
    const meeting = await recorder.roomRecordingJob(room);
    const job = meeting?.recording_job;
    if (!job || job.roomCapture !== 'daily' || !['starting', 'recording', 'stopping'].includes(job.status)) return job;
    if (job.status !== 'stopping') {
      await recorder.patchRoomRecording(meeting, { status: 'stopping', stopRequestedAt: new Date().toISOString() });
    }
    const response = await daily(recordingPath(room) + '/stop', 'POST', { instanceId: room.id }, [400, 404]);
    if (!response && (await list(room, daily)).some(recording => recording.status === 'in-progress')) {
      throw new recorder.RecorderError(502, 'Daily is still recording. Try stopping the audio again.');
    }
    const processing = await recorder.patchRoomRecording(meeting, { status: 'processing' });
    refresh(room, daily);
    return processing;
  });
}

async function getObject(configuration, client, key, maxBytes) {
  const result = await client.send(new GetObjectCommand({ Bucket: configuration.bucket_name, Key: key }), {
    abortSignal: AbortSignal.timeout(45_000),
  });
  if (!result.Body || !Number.isFinite(result.ContentLength) || result.ContentLength > maxBytes) {
    result.Body?.destroy();
    throw new Error('Invalid Daily recording object');
  }
  return result.Body;
}

function matchingKeys(recording, access) {
  const prefix = recording.s3key;
  if (typeof prefix !== 'string' || !prefix) throw new Error('Missing Daily recording prefix');
  const valid = key => typeof key === 'string' && ['/', '-', '.'].some(separator => key.startsWith(prefix + separator));
  const keyOf = value => typeof value === 'string' ? value : value?.s3key;
  const eventKey = keyOf(access.dataOutputs?.['event-json']);
  if (!valid(eventKey)) throw new Error('Missing Daily event log');
  return { eventKey, tracks: Array.isArray(access.tracks) ? access.tracks.map(keyOf).filter(valid) : [] };
}

async function renderRecording(meeting, manifest, get) {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'entomate-room-audio-'));
  try {
    const { durationMs } = manifest;
    const participantTracks = {};
    const mixed = [];
    for (const [index, person] of manifest.people.entries()) {
      const track = 'p' + (index + 1);
      const clips = [];
      for (const [part, segment] of person.segments.entries()) {
        if (segment.endMs <= segment.startMs) continue;
        const file = path.join(dir, track + '-' + part);
        await pipeline(await get(segment.key, 180_000_000), createWriteStream(file));
        try {
          const mediaDurationMs = await playback.audioDuration(file);
          clips.push({ ...segment, file, mediaDurationMs });
        } catch {
          log.warn('Daily room audio segment has no usable duration', { meetingId: meeting.id, track });
        }
      }
      const gaps = coverageGaps(clips, durationMs, person.witnessedAt);
      if (!clips.length) {
        participantTracks[track] = { label: person.label, status: 'missing', gaps };
        continue;
      }
      const output = path.join(dir, track + '.webm');
      await playback.renderAlignedAudio(clips, durationMs, output);
      const playbackFile = await recorder.saveRoomPlayback(meeting, track, await fs.readFile(output));
      participantTracks[track] = { label: person.label, status: gaps.length ? 'partial' : 'saved',
        pieces: 1, durationMs, playbackFile, gaps };
      mixed.push({ file: output, startMs: 0, endMs: durationMs });
    }
    if (!mixed.length) throw new Error('Daily returned no usable microphone audio');
    const output = path.join(dir, 'combined.webm');
    await playback.renderAlignedAudio(mixed, durationMs, output);
    const playbackFile = await recorder.saveRoomPlayback(meeting, 'mix', await fs.readFile(output));
    return { playbackFile, durationMs, participantTracks };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function processRecording(room, daily) {
  const meeting = await recorder.roomRecordingJob(room);
  const job = meeting?.recording_job;
  if (job?.roomCapture !== 'daily' || job.status !== 'processing') return true;
  const recording = (await list(room, daily)).find(item => item.status === 'finished');
  if (!recording?.mtgSessionId) return false;
  const access = await daily('/recordings/' + encodeURIComponent(recording.id) + '/access-link');
  const { eventKey, tracks } = matchingKeys(recording, access);
  const configuration = bucket();
  if (!configuration) throw new Error('Daily recording storage is unavailable');
  const client = new S3Client({ region: configuration.bucket_region });
  try {
    const get = (key, max) => getObject(configuration, client, key, max);
    const data = JSON.parse(await (await get(eventKey, 10_000_000)).transformToString());
    const sessions = (await daily('/meetings/' + encodeURIComponent(recording.mtgSessionId) + '/participants'))?.data ?? [];
    const manifest = readManifest(data, recording, sessions, tracks);
    if (!manifest) return false;
    if (!job.participantTracks) {
      const pending = Object.fromEntries(manifest.people.map(({ label }, index) => ['p' + (index + 1), { label, status: 'processing' }]));
      await recorder.patchRoomRecording(meeting, { participantTracks: pending });
    }
    const saved = await renderRecording(meeting, manifest, get);
    await recorder.patchRoomRecording(meeting, {
      ...saved, status: 'done', audioKept: true, pieces: 1, finishedAt: new Date().toISOString(),
      roomOffsetMs: Math.max(0, manifest.origin - Date.parse(room.created_at)),
    });
    return true;
  } finally {
    client.destroy();
  }
}

const attempts = new Map();
function refresh(room, daily) {
  const now = Date.now();
  const last = attempts.get(room.id);
  if (last && now - last < 8_000) return;
  attempts.set(room.id, now);
  setTimeout(() => { if (attempts.get(room.id) === now) attempts.delete(room.id); }, 8_000).unref();
  void share(room.id + ':import', async () => {
    const queued = (await recorder.roomRecordingJob(room))?.recording_job;
    try {
      if (await processRecording(room, daily)) return;
    } catch (error) {
      log.warn('Daily room audio import could not finish', { roomId: room.id, name: error.name, code: error.code });
    }
    // The processing state also lets opening the recap resume import after a server restart.
    if (Date.now() - Date.parse(queued?.stopRequestedAt) < 120_000) {
      setTimeout(() => refresh(room, daily), 10_000).unref();
    }
  }).catch(error => {
    log.warn('Daily room audio state is unavailable', { roomId: room.id, name: error.name, code: error.code });
  });
}

module.exports = { bucket, start, stop, refresh };
