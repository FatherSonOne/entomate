/**
 * One seekable audio file from a browser recording, for playback.
 *
 * MediaRecorder's WebM has no duration and no index (cues), so a browser that streams it
 * can neither show its length nor jump into it. ffmpeg copies the audio into a new file
 * that has both. It copies the audio as it is (no re-encoding), so it is fast and lossless.
 * It needs `ffmpeg` on the PATH (the Docker image installs it). Without it, the caller
 * keeps the pieces and the browser joins them, as before.
 */

'use strict';

const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

/** Per container: put the index first, so a seek does not first read the end of the file. */
const MUXER_FLAGS = { webm: ['-cues_to_front', '1'], m4a: ['-movflags', '+faststart'], ogg: [] };
const TIMEOUT_MS = 2 * 60 * 1000;
const WAVEFORM_BARS = 160;
const WAVEFORM_LIMIT_SECONDS = 9 * 60 * 60;

// Measure a peak every quarter second before combining measurements into the display's bars.
const PEAK_FILTER = 'aresample=8000:async=1:first_pts=0,asetnsamples=n=2000:p=0,' +
  'astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=Peak_level,' +
  'ametadata=mode=print:key=lavfi.astats.Overall.Peak_level:file=-';

function run(cmd, args, timeoutMs = TIMEOUT_MS, maxStdout = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    child.stdout.on('data', (d) => {
      stdout += d;
      if (!maxStdout) stdout = stdout.slice(-2000);
      else if (stdout.length > maxStdout) child.kill('SIGKILL');
    });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr = (stderr + d).slice(-2000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`ffmpeg exited with ${code ?? signal}: ${stderr.trim()}`));
    });
  });
}

/**
 * @param {Buffer} buffer  the joined recording
 * @param {'webm'|'ogg'|'m4a'} ext  its container
 * @returns {Promise<Buffer>} the same audio, with a duration and an index
 */
async function makeSeekable(buffer, ext) {
  if (!MUXER_FLAGS[ext]) throw new Error(`No playback format for .${ext}`);
  // The muxer writes the index by seeking back in its output, so it needs files, not pipes.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'entomate-playback-'));
  const input = path.join(dir, `in.${ext}`);
  const output = path.join(dir, `out.${ext}`);
  try {
    await fs.writeFile(input, buffer);
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map', '0:a', '-c', 'copy', ...MUXER_FLAGS[ext], output]);
    return await fs.readFile(output);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

/**
 * Speech-quality audio from a meeting bot's recording (an MP4 with video), small
 * enough for the recordings bucket: mono Opus at 16 kbps is about 7 MB an hour.
 * Reads and writes files, so a long video never sits in memory.
 * @param {string} inputPath
 * @param {string} outputPath  a .webm path
 * @returns {Promise<number>} duration in ms (0 when ffprobe could not tell)
 */
async function extractSpeechAudio(inputPath, outputPath) {
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
    '-vn', '-ac', '1', '-c:a', 'libopus', '-b:a', '16k', '-application', 'voip',
    ...MUXER_FLAGS.webm, outputPath,
  ], 10 * 60 * 1000);
  return audioDuration(outputPath).catch(() => 0);
}

async function audioDuration(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  const seconds = Number(out.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Recording duration is unavailable');
  return Math.round(seconds * 1000);
}

/** Render seekable mono Opus on the room recording clock. Inputs are local files. */
async function renderAlignedAudio(clips, durationMs, output) {
  const filters = clips.map(({ startMs, endMs }, i) => (
    `[${i}:a:0]asetpts=PTS-STARTPTS,aresample=48000:async=1:first_pts=0,aformat=channel_layouts=mono,` +
    `atrim=duration=${(endMs - startMs) / 1000},adelay=${startMs},` +
    `apad,atrim=duration=${durationMs / 1000}[a${i}]`
  ));
  const mix = clips.map((_, i) => `[a${i}]`).join('');
  filters.push(`${mix}amix=inputs=${clips.length}:normalize=0,alimiter=limit=0.95:latency=1[audio]`);
  await run('ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file', '-y',
    ...clips.flatMap(clip => ['-i', clip.file]), '-filter_complex', filters.join(';'), '-map', '[audio]',
    '-c:a', 'libopus', '-b:a', '48k', ...MUXER_FLAGS.webm, output,
  ], 5 * 60 * 1000);
}

/** Decode the joined MediaRecorder stream to indexed speech audio before seeking into it. */
async function prepareTranscriptionAudio(input, output) {
  await run('ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file', '-y', '-i', input,
    '-map', '0:a:0', '-af', 'aresample=16000:async=1:first_pts=0', '-ac', '1', '-c:a', 'flac', output,
  ], 10 * 60 * 1000);
  return audioDuration(output);
}

async function extractTranscriptionClip(input, output, startMs, durationMs) {
  await run('ffmpeg', [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-ss', String(startMs / 1000), '-i', input,
    '-t', String(durationMs / 1000), '-c:a', 'flac', output,
  ]);
}

async function measureWaveform(inputArgs) {
  let output;
  try {
    output = await run('ffmpeg', [
      '-nostdin', '-hide_banner', '-loglevel', 'error',
      ...inputArgs,
      '-map', '0:a:0', '-t', String(WAVEFORM_LIMIT_SECONDS + 1),
      '-af', PEAK_FILTER, '-f', 'null', '-',
    ], 90_000, 16 * 1024 * 1024);
  } catch {
    // ffmpeg's error may include the signed URL.
    throw new Error('The recording audio could not be measured');
  }
  const levels = [...output.matchAll(/^lavfi\.astats\.Overall\.Peak_level=(-?inf|[-+]?\d+(?:\.\d+)?)\r?$/gm)];
  if (!levels.length || levels.length > WAVEFORM_LIMIT_SECONDS * 4) throw new Error('No supported waveform available');
  const count = Math.min(WAVEFORM_BARS, levels.length);
  return Array.from({ length: count }, (_, bar) => {
    const first = Math.floor(bar * levels.length / count);
    const last = Math.floor((bar + 1) * levels.length / count);
    let peak = 0;
    for (let i = first; i < last; i++) {
      const level = Number(levels[i][1]);
      if (Number.isFinite(level)) peak = Math.max(peak, Math.min(1, 10 ** (level / 20)));
    }
    return Math.round(peak * 10_000) / 10_000;
  });
}

/** Stream a signed recording through its audio track and return only numeric waveform data. */
async function readWaveformPeaks(url) {
  if (new URL(url).protocol !== 'https:') throw new Error('Expected a signed HTTPS recording URL');
  return measureWaveform(['-protocol_whitelist', 'https,tls,tcp,crypto', '-rw_timeout', '12000000', '-i', url]);
}

async function readWaveformPeaksFromAudio(audio) {
  // Use a local file so MP4 inputs can find their index even when it is at the end.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'entomate-waveform-'));
  const input = path.join(dir, 'recording');
  try {
    await fs.writeFile(input, audio);
    return await measureWaveform(['-protocol_whitelist', 'file', '-i', input]);
  } finally {
    await fs.unlink(input).catch(() => {});
    await fs.rmdir(dir);
  }
}

module.exports = {
  makeSeekable, extractSpeechAudio, prepareTranscriptionAudio, extractTranscriptionClip, renderAlignedAudio, audioDuration,
  readWaveformPeaks, readWaveformPeaksFromAudio,
};
