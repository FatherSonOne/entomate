'use strict';

jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn(async () => '/tmp/recording'),
  writeFile: jest.fn(async () => {}),
  readFile: jest.fn(async () => Buffer.from('speaker audio')),
  unlink: jest.fn(async () => {}),
  rmdir: jest.fn(async () => {}),
}));

const mockUpload = jest.fn(async () => ({ file: { state: 'ACTIVE', name: 'files/clip', uri: 'files/clip' } }));
const mockDelete = jest.fn(async () => {});
const mockGenerate = jest.fn();
const mockPrepare = jest.fn();
const mockExtract = jest.fn(async () => {});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({ getGenerativeModel: () => ({ generateContent: mockGenerate }) })),
}));
jest.mock('@google/generative-ai/server', () => ({
  GoogleAIFileManager: jest.fn(() => ({ uploadFile: mockUpload, deleteFile: mockDelete })),
}));
jest.mock('../services/playbackFile', () => ({
  prepareTranscriptionAudio: (...args) => mockPrepare(...args),
  extractTranscriptionClip: (...args) => mockExtract(...args),
}));

const { transcribeRecording } = require('../config/geminiRecording');
const response = (text, finishReason = 'STOP') => ({ response: { text: () => text, candidates: [{ finishReason }] } });

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(process, 'env', { ...process.env, GEMINI_API_KEY: 'test-key' });
  mockGenerate.mockReset();
});

afterEach(() => jest.restoreAllMocks());

test('retries a looping first clip in smaller parts and keeps recording times and speaker references', async () => {
  mockPrepare.mockResolvedValue(620_000);
  mockGenerate
    .mockResolvedValueOnce(response(`[00:59 - 01:00] Speaker 1: ${'Mm. '.repeat(24)}`))
    .mockResolvedValueOnce(response('[00:10.500 - 00:16.500] Speaker 1: Opening remarks.'))
    .mockResolvedValueOnce(response('[NO SPEECH]'))
    .mockResolvedValueOnce(response('[00:20 - 00:30] Speaker 2: Second speaker.'))
    .mockResolvedValueOnce(response('[00:02 - 00:05] Speaker 1: Final remarks.'));

  const progress = jest.fn();
  const turns = await transcribeRecording(Buffer.from('recording'), 'audio/webm', progress);
  expect(turns).toEqual([
    { atMs: 10_500, endMs: 16_500, speaker: 'Speaker 1', text: 'Opening remarks.' },
    { atMs: 320_000, endMs: 330_000, speaker: 'Speaker 2', text: 'Second speaker.' },
    { atMs: 602_000, endMs: 605_000, speaker: 'Speaker 1', text: 'Final remarks.' },
  ]);
  const windows = mockExtract.mock.calls.filter(([, file]) => file.endsWith('clip.flac'));
  expect(windows.map(args => args.slice(2))).toEqual([
    [0, 300_000], [0, 150_000], [150_000, 150_000], [300_000, 300_000], [600_000, 20_000],
  ]);
  expect(progress.mock.calls.flat().map(({ processedMs, totalMs }) => [processedMs, totalMs])).toEqual([
    [0, 620_000], [150_000, 620_000], [300_000, 620_000], [600_000, 620_000], [620_000, 620_000],
  ]);
  expect(mockGenerate.mock.calls.at(-1)[0]).toEqual(expect.arrayContaining([
    { text: 'Reference voice for Speaker 1.' }, { text: 'Reference voice for Speaker 2.' },
    { text: 'Target clip follows. The next unused speaker number is 3.' },
  ]));
  expect(mockDelete).toHaveBeenCalledTimes(5);
});

test('fails the job when a short clip still has an incomplete result', async () => {
  mockPrepare.mockResolvedValue(20_000);
  mockGenerate.mockResolvedValue(response('[00:02 - 00:05] Speaker 1: Partial.', 'MAX_TOKENS'));
  await expect(transcribeRecording(Buffer.from('recording'), 'audio/webm')).rejects.toThrow('incomplete recording clip');
  expect(mockDelete).toHaveBeenCalledTimes(1);
});
