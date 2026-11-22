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

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr = (stderr + d).slice(-2000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
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

module.exports = { makeSeekable };
