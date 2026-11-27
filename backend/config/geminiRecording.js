/** Transcribe browser recordings in bounded clips using the Gemini Files API. */
'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const playbackFile = require('../services/playbackFile');
const log = require('../utils/log');

const MODEL = 'gemini-2.5-flash';
const CLIP_MS = 5 * 60 * 1000;
const MIN_RETRY_CLIP_MS = 30 * 1000;
const MAX_SPEAKER_SAMPLES = 16;
const PROCESSING_POLL_MS = 3000;
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;
const NO_SPEECH = '[NO SPEECH]';

const PROMPT = `Transcribe the target audio clip word for word, from its beginning to its end.

Rules:
- Start a new line when the speaker changes or resumes after a pause. For long turns, also start new lines at sentence boundaries every 15 to 30 seconds.
- Format each line as [MM:SS.mmm - MM:SS.mmm] Speaker N: words. Use the target clip's clock, starting at zero. The two times are the beginning and end of the spoken words on that line.
- Use the reference audio, if supplied, only to match voices to their existing speaker numbers. Keep those numbers for returning voices, and use the next unused number for each new voice.
- Write [UNCLEAR] for words you cannot make out. Leave out silence, music and background noise. Output [NO SPEECH] if the target clip contains no speech.
- Output only the transcript lines. No headings, commentary or summary.

Example:
[00:00.200 - 00:04.900] Speaker 1: Morning, everyone. Let's start with the launch date.
[00:06.100 - 00:10.500] Speaker 2: We can ship on the fourteenth if QA signs off on Friday.`;

const TIME = '(?:\\d{1,2}:)?\\d{1,2}:\\d{2}(?:[.,]\\d{1,3})?';
const STAMPED_LINE = new RegExp(`^\\s*\\**\\s*\\[\\s*(${TIME})(?:\\s*[-–—]\\s*(${TIME}))?\\s*\\]\\s*\\**\\s*(.*)$`);
const SPEAKER_PREFIX = /^\**(Speaker \d+|[A-Z][\w.'-]*(?: [A-Z][\w.'-]*){0,3})\**:\**\s+(.+)$/;

function timestampMs(clock) {
  const seconds = clock.replace(',', '.').split(':').reduce((total, part) => total * 60 + Number(part), 0);
  return Math.round(seconds * 1000);
}

/** Also accepts start-only tags emitted by the older transcription prompt. */
function parseTimestampedTranscript(text) {
  const lines = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const match = raw.match(STAMPED_LINE);
    const previous = lines.at(-1);
    if (!match) {
      if (raw.trim() && previous) previous.text += ` ${raw.trim()}`;
      continue;
    }
    const [, start, end, body] = match;
    if (!body.trim()) continue;
    const who = body.trim().match(SPEAKER_PREFIX);
    const atMs = Math.max(timestampMs(start), previous?.atMs ?? 0);
    const endMs = end ? timestampMs(end) : 0;
    lines.push({ atMs, ...(endMs > atMs ? { endMs } : {}), speaker: who?.[1] ?? previous?.speaker ?? 'Speaker 1', text: (who?.[2] ?? body).trim() });
  }
  return lines;
}

/** Generative transcripts can loop on a syllable even when the result reports STOP. */
function hasRepeatedPhrase(text) {
  return /(?:^| )(\S+(?: \S+){0,3})(?: \1){11}(?= |$)/iu
    .test(text.replace(/[^\p{L}\p{N}]+/gu, ' '));
}

function isConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

async function requestClip({ files, model, clip, mimeType, samples, nextSpeaker }) {
  const { file: uploaded } = await files.uploadFile(clip, { mimeType, displayName: 'meeting recording' });
  try {
    let file = uploaded;
    const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
    while (file.state === 'PROCESSING') {
      if (Date.now() > deadline) throw new Error('Gemini took too long to process the recording');
      await new Promise(resolve => setTimeout(resolve, PROCESSING_POLL_MS));
      file = await files.getFile(uploaded.name);
    }
    if (file.state !== 'ACTIVE') throw new Error(`Gemini could not read the recording (${file.state})`);

    const result = await model.generateContent([
      { text: PROMPT },
      ...[...samples].flatMap(([speaker, data]) => [
        { text: `Reference voice for ${speaker}.` }, { inlineData: { mimeType: 'audio/flac', data } },
      ]),
      { text: `Target clip follows. The next unused speaker number is ${nextSpeaker}.` },
      { fileData: { mimeType: file.mimeType || mimeType, fileUri: file.uri } },
    ]);
    const finishReason = result.response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') return null;
    const text = result.response.text().trim();
    if (text === NO_SPEECH) return [];
    const lines = parseTimestampedTranscript(text);
    if (!lines.length || lines.some(line => !line.endMs) || hasRepeatedPhrase(lines.map(line => line.text).join(' '))) return null;
    return lines;
  } finally {
    await files.deleteFile(uploaded.name).catch(() => log.warn('Could not delete a Gemini recording clip'));
  }
}

/** Return speaker turns on the recording clock, with real gaps where no speech was found. */
async function transcribeRecording(buffer, mimeType, onProgress = async () => {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API not configured');
  const files = new GoogleAIFileManager(apiKey);
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: MODEL, generationConfig: { maxOutputTokens: 16384, temperature: 0 },
  });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'entomate-transcript-'));
  const input = path.join(dir, 'recording');
  const source = path.join(dir, 'indexed.flac');
  const clip = path.join(dir, 'clip.flac');
  const sample = path.join(dir, 'speaker.flac');
  try {
    await fs.writeFile(input, buffer);
    const durationMs = await playbackFile.prepareTranscriptionAudio(input, source).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
      // Local installations without ffmpeg still support the original upload path.
      log.warn('FFmpeg is unavailable for preparing transcription clips');
      return 0;
    });
    const samples = new Map();
    let nextSpeaker = 1;
    await onProgress({ processedMs: 0, totalMs: durationMs });
    if (!durationMs) {
      const lines = await requestClip({ files, model, clip: input, mimeType, samples, nextSpeaker });
      if (lines === null) throw new Error('Gemini returned an incomplete transcript');
      return lines;
    }

    const transcript = [];
    async function appendClip(startMs, lengthMs) {
      await onProgress();
      await playbackFile.extractTranscriptionClip(source, clip, startMs, lengthMs);
      const lines = await requestClip({ files, model, clip, mimeType: 'audio/flac', samples, nextSpeaker });
      if (lines === null || lines.some(line => line.atMs >= lengthMs)) {
        if (lengthMs <= MIN_RETRY_CLIP_MS) throw new Error('Gemini returned an incomplete recording clip');
        const half = Math.floor(lengthMs / 2);
        await appendClip(startMs, half);
        await appendClip(startMs + half, lengthMs - half);
        return;
      }

      for (const line of lines) {
        const atMs = startMs + line.atMs;
        const endMs = startMs + Math.min(line.endMs, lengthMs);
        transcript.push({ ...line, atMs, endMs });
        const number = /^Speaker (\d+)$/.exec(line.speaker);
        if (!number) continue;
        nextSpeaker = Math.max(nextSpeaker, Number(number[1]) + 1);
        const sampleMs = Math.min(5000, endMs - atMs);
        if (sampleMs < 1500 || samples.has(line.speaker) || samples.size >= MAX_SPEAKER_SAMPLES) continue;
        await playbackFile.extractTranscriptionClip(source, sample, atMs, sampleMs);
        samples.set(line.speaker, (await fs.readFile(sample)).toString('base64'));
      }
      await onProgress({ processedMs: startMs + lengthMs, totalMs: durationMs });
    }

    for (let start = 0; start < durationMs; start += CLIP_MS) {
      await appendClip(start, Math.min(CLIP_MS, durationMs - start));
    }
    return transcript;
  } finally {
    await Promise.all([input, source, clip, sample].map(file => fs.unlink(file).catch(() => {})));
    await fs.rmdir(dir);
  }
}

module.exports = { isConfigured, parseTimestampedTranscript, transcribeRecording };
