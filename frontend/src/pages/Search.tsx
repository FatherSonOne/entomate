/**
 * Search (route /search): the full-page twin of the ⌘K palette. Same engine
 * (services/searchEngine.ts, POST /api/search/everything), plus the detail the
 * palette has no room for (the words that matched, the moment, the agent's call),
 * Ask Entomate with sources, and Notes: a private column of clips and typed notes.
 *
 * Results use the full page. Private notes and clips live in the Notepad drawer.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, NotebookPen, Search as SearchIcon } from 'lucide-react'
import {
  Drawer, GroupHead, Key, Section, Signal, Switch, Tag, TextArea, TextInput, TitleRule, useMediaQuery, PHONE_QUERY,
} from '../components/bench'
import { Highlight } from '../components/search/Highlight'
import { useToast } from '../components/vc/ToastProvider'
import { useAuth } from '../contexts/AuthContext'
import { useOrgSafe } from '../contexts/OrgContext'
import { useNotes, useRecentSearches, useSearch } from '../hooks/useSearch'
import type { UseNotesResult } from '../hooks/useSearch'
import { searchApi } from '../services/api'
import {
  GROUPS, groupCount, isFilter, matchCommands, metaLine, readUrlState, resultHref, resultMomentHref, searchEverything,
  shortDate, statusSignal, timecode, writeUrlState,
} from '../services/searchEngine'
import type { Filter, SearchMode, SearchResponse, SearchResult } from '../services/searchEngine'
import { readSearchVisit, rememberSearchVisit } from '../services/searchReturn'
import type { AskClaim, AskMeeting, CompletedAnswer } from '../services/searchReturn'
import { meetingSourceHref } from '../services/meetingSourceLink'
import {
  clipFromResult, clipKey, kindLabel, noteHref, notesToMarkdown, originLabel, sourceLine,
} from '../services/searchNotesService'
import type { NewNote, SearchNote } from '../services/searchNotesService'

interface ToastApi {
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
}

const MIN_QUERY = 2
const MAX_QUESTION = 2000
const MODES = [{ value: 'search', label: 'Search' }, { value: 'ask', label: 'Ask' }] as const
type SearchLinkState = { searchReturnKey: string }

const resultLinkId = (r: SearchResult) => `search-result-${r.type}-${r.id}`
const ordinaryClick = (e: React.MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

export default function Search(): React.ReactElement {
  const { user } = useAuth() as unknown as { user: { id: string } | null }
  const context = useOrgSafe() as { org: { id: string } | null } | null
  const org = context?.org
  const owner = user?.id && org?.id ? `${user.id}:${org.id}` : null
  return <SearchPage key={owner} owner={owner} />
}

function SearchPage({ owner }: { owner: string | null }): React.ReactElement {
  const toast = useToast() as ToastApi
  const location = useLocation()
  const navigate = useNavigate()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [params, setParams] = useSearchParams()
  const url = readUrlState(params)
  const [restored, setRestored] = useState(() => {
    const visit = readSearchVisit(location.key, owner, location.search)
    const returnKey = location.state?.searchReturnKey
    return visit ?? (returnKey ? readSearchVisit(returnKey, owner, location.search) : null)
  })
  const [draft, setDraft] = useState(restored?.draft ?? url.q)
  const [recentKey, setRecentKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousQuery = useRef(url.q)

  const setUrl = useCallback((next: Parameters<typeof writeUrlState>[1]) => {
    setParams((prev) => writeUrlState(prev, next), { replace: true })
  }, [setParams])

  const q = url.q.trim()
  const isAsk = url.mode === 'ask'
  const canIncludeMeaning = url.filter === 'all' || url.filter === 'meetings'
  const includeMeaning = canIncludeMeaning && q.length >= MIN_QUERY && url.meaning
  const restoredResults = restored?.results?.query === q && restored.meaning === includeMeaning ? restored.results : null
  const restoredAnswer = restored?.answer?.question === q ? restored.answer : null
  const { data, loading, error, settledQuery } = useSearch(q, {
    enabled: !isAsk && !restoredResults, limit: 25, debounceMs: 220, meaning: includeMeaning,
  })
  const recent = useRecentSearches(true, recentKey)
  const notes = useNotes(true)

  // Keep the field in step when the URL changes from outside (palette ⌘↵, back button).
  useEffect(() => {
    if (previousQuery.current === url.q) return
    previousQuery.current = url.q
    setDraft(url.q)
  }, [url.q])

  useEffect(() => {
    if (!restored) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(restored.linkId)?.focus({ preventScroll: true })
      window.scrollTo(0, restored.scrollY)
    })
    return () => cancelAnimationFrame(frame)
  }, [restored])

  // Arriving with a query (from the palette) counts as a search for history.
  const logged = useRef<string>('')
  const logQuery = useCallback((query: string) => {
    const t = query.trim()
    if (t.length < MIN_QUERY || logged.current === t) return
    logged.current = t
    searchEverything(t, { limit: 1, log: true, meaning: false }).then(() => setRecentKey((k) => k + 1)).catch(() => undefined)
  }, [])
  useEffect(() => { if (q && !restored && !isAsk) logQuery(q) }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (isAsk || value.trim() === q) return
    setRestored(null)
    setUrl({ q: value, meaning: false })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = draft.trim()
    if (t.length < MIN_QUERY) return
    if (!isAsk) { logQuery(t); return }
    if (t.length > MAX_QUESTION) return
    if (url.ask && t === q) return
    setRestored(null)
    setUrl({ q: t, mode: 'ask', ask: true, meaning: t === q && url.meaning })
  }

  const changeMode = (mode: SearchMode) => {
    if (mode === url.mode) return
    if (draft.trim() !== q) setRestored(null)
    setUrl({ mode, q: draft, ask: false, meaning: draft.trim() === q && url.meaning })
  }

  const pickRecent = (text: string) => {
    setDraft(text)
    if (text !== q) setRestored(null)
    setUrl({ q: text, meaning: text === q && url.meaning })
    logQuery(text)
  }

  const clip = useCallback(async (note: NewNote) => {
    if (notes.clipped.has(clipKey(note))) return
    try {
      await notes.add(note)
    } catch {
      toast.error('Could not clip', 'Notes are not available right now.')
    }
  }, [notes, toast])

  const currentData = restoredResults ?? (settledQuery === q ? data : null)
  const count = currentData ? (url.filter === 'all' ? currentData.total : groupCount(currentData, url.filter)) : null
  const linkState = { searchReturnKey: location.key }
  const saveReturn = (linkId: string, answer: CompletedAnswer | null = null) => {
    if (!owner) return
    rememberSearchVisit(location.key, {
      owner, search: location.search, draft, results: currentData, meaning: includeMeaning, answer, linkId, scrollY: window.scrollY,
    })
  }

  return (
    <>
      <TitleRule
        title="Search"
        actions={(
          <>
            <Key
              icon={<NotebookPen aria-hidden="true" />}
              kbd={notes.notes.length ? String(notes.notes.length) : undefined}
              aria-haspopup="dialog"
              aria-expanded={url.notes}
              onClick={() => setUrl({ notes: true })}
            >Notepad</Key>
          </>
        )}
      />

      <Switch label="Discovery mode" className="bs-srch-modes" options={MODES} value={url.mode} onChange={changeMode} />
      <form className={`bs-srch-q${isAsk ? ' bs-srch-q--ask' : ''}`} role={isAsk ? undefined : 'search'} onSubmit={onSubmit}>
        <TextInput
          ref={inputRef}
          icon={<SearchIcon strokeWidth={1.6} />}
          value={draft}
          onChange={(e) => onType(e.target.value)}
          placeholder={isAsk ? 'Ask a question about your meetings' : isPhone ? 'Search anything' : 'Search meetings, decisions, tasks, and notes'}
          aria-label={isAsk ? 'Question about your meetings' : 'Search meetings, decisions, tasks, and notes'}
          autoFocus={!q && !isPhone && !url.notes && !restored}
          autoComplete="off"
          spellCheck={false}
          maxLength={isAsk ? MAX_QUESTION : undefined}
        />
        {isAsk ? <Key type="submit" variant="primary" className="bs-srch-submit" disabled={draft.trim().length < MIN_QUERY || draft.trim().length > MAX_QUESTION}>Ask Entomate</Key>
          : <FilterSelect data={currentData} value={url.filter} onChange={(filter) => setUrl({ filter })} />}
      </form>
      {!isAsk && <div className="bs-srch-status">
        <EngineLine data={currentData} />
        {q.length >= MIN_QUERY && canIncludeMeaning && (
          <Key size="sm" aria-pressed={includeMeaning} onClick={() => { setRestored(null); setUrl({ meaning: !includeMeaning }) }}>
            Include related meetings
          </Key>
        )}
        <span className="bs-srch-count">{count == null ? '' : `${count} result${count === 1 ? '' : 's'}`}</span>
      </div>}

      <div className="bs-srch-main">
        {isAsk ? (url.ask && q.length >= MIN_QUERY ? (
          <AskAnswer key={q} question={q} showQuestion={draft.trim() !== q} initial={restoredAnswer} onClip={clip} clipped={notes.clipped}
            linkState={linkState} onLeave={saveReturn} />
        ) : <p className="bs-srch-empty">Ask about a decision, a commitment, or what changed across your meetings.</p>) : q.length >= MIN_QUERY ? (
          <>
            <Results
              data={currentData}
              loading={loading}
              error={error}
              filter={url.filter}
              q={q}
              clipped={notes.clipped}
              onClip={(r) => clip(clipFromResult(r, q, 'search'))}
              linkState={linkState}
              onLeave={saveReturn}
              onOpen={(r) => { saveReturn(resultLinkId(r)); navigate(resultHref(r), { state: linkState }) }}
              onAsk={() => changeMode('ask')}
            />
            {recent.length > 0 && (
              <details className="bs-srch-history">
                <summary>Recent searches</summary>
                <RecentList recent={recent} onPick={pickRecent} />
              </details>
            )}
          </>
        ) : (
          <EmptyState recent={recent} onPick={pickRecent} />
        )}
      </div>

      <Notepad open={url.notes} onClose={() => setUrl({ notes: false })} notes={notes} onClipError={() => toast.error('Could not save the note')} />
    </>
  )
}

function EngineLine({ data }: { data: SearchResponse | null }): React.ReactElement {
  const meaning = data?.engine === 'words+meaning'
  return (
    <p className="bs-srch-engine">
      <Signal tone={meaning ? 'live' : 'off'}>{meaning ? 'Words and meaning' : 'Matching words'}</Signal>
    </p>
  )
}

function FilterSelect({ data, value, onChange }: { data: SearchResponse | null; value: Filter; onChange: (f: Filter) => void }): React.ReactElement {
  const options = [
    { value: 'all', label: 'All types', count: data?.total },
    ...GROUPS.map((g) => ({ value: g.key, label: g.short, count: data ? groupCount(data, g.key) : undefined })),
  ]
  return (
    <div className="bs-srch-filter">
      <select
        aria-label="Filter by result type"
        value={value}
        onChange={(e) => { if (isFilter(e.target.value)) onChange(e.target.value) }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}{option.count == null ? '' : ` (${option.count})`}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" />
    </div>
  )
}

interface ResultsProps {
  data: SearchResponse | null
  loading: boolean
  error: string | null
  filter: Filter
  q: string
  clipped: Set<string>
  onClip: (r: SearchResult) => void
  linkState: SearchLinkState
  onLeave: (linkId: string) => void
  onOpen: (r: SearchResult) => void
  onAsk: () => void
}

function Results({ data, loading, error, filter, q, clipped, onClip, linkState, onLeave, onOpen, onAsk }: ResultsProps): React.ReactElement {
  if (error) return <p className="bs-srch-empty">Search is unavailable right now. Try again in a moment.</p>
  if (!data) return <p className="bs-srch-empty" aria-live="polite">{loading ? 'Searching…' : ''}</p>
  const groups = GROUPS.filter((g) => (filter === 'all' || filter === g.key) && (data.groups[g.key] || []).length > 0)
  const commands = filter === 'all' ? matchCommands(q, 3) : []
  const hasWordMatches = groups.some((g) => data.groups[g.key]?.some((row) => !row.meta.byMeaning))
  if (!groups.length && !commands.length) {
    return (
      <div className="bs-srch-empty">
        <p role="status">No word matches for “{q}”{filter !== 'all' ? ' in this filter' : ''}.</p>
        <Key size="sm" onClick={onAsk}>Ask Entomate instead</Key>
      </div>
    )
  }
  return (
    <div aria-live="polite" onClickCapture={(e) => {
      const link = (e.target as HTMLElement).closest('a[id]')
      if (link && ordinaryClick(e)) onLeave(link.id)
    }}>
      {!hasWordMatches && <p className="bs-srch-empty">No word matches for “{q}”.</p>}
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
                  linkState={linkState}
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
                <Link id={`search-command-${c.id}`} className="bs-srch-t" to={c.path} state={{ ...c.state, ...linkState }}>{c.label}</Link>
                <span className="bs-srch-m">{c.hint}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ResultRow({ r, clipped, onClip, linkState, onOpen }: {
  r: SearchResult; clipped: boolean; onClip: () => void; linkState: SearchLinkState; onOpen: () => void
}): React.ReactElement {
  const tc = timecode(r.meta.atMs)
  const momentHref = resultMomentHref(r)
  const sourceLabel = tc ? `View source at ${tc}` : 'View passage'
  const sig = statusSignal(r)
  const href = resultHref(r)
  const canClip = r.type !== 'note'
  return (
    <li className="bs-srch-row" onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button')) onOpen() }}>
      <div className="bs-srch-body">
        <Link id={resultLinkId(r)} className="bs-srch-t" to={href} state={linkState}>
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
        {momentHref && <Link id={`${resultLinkId(r)}-source`} to={momentHref} state={linkState} className="bs-key sm bs-srch-source"
          aria-label={`${sourceLabel} for ${r.title}`}>{sourceLabel}</Link>}
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

function AskAnswer({ question, showQuestion, initial, onClip, clipped, linkState, onLeave }: {
  question: string
  showQuestion: boolean
  initial?: CompletedAnswer | null
  onClip: (n: NewNote) => void
  clipped: Set<string>
  linkState: SearchLinkState
  onLeave: (linkId: string, answer: CompletedAnswer) => void
}): React.ReactElement {
  const [text, setText] = useState(initial?.text ?? '')
  const [citations, setCitations] = useState<AskMeeting[]>(initial?.meetings ?? [])
  const [claims, setClaims] = useState<AskClaim[] | undefined>(initial?.claims)
  const [state, setState] = useState<'asking' | 'done' | 'failed'>(initial ? 'done' : 'asking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (initial) return
    const controller = new AbortController()
    let streamed = ''
    let finished = false
    const fail = () => {
      if (finished || controller.signal.aborted) return
      finished = true
      setState('failed')
    }
    const askStream = (searchApi as unknown as {
      askStream: (data: { question: string }, cb: {
        signal: AbortSignal
        onChunk: (c: string) => void
        onCitations: (c: AskMeeting[]) => void
        onComplete: (r: { answer?: string; citations?: AskMeeting[]; claims?: AskClaim[] }) => void
        onError: () => void
      }) => Promise<void>
    }).askStream
    askStream({ question }, {
      signal: controller.signal,
      onChunk: (c) => { if (!controller.signal.aborted && !finished) { streamed += c; setText(streamed) } },
      onCitations: (c) => { if (!controller.signal.aborted && !finished) setCitations(Array.isArray(c) ? c : []) },
      onComplete: (r) => {
        if (controller.signal.aborted || finished) return
        if (r.answer) setText(r.answer)
        if (Array.isArray(r.citations)) setCitations(r.citations)
        if (Array.isArray(r.claims)) setClaims(r.claims)
        finished = true
        setState('done')
      },
      onError: fail,
    }).then(fail, fail)
    return () => controller.abort()
  }, [initial, question, attempt])

  const meetings = claims ? [] : citations.filter((c) => c.type === 'meeting' && c.id)
  const meetingCount = new Set((claims ? claims.flatMap((claim) => claim.citations) : meetings).map((c) => c.id)).size
  const leave = (event: React.MouseEvent, id: string) => {
    if (ordinaryClick(event)) onLeave(id, { question, text, meetings, claims })
  }
  const note: NewNote = {
    kind: 'answer', body: text.trim() || ' ', origin: 'ask', query: question,
    sourceLabel: meetingCount ? `${meetingCount} meeting${meetingCount === 1 ? '' : 's'}` : null,
  }
  const isClipped = clipped.has(clipKey(note))

  return (
    <div className="bs-srch-answer" aria-live="polite">
      <div className="bs-srch-answer-h">
        <span className="bs-lbl">Ask Entomate</span>
        {state === 'done' && text.trim() && (
          <Key size="sm" onClick={() => onClip(note)} aria-pressed={isClipped} className={isClipped ? 'bs-srch-clipped' : undefined}>
            {isClipped ? '✓ Clipped' : '+ Notes'}
          </Key>
        )}
      </div>
      {showQuestion && <p className="bs-srch-answer-question">{question}</p>}
      {state === 'failed' ? (
        <div className="bs-srch-empty">
          <p>Entomate couldn't answer right now.</p>
          <Key size="sm" onClick={() => {
            setText('')
            setCitations([])
            setClaims(undefined)
            setState('asking')
            setAttempt((n) => n + 1)
          }}>Try again</Key>
        </div>
      ) : state === 'done' && !!claims?.length ? (
        <ul className="bs-srch-claims">
          {claims.map((claim, claimIndex) => (
            <li key={claimIndex}>
              <p className="bs-srch-answer-p">{claim.text}</p>
              <ul className="bs-srch-claim-sources" aria-label="Transcript sources">
                {claim.citations.map((source, sourceIndex) => {
                  const id = `search-answer-claim-${claimIndex}-${sourceIndex}`
                  const time = timecode(source.atMs)
                  const moment = time ?? (source.passage.kind === 'segment' ? `Line ${source.passage.position}` : 'Transcript excerpt')
                  return (
                    <li key={id}>
                      <Link id={id} className="bs-srch-claim-source"
                        to={meetingSourceHref(source.id, source.atMs, source.passage)} state={linkState} onClick={(e) => leave(e, id)}>
                        <span>{source.title} · {moment}{source.speaker ? ` · ${source.speaker}` : ''}{source.date ? ` · ${shortDate(source.date)}` : ''}</span>
                        <q>{source.quote}</q>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bs-srch-answer-p">{text || 'Reading your meetings…'}</p>
      )}
      {state === 'done' && meetings.length > 0 && (
        <section className="bs-srch-answer-related" aria-label="Related meetings">
          <h2 className="bs-lbl">Related meetings</h2>
          <div className="bs-srch-answer-src">
            {meetings.map((c) => {
              const id = `search-answer-meeting-${c.id}`
              return <Link key={c.id} id={id} className="bs-tag" to={`/meetings/${encodeURIComponent(c.id!)}`} state={linkState}
                onClick={(e) => leave(e, id)}>
                {c.title || 'Meeting'}{c.date ? ` · ${shortDate(c.date)}` : ''}
              </Link>
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Empty state, recent ──

function EmptyState({ recent, onPick }: { recent: ReturnType<typeof useRecentSearches>; onPick: (q: string) => void }): React.ReactElement {
  return (
    <div className="bs-srch-start">
      <Section level={2} title="Recent searches" />
      {recent.length ? <RecentList recent={recent} onPick={onPick} /> : <p className="bs-srch-empty">Your searches show up here.</p>}
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

function Notepad({ open, onClose, notes, onClipError }: { open: boolean; onClose: () => void; notes: UseNotesResult; onClipError: () => void }): React.ReactElement {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const add = async () => {
    const body = draft.trim()
    if (!body || saving) return
    setSaving(true)
    try {
      await notes.add({ kind: 'note', body, origin: 'search' })
      setDraft((current) => (current === draft ? '' : current))
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
    <Drawer open={open} onClose={onClose} label="Notepad" className="bs-srch-notepad">
      <p className="bs-srch-note-info">Private{!notes.loading && !notes.failed && ` · ${count} ${count === 1 ? 'item' : 'items'}`}</p>
      <form className="bs-srch-note-new" onSubmit={(e) => { e.preventDefault(); void add() }}>
        <TextArea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void add() } }}
          placeholder="Write a note…"
          aria-label="New note"
          rows={3}
          maxLength={8000}
        />
        <Key type="submit" disabled={!draft.trim() || saving}>{saving ? 'Adding…' : 'Add note'}</Key>
      </form>
      {notes.failed ? (
        <p className="bs-srch-empty">Notes aren't available right now.</p>
      ) : notes.loading ? null : count === 0 ? (
        <p className="bs-srch-empty">Use + Notes on a result, answer, or transcript line to save it here.</p>
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
    </Drawer>
  )
}

function NoteRow({ n, notes }: { n: SearchNote; notes: UseNotesResult }): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(n.body)
  const editButton = useRef<HTMLButtonElement>(null)
  const href = noteHref(n)
  const src = sourceLine(n)
  const from = originLabel(n)
  const finishEditing = () => {
    editButton.current?.focus()
    setEditing(false)
  }
  const save = async () => {
    const t = body.trim()
    if (!t || t === n.body) { setBody(n.body); finishEditing(); return }
    try {
      await notes.edit(n.id, t)
      finishEditing()
    } catch {
      setBody(n.body)
      finishEditing()
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save() }
            if (e.key === 'Escape') { e.stopPropagation(); setBody(n.body); finishEditing() }
          }} />
      ) : (
        <p className={n.kind === 'transcript' ? 'bs-srch-clip-b q' : 'bs-srch-clip-b'}>{n.body}</p>
      )}
      <div className="bs-srch-clip-m">
        {src && (href ? <Link to={href}>{src}</Link> : <span>{src}</span>)}
        <span className="bs-srch-clip-k">
          {n.kind === 'note' && (
            <button ref={editButton} type="button" onClick={() => editing ? void save() : setEditing(true)}>
              {editing ? 'Save' : 'Edit'}
            </button>
          )}
          <button type="button" onClick={() => { void notes.remove(n.id) }} aria-label="Delete note">Delete</button>
        </span>
      </div>
    </li>
  )
}
