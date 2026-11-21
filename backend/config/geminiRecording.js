/**
 * Gemini transcription of a whole meeting recording, through the Files API.
 *
 * `gemini.transcribeAudio` sends the audio inline, which caps a request at about 20 MB.
 * A browser recording of a long meeting can pass that, so this uploads the file to Gemini
 * first, waits until Gemini has processed it, transcribes it, and deletes it again.
 *
 * The prompt asks for one tagged line per speaker turn, `[MM:SS] Speaker 1: words`
 * (or `[H:MM:SS]` past the hour), which `meetingRecorder.parseTimestampedTranscript` reads.
 */

'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const log = require('../utils/log');

const MODEL = 'gemini-2.5-flash';
const PROCESSING_POLL_MS = 3000;
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

const PROMPT = `Transcribe this meeting recording word for word.

Rules:
- Start a new line at every change of speaker.
- Begin every line with the time the turn starts, in square brackets: [MM:SS], or [H:MM:SS] after the first hour.
- After the time, name the speaker as "Speaker 1", "Speaker 2" and so on, then a colon. Keep the same number for the same voice for the whole recording. Number speakers in the order they first speak.
- If a speaker says their own name, still use their Speaker number.
- Write [UNCLEAR] for words you cannot make out. Do not guess.
- Leave out silence, music and background noise.
- Output only the transcript lines. No headings, notes or summary.

Example:
[00:00] Speaker 1: Morning, everyone. Let's start with the launch date.
[00:06] Speaker 2: We can ship on the fourteenth if QA signs off on Friday.`;

function isConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {Buffer} buffer  The whole recording.
 * @param {string} mimeType  e.g. 'audio/webm'.
 * @returns {Promise<string>} The tagged transcript text (may be empty for silence).
 */
async function transcribeRecording(buffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API not configured');

  const files = new GoogleAIFileManager(apiKey);
  const tmp = path.join(os.tmpdir(), `entomate-recording-${crypto.randomUUID()}`);
  let uploadedName = null;
  try {
    // The SDK's uploadFile reads from a path, not a buffer.
    await fs.writeFile(tmp, buffer);
    const uploaded = await files.uploadFile(tmp, { mimeType, displayName: 'meeting recording' });
    uploadedName = uploaded.file.name;

    let file = uploaded.file;
    const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
    while (file.state === 'PROCESSING') {
      if (Date.now() > deadline) throw new Error('Gemini took too long to process the recording');
      await sleep(PROCESSING_POLL_MS);
      file = await files.getFile(uploadedName);
    }
    if (file.state !== 'ACTIVE') throw new Error(`Gemini could not read the recording (${file.state})`);

    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: MODEL,
      // A long meeting is a long transcript; the default output cap would cut it off.
      generationConfig: { maxOutputTokens: 65536, temperature: 0 },
    });
    const result = await model.generateContent([
      { fileData: { mimeType: file.mimeType || mimeType, fileUri: file.uri } },
      { text: PROMPT },
    ]);
    const finish = result.response?.candidates?.[0]?.finishReason;
    if (finish === 'MAX_TOKENS') log.warn('Recording transcript hit the output limit; the end may be missing');
    return result.response.text();
  } finally {
    await fs.unlink(tmp).catch(() => {});
    if (uploadedName) {
      await files.deleteFile(uploadedName).catch((err) => {
        log.warn('Could not delete the recording from Gemini (it expires in 48 hours)', { error: err.message });
      });
    }
  }
}

module.exports = { isConfigured, transcribeRecording, PROMPT };
