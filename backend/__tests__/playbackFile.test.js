/**
 * The seekable playback copy, made by the real ffmpeg. Skipped where ffmpeg is not installed.
 *
 * ffmpeg's live WebM (`-live 1`) is written like MediaRecorder's: no duration and no cues.
 */

'use strict';

const { spawnSync } = require('child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { makeSeekable, exportAudioRange } = require('../services/playbackFile');

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status === 0;
const maybe = hasFfmpeg ? test : test.skip;

/** EBML ids: Duration (0x4489) in Info, and Cues (0x1C53BB6B), the seek index. */
const DURATION = Buffer.from([0x44, 0x89]);
const CUES = Buffer.from([0x1c, 0x53, 0xbb, 0x6b]);

function liveWebm(seconds) {
  const out = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`, '-c:a', 'libopus', '-b:a', '64k', '-f', 'webm', '-live', '1', 'pipe:1'],
    { maxBuffer: 64 * 1024 * 1024, windowsHide: true },
  );
  if (out.status !== 0) throw new Error(String(out.stderr));
  return out.stdout;
}

describe('makeSeekable', () => {
  maybe('adds a duration and puts the cues before the audio', async () => {
    const live = liveWebm(10);
    expect(live.includes(CUES)).toBe(false);

    const file = await makeSeekable(live, 'webm');
    const cuesAt = file.indexOf(CUES);
    const firstCluster = file.indexOf(Buffer.from([0x1f, 0x43, 0xb6, 0x75]));
    expect(file.includes(DURATION)).toBe(true);
    expect(cuesAt).toBeGreaterThan(0);
    expect(cuesAt).toBeLessThan(firstCluster);
    // The audio is copied, not re-encoded: about the same size.
    expect(Math.abs(file.length - live.length) / live.length).toBeLessThan(0.1);
  }, 30000);

  maybe('rejects a damaged file', async () => {
    await expect(makeSeekable(Buffer.from('not audio'), 'webm')).rejects.toThrow(/ffmpeg exited/);
  });

  test('rejects an unknown container', async () => {
    await expect(makeSeekable(Buffer.from('x'), 'mp3')).rejects.toThrow(/No playback format/);
  });
});


maybe('exports only the selected part of the recording clock', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'entomate-audio-range-test-'));
  try {
    const input = path.join(dir, 'source.webm');
    const output = path.join(dir, 'clip.webm');
    const source = spawnSync('ffmpeg', [
      '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono:d=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1',
      '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1[a]', '-map', '[a]', '-c:a', 'libopus', input,
    ], { windowsHide: true });
    expect(source.stderr.toString()).toBe('');
    expect(source.status).toBe(0);

    await exportAudioRange(input, output, 1250, 2750);
    const decoded = spawnSync('ffmpeg', [
      '-loglevel', 'error', '-i', output, '-ar', '8000', '-ac', '1', '-f', 's16le', '-',
    ], { windowsHide: true });
    expect(decoded.status).toBe(0);
    const samples = decoded.stdout;
    expect(Math.abs(samples.length / 2 / 8000 - 1.5)).toBeLessThan(0.02);
    const peak = (from, to) => {
      let value = 0;
      for (let i = from * 8000; i < to * 8000; i++) value = Math.max(value, Math.abs(samples.readInt16LE(i * 2)));
      return value;
    };
    expect(peak(0.1, 0.6)).toBeLessThan(25);
    expect(peak(0.9, 1.4)).toBeGreaterThan(1000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);
