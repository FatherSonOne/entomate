/**
 * In-browser meeting recorder API. See services/meetingRecorder.js for the flow.
 *
 *   GET    /api/recordings/bot-check          a bot of yours in a call now, if any (record beside it)
 *   POST   /api/recordings                    start: makes the meeting, returns its id
 *                                             ({ botSessionId }: add to that bot's meeting;
 *                                              { separate: true }: a different meeting; else 409
 *                                              with code 'bot_in_call' when a bot is in a call)
 *   PUT    /api/recordings/:id/pieces/:seq    one 30-second piece of audio (raw body)
 *   POST   /api/recordings/:id/finish         all pieces sent: transcribe in the background
 *                                             ({ salvage: true }: the tab closed; use what was saved)
 *   POST   /api/recordings/:id/retry          transcribe again after a failure
 *   POST   /api/recordings/:id/rebuild-transcript   regenerate a saved browser transcript
 *   DELETE /api/recordings/:id                discard an unfinished recording
 *   GET    /api/recordings/:id/playback       a signed link to the seekable copy, or to the pieces in order
 *   GET    /api/recordings/:id/waveform       audio peaks for a saved or linked recording
 *   DELETE /api/recordings/:id/audio          remove a finished recording's audio; keep the transcript
 *
 * Progress is read from the meeting itself (`recording_job` on GET /api/meetings/:id).
 */

'use strict';

const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { getOrgIdForUser } = require('../utils/orgContext');
const meetingNotes = require('../services/meetingNotesService');
const recorder = require('../services/meetingRecorder');
const log = require('../utils/log');

const router = express.Router();

const rawAudio = express.raw({ type: () => true, limit: recorder.PIECE_MAX_BYTES });

function sendError(res, err, what) {
  if (err instanceof recorder.RecorderError || err instanceof meetingNotes.NotesError) {
    const body = { error: err.status === 401 ? 'Unauthorized' : err.message };
    if (Array.isArray(err.missing)) body.missing = err.missing;
    if (err.code) body.code = err.code;
    if (err.bot) body.bot = err.bot;
    return res.status(err.status).json(body);
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'The piece is too large.' });
  log.error(`[Recordings] ${what} error:`, { error: err?.message || err });
  return res.status(500).json({ error: 'Internal server error' });
}

router.get('/bot-check', authenticate, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const orgId = await getOrgIdForUser(req.user?.id);
    const bots = orgId ? await recorder.botsInCall({ orgId, userId: req.user.id }) : [];
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, bot: bots[0] || null });
  } catch (err) {
    sendError(res, err, 'bot check');
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const { title, attendees, mode, mimeType, consentAcknowledged, botSessionId, separate, splitAudio } = req.body || {};
    if (consentAcknowledged !== true) {
      return res.status(400).json({ error: 'Confirm that everyone in the meeting knows it is being recorded.' });
    }
    const orgId = await getOrgIdForUser(req.user?.id);
    if (!orgId) return res.status(403).json({ error: 'Join or create a workspace before recording.' });
    const result = await recorder.startRecording({
      userId: req.user.id, orgId, title, attendees, mode, mimeType,
      botSessionId: typeof botSessionId === 'string' && botSessionId ? botSessionId : null,
      separate: separate === true,
      splitAudio: splitAudio === true,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    sendError(res, err, 'start');
  }
});

async function uploadRecordingPiece(req, res) {
  try {
    const orgId = await meetingNotes.assertMeetingAccess(req.user?.id, req.params.id);
    await recorder.savePiece({
      orgId,
      meetingId: req.params.id,
      seq: Number(req.params.seq),
      durationMs: Number(req.query.durationMs),
      track: req.params.track ?? req.query.track,
      buffer: Buffer.isBuffer(req.body) ? req.body : null,
    });
    res.status(204).end();
  } catch (err) {
    sendError(res, err, 'piece');
  }
}

router.put('/:id/pieces/:seq', authenticate, rawAudio, uploadRecordingPiece);
// A distinct URL makes older backends reject isolated chunks before they can reach the mix.
router.put('/:id/pieces/:seq/:track', authenticate, rawAudio, uploadRecordingPiece);

router.get('/:id/recovery', authenticate, async (req, res) => {
  try {
    await meetingNotes.assertMeetingAccess(req.user?.id, req.params.id);
    res.set('Cache-Control', 'no-store');
    res.json(await recorder.recordingRecovery(req.params.id));
  } catch (err) {
    sendError(res, err, 'recovery');
  }
});

router.post('/:id/finish', authenticate, async (req, res) => {
  try {
    await meetingNotes.assertMeetingAccess(req.user?.id, req.params.id);
    const result = await recorder.finishRecording({
      meetingId: req.params.id,
      pieces: Number(req.body?.pieces),
      salvage: req.body?.salvage === true,
    });
    res.status(202).json({ success: true, ...result });
  } catch (err) {
    sendError(res, err, 'finish');
  }
});

router.post('/:id/retry', authenticate, async (req, res) => {
  try {
    await meetingNotes.assertMeetingAccess(req.user?.id, req.params.id);
    const result = await recorder.retryTranscription({ meetingId: req.params.id });
    res.status(202).json({ success: true, ...result });
  } catch (err) {
    sendError(res, err, 'retry');
  }
});

router.post('/:id/rebuild-transcript', authenticate, async (req, res) => {
  try {
    const orgId = await meetingNotes.assertMeetingAccess(req.user?.id, req.params.id);
    const result = await recorder.rebuildTranscript({ orgId, meetingId: req.params.id });
    res.status(202).json({ success: true, ...result });
  } catch (err) {
    sendError(res, err, 'rebuild transcript');
  }
});

router.get('/:id/playback', authenticate, async (req, res) => {
  try {
    const orgId = await meetingNotes.assertMeetingAccess(req.user?.id, req.params.id);
    // Signed links expire; a cached copy would hand out dead ones.
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, ...(await recorder.getPlayback({ orgId, meetingId: req.params.id, track: req.query.track })) });
  } catch (err) {
    sendError(res, err, 'playback');
  }
});

router.get('/:id/waveform', authenticate, async (req, res) => {
  try {
    const orgId = await meetingNotes.assertMeetingAccess(req.user?.id, req.params.id);
    const peaks = await recorder.getRecordingWaveform({ orgId, meetingId: req.params.id });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, peaks });
  } catch (err) {
    sendError(res, err, 'waveform');
  }
});

router.delete('/:id/audio', authenticate, async (req, res) => {
  try {
    const orgId = await meetingNotes.assertMeetingAccess(req.user?.id, req.params.id);
    res.json({ success: true, recordingJob: await recorder.removeAudio({ orgId, meetingId: req.params.id }) });
  } catch (err) {
    sendError(res, err, 'remove audio');
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const orgId = await meetingNotes.assertMeetingAccess(req.user?.id, req.params.id);
    await recorder.discardRecording({ orgId, meetingId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err, 'discard');
  }
});

// express.raw rejects an oversized body before the handler runs.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => sendError(res, err, 'body'));

module.exports = router;
