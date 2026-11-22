/**
 * Why an action item has the priority, due date and owner it has: the reason and
 * confidence each agent gave after the meeting was processed (action_items.agent_notes,
 * written by backend/services/meetingEvents.js).
 *
 * Collapsed by default so the list stays scannable. Renders nothing for items the
 * agents never reviewed. "Applied" means the agent changed the item; "Suggested"
 * means it held back (low confidence, or someone had already set the value).
 */

import React from 'react'

export interface AgentNote {
  recommended: string | null
  reason?: string | null
  confidence?: number | null
  applied: boolean
}

export interface AgentNotesValue {
  reviewed_at?: string
  priority?: AgentNote
  deadline?: AgentNote
  assignment?: AgentNote
}

const LABELS: Record<'priority' | 'deadline' | 'assignment', string> = {
  priority: 'Priority',
  deadline: 'Due date',
  assignment: 'Owner'
}

function formatValue(kind: keyof typeof LABELS, value: string | null): string {
  if (!value) return 'none'
  if (kind === 'deadline' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString()
  }
  return value
}

export interface AgentNotesProps {
  notes: AgentNotesValue | null | undefined
}

export function AgentNotes({ notes }: AgentNotesProps): React.ReactElement | null {
  if (!notes || typeof notes !== 'object') return null
  const rows = (Object.keys(LABELS) as Array<keyof typeof LABELS>)
    .map(kind => ({ kind, note: notes[kind] }))
    .filter((r): r is { kind: keyof typeof LABELS; note: AgentNote } => Boolean(r.note && (r.note.recommended || r.note.reason)))
  if (rows.length === 0) return null

  const appliedCount = rows.filter(r => r.note.applied).length

  return (
    <details className="group mt-1.5 text-xs">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded text-content-tertiary hover:text-content-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-tertiary">
        <span aria-hidden="true" className="h-1.5 w-1.5 bg-accent-tertiary" />
        <span>
          Why{appliedCount > 0 ? ` · agents set ${appliedCount}` : ' · agent suggestions'}
        </span>
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
      </summary>
      <dl className="mt-1.5 space-y-1 border-l border-accent-tertiary pl-3">
        {rows.map(({ kind, note }) => (
          <div key={kind}>
            <dt className="flex flex-wrap items-baseline gap-x-2 text-content-secondary">
              <span className="font-medium">{LABELS[kind]}: {formatValue(kind, note.recommended)}</span>
              {typeof note.confidence === 'number' && (
                <span className="font-mono tabular-nums text-content-tertiary">
                  {Math.round(note.confidence * 100)}%
                </span>
              )}
              <span className={note.applied ? 'text-accent-tertiary' : 'text-content-tertiary'}>
                {note.applied ? 'Applied' : 'Suggested'}
              </span>
            </dt>
            {note.reason && <dd className="text-content-tertiary">{note.reason}</dd>}
          </div>
        ))}
      </dl>
    </details>
  )
}

export default AgentNotes
