/** Bot meeting audio is copied into the meeting for playback. */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service';

const mockState = { session: null, meeting: null, updates: [], uploads: [], uploadError: null };
const mockBot = jest.fn();
const mockExtract = jest.fn(async (input, output) => { require('fs').writeFileSync(output, Buffer.from('opus')); return 50000; });

jest.mock('../services/botOrchestrator', () => ({ getRecallBotState: (...a) => mockBot(...a) }));
jest.mock('../services/playbackFile', () => ({ extractSpeechAudio: (...a) => mockExtract(...a) }));
jest.mock('../config/supabase', () => ({
  supabase: null,
  supabaseAdmin: {
    from: (table) => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: table === 'bot_sessions' ? mockState.session : mockState.meeting, error: null }),
        update: (row) => { mockState.updates.push(row); return { eq: async () => ({ error: null }) }; },
      };
      return q;
    },
    storage: { from: () => ({ upload: async (p, body, opts) => { mockState.uploads.push({ p, opts }); return { error: mockState.uploadError }; } }) },
  },
}));

const { copyBotRecording, recordingLinkFrom } = require('../services/botRecording');

const bot = { recordings: [{ media_shortcuts: { video_mixed: { data: { download_url: 'https://recall.example/v.mp4' } } } }] };

beforeEach(() => {
  mockState.session = { id: 's1', org_id: 'o1', meeting_id: 'm1', recall_bot_id: 'b1' };
  mockState.meeting = { id: 'm1', org_id: 'o1', recording_job: null };
  mockState.updates = []; mockState.uploads = []; mockState.uploadError = null;
  mockBot.mockResolvedValue(bot);
  global.fetch = jest.fn(async () => new Response('fake-mp4-bytes', { status: 200 }));
});

test('prefers audio over video when Recall has both', () => {
  expect(recordingLinkFrom({ recordings: [{ media_shortcuts: { audio_mixed: { data: { download_url: 'a' } }, video_mixed: { data: { download_url: 'v' } } } }] })).toBe('a');
  expect(recordingLinkFrom(bot)).toBe('https://recall.example/v.mp4');
});

test('saves speech audio as the meeting playback file', async () => {
  await expect(copyBotRecording('s1')).resolves.toEqual({ status: 'saved' });
  expect(mockState.uploads[0]).toEqual({ p: 'o1/m1/playback.webm', opts: { contentType: 'audio/webm', upsert: true } });
  expect(mockState.updates.at(-1).recording_job).toMatchObject({
    status: 'done', source: 'bot', botSessionId: 's1', audioKept: true, playbackFile: 'o1/m1/playback.webm', durationMs: 50000,
  });
});

test('falls back to the Recall link when the upload fails', async () => {
  mockState.uploadError = { message: 'Payload too large' };
  const r = await copyBotRecording('s1');
  expect(r.status).toBe('linked');
  expect(mockState.updates.at(-1).recording_job).toMatchObject({ source: 'bot', botSessionId: 's1', playbackFile: null, audioKept: true });
});

test('leaves a meeting whose audio was removed alone', async () => {
  mockState.meeting.recording_job = { audioRemovedAt: '2026-11-22' };
  await expect(copyBotRecording('s1')).resolves.toEqual({ status: 'skipped', reason: 'already_done' });
  expect(mockState.updates).toHaveLength(0);
});
