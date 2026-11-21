/**
 * In-browser meeting recorder API. See services/meetingRecorder.js for the flow.
 *
 *   POST   /api/recordings                    start: makes the meeting, returns its id
 *   PUT    /api/recordings/:id/pieces/:seq    one 30-second piece of audio (raw body)
 *   POST   /api/recordings/:id/finish         all pieces sent: transcribe in the background
 *                                             ({ salvage: true }: the tab closed; use what was saved)
 *   POST   /api/recordings/:id/retry          transcribe again after a failure
 *   DELETE /api/recordings/:id                discard an unfinished recording
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
    return res.status(err.status).json(body);
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'The piece is too large.' });
  log.error(`[Recordings] ${what} error:`, { error: err?.message || err });
  return res.status(500).json({ error: 'Internal server error' });
}

router.post('/', authenticate, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const { title, attendees, mode, mimeType, consentAcknowledged } = req.body || {};
    if (consentAcknowledged !== true) {
      return res.status(400).json({ error: 'Confirm that everyone in the meeting knows it is being recorded.' });
    }
    const orgId = await getOrgIdForUser(req.user?.id);
    if (!orgId) return res.status(403).json({ error: 'Join or create a workspace before recording.' });
    const result = await recorder.startRecording({ userId: req.user.id, orgId, title, attendees, mode, mimeType });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    sendError(res, err, 'start');
  }
});

router.put('/:id/pieces/:seq', authenticate, rawAudio, async (req, res) => {
  try {
    const orgId = await meetingNotes.assertMeetingAccess(req.user?.id, req.params.id);
    await recorder.savePiece({
      orgId,
      meetingId: req.params.id,
      seq: Number(req.params.seq),
      durationMs: Number(req.query.durationMs),
      buffer: Buffer.isBuffer(req.body) ? req.body : null,
    });
    res.status(204).end();
  } catch (err) {
    sendError(res, err, 'piece');
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
