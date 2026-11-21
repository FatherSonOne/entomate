/**
 * Transcript panel: timed, per-speaker lines with search and speaker rename.
 * Ported from Logos Vision `NotetakerPlaybackPanel.tsx` (search moments, speaker lanes)
 * and the "Check speakers" step, without media playback: Recall's recording link is
 * pre-signed and expires, so there is nothing reliable to play yet.
 *
 * Search marks every match and steps through them; the current one scrolls into view.
 * Renaming a speaker changes every line they spoke, on the server, so search, Ask and
 * recaps see the new name too.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Loader2, Pencil, Search, X } from 'lucide-react'
import {
  formatClock,
  matchingLines,
  renameSpeaker,
  speakersOf,
  type RenameResult,
  type TranscriptSegment,
} from '../../services/meetingTranscriptService'

export interface TranscriptPanelProps {
  meetingId: string
  segments: TranscriptSegment[]
  /** Called with the server's copy after a rename, so the page can update its meeting. */
  onRenamed?: (result: RenameResult) => void
  /**
   * Jump to the line being spoken at this moment (ms from the start). For decision and
   * action-item timecodes elsewhere on the page; a new value scrolls and marks the line.
   */
  focusAtMs?: number | null
}

/** Index of the line being spoken at `atMs`: the last one that started at or before it. */
export function lineAt(lines: TranscriptSegment[], atMs: number): number {
  let found = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.atMs <= atMs) found = i
    else break
  }
  return found === -1 ? 0 : found
}

const MAX_SPEAKER_NAME = 120

const INPUT =
  'w-full rounded-lg border border-line bg-surface-elevated px-3 py-1.5 text-sm text-content-primary ' +
  'placeholder:text-content-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary'
const ICON_BUTTON =
  'inline-flex min-h-8 min-w-8 items-center justify-center rounded text-content-secondary hover:text-content-primary ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:opacity-40'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function Highlighted({ text, query }: { text: string; query: string }): React.ReactElement {
  const q = query.trim()
  if (!q) return <>{text}</>
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'ig'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-accent-primary-dim px-0.5 text-content-primary underline decoration-accent-primary decoration-2 underline-offset-2">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}

export function TranscriptPanel({ meetingId, segments, onRenamed, focusAtMs }: TranscriptPanelProps): React.ReactElement {
  const [lines, setLines] = useState<TranscriptSegment[]>(segments)
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState(0)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lineRefs = useRef<Array<HTMLLIElement | null>>([])

  useEffect(() => setLines(segments), [segments])

  const speakers = useMemo(() => speakersOf(lines), [lines])
  const hits = useMemo(() => matchingLines(lines, query), [lines, query])
  const focusLine =
    typeof focusAtMs === 'number' && Number.isFinite(focusAtMs) && lines.length ? lineAt(lines, focusAtMs) : undefined
  // A search in progress wins; otherwise the line a timecode jumped to is the active one.
  const activeLine = hits.length ? hits[Math.min(current, hits.length - 1)] : query.trim() ? undefined : focusLine

  // A new query starts at its first match.
  useEffect(() => setCurrent(0), [query])

  useEffect(() => {
    if (activeLine === undefined) return
    lineRefs.current[activeLine]?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [activeLine])

  const step = (delta: number): void => {
    if (!hits.length) return
    setCurrent((c) => (c + delta + hits.length) % hits.length)
  }

  const startRename = (name: string): void => {
    setRenaming(name)
    setNewName(name)
    setError(null)
  }

  const submitRename = async (): Promise<void> => {
    if (!renaming || saving) return
    const to = newName.trim()
    if (!to || to === renaming) {
      setRenaming(null)
      return
    }
    if (/[\r\n:]/.test(to)) {
      setError('A speaker name cannot contain a colon.')
      return
    }
    setSaving(true)
    setError(null)
    const { result, error: reason } = await renameSpeaker(meetingId, renaming, to)
    setSaving(false)
    if (!result) {
      setError(reason)
      return
    }
    setLines(result.segments)
    setRenaming(null)
    onRenamed?.(result)
  }

  return (
    <div data-testid="transcript-panel">
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-secondary" aria-hidden="true" />
          <label htmlFor="transcript-search" className="sr-only">
            Search transcript
          </label>
          <input
            id="transcript-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                step(e.shiftKey ? -1 : 1)
              }
            }}
            placeholder="Search transcript"
            className={`${INPUT} pl-8`}
          />
        </div>
        {query.trim() && (
          <div className="flex items-center gap-0.5">
            <span aria-live="polite" className="min-w-16 text-right text-xs tabular-nums text-content-secondary">
              {hits.length ? `${Math.min(current, hits.length - 1) + 1} of ${hits.length}` : 'No matches'}
            </span>
            <button type="button" aria-label="Previous match" onClick={() => step(-1)} disabled={!hits.length} className={ICON_BUTTON}>
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Next match" onClick={() => step(1)} disabled={!hits.length} className={ICON_BUTTON}>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="mb-3">
        <h3 className="mb-1.5 text-xs font-medium text-content-secondary">Speakers</h3>
        <ul className="flex flex-wrap gap-1.5">
          {speakers.map((s) => (
            <li key={s.name}>
              {renaming === s.name ? (
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submitRename()
                  }}
                >
                  <label htmlFor="speaker-rename" className="sr-only">
                    New name for {s.name}
                  </label>
                  <input
                    id="speaker-rename"
                    autoFocus
                    maxLength={MAX_SPEAKER_NAME}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    className={`${INPUT} w-44 py-1`}
                  />
                  <button type="submit" aria-label="Save name" disabled={saving} className={ICON_BUTTON}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                  </button>
                  <button type="button" aria-label="Cancel rename" onClick={() => setRenaming(null)} className={ICON_BUTTON}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => startRename(s.name)}
                  aria-label={`Rename ${s.name}`}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-content-primary hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                >
                  {s.name}
                  <span className="tabular-nums text-content-secondary">{s.lines}</span>
                  <Pencil className="h-3 w-3 text-content-secondary" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-semantic-error">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {error}
          </p>
        )}
      </div>

      <ol className="max-h-96 space-y-2 overflow-y-auto rounded-lg bg-surface-elevated p-3 scrollbar-thin" aria-label="Transcript">
        {lines.map((line, i) => (
          <li
            key={`${line.atMs}-${i}`}
            ref={(el) => {
              lineRefs.current[i] = el
            }}
            data-testid="transcript-line"
            data-at-ms={line.atMs}
            aria-current={i === activeLine ? 'true' : undefined}
            className={`grid grid-cols-[3.5rem_1fr] gap-x-3 rounded px-1.5 py-1 text-sm ${
              i === activeLine ? 'ring-2 ring-accent-primary' : ''
            }`}
          >
            <span className="pt-px text-xs tabular-nums text-content-secondary">{formatClock(line.atMs)}</span>
            <p className="text-content-secondary">
              <span className="font-medium text-content-primary">
                <Highlighted text={line.speaker} query={query} />
              </span>{' '}
              <Highlighted text={line.text} query={query} />
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default TranscriptPanel
