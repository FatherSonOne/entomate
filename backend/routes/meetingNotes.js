/**
 * Meeting Notes routes — mounted at /api/meetings/:meetingId/notes.
 *
 * Every route requires a signed-in user. Org membership and the private-or-team rule
 * are enforced in services/meetingNotesService.js (the backend bypasses RLS).
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const notes = require('../services/meetingNotesService');
const log = require('../utils/log');

const router = express.Router({ mergeParams: true });

function displayName(user) {
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return full || user?.email || null;
}

function sendError(res, error, action) {
  if (error instanceof notes.NotesError) {
    return res.status(error.status).json({ success: false, error: error.message });
  }
  log.error(`[MeetingNotes] ${action} error:`, { error: error.message || error });
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

/** GET /api/meetings/:meetingId/notes — my notes plus team notes, newest first. */
router.get('/', authenticate, async (req, res) => {
  try {
    const data = await notes.listNotes(req.user?.id, req.params.meetingId);
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'list');
  }
});

/** POST /api/meetings/:meetingId/notes — body { body, visibility? }. Defaults to private. */
router.post('/', authenticate, async (req, res) => {
  try {
    const data = await notes.createNote(req.user?.id, req.params.meetingId, {
      body: req.body?.body,
      visibility: req.body?.visibility,
      authorName: displayName(req.user)
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'create');
  }
});

/** PATCH /api/meetings/:meetingId/notes/:noteId — author only. */
router.patch('/:noteId', authenticate, async (req, res) => {
  try {
    const data = await notes.updateNote(req.user?.id, req.params.meetingId, req.params.noteId, {
      body: req.body?.body,
      visibility: req.body?.visibility
    });
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'update');
  }
});

/** DELETE /api/meetings/:meetingId/notes/:noteId — author only. */
router.delete('/:noteId', authenticate, async (req, res) => {
  try {
    await notes.deleteNote(req.user?.id, req.params.meetingId, req.params.noteId);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, 'delete');
  }
});

module.exports = router;
