/**
 * Meeting Notes — typed client for /api/meetings/:meetingId/notes.
 * Ported from Logos Vision `src/services/meetingNotesService.ts` (Enterprise Series N1).
 *
 * A note is PRIVATE to its author by default; team visibility is an explicit per-note
 * opt-in. That rule is enforced by the backend (backend/services/meetingNotesService.js),
 * never here: this file only supplies the safe default ('private').
 *
 * Differences from Logos Vision: Logos Vision talks to Supabase directly and RLS
 * enforces privacy; Entomate goes through the Express API, which also returns `isMine`
 * so the UI never has to compare user ids itself.
 */

import { meetingsApi } from './api'
import cache from './apiCache'

export type MeetingNoteVisibility = 'private' | 'team'

export interface MeetingNote {
  id: string
  meetingId: string
  authorId: string
  /** Snapshot taken at write time; null when no name was available. */
  authorName: string | null
  body: string
  visibility: MeetingNoteVisibility
  createdAt: string
  updatedAt: string
  /** True when the signed-in user wrote this note (decided by the server). */
  isMine: boolean
}

/**
 * `failed` exists so an empty list is not the same value as a broken read. A panel
 * that renders "No notes yet" over a failed fetch tells the user their notes are gone.
 */
export interface MeetingNotesResult {
  notes: MeetingNote[]
  failed: boolean
}

export const MEETING_NOTE_MAX_LENGTH = 4000

interface ApiEnvelope<T> {
  success?: boolean
  data?: T
  error?: string
}

/** Anything unexpected reads as the SAFER value, never as 'team'. */
function normalizeVisibility(value: unknown): MeetingNoteVisibility {
  return value === 'team' ? 'team' : 'private'
}

function toNote(raw: unknown): MeetingNote | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.body !== 'string') return null
  return {
    id: r.id,
    meetingId: String(r.meetingId ?? ''),
    authorId: String(r.authorId ?? ''),
    authorName: typeof r.authorName === 'string' ? r.authorName : null,
    body: r.body,
    visibility: normalizeVisibility(r.visibility),
    createdAt: String(r.createdAt ?? ''),
    updatedAt: String(r.updatedAt ?? ''),
    isMine: r.isMine === true,
  }
}

/** GET responses are cached for 30 s; a PATCH/DELETE on a child URL does not clear the list. */
function invalidateNotes(meetingId: string): void {
  cache.invalidate(`/meetings/${meetingId}/notes`)
}

export async function getMeetingNotes(meetingId: string): Promise<MeetingNotesResult> {
  if (!meetingId) return { notes: [], failed: false }
  try {
    const res = (await meetingsApi.listNotes(meetingId)) as ApiEnvelope<unknown[]>
    const rows = Array.isArray(res?.data) ? res.data : []
    const notes = rows.map(toNote).filter((n): n is MeetingNote => n !== null)
    return { notes, failed: false }
  } catch (err) {
    console.error('[MeetingNotes] getMeetingNotes error:', err)
    return { notes: [], failed: true }
  }
}

export interface CreateMeetingNoteInput {
  meetingId: string
  body: string
  /** Defaults to 'private'. A caller must ask for 'team' explicitly. */
  visibility?: MeetingNoteVisibility
}

export async function createMeetingNote(input: CreateMeetingNoteInput): Promise<MeetingNote | null> {
  const body = input.body.trim().slice(0, MEETING_NOTE_MAX_LENGTH)
  if (!body || !input.meetingId) return null
  try {
    const res = (await meetingsApi.createNote(input.meetingId, {
      body,
      visibility: normalizeVisibility(input.visibility),
    })) as ApiEnvelope<unknown>
    invalidateNotes(input.meetingId)
    return toNote(res?.data)
  } catch (err) {
    console.error('[MeetingNotes] createMeetingNote error:', err)
    return null
  }
}

export async function updateMeetingNote(
  meetingId: string,
  noteId: string,
  patch: { body?: string; visibility?: MeetingNoteVisibility },
): Promise<MeetingNote | null> {
  const update: { body?: string; visibility?: MeetingNoteVisibility } = {}
  if (typeof patch.body === 'string') {
    const body = patch.body.trim().slice(0, MEETING_NOTE_MAX_LENGTH)
    // The server rejects a blank body, so an empty edit is a delete the caller has to
    // ask for by name rather than a silent wipe.
    if (!body) return null
    update.body = body
  }
  if (patch.visibility) update.visibility = normalizeVisibility(patch.visibility)
  if (Object.keys(update).length === 0) return null
  try {
    const res = (await meetingsApi.updateNote(meetingId, noteId, update)) as ApiEnvelope<unknown>
    invalidateNotes(meetingId)
    return toNote(res?.data)
  } catch (err) {
    console.error('[MeetingNotes] updateMeetingNote error:', err)
    return null
  }
}

export async function deleteMeetingNote(meetingId: string, noteId: string): Promise<boolean> {
  try {
    await meetingsApi.deleteNote(meetingId, noteId)
    invalidateNotes(meetingId)
    return true
  } catch (err) {
    console.error('[MeetingNotes] deleteMeetingNote error:', err)
    return false
  }
}
