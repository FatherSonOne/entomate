/**
 * Meeting Notes panel — ported from Logos Vision `MeetingNotesPanel.tsx` (Enterprise Series N1).
 *
 * A new note starts PRIVATE. Sharing with the team is a deliberate second action, and the
 * composer says which one it is going to be BEFORE you press save: a notes box that
 * silently defaults to team-visible is how a private thought becomes an incident.
 *
 * Changes from Logos Vision: one skin (Entomate theme tokens via Tailwind, no live-room
 * dark skin, since Entomate has no live room); ownership comes from the server's `isMine`
 * instead of comparing user ids; a confirm step before delete.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2, Lock, Pencil, Trash2, Users, X } from 'lucide-react'
import {
  createMeetingNote,
  deleteMeetingNote,
  getMeetingNotes,
  updateMeetingNote,
  MEETING_NOTE_MAX_LENGTH,
  type MeetingNote,
  type MeetingNoteVisibility,
} from '../../services/meetingNotesService'

export interface MeetingNotesPanelProps {
  /** Null before a meeting row exists: the composer says so rather than silently failing. */
  meetingId: string | null
}

const FIELD =
  'w-full resize-y rounded-lg border border-line bg-surface-elevated px-3 py-2 text-sm text-content-primary ' +
  'placeholder:text-content-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary'
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-content-secondary ' +
  'hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary'
const QUIET_BUTTON =
  'inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded text-xs ' +
  'hover:text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary'

function formatStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function MeetingNotesPanel({ meetingId }: MeetingNotesPanelProps): React.ReactElement {
  const [notes, setNotes] = useState<MeetingNote[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftVisibility, setDraftVisibility] = useState<MeetingNoteVisibility>('private')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    if (!meetingId) {
      setNotes([])
      return
    }
    setLoading(true)
    const res = await getMeetingNotes(meetingId)
    setNotes(res.notes)
    setFailed(res.failed)
    setLoading(false)
  }, [meetingId])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async (): Promise<void> => {
    if (!meetingId || !draft.trim() || saving) return
    setSaving(true)
    setMessage(null)
    const created = await createMeetingNote({ meetingId, body: draft, visibility: draftVisibility })
    setSaving(false)
    if (!created) {
      setMessage('That note could not be saved. Try again.')
      return
    }
    setNotes((prev) => [created, ...prev])
    setDraft('')
    // The visibility choice does NOT persist between notes: the next note starts private
    // again, so one deliberate share never quietly becomes a standing setting.
    setDraftVisibility('private')
  }

  const replaceNote = (updated: MeetingNote): void => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
  }

  const handleToggleVisibility = async (note: MeetingNote): Promise<void> => {
    if (!meetingId) return
    setMessage(null)
    const next: MeetingNoteVisibility = note.visibility === 'team' ? 'private' : 'team'
    const updated = await updateMeetingNote(meetingId, note.id, { visibility: next })
    if (!updated) {
      setMessage('That note could not be updated.')
      return
    }
    replaceNote(updated)
  }

  const handleSaveEdit = async (note: MeetingNote): Promise<void> => {
    if (!meetingId) return
    setMessage(null)
    const updated = await updateMeetingNote(meetingId, note.id, { body: editBody })
    if (!updated) {
      setMessage(editBody.trim() ? 'That note could not be updated.' : 'A note needs some text. Delete it instead.')
      return
    }
    replaceNote(updated)
    setEditingId(null)
  }

  const handleDelete = async (note: MeetingNote): Promise<void> => {
    if (!meetingId) return
    setMessage(null)
    const ok = await deleteMeetingNote(meetingId, note.id)
    setConfirmDeleteId(null)
    if (!ok) {
      setMessage('That note could not be deleted.')
      return
    }
    setNotes((prev) => prev.filter((n) => n.id !== note.id))
  }

  return (
    <div data-testid="meeting-notes-panel">
      {meetingId ? (
        <div className="mb-4">
          <label htmlFor="meeting-note-draft" className="sr-only">
            Add a note
          </label>
          <textarea
            id="meeting-note-draft"
            rows={3}
            maxLength={MEETING_NOTE_MAX_LENGTH}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Your note about this meeting..."
            className={FIELD}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDraftVisibility((v) => (v === 'team' ? 'private' : 'team'))}
              aria-pressed={draftVisibility === 'team'}
              className={CHIP}
            >
              {draftVisibility === 'team' ? (
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {draftVisibility === 'team' ? 'Visible to the team' : 'Private to me'}
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSave()
              }}
              disabled={!draft.trim() || saving}
              className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-accent-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 disabled:opacity-40"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Save note
            </button>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-xs text-content-secondary">Notes can be added once this meeting has been saved.</p>
      )}

      {message && (
        <p role="alert" className="mb-3 flex items-center gap-1.5 text-xs text-semantic-error">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {message}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-content-secondary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading notes...
        </div>
      ) : failed ? (
        // NOT "No notes yet": an empty list and a broken read look identical, and telling
        // someone their notes are gone when the fetch merely failed is the worse lie.
        // `status`, not `alert`: nobody asked for this, so it should not interrupt.
        <div role="status" className="flex items-center gap-2 text-xs text-content-secondary">
          Notes could not be loaded.
          <button
            type="button"
            onClick={() => {
              void load()
            }}
            className="underline underline-offset-2 hover:text-content-primary"
          >
            Try again
          </button>
        </div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-content-secondary">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li
              key={note.id}
              data-testid="meeting-note"
              className="rounded-lg border border-line-subtle bg-surface-elevated px-3 py-2"
            >
              {editingId === note.id ? (
                <div>
                  <label htmlFor={`edit-note-${note.id}`} className="sr-only">
                    Edit note
                  </label>
                  <textarea
                    id={`edit-note-${note.id}`}
                    rows={3}
                    maxLength={MEETING_NOTE_MAX_LENGTH}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className={FIELD}
                  />
                  <div className="mt-1.5 flex gap-3 text-content-secondary">
                    <button
                      type="button"
                      onClick={() => {
                        void handleSaveEdit(note)
                      }}
                      className={QUIET_BUTTON}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className={QUIET_BUTTON}>
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-content-primary">{note.body}</p>
              )}

              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-content-secondary">
                <span>{note.isMine ? 'You' : note.authorName || 'A teammate'}</span>
                <span aria-hidden="true">·</span>
                <span>{formatStamp(note.createdAt)}</span>
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5"
                  title={
                    note.visibility === 'team'
                      ? 'Everyone in your organisation can read this note'
                      : 'Only you can read this note'
                  }
                >
                  {note.visibility === 'team' ? (
                    <Users className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Lock className="h-3 w-3" aria-hidden="true" />
                  )}
                  {note.visibility === 'team' ? 'Team' : 'Private'}
                </span>

                {note.isMine && editingId !== note.id && (
                  <span className="ml-auto flex items-center gap-1">
                    {confirmDeleteId === note.id ? (
                      <>
                        <span className="text-content-secondary">Delete this note?</span>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDelete(note)
                          }}
                          className={`${QUIET_BUTTON} px-1 text-semantic-error`}
                        >
                          Delete
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className={`${QUIET_BUTTON} px-1`}>
                          Keep
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            void handleToggleVisibility(note)
                          }}
                          className={`${QUIET_BUTTON} px-1 underline-offset-2 hover:underline`}
                        >
                          {note.visibility === 'team' ? 'Make private' : 'Share with team'}
                        </button>
                        <button
                          type="button"
                          aria-label="Edit note"
                          onClick={() => {
                            setEditingId(note.id)
                            setEditBody(note.body)
                          }}
                          className={QUIET_BUTTON}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete note"
                          onClick={() => setConfirmDeleteId(note.id)}
                          className={QUIET_BUTTON}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MeetingNotesPanel
