/**
 * EAI-02c slice 3, ported from LV `AnswerRecordLinks` (PR-2333): record buttons under an answer,
 * built from the meetings and projects the read tools returned and the answer names. Each saved
 * link is checked again here and fails closed: an unknown kind or a non-uuid id gets no button.
 * Tasks have no detail page in Entomate, so the backend never sends one.
 */
import React from 'react'

export interface AnswerRecordLink {
  kind: string
  id: string
  label: string
}

const RECORD_PATHS: Record<string, string> = { meeting: '/meetings', project: '/projects' }
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The page a saved link opens, or null when it cannot be opened. */
export function recordLinkPath(link: unknown): string | null {
  const { kind, id } = (link && typeof link === 'object' ? link : {}) as { kind?: unknown; id?: unknown }
  if (typeof kind !== 'string' || typeof id !== 'string') return null
  const base = Object.prototype.hasOwnProperty.call(RECORD_PATHS, kind) ? RECORD_PATHS[kind] : null
  return base && UUID_PATTERN.test(id) ? `${base}/${id}` : null
}

interface AnswerRecordLinksProps {
  links: AnswerRecordLink[] | undefined
  onOpen: (path: string) => void
}

export default function AnswerRecordLinks({ links, onOpen }: AnswerRecordLinksProps) {
  const records = (Array.isArray(links) ? links : []).flatMap((link) => {
    const path = recordLinkPath(link)
    return path && typeof link.label === 'string' && link.label.trim() ? [{ path, label: link.label }] : []
  })
  if (records.length === 0) return null
  return (
    <div className="la-answer-records" role="group" aria-label="Records in this answer">
      {records.map((r) => (
        <button
          key={r.path}
          type="button"
          className="la-record-link"
          onClick={() => onOpen(r.path)}
          aria-label={`Open ${r.label}`}
          title="Open record"
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
