import React, { useEffect, useState } from 'react'
import { X, Plus, Trash2, MessageSquare, Loader } from 'lucide-react'
import './ThreadRail.css'

/**
 * EAI-02b — the conversation list, ported from Logos AI's ThreadRail (U2b).
 *
 * It **overlays** the panel rather than splitting it. LV measured that at the mobile width
 * a rail wide enough to read titles crushed the context card and truncated the composer.
 * Overlaying costs one extra tap to dismiss and keeps every other surface at full width.
 *
 * Not ported: pinning (ento_ai_threads has no pinned_at). The panel lists the newest 20;
 * "View all conversations" opens the history page with the rest (EAI-02c slice 4).
 */

export interface ThreadSummary {
  id: string
  title: string | null
  updated_at: string
}

interface ThreadRailProps {
  open: boolean
  threads: ThreadSummary[]
  activeThreadId: string | null
  loading: boolean
  /** A failed read or delete, said inside the rail (its scrim covers the panel's banner). */
  error?: string | null
  onClose: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  /** Opens the full history page. Omitted, the link is not shown. */
  onViewAll?: () => void
}

/** "Just now", "5 minutes ago", "3 hours ago", "2 days ago", then "Mar 15" / "Mar 15, 2025". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const diffMs = now.getTime() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}

export const ThreadRail: React.FC<ThreadRailProps> = ({
  open,
  threads,
  activeThreadId,
  loading,
  error = null,
  onClose,
  onSelect,
  onDelete,
  onNew,
  onViewAll,
}) => {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // Escape closes the rail before it closes the panel. Registered in the CAPTURE phase on the
  // document: the panel's own Escape handler listens on window in the bubble phase, so stopping
  // propagation here means one Escape does not dismiss both at once.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose])

  // A confirm left armed on a row would still be armed the next time the rail opens, one click
  // away from deleting a conversation the user never meant to touch.
  useEffect(() => {
    if (!open) setConfirmingId(null)
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="la-rail-scrim" onClick={onClose} aria-hidden="true" />
      {/* A div, not an aside: element-level `aside button` rules in dark mode would grey its
          buttons (LV measured it). role="dialog" carries the meaning. */}
      <div className="la-rail" role="dialog" aria-label="Conversation history">
        <div className="la-rail-header">
          <h3 className="la-rail-title">Transcripts</h3>
          <button
            type="button"
            className="la-rail-close"
            onClick={onClose}
            title="Close history"
            aria-label="Close conversation history"
          >
            <X size={14} />
          </button>
        </div>

        <button type="button" className="la-rail-new" onClick={onNew}>
          <Plus size={14} />
          <span>New conversation</span>
        </button>

        {error && (
          <div className="la-rail-empty" role="alert">
            <MessageSquare size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="la-rail-list">
          {loading && threads.length === 0 ? (
            <div className="la-rail-empty">
              <Loader size={16} className="la-spin" />
              <span>Loading…</span>
            </div>
          ) : threads.length === 0 ? (
            // A failed read is not "no conversations": the alert above says what happened.
            error ? null : (
            <div className="la-rail-empty">
              <MessageSquare size={16} />
              {/* Honest about WHY it's empty — "no conversations" reads like a failure. */}
              <span>Your conversations will appear here once you ask something.</span>
            </div>
            )
          ) : (
            threads.map(thread => {
              const isActive = thread.id === activeThreadId
              const isConfirming = thread.id === confirmingId
              return (
                <div
                  key={thread.id}
                  className={`la-rail-item${isActive ? ' la-rail-item-active' : ''}`}
                >
                  <button
                    type="button"
                    className="la-rail-item-main"
                    onClick={() => onSelect(thread.id)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    {/* A thread gets a title from its first question, so an untitled row is a
                        real state. Not "New conversation": that is the button above. */}
                    <span className="la-rail-item-title">
                      {thread.title || 'Untitled conversation'}
                    </span>
                    <span className="la-rail-item-time">{relativeTime(thread.updated_at)}</span>
                  </button>

                  {isActive && !isConfirming && (
                    <span className="la-rail-item-state">Open</span>
                  )}

                  {isConfirming ? (
                    <div className="la-rail-confirm">
                      <button
                        type="button"
                        className="la-rail-confirm-yes"
                        onClick={() => {
                          setConfirmingId(null)
                          onDelete(thread.id)
                        }}
                        aria-label={`Confirm delete ${thread.title || 'untitled conversation'}`}
                      >
                        Delete?
                      </button>
                      <button
                        type="button"
                        className="la-rail-confirm-no"
                        onClick={() => setConfirmingId(null)}
                        aria-label="Cancel delete"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="la-rail-item-delete"
                      onClick={() => setConfirmingId(thread.id)}
                      title="Delete conversation"
                      aria-label={`Delete ${thread.title || 'untitled conversation'}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Under the list, outside its scroll, so it is always in reach. */}
        {onViewAll && threads.length > 0 && (
          <button type="button" className="la-rail-view-all" onClick={onViewAll}>
            View all conversations
          </button>
        )}
      </div>
    </>
  )
}

export default ThreadRail
