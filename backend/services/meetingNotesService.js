/**
 * Meeting Notes service — port of Logos Vision's meetingNotesService (Enterprise Series N1).
 *
 * A person's own notes about a meeting. A note is PRIVATE to its author by default;
 * team visibility is an explicit per-note opt-in.
 *
 * WHY THE RULES LIVE HERE: the backend runs on the service-role key, which bypasses
 * RLS. In Logos Vision the browser talks to Supabase directly and RLS enforces privacy;
 * in Entomate every read and write goes through this file, so this file IS the gate.
 * The `meeting_notes` RLS policies are defence in depth only. Every query below is
 * scoped by org_id AND by the private-or-team rule, and every write by author_id.
 */

const { supabase } = require('../config/supabase');
const log = require('../utils/log');

const MEETING_NOTE_MAX_LENGTH = 4000;
const COLUMNS = 'id, meeting_id, author_id, author_name, body, visibility, created_at, updated_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Error carrying an HTTP status, so the route can map it without string matching. */
class NotesError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * @typedef {'private'|'team'} NoteVisibility
 * @typedef {{ id: string, meetingId: string, authorId: string, authorName: string|null,
 *   body: string, visibility: NoteVisibility, createdAt: string, updatedAt: string,
 *   isMine: boolean }} MeetingNote
 */

/** Anything unexpected reads as the SAFER value, never as 'team'. */
function normalizeVisibility(value) {
  return value === 'team' ? 'team' : 'private';
}

/** @returns {MeetingNote} */
function mapRow(row, userId) {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    authorId: row.author_id,
    authorName: row.author_name ?? null,
    body: row.body ?? '',
    visibility: normalizeVisibility(row.visibility),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isMine: row.author_id === userId
  };
}

/** Trim and cap a body; returns '' when nothing is left. */
function cleanBody(body) {
  if (typeof body !== 'string') return '';
  return body.trim().slice(0, MEETING_NOTE_MAX_LENGTH);
}

function requireUser(userId) {
  if (!userId || !UUID_RE.test(userId)) {
    throw new NotesError(401, 'Sign in to use meeting notes');
  }
}

function requireId(id, label) {
  if (!id || !UUID_RE.test(id)) throw new NotesError(404, `${label} not found`);
}

/**
 * Confirm the user belongs to the meeting's org and return that org id.
 * A missing meeting and a meeting in someone else's org both answer 404, so the
 * response never reveals that a meeting exists in another tenant.
 * @returns {Promise<string>} org_id
 */
async function assertMeetingAccess(userId, meetingId) {
  requireUser(userId);
  requireId(meetingId, 'Meeting');
  if (!supabase) throw new NotesError(503, 'Database not configured');

  const { data: meeting, error: meetingErr } = await supabase
    .from('meetings')
    .select('id, org_id')
    .eq('id', meetingId)
    .maybeSingle();
  if (meetingErr) throw meetingErr;
  if (!meeting?.org_id) throw new NotesError(404, 'Meeting not found');

  const { data: membership, error: memberErr } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('org_id', meeting.org_id)
    .limit(1)
    .maybeSingle();
  if (memberErr) throw memberErr;
  if (!membership) throw new NotesError(404, 'Meeting not found');

  return meeting.org_id;
}

/**
 * Notes on a meeting that this user may read: their own (any visibility) plus team notes.
 * @returns {Promise<MeetingNote[]>}
 */
async function listNotes(userId, meetingId) {
  const orgId = await assertMeetingAccess(userId, meetingId);
  const { data, error } = await supabase
    .from('meeting_notes')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('meeting_id', meetingId)
    // userId is UUID-validated in requireUser, so interpolation is safe.
    .or(`visibility.eq.team,author_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // Second filter in JS: the query is the first line, this is the backstop.
  return (data || [])
    .filter((row) => row.visibility === 'team' || row.author_id === userId)
    .map((row) => mapRow(row, userId));
}

/**
 * @param {{ body: string, visibility?: NoteVisibility, authorName?: string|null }} input
 * @returns {Promise<MeetingNote>}
 */
async function createNote(userId, meetingId, input) {
  const orgId = await assertMeetingAccess(userId, meetingId);
  const body = cleanBody(input?.body);
  if (!body) throw new NotesError(400, 'A note needs some text');

  const authorName = typeof input?.authorName === 'string' ? input.authorName.trim().slice(0, 200) : '';
  const { data, error } = await supabase
    .from('meeting_notes')
    .insert({
      org_id: orgId,
      meeting_id: meetingId,
      author_id: userId,
      author_name: authorName || null,
      body,
      visibility: normalizeVisibility(input?.visibility)
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapRow(data, userId);
}

/**
 * Author-only edit. A blank body is rejected rather than treated as a delete.
 * @param {{ body?: string, visibility?: NoteVisibility }} patch
 * @returns {Promise<MeetingNote>}
 */
async function updateNote(userId, meetingId, noteId, patch) {
  const orgId = await assertMeetingAccess(userId, meetingId);
  requireId(noteId, 'Note');

  const update = {};
  if (patch && typeof patch.body === 'string') {
    const body = cleanBody(patch.body);
    if (!body) throw new NotesError(400, 'A note needs some text');
    update.body = body;
  }
  if (patch && patch.visibility !== undefined) update.visibility = normalizeVisibility(patch.visibility);
  if (Object.keys(update).length === 0) throw new NotesError(400, 'Nothing to update');

  const { data, error } = await supabase
    .from('meeting_notes')
    .update(update)
    .eq('id', noteId)
    .eq('org_id', orgId)
    .eq('meeting_id', meetingId)
    .eq('author_id', userId)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  // Not yours, or not there: same answer, so other people's note ids aren't confirmed.
  if (!data) throw new NotesError(404, 'Note not found');
  return mapRow(data, userId);
}

/** Author-only delete. */
async function deleteNote(userId, meetingId, noteId) {
  const orgId = await assertMeetingAccess(userId, meetingId);
  requireId(noteId, 'Note');

  const { data, error } = await supabase
    .from('meeting_notes')
    .delete()
    .eq('id', noteId)
    .eq('org_id', orgId)
    .eq('meeting_id', meetingId)
    .eq('author_id', userId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new NotesError(404, 'Note not found');
  return true;
}

/**
 * Team notes only, for recaps and outbound exports. "What I can read" and "what belongs
 * in a message to the team" are different questions: a user's OWN private note is
 * readable to them and must still never be sent. Callers are server-side jobs that have
 * already scoped the meeting, so this takes the org id explicitly.
 * @returns {Promise<Array<{ authorName: string|null, body: string, createdAt: string }>>}
 */
async function getTeamNotesForMeeting(orgId, meetingId) {
  if (!orgId || !meetingId) return [];
  try {
    const { data, error } = await supabase
      .from('meeting_notes')
      .select('author_name, body, visibility, created_at')
      .eq('org_id', orgId)
      .eq('meeting_id', meetingId)
      .eq('visibility', 'team')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || [])
      .filter((row) => row.visibility === 'team')
      .map((row) => ({ authorName: row.author_name ?? null, body: row.body, createdAt: row.created_at }));
  } catch (err) {
    // A recap without notes is better than no recap.
    log.error('[MeetingNotes] getTeamNotesForMeeting error:', err.message || err);
    return [];
  }
}

module.exports = {
  MEETING_NOTE_MAX_LENGTH,
  NotesError,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  getTeamNotesForMeeting,
  assertMeetingAccess,
  _internal: { mapRow, cleanBody, normalizeVisibility }
};
