/**
 * ⌘K palette: available on every page, same engine as the Search page
 * (services/searchEngine.ts). Finds meetings (with the moment), decisions,
 * action items, tasks, projects, your notes and pages. Tab asks Entomate,
 * ⌘↵ opens the query on the Search page, ⌘S clips the selected result to Notes.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import { Led, Signal } from './bench'
import { Highlight } from './search/Highlight'
import { useNotes, useRecentSearches, useSearch } from '../hooks/useSearch'
import {
  GROUPS, groupCount, matchCommands, resultHref, searchPagePath, statusSignal, timecode, shortDate,
} from '../services/searchEngine'
import type { Command, Filter, GroupKey, SearchResult } from '../services/searchEngine'
import { clipFromResult, clipKey } from '../services/searchNotesService'

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onShowShortcuts?: () => void
}

type Row =
  | { kind: 'ask'; id: string }
  | { kind: 'result'; id: string; result: SearchResult; group: GroupKey }
  | { kind: 'command'; id: string; command: Command }
  | { kind: 'open'; id: string }
  | { kind: 'recent'; id: string; query: string }
  | { kind: 'shortcuts'; id: string }

const PAL_FILTERS: ReadonlyArray<{ value: Filter | 'pages'; label: string }> = [
  { value: 'all', label: 'All' },
  ...GROUPS.map((g) => ({ value: g.key as Filter, label: g.short })),
  { value: 'pages', label: 'Pages' },
]

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl+'

export default function CommandPalette({ isOpen, onClose, onShowShortcuts }: CommandPaletteProps): React.ReactPortal | null {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter | 'pages'>('all')
  const [active, setActive] = useState(0)
  const [flash, setFlash] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  const { data, loading, error } = useSearch(query, { enabled: isOpen && filter !== 'pages', limit: 4, debounceMs: 160 })
  const recent = useRecentSearches(isOpen)
  const notes = useNotes(isOpen)

  useEffect(() => {
    if (!isOpen) return undefined
    returnFocus.current = document.activeElement as HTMLElement | null
    setQuery('')
    setFilter('all')
    setActive(0)
    setFlash(null)
    const t = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => {
      window.clearTimeout(t)
      returnFocus.current?.focus?.()
    }
  }, [isOpen])

  const q = query.trim()
  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    if (!q) {
      recent.slice(0, 4).forEach((r) => out.push({ kind: 'recent', id: `recent:${r.query}`, query: r.query }))
      matchCommands('', 6).forEach((c) => out.push({ kind: 'command', id: c.id, command: c }))
      out.push({ kind: 'shortcuts', id: 'shortcuts' })
      return out
    }
    if (filter !== 'pages') {
      out.push({ kind: 'ask', id: 'ask' })
      for (const g of GROUPS) {
        if (filter !== 'all' && filter !== g.key) continue
        for (const r of data?.groups[g.key] || []) out.push({ kind: 'result', id: `${r.type}:${r.id}`, result: r, group: g.key })
      }
    }
    if (filter === 'all' || filter === 'pages') {
      matchCommands(q, filter === 'pages' ? 10 : 3).forEach((c) => out.push({ kind: 'command', id: c.id, command: c }))
    }
    if (filter !== 'pages') out.push({ kind: 'open', id: 'open' })
    return out
  }, [q, filter, data, recent])

  useEffect(() => { setActive(0) }, [q, filter])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  if (!isOpen) return null

  const go = (path: string, state?: Record<string, string>) => {
    onClose()
    navigate(path, state ? { state } : undefined)
  }

  const run = (row: Row | undefined) => {
    if (!row) return
    switch (row.kind) {
      case 'ask': return go(searchPagePath(q, true))
      case 'open': return go(searchPagePath(q))
      case 'result': return go(resultHref(row.result))
      case 'command': return go(row.command.path, row.command.state)
      case 'recent': setQuery(row.query); return undefined
      case 'shortcuts': onClose(); onShowShortcuts?.(); return undefined
    }
  }

  const clip = async (row: Row | undefined) => {
    if (!row || row.kind !== 'result') return
    const n = clipFromResult(row.result, q, 'palette')
    if (notes.clipped.has(clipKey(n))) { setFlash('Already in Notes'); return }
    try {
      await notes.add(n)
      setFlash('Clipped to Notes')
    } catch {
      setFlash('Could not clip')
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, rows.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' && mod) { e.preventDefault(); go(searchPagePath(q)); return }
    if (e.key === 'Enter') { e.preventDefault(); run(rows[active]); return }
    if (e.key === 'Tab' && q && !e.shiftKey) { e.preventDefault(); go(searchPagePath(q, true)); return }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void clip(rows[active]); return }
  }

  let lastGroup = ''
  const head = (label: string, count?: number) => (
    <div className="bs-pal-group" role="presentation"><span>{label}</span>{count != null && <span>{count}</span>}</div>
  )

  const body = (
    <div className="bs-pal-wrap" onKeyDown={onKeyDown}>
      <div className="bs-pal-scrim" onClick={onClose} aria-hidden="true" />
      <div className="bs-pal" role="dialog" aria-modal="true" aria-label="Search or Ask Entomate">
        <div className="bs-pal-in">
          <SearchIcon aria-hidden="true" strokeWidth={1.6} />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="bs-pal-list"
            aria-activedescendant={rows[active] ? `bs-pal-row-${active}` : undefined}
            aria-label="Search meetings, decisions, tasks, or ask a question"
            placeholder="Search meetings, decisions, tasks, or ask…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFlash(null) }}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <span className="bs-pal-busy" aria-live="polite">Searching</span>}
          <button type="button" className="bs-tag bs-pal-esc" onClick={onClose} aria-label="Close">esc</button>
        </div>
        {q && (
          <div className="bs-pal-filters" role="group" aria-label="Show">
            {PAL_FILTERS.map((f) => (
              <button key={f.value} type="button" aria-pressed={filter === f.value} className="bs-tag" onClick={() => { setFilter(f.value); inputRef.current?.focus() }}>
                {f.label}
              </button>
            ))}
          </div>
        )}
        <div className="bs-pal-list" id="bs-pal-list" role="listbox" ref={listRef} aria-label="Results">
          {rows.map((row, i) => {
            const on = i === active
            let groupHead: React.ReactNode = null
            const g = row.kind === 'result' ? row.group : row.kind === 'command' ? 'cmd' : row.kind === 'recent' ? 'recent' : row.kind
            if (g !== lastGroup) {
              lastGroup = g
              if (row.kind === 'result') groupHead = head(GROUPS.find((x) => x.key === row.group)?.label || '', groupCount(data, row.group))
              else if (row.kind === 'command') groupHead = head('Go to')
              else if (row.kind === 'recent') groupHead = head('Recent')
              else if (row.kind === 'ask') groupHead = head('Ask')
            }
            return (
              <React.Fragment key={row.id}>
                {groupHead}
                <div
                  id={`bs-pal-row-${i}`}
                  data-row={i}
                  role="option"
                  aria-selected={on}
                  className={`bs-pal-row${on ? ' on' : ''}`}
                  onMouseMove={() => { if (!on) setActive(i) }}
                  onClick={() => run(row)}
                >
                  <PaletteRow row={row} q={q} />
                </div>
              </React.Fragment>
            )
          })}
          {q && !loading && data && data.total === 0 && filter !== 'pages' && (
            <p className="bs-pal-empty">Nothing matches “{q}”. Press Tab to ask Entomate instead.</p>
          )}
          {error && <p className="bs-pal-empty">Search is unavailable right now. Pages still work.</p>}
        </div>
        <div className="bs-pal-foot" aria-hidden="true">
          {flash ? <span className="bs-pal-flash"><Led tone="mint" /> {flash}</span> : (
            <>
              <span><kbd>↑↓</kbd>move</span><span><kbd>↵</kbd>open</span><span><kbd>Tab</kbd>ask</span>
              <span><kbd>{MOD}S</kbd>clip to notes</span><span><kbd>{MOD}↵</kbd>open in Search</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
  return createPortal(body, document.body)
}

function PaletteRow({ row, q }: { row: Row; q: string }): React.ReactElement {
  switch (row.kind) {
    case 'ask':
      return (
        <>
          <div className="bs-pal-main"><div className="bs-pal-t"><Led tone="ai" /><span>Ask Entomate about “{q}”</span></div><div className="bs-pal-s">Answers with sources from your meetings</div></div>
          <span className="bs-pal-m">Tab</span>
        </>
      )
    case 'open':
      return (
        <>
          <div className="bs-pal-main"><div className="bs-pal-t"><span>Open “{q}” in Search</span></div><div className="bs-pal-s">Every result, the answer and your notes</div></div>
          <span className="bs-pal-m">{MOD}↵</span>
        </>
      )
    case 'recent':
      return <><div className="bs-pal-main"><div className="bs-pal-t"><span>{row.query}</span></div></div><span className="bs-pal-m">Search</span></>
    case 'shortcuts':
      return <><div className="bs-pal-main"><div className="bs-pal-t"><span>Keyboard shortcuts</span></div></div><span className="bs-pal-m">?</span></>
    case 'command':
      return <><div className="bs-pal-main"><div className="bs-pal-t"><span>{row.command.label}</span></div></div><span className="bs-pal-m">{row.command.shortcut || row.command.hint}</span></>
    case 'result': {
      const r = row.result
      const tc = timecode(r.meta.atMs)
      const sig = statusSignal(r)
      return (
        <>
          <div className="bs-pal-main">
            <div className="bs-pal-t">{r.type === 'decision' && <span className="bs-tick" aria-label="Decision" />}<span><Highlight text={r.title} hits={r.titleHits} /></span></div>
            {r.snippet && r.type !== 'decision' && <div className="bs-pal-s"><Highlight text={r.snippet} hits={r.snippetHits} /></div>}
          </div>
          <span className="bs-pal-m">
            {sig ? <Signal tone={sig.tone}>{sig.word}</Signal> : (
              <>{r.type === 'meeting' && <span className="bs-dt">{shortDate(r.meta.date)}{tc ? ' · ' : ''}</span>}{tc ? `▶ ${tc}` : r.type === 'note' || r.type === 'meeting_note' ? 'Note' : ''}</>
            )}
          </span>
        </>
      )
    }
  }
}
