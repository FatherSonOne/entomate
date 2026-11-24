/**
 * ⌘K palette: available on every page, same engine as the Search page
 * (services/searchEngine.ts). Finds meetings (with the moment), decisions,
 * action items, tasks, projects, your notes and pages. Tab asks Entomate,
 * ⌘↵ opens the query on the Search page, ⌘S clips the selected result to Notes.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon, X } from 'lucide-react'
import { shortcutLabel } from '../hooks/useNavigationShortcuts'
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
  toolbar?: boolean
  onOpen?: () => void
  isAdmin?: boolean
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

export default function CommandPalette({ isOpen, onClose, onShowShortcuts, toolbar = false, onOpen, isAdmin = false }: CommandPaletteProps): React.ReactElement | React.ReactPortal | null {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [present, setPresent] = useState(isOpen)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const commandMode = query.startsWith('>')
  const searchQuery = query.replace(/^>/, '').trim()
  const [filter, setFilter] = useState<Filter | 'pages'>('all')
  const [active, setActive] = useState(0)
  const [flash, setFlash] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  const { data, loading, error } = useSearch(searchQuery, { enabled: isOpen && !commandMode && filter !== 'pages', limit: 4, debounceMs: 160 })
  const recent = useRecentSearches(isOpen)
  const notes = useNotes(isOpen)

  useEffect(() => {
    if (!isOpen) return undefined
    returnFocus.current = document.activeElement as HTMLElement | null
    setFilter('all')
    setActive(0)
    setFlash(null)
    const t = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => {
      window.clearTimeout(t)
      if (!toolbar) returnFocus.current?.focus?.()
    }
  }, [isOpen, toolbar])

  useEffect(() => {
    if (isOpen) { setPresent(true); return }
    const timer = window.setTimeout(() => { setPresent(false); setQuery('') }, 180)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !toolbar) return
    const outside = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [isOpen, toolbar, onClose])

  useLayoutEffect(() => {
    if (!toolbar || !isOpen) return
    const place = () => {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(680, window.innerWidth - 32)
      setPanelStyle({ position: 'fixed', top: rect.bottom + 8, left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)), width, maxHeight: Math.max(120, (window.visualViewport?.height ?? window.innerHeight) - rect.bottom - 24) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
    }
  }, [toolbar, isOpen])

  const q = searchQuery
  const showingCommands = commandMode || filter === 'pages'
  const matches = useMemo(() => matchCommands(q, 30, isAdmin), [q, isAdmin])
  const firstRecord = !showingCommands ? GROUPS.filter(g => filter === 'all' || filter === g.key).flatMap(g => data?.groups[g.key] || [])[0] : undefined
  const bestCommand = filter === 'all' || showingCommands ? matches[0] : undefined
  const prediction = q ? bestCommand?.label.replace(/^Go to /, '') || firstRecord?.title || (!showingCommands ? recent.find(r => r.query.toLowerCase().startsWith(q.toLowerCase()))?.query : undefined) : undefined
  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    if (!q) {
      if (!showingCommands) recent.slice(0, 4).forEach((r) => out.push({ kind: 'recent', id: `recent:${r.query}`, query: r.query }))
      matches.forEach((c) => out.push({ kind: 'command', id: c.id, command: c }))
      out.push({ kind: 'shortcuts', id: 'shortcuts' })
      return out
    }
    if (filter === 'all' || showingCommands) {
      matches.forEach((c) => out.push({ kind: 'command', id: c.id, command: c }))
    }
    if (!showingCommands) {
      for (const g of GROUPS) {
        if (filter !== 'all' && filter !== g.key) continue
        for (const r of data?.groups[g.key] || []) out.push({ kind: 'result', id: `${r.type}:${r.id}`, result: r, group: g.key })
      }
      out.push({ kind: 'ask', id: 'ask' })
    }
    if (!showingCommands) out.push({ kind: 'open', id: 'open' })
    return out
  }, [q, filter, data, recent, matches, showingCommands])

  useEffect(() => { setActive(0) }, [q, filter])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active])


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
    if (!isOpen || e.nativeEvent.isComposing) return
    const mod = e.metaKey || e.ctrlKey
    if (e.key === 'Escape') { e.preventDefault(); onClose(); inputRef.current?.blur(); return }
    if (e.target instanceof HTMLButtonElement) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, rows.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter' && mod) { e.preventDefault(); go(searchPagePath(q)); return }
    if (e.key === 'ArrowRight' && prediction && e.target === inputRef.current && inputRef.current?.selectionStart === query.length && inputRef.current?.selectionEnd === query.length) { e.preventDefault(); setQuery((commandMode ? '>' : '') + prediction); return }
    if (e.key === 'Home' && e.target === inputRef.current && !query) { e.preventDefault(); setActive(0); return }
    if (e.key === 'End' && e.target === inputRef.current && !query) { e.preventDefault(); setActive(rows.length - 1); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      // Completion starts a fresh record search. Do not turn a quick Enter into
      // an AI question just because the result rows have not arrived yet.
      if (loading && rows[active]?.kind === 'ask') return
      run(rows[active])
      return
    }
    if (e.key === 'Tab' && q && !showingCommands && !e.shiftKey && !mod && !e.altKey) { e.preventDefault(); go(searchPagePath(q, true)); return }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void clip(rows[active]); return }
  }

  let lastGroup = ''
  const head = (label: string, count?: number) => (
    <div className="bs-pal-group" role="presentation"><span>{label}</span>{count != null && <span>{count}</span>}</div>
  )

  const searchKey = isOpen ? 'Esc' : `${MOD}K`
  const searchAction = isOpen ? 'Close search' : 'Open search'
  const input = (
    <div className="bs-pal-in">
      <SearchIcon aria-hidden="true" strokeWidth={1.6} />
      <input ref={inputRef} type="text" role="combobox" aria-expanded={isOpen}
        aria-controls={isOpen ? 'bs-pal-list' : undefined}
        aria-activedescendant={isOpen && rows[active] ? `bs-pal-row-${active}` : undefined}
        aria-autocomplete="list" aria-label="Search or run a command"
        placeholder={commandMode ? 'Type a command...' : 'Search or run a command...'}
        value={query} onFocus={() => { if (!isOpen) onOpen?.() }}
        onChange={(e) => { if (!isOpen) onOpen?.(); setQuery(e.target.value); setFlash(null) }} autoComplete="off" spellCheck={false} />
      {query && <button type="button" className="bs-pal-clear" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus() }}><X aria-hidden="true" /></button>}
      <button type="button" className="bs-tag bs-pal-esc" onClick={() => isOpen ? onClose() : onOpen?.()} aria-label={`${searchAction}, ${searchKey}`}>{searchKey}</button>
    </div>
  )

  const panel = (
    <div ref={(el) => { if (el) el.inert = !isOpen }} className={toolbar ? 'bs-pal bs-pal-toolbar' : 'bs-pal-wrap'} style={toolbar ? panelStyle : undefined} data-open={isOpen} aria-hidden={!isOpen} onKeyDown={toolbar ? undefined : onKeyDown}>
      {!toolbar && <div className="bs-pal-scrim" onClick={onClose} aria-hidden="true" />}
      <div className={toolbar ? 'bs-pal-content' : 'bs-pal'} role={toolbar ? undefined : 'dialog'} aria-modal={toolbar ? undefined : true} aria-label="Search or Ask Entomate">
        {!toolbar && input}
        {(
          <div className="bs-pal-filters" role="group" aria-label="Show">
            {PAL_FILTERS.map((f) => (
              <button key={f.value} type="button" aria-pressed={(commandMode ? 'pages' : filter) === f.value} className="bs-tag" onClick={() => { setFilter(f.value); if (commandMode) setQuery(q); inputRef.current?.focus() }}>
                {f.value === 'pages' ? 'Commands' : f.label}
              </button>
            ))}
          </div>
        )}
        {prediction && <button type="button" className="bs-pal-predict" onClick={() => { setQuery((commandMode ? '>' : '') + prediction); inputRef.current?.focus() }}>Best match · {prediction}<kbd>→ complete</kbd></button>}
        {loading && !showingCommands && <div className="bs-pal-empty" role="status">Searching workspace...</div>}
        <div className="bs-pal-list" id="bs-pal-list" role="listbox" ref={listRef} aria-label="Results">
          {rows.map((row, i) => {
            const on = i === active
            let groupHead: React.ReactNode = null
            const g = row.kind === 'result' ? row.group : row.kind === 'command' ? 'cmd' : row.kind === 'recent' ? 'recent' : row.kind
            if (g !== lastGroup) {
              lastGroup = g
              if (row.kind === 'result') groupHead = head(GROUPS.find((x) => x.key === row.group)?.label || '', groupCount(data, row.group))
              else if (row.kind === 'command') groupHead = head(q ? 'Best matches' : 'Pages & actions')
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
          {q && !loading && data && data.total === 0 && !matches.length && !showingCommands && (
            <p className="bs-pal-empty">Nothing matches “{q}”. Press Tab to ask Entomate instead.</p>
          )}
          {error && !showingCommands && <p className="bs-pal-empty">Search is unavailable right now. Pages still work.</p>}
          {q && showingCommands && !matches.length && <p className="bs-pal-empty">No close commands. Try another name or choose All to search the workspace.</p>}
        </div>
        <div className="bs-pal-foot" role="status">
          {flash ? <span className="bs-pal-flash"><Led tone="mint" /> {flash}</span> : (
            <>
              <span><kbd>↑↓</kbd>move</span><span><kbd>↵</kbd>open</span>
              {prediction && <span><kbd>→</kbd>complete</span>}
              {!showingCommands && <span><kbd>Tab</kbd>ask</span>}
              <span><kbd>&gt;</kbd>commands</span><span><kbd>Esc</kbd>close</span>
              {rows[active]?.kind === 'result' && <span><kbd>{MOD}S</kbd>clip to notes</span>}
              <span><kbd>{MOD}↵</kbd>open in Search</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
  if (toolbar) return <div ref={wrapRef} className="bs-command-search" onKeyDown={onKeyDown} onBlur={(e) => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) onClose() }}>
    {input}{present && panel}
  </div>
  return present ? createPortal(panel, document.body) : null
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
      return <><div className="bs-pal-main"><div className="bs-pal-t"><span>{row.command.label}</span></div></div><span className="bs-pal-m">{row.command.shortcut ? shortcutLabel(row.command.shortcut) : row.command.hint}</span></>
    case 'result': {
      const r = row.result
      const tc = timecode(r.meta.atMs)
      const sig = statusSignal(r)
      return (
        <>
          <div className="bs-pal-main">
            <div className="bs-pal-t">{r.type === 'decision' && <span className="bs-tick" aria-label="Decision" />}<span><Highlight text={r.title} hits={r.titleHits} /></span></div>
            {r.snippet && r.type !== 'decision' && <div className="bs-pal-s"><Highlight text={r.snippet} hits={r.snippetHits} /></div>}
            {r.meta.spellingMatch && <div className="bs-pal-s">Closest spelling</div>}
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
