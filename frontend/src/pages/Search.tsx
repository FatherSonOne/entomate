/**
 * Search (route /search): the full-page twin of the ⌘K palette. Same engine
 * (services/searchEngine.ts, POST /api/search/everything), plus the detail the
 * palette has no room for (the words that matched, the moment, the agent's call),
 * Ask Entomate with sources, and Notes: a private column of clips and typed notes.
 *
 * Direction A "Bench" from the Search Slate pass (2026-11-22). Results take 8
 * columns, Notes take 4; on phone Notes open in a sheet from the title.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import {
  Cell, Drawer, GroupHead, Grid, Key, Section, Signal, Switch, Tag, TextArea, TextInput, TitleRule, useMediaQuery, PHONE_QUERY,
} from '../components/bench'
import { Highlight } from '../components/search/Highlight'
import { useToast } from '../components/vc/ToastProvider'
import { useNotes, useRecentSearches, useSearch } from '../hooks/useSearch'
import type { UseNotesResult } from '../hooks/useSearch'
import { searchApi } from '../services/api'
import {
  GROUPS, groupCount, isQuestion, matchCommands, metaLine, readUrlState, resultHref, searchEverything,
  shortDate, statusSignal, timecode, writeUrlState,
} from '../services/searchEngine'
import type { Filter, SearchResponse, SearchResult } from '../services/searchEngine'
import {
  clipFromResult, clipKey, kindLabel, noteHref, notesToMarkdown, originLabel, sourceLine,
} from '../services/searchNotesService'
import type { NewNote, SearchNote } from '../services/searchNotesService'

interface ToastApi {
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
}

const MIN_QUERY = 2

export default function Search(): React.ReactElement {
  const toast = useToast() as ToastApi
  const navigate = useNavigate()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [params, setParams] = useSearchParams()
  const url = readUrlState(params)
  const [draft, setDraft] = useState(url.q)
  const [recentKey, setRecentKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const setUrl = useCallback((next: Parameters<typeof writeUrlState>[1]) => {
    setParams((prev) => writeUrlState(prev, next), { replace: true })
  }, [setParams])

  const q = url.q.trim()
  const { data, loading, error, settledQuery } = useSearch(q, { limit: 25, debounceMs: 220 })
  const recent = useRecentSearches(true, recentKey)
  const notes = useNotes(true)

  // Keep the field in step when the URL changes from outside (palette ⌘↵, back button).
  useEffect(() => { setDraft(url.q) }, [url.q])

  // Arriving with a query (from the palette) counts as a search for history.
  const logged = useRef<string>('')
  const logQuery = useCallback((query: string) => {
    const t = query.trim()
    if (t.length < MIN_QUERY || logged.current === t) return
    logged.current = t
    searchEverything(t, { limit: 1, log: true }).then(() => setRecentKey((k) => k + 1)).catch(() => undefined)
  }, [])
  useEffect(() => { if (q) logQuery(q) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // "/" focuses the field, as before.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName || ''
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const onType = (value: string) => {
    setDraft(value)
    setUrl({ q: value, ask: false })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = draft.trim()
    if (!t) return
    logQuery(t)
    if (isQuestion(t)) setUrl({ q: t, ask: true })
  }

  const ask = () => {
    const t = draft.trim()
    if (!t) { inputRef.current?.focus(); return }
    logQuery(t)
    setUrl({ q: t, ask: true })
  }

  const clip = useCallback(async (note: NewNote) => {
    if (notes.clipped.has(clipKey(note))) return
    try {
      await notes.add(note)
    } catch {
      toast.error('Could not clip', 'Notes are not available right now.')
    }
  }, [notes, toast])

  const total = data && settledQuery === q ? data.total : 0
  const meta = q
    ? <><b>{loading && !data ? 'Searching' : `${total} result${total === 1 ? '' : 's'}`}</b> · “{q}”</>
    : <><b>Search</b> · meetings, decisions, tasks and your notes</>

  return (
    <>
      <TitleRule
        title="Search"
        meta={meta}
        actions={(
          <>
            <Key className="bs-ph-only" onClick={() => setUrl({ notes: true })} kbd={String(notes.notes.length)}>Notes</Key>
            <Key variant="primary" onClick={ask}>Ask Entomate</Key>
          </>
        )}
      />

      <form className="bs-srch-q" role="search" onSubmit={onSubmit}>
        <TextInput
          ref={inputRef}
          icon={<SearchIcon strokeWidth={1.6} />}
          value={draft}
          onChange={(e) => onType(e.target.value)}
          placeholder="Search meetings, decisions, tasks, or ask a question"
          aria-label="Search meetings, decisions, tasks, or ask a question"
          autoFocus={!q && !isPhone}
          autoComplete="off"
          spellCheck={false}
        />
      </form>
      <EngineLine data={data} />

      <Grid className="bs-srch-grid">
        <Cell span={8} className="bs-srch-main">
          {q.length >= MIN_QUERY ? (
            <>
              <FilterSwitch data={data} value={url.filter} onChange={(f) => setUrl({ filter: f })} />
              {url.ask && url.filter === 'all' && <AskAnswer key={q} question={q} onClip={clip} clipped={notes.clipped} />}
              <Results
                data={settledQuery === q ? data : null}
                loading={loading}
                error={error}
                filter={url.filter}
                q={q}
                clipped={notes.clipped}
                onClip={(r) => clip(clipFromResult(r, q, 'search'))}
                onOpen={(r) => navigate(resultHref(r))}
                onAsk={ask}
              />
            </>
          ) : (
            <EmptyState recent={recent} onPick={(t) => { setDraft(t); setUrl({ q: t }); logQuery(t) }} />
          )}
        </Cell>
        <Cell span={4} rule desktopOnly className="bs-srch-side">
          <NotesPanel notes={notes} onClipError={() => toast.error('Could not save the note')} />
          {q && recent.length > 0 && (
            <div className="bs-srch-side-sec">
              <Section level={3} title="Recent" />
              <RecentList recent={recent} onPick={(t) => { setDraft(t); setUrl({ q: t }); logQuery(t) }} />
            </div>
          )}
        </Cell>
      </Grid>

      <Drawer open={isPhone && url.notes} onClose={() => setUrl({ notes: false })} label="Notes">
        <NotesPanel notes={notes} onClipError={() => toast.error('Could not save the note')} />
      </Drawer>
    </>
  )
}

function EngineLine({ data }: { data: SearchResponse | null }): React.ReactElement {
  const meaning = data?.engine === 'words+meaning'
  return (
    <p className="bs-srch-engine">
      <Signal tone={meaning ? 'live' : 'off'}>{meaning ? 'Words and meaning' : 'Matching words'}</Signal>
      <span>{meaning ? 'Meetings found by meaning are marked.' : 'Transcripts, decisions, items, tasks, projects and notes.'}</span>
      {!meaning && <span className="bs-dt">Meaning search turns on once meetings are indexed.</span>}
      <span className="bs-dt">Press ⌘K anywhere for the same search.</span>
    </p>
  )
}

function FilterSwitch({ data, value, onChange }: { data: SearchResponse | null; value: Filter; onChange: (f: Filter) => void }): React.ReactElement {
  const options = [
    { value: 'all' as Filter, label: <>All <span className="bs-srch-n">{data?.total ?? ''}</span></> },
    ...GROUPS.map((g) => ({ value: g.key as Filter, label: <>{g.short} <span className="bs-srch-n">{data ? groupCount(data, g.key) : ''}</span></> })),
  ]
  return <div className="bs-srch-filter"><Switch label="Show" options={options} value={value} onChange={onChange} /></div>
}

interface ResultsProps {
  data: SearchResponse | null
  loading: boolean
  error: string | null
  filter: Filter
  q: string
  clipped: Set<string>
  onClip: (r: SearchResult) => void
  onOpen: (r: SearchResult) => void
  onAsk: () => void
}

function Results({ data, loading, error, filter, q, clipped, onClip, onOpen, onAsk }: ResultsProps): React.ReactElement {
  if (error) return <p className="bs-srch-empty">Search is unavailable right now. Try again in a moment.</p>
  if (!data) return <p className="bs-srch-empty" aria-live="polite">{loading ? 'Searching…' : ''}</p>
  const groups = GROUPS.filter((g) => (filter === 'all' || filter === g.key) && (data.groups[g.key] || []).length > 0)
  const commands = filter === 'all' ? matchCommands(q, 3) : []
  if (!groups.length && !commands.length) {
    return (
      <div className="bs-srch-empty">
        <p>Nothing matches “{q}”{filter !== 'all' ? ' in this filter' : ''}.</p>
        <Key size="sm" onClick={onAsk}>Ask Entomate instead</Key>
      </div>
    )
  }
  return (
    <div aria-live="polite">
      {groups.map((g) => {
        const rows = data.groups[g.key] || []
        const count = groupCount(data, g.key)
        return (
          <section key={g.key} className="bs-srch-group" aria-label={g.label}>
            <GroupHead label={g.label} count={count} />
            <ul className="bs-srch-list">
              {rows.map((r) => (
                <ResultRow
                  key={`${r.type}:${r.id}`}
                  r={r}
                  clipped={clipped.has(clipKey(clipFromResult(r, q, 'search')))}
                  onClip={() => onClip(r)}
                  onOpen={() => onOpen(r)}
                />
              ))}
            </ul>
            {count > rows.length && <p className="bs-srch-more">Showing {rows.length} of {count}. Narrow the search to see the rest.</p>}
          </section>
        )
      })}
      {commands.length > 0 && (
        <section className="bs-srch-group" aria-label="Pages">
          <GroupHead label="Go to" count={commands.length} />
          <ul className="bs-srch-list">
            {commands.map((c) => (
              <li key={c.id} className="bs-srch-row bs-srch-cmd">
                <Link className="bs-srch-t" to={c.path} state={c.state}>{c.label}</Link>
                <span className="bs-srch-m">{c.hint}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ResultRow({ r, clipped, onClip, onOpen }: { r: SearchResult; clipped: boolean; onClip: () => void; onOpen: () => void }): React.ReactElement {
  const tc = timecode(r.meta.atMs)
  const sig = statusSignal(r)
  const href = resultHref(r)
  const canClip = r.type !== 'note'
  return (
    <li className="bs-srch-row" onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button')) onOpen() }}>
      <div className="bs-srch-body">
        <Link className="bs-srch-t" to={href}>
          {r.type === 'decision' && <span className="bs-tick" aria-hidden="true" />}
          <span><Highlight text={r.title} hits={r.titleHits} /></span>
        </Link>
        {r.snippet && <p className="bs-srch-snip"><Highlight text={r.snippet} hits={r.snippetHits} /></p>}
        <div className="bs-srch-meta">
          {sig && <Signal tone={sig.tone}>{sig.word}</Signal>}
          <span>{metaLine(r)}</span>
          {r.meta.agent && <Tag tone="ai">{agentWord(r.meta.agent.field)} AI {r.meta.agent.confidence}%</Tag>}
        </div>
      </div>
      <div className="bs-srch-keys">
        {tc && <Key size="tc" onClick={() => onOpen()} aria-label={`Play from ${tc}`}>▶ {tc}</Key>}
        {canClip && (
          <Key size="sm" className={clipped ? 'bs-srch-clipped' : undefined} onClick={onClip} aria-pressed={clipped} aria-label={clipped ? 'In your notes' : 'Clip to notes'}>
            {clipped ? '✓ Clipped' : '+ Notes'}
          </Key>
        )}
      </div>
    </li>
  )
}

function agentWord(field: string): string {
  const f = field.toLowerCase()
  if (f.includes('owner') || f.includes('assign')) return 'Owner'
  if (f.includes('due') || f.includes('deadline')) return 'Due'
  if (f.includes('prio')) return 'Priority'
  return field.charAt(0).toUpperCase() + field.slice(1)
}

// ── Ask Entomate ──

interface Citation { type?: string; id?: string; title?: string; date?: string }

function AskAnswer({ question, onClip, clipped }: { question: string; onClip: (n: NewNote) => void; clipped: Set<string> }): React.ReactElement {
  const [text, setText] = useState('')
  const [citations, setCitations] = useState<Citation[]>([])
  const [state, setState] = useState<'asking' | 'done' | 'failed'>('asking')

  useEffect(() => {
    const controller = new AbortController()
    let streamed = ''
    const askStream = (searchApi as unknown as {
      askStream: (data: { question: string }, cb: {
        signal: AbortSignal
        onChunk: (c: string) => void
        onCitations: (c: Citation[]) => void
        onComplete: (r: { answer?: string }) => void
        onError: () => void
      }) => Promise<void>
    }).askStream
    askStream({ question }, {
      signal: controller.signal,
      onChunk: (c) => { streamed += c; setText(streamed) },
      onCitations: (c) => setCitations(Array.isArray(c) ? c : []),
      onComplete: (r) => { if (r.answer) setText(r.answer); setState('done') },
      onError: () => setState('failed'),
    }).catch((e: unknown) => {
      if ((e as { name?: string })?.name !== 'AbortError') setState('failed')
    })
    return () => controller.abort()
  }, [question])

  const meetings = citations.filter((c) => c.type === 'meeting' && c.id)
  const note: NewNote = {
    kind: 'answer', body: text.trim() || ' ', origin: 'ask', query: question,
    sourceLabel: meetings.length ? `${meetings.length} meeting${meetings.length === 1 ? '' : 's'}` : null,
  }
  const isClipped = clipped.has(clipKey(note))

  return (
    <div className="bs-srch-answer" aria-live="polite">
      <div className="bs-srch-answer-h">
        <span className="bs-lbl">Ask Entomate{meetings.length ? ` · from ${meetings.length} meeting${meetings.length === 1 ? '' : 's'}` : ''}</span>
        {state === 'done' && text.trim() && (
          <Key size="sm" onClick={() => onClip(note)} aria-pressed={isClipped} className={isClipped ? 'bs-srch-clipped' : undefined}>
            {isClipped ? '✓ Clipped' : '+ Notes'}
          </Key>
        )}
      </div>
      {state === 'failed' ? (
        <p className="bs-srch-answer-p bs-mut">Entomate couldn't answer right now. The results below still apply.</p>
      ) : (
        <p className="bs-srch-answer-p">{text || 'Reading your meetings…'}</p>
      )}
      {meetings.length > 0 && (
        <div className="bs-srch-answer-src">
          {meetings.map((c) => (
            <Link key={c.id} className="bs-tag" to={`/meetings/${c.id}`}>{c.title || 'Meeting'}{c.date ? ` · ${shortDate(c.date)}` : ''}</Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Empty state, recent ──

function EmptyState({ recent, onPick }: { recent: ReturnType<typeof useRecentSearches>; onPick: (q: string) => void }): React.ReactElement {
  return (
    <div className="bs-srch-start">
      <Section level={3} title="Recent" />
      {recent.length ? <RecentList recent={recent} onPick={onPick} /> : <p className="bs-srch-empty">Your searches show up here.</p>}
      <p className="bs-srch-tip">End with a question mark to ask across meetings. Press / to type, ⌘K from any page for the same search.</p>
    </div>
  )
}

function RecentList({ recent, onPick }: { recent: ReturnType<typeof useRecentSearches>; onPick: (q: string) => void }): React.ReactElement {
  return (
    <ul className="bs-srch-recent">
      {recent.map((r) => (
        <li key={r.query}>
          <button type="button" onClick={() => onPick(r.query)}>
            <span>{r.query}</span>
            <span className="bs-srch-m">{r.results != null ? `${r.results} result${r.results === 1 ? '' : 's'}` : ''}{r.at ? ` · ${shortDate(r.at)}` : ''}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ── Notes ──

function NotesPanel({ notes, onClipError }: { notes: UseNotesResult; onClipError: () => void }): React.ReactElement {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const add = async () => {
    const body = draft.trim()
    if (!body) return
    setSaving(true)
    try {
      await notes.add({ kind: 'note', body, origin: 'search' })
      setDraft('')
    } catch {
      onClipError()
    } finally {
      setSaving(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(notesToMarkdown(notes.notes, window.location.origin))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const count = notes.notes.length
  return (
    <div className="bs-srch-notes">
      <Section level={3} title="Notes" aside={<span className="bs-lbl">{count} {count === 1 ? 'clip' : 'clips'} · private</span>} />
      <form className="bs-srch-note-new" onSubmit={(e) => { e.preventDefault(); void add() }}>
        <TextArea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void add() } }}
          placeholder="Type a note, or clip anything with + Notes"
          aria-label="New note"
          rows={3}
          maxLength={8000}
        />
        {draft.trim() && <Key size="sm" type="submit" disabled={saving}>Add note</Key>}
      </form>
      {notes.failed ? (
        <p className="bs-srch-empty">Notes aren't available right now.</p>
      ) : notes.loading ? null : count === 0 ? (
        <p className="bs-srch-empty">Nothing clipped yet. Use + Notes on a result, an answer or a transcript line.</p>
      ) : (
        <ul className="bs-srch-clips">
          {notes.notes.map((n) => <NoteRow key={n.id} n={n} notes={notes} />)}
        </ul>
      )}
      {count > 0 && (
        <div className="bs-srch-note-keys">
          <Key size="sm" onClick={copy}>{copied ? 'Copied' : 'Copy as Markdown'}</Key>
        </div>
      )}
    </div>
  )
}

function NoteRow({ n, notes }: { n: SearchNote; notes: UseNotesResult }): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(n.body)
  const href = noteHref(n)
  const src = sourceLine(n)
  const from = originLabel(n)
  const save = async () => {
    const t = body.trim()
    if (!t || t === n.body) { setEditing(false); return }
    try {
      await notes.edit(n.id, t)
      setEditing(false)
    } catch {
      setBody(n.body)
      setEditing(false)
    }
  }
  return (
    <li className="bs-srch-clip">
      <div className="bs-srch-clip-h">
        <span className="bs-lbl bs-srch-kind">{kindLabel(n.kind)}</span>
        {from && <span className="bs-lbl">{from}</span>}
      </div>
      {editing ? (
        <TextArea value={body} onChange={(e) => setBody(e.target.value)} rows={3} aria-label="Edit note" autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save() } if (e.key === 'Escape') { setBody(n.body); setEditing(false) } }} />
      ) : (
        <p className={n.kind === 'transcript' ? 'bs-srch-clip-b q' : 'bs-srch-clip-b'}>{n.body}</p>
      )}
      <div className="bs-srch-clip-m">
        {src && (href ? <Link to={href}>{src}</Link> : <span>{src}</span>)}
        <span className="bs-srch-clip-k">
          {n.kind === 'note' && !editing && <button type="button" onClick={() => setEditing(true)}>Edit</button>}
          {editing && <button type="button" onClick={() => void save()}>Save</button>}
          <button type="button" onClick={() => { void notes.remove(n.id) }} aria-label="Delete note">Delete</button>
        </span>
      </div>
    </li>
  )
}
