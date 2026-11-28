const { Readable } = require('node:stream');
const { writeFile } = require('node:fs/promises');

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockSend, destroy: jest.fn() })),
  GetObjectCommand: jest.fn(input => ({ input })),
}));
jest.mock('../services/meetingRecorder', () => ({
  roomRecordingJob: jest.fn(), patchRoomRecording: jest.fn(), saveRoomPlayback: jest.fn(),
}));
jest.mock('../services/playbackFile', () => ({ audioDuration: jest.fn(), renderAlignedAudio: jest.fn() }));
jest.mock('../utils/log', () => ({ warn: jest.fn() }));

const recorder = require('../services/meetingRecorder');
const playback = require('../services/playbackFile');
const log = require('../utils/log');
const { refresh } = require('../services/dailyRoomRecording');

test('imports the raw manifest and track directly from the matching S3 recording', async () => {
  const bucket = 'entomate-private-recordings';
  const region = 'us-east-2';
  const prefix = 'daily-domain/pilot/1795847368663';
  const track = `${prefix}-participant-cam-audio-1795847368663`;
  const start = 1795847368.663;
  const room = { id: 'room-id', provider_name: 'pilot', created_at: new Date(start * 1000).toISOString() };
  const recording = { id: 'daily-recording', mtgSessionId: 'session', s3key: prefix, duration: 3, status: 'finished' };
  const manifest = {
    recording: { id: recording.id, instance_id: room.id },
    meeting_session_id: recording.mtgSessionId,
    events: [
      { type: 'track-added', participant_id: 'participant', ts: start,
        data: { trackSessionNum: 1, kind: 'audio', trackType: 'cam-audio' } },
      { type: 'recording-media-started', participant_id: 'participant', ts: start,
        data: { trackSessionNum: 1, uri: `s3://${region}/${bucket}/${track}`, mediaStartTime: start } },
      { type: 'recording-media-started', participant_id: 'unrelated', ts: start,
        data: { trackSessionNum: 2, uri: `s3://${region}/another-bucket/${track}` } },
    ],
  };
  const participants = [{ participant_id: 'participant', user_id: 'person', user_name: 'Guest', join_time: start, duration: 3 }];
  const daily = jest.fn(async endpoint => {
    if (endpoint === '/recordings?room_name=pilot') return { data: [recording] };
    if (endpoint === '/meetings/session/participants') return { data: participants };
    throw new Error(`Unexpected Daily call ${endpoint}`);
  });
  mockSend.mockImplementation(async ({ input }) => {
    if (input.Key === `${prefix}.event.json`) {
      const json = JSON.stringify(manifest);
      return { ContentLength: Buffer.byteLength(json), Body: { transformToString: async () => json } };
    }
    if (input.Key === track) return { ContentLength: 1, Body: Readable.from([Buffer.from('x')]) };
    throw new Error(`Unexpected S3 read ${input.Key}`);
  });
  recorder.roomRecordingJob.mockResolvedValue({ id: room.id, recording_job: { roomCapture: 'daily', status: 'processing' } });
  playback.audioDuration.mockResolvedValue(3000);
  playback.renderAlignedAudio.mockImplementation(async (_clips, _duration, filename) => writeFile(filename, 'playback'));
  recorder.saveRoomPlayback.mockImplementation(async (_meeting, id) => `${id}.webm`);

  const originalEnv = jest.replaceProperty(process, 'env', {
    ...process.env, DAILY_ROOM_RECORDING_BUCKET: bucket, DAILY_ROOM_RECORDING_REGION: region,
    DAILY_ROOM_RECORDING_ROLE_ARN: 'arn:aws:iam::111122223333:role/DailyRecording',
  });
  try {
    const saved = await new Promise((resolve, reject) => {
      recorder.patchRoomRecording.mockImplementation(async (_meeting, patch) => {
        if (patch.status === 'done') resolve(patch);
      });
      log.warn.mockImplementation(message => reject(new Error(message)));
      refresh(room, daily);
    });
    expect(saved).toMatchObject({ playbackFile: 'mix.webm', durationMs: 3000, participantTracks: { p1: { label: 'Guest', playbackFile: 'p1.webm' } } });
    expect(mockSend.mock.calls.map(([command]) => command.input)).toEqual([
      { Bucket: bucket, Key: `${prefix}.event.json` }, { Bucket: bucket, Key: track },
    ]);
    expect(daily.mock.calls.map(([endpoint]) => endpoint)).toEqual(['/recordings?room_name=pilot', '/meetings/session/participants']);
  } finally {
    originalEnv.restore();
  }
});
