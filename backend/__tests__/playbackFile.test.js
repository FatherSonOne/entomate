/**
 * The seekable playback copy, made by the real ffmpeg. Skipped where ffmpeg is not installed.
 *
 * ffmpeg's live WebM (`-live 1`) is written like MediaRecorder's: no duration and no cues.
 */

'use strict';

const { spawnSync } = require('child_process');
const { makeSeekable } = require('../services/playbackFile');

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
    const live = liveWebm(40);
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
