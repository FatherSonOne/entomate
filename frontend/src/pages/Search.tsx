/**
 * Search (route /search): the full-page twin of the ⌘K palette. Same engine
 * (services/searchEngine.ts, POST /api/search/everything), plus the detail the
 * palette has no room for (the words that matched, the moment, the agent's call),
 * Ask Entomate with sources, and Notes: a private column of clips and typed notes.
 *
 * Results use the full page. Private notes and clips live in the Notepad drawer.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, NotebookPen, Search as SearchIcon } from 'lucide-react'
import {
  Drawer, GroupHead, Key, Section, Signal, Switch, Tag, TextArea, TextInput, TitleRule, useMediaQuery, PHONE_QUERY,
} from '../components/bench'
import { Highlight } from '../components/search/Highlight'
import { LaunchPicker } from '../components/search/LaunchPicker'
import { useToast } from '../components/vc/ToastProvider'
import { useAuth } from '../contexts/AuthContext'
import { useOrgSafe } from '../contexts/OrgContext'
import { useNotes, useRecentSearches, useSearch } from '../hooks/useSearch'
import type { UseNotesResult } from '../hooks/useSearch'
import { searchApi } from '../services/api'
import {
  EMPTY_RANGES, calendarDateInZone, eventComparisonRanges, isEventComparison, proposeComparison,
  rangeDates, readComparisonRanges, validComparisonRanges,
} from '../services/askDateRanges'
import type { ComparisonEvent, ComparisonRanges } from '../services/askDateRanges'
import {
  GROUPS, groupCount, isFilter, matchCommands, metaLine, readUrlState, resultHref, resultMomentHref, searchEverything,
  shortDate, statusSignal, timecode, writeUrlState,
} from '../services/searchEngine'
import type { Filter, SearchMode, SearchResponse, SearchResult } from '../services/searchEngine'
import { readSearchVisit, rememberSearchVisit } from '../services/searchReturn'
import type { AskCitation, AskClaim, AskMeeting, ComparisonDraft, CompletedAnswer, MonthlyRecap, PeriodComparison } from '../services/searchReturn'
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
const COMPARISON_QUESTION = 'What changed between these periods?'
type SearchLinkState = { searchReturnKey: string }

const resultLinkId = (r: SearchResult) => `search-result-${r.type}-${r.id}`
const ordinaryClick = (e: React.MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

export default function Search(): React.ReactElement {
  const { user } = useAuth() as unknown as { user: { id: string } | null }
  const context = useOrgSafe() as { org: { id: string; name?: string } | null } | null
  const org = context?.org
  const owner = user?.id && org?.id ? `${user.id}:${org.id}` : null
  return <SearchPage key={owner} owner={owner} workspace={org} />
}

function SearchPage({ owner, workspace }: { owner: string | null; workspace?: { id: string; name?: string } | null }): React.ReactElement {
  const toast = useToast() as ToastApi
  const location = useLocation()
  const navigate = useNavigate()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [params, setParams] = useSearchParams()
  const url = readUrlState(params)
  const comparisonParam = params.get('compare')
  const comparisonRanges = useMemo(() => readComparisonRanges(comparisonParam), [comparisonParam])
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const comparisonQuestion = url.q !== COMPARISON_QUESTION ? url.q || undefined : undefined
  const [restored, setRestored] = useState(() => {
    const visit = readSearchVisit(location.key, owner, location.search)
    const returnKey = location.state?.searchReturnKey
    return visit ?? (returnKey ? readSearchVisit(returnKey, owner, location.search) : null)
  })
  const historyEvent = location.state?.askEvent as { workspaceId: string; event: ComparisonEvent } | undefined
  const confirmedEvent = comparisonRanges && isEventComparison(url.q)
    ? (historyEvent?.workspaceId === workspace?.id ? historyEvent?.event : undefined) ?? restored?.answer?.event
    : undefined
  const proposedComparison = useMemo(() => url.ask &&
    (comparisonParam === null || (!confirmedEvent && isEventComparison(url.q))) ? proposeComparison(url.q, timeZone) : null,
    [url.ask, url.q, comparisonParam, timeZone, confirmedEvent])
  const [draft, setDraft] = useState(restored?.draft ?? (comparisonParam === null ? url.q : comparisonQuestion ?? ''))
  const [rangeDraft, setRangeDraft] = useState<ComparisonDraft | null>(() => {
    if (restored) return restored.rangeDraft
    if (proposedComparison) return { ...proposedComparison, question: comparisonQuestion }
    if (comparisonParam === null) return null
    return { ranges: comparisonRanges ?? EMPTY_RANGES, question: comparisonQuestion,
      ...(confirmedEvent ? { eventBased: true, event: confirmedEvent } : {}) }
  })
  const [recentKey, setRecentKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const confirmationRef = useRef<HTMLHeadingElement>(null)
  const previousQuery = useRef(url.q)

  const setUrl = useCallback((next: Parameters<typeof writeUrlState>[1], compare?: string | null, event?: ComparisonEvent) => {
    setParams((prev) => {
      const updated = writeUrlState(prev, next)
      if (compare === null) updated.delete('compare')
      else if (compare !== undefined) updated.set('compare', compare)
      return updated
    }, {
      replace: true,
      state: compare === undefined ? location.state : {
        ...location.state, askEvent: event ? { workspaceId: workspace?.id, event } : null,
      },
    })
  }, [setParams, location.state, workspace?.id])

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
    if (comparisonParam === null) setDraft(url.q)
  }, [url.q, comparisonParam])

  // A palette shortcut can enter Ask with a query already in the URL.
  useEffect(() => {
    if (proposedComparison) setRangeDraft({ ...proposedComparison, question: url.q.trim() })
  }, [proposedComparison, url.q])

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
    const proposal = proposeComparison(t, timeZone)
    if (proposal) {
      setRangeDraft({ ...proposal, question: t })
      requestAnimationFrame(() => confirmationRef.current?.focus())
      return
    }
    if (url.ask && t === q && comparisonParam === null) return
    setRestored(null)
    if (comparisonParam !== null || rangeDraft?.question) setRangeDraft(null)
    setUrl({ q: t, mode: 'ask', ask: true, meaning: t === q && url.meaning }, null)
  }

  const onCompare = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rangeDraft || !workspace || !validComparisonRanges(rangeDraft.ranges)) return
    if (rangeDraft.eventBased && !rangeDraft.event?.date) return
    const event = rangeDraft.eventBased && rangeDraft.event
      ? { ...rangeDraft.event, name: rangeDraft.event.name.trim() || 'Launch' }
      : undefined
    const compare = rangeDates(rangeDraft.ranges).join(',')
    const question = rangeDraft.question ?? COMPARISON_QUESTION
    if (url.ask && q === question && comparisonParam === compare && JSON.stringify(confirmedEvent) === JSON.stringify(event)) return
    setRestored(null)
    setUrl({ q: question, mode: 'ask', ask: true, meaning: false }, compare, event)
  }

  const changeEvent = (event?: ComparisonEvent) => {
    setRangeDraft((previous) => previous?.eventBased ? {
      ...previous,
      event,
      ranges: event?.date === previous.event?.date ? previous.ranges : eventComparisonRanges(event?.date ?? ''),
    } : previous)
  }

  const changeMode = (mode: SearchMode) => {
    if (mode === url.mode) return
    if (draft.trim() !== q) setRestored(null)
    setUrl({ mode, q: draft, ask: false, meaning: draft.trim() === q && url.meaning }, null)
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
      owner, search: location.search, draft, rangeDraft, results: currentData, meaning: includeMeaning, answer, linkId, scrollY: window.scrollY,
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
      {isAsk && (workspace || rangeDraft) && (
        <div className="bs-srch-compare">
          <Key size="sm" aria-expanded={rangeDraft !== null} aria-controls={rangeDraft ? 'ask-date-ranges' : undefined}
            onClick={() => setRangeDraft(rangeDraft ? null
              : { ...(proposedComparison ?? { ranges: comparisonRanges ?? EMPTY_RANGES, ...(confirmedEvent ? { eventBased: true, event: confirmedEvent } : {}) }),
                question: comparisonRanges || proposedComparison ? comparisonQuestion : undefined })}>
            Compare date ranges
          </Key>
          {rangeDraft && <ComparisonForm draft={rangeDraft} timeZone={timeZone} workspace={workspace}
            confirmationRef={confirmationRef}
            proposedQuestion={rangeDraft.question !== draft.trim() ? rangeDraft.question : undefined}
            onEventChange={changeEvent}
            onChange={(ranges) => setRangeDraft({ ...rangeDraft, ranges })} onSubmit={onCompare} />}
        </div>
      )}
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
        {isAsk ? (url.ask && !proposedComparison && q.length >= MIN_QUERY && (comparisonParam === null || (comparisonRanges && workspace)) ? (
          <AskAnswer key={JSON.stringify([q, comparisonParam, confirmedEvent])} question={q} workspaceId={workspace?.id} workspaceName={workspace?.name}
            event={confirmedEvent}
            comparisonRanges={comparisonRanges} timeZone={timeZone} showQuestion={q !== COMPARISON_QUESTION && draft.trim() !== q} initial={restoredAnswer} onClip={clip} clipped={notes.clipped}
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

function ComparisonForm({ draft, timeZone, workspace, confirmationRef, proposedQuestion, onChange, onEventChange, onSubmit }: {
  draft: ComparisonDraft
  timeZone: string
  workspace?: { id: string; name?: string } | null
  confirmationRef: React.Ref<HTMLHeadingElement>
  proposedQuestion?: string
  onChange: (ranges: ComparisonRanges) => void
  onEventChange: (event?: ComparisonEvent) => void
  onSubmit: (e: React.FormEvent) => void
}): React.ReactElement {
  const { ranges, relative, question, eventBased, event } = draft
  const dates = rangeDates(ranges)
  const valid = validComparisonRanges(ranges)
  const complete = dates.every(Boolean)
  return (
    <form className="bs-srch-compare-form" id="ask-date-ranges" onSubmit={onSubmit}
      aria-labelledby={question ? 'ask-confirm-date-ranges' : undefined}>
      {question && <h2 className="bs-lbl" id="ask-confirm-date-ranges" tabIndex={-1} ref={confirmationRef}>Confirm date ranges</h2>}
      {proposedQuestion && <p>{proposedQuestion}</p>}
      <p>Both start and end dates are included · {timeZone} · {workspace ? workspace.name || 'Current workspace' : 'Choose a workspace'}</p>
      {relative === 'completed-days' && <p>The suggested ranges cover completed calendar days and exclude today.</p>}
      {relative === 'completed-weeks' && <p>The suggested ranges cover completed Monday–Sunday weeks and exclude the current week.</p>}
      {relative === 'completed-months' && <p>The suggested ranges cover completed calendar months and exclude the current month.</p>}
      {relative === 'invalid-day-count' && !complete && <p>Use the same positive whole number of days for both periods, or enter dates below.</p>}
      {relative === 'invalid-week-count' && !complete && <p>Use the same positive whole number of weeks for both periods, or enter dates below.</p>}
      {relative === 'invalid-month-count' && !complete && <p>Use the same positive whole number of months for both periods, or enter dates below.</p>}
      {question && !relative && !eventBased && !complete && <p>Fill in the missing dates or correct them below. Include a year for each range when typing dates.</p>}
      {eventBased && (
        <div className="bs-srch-compare-periods">
          <LaunchPicker workspaceId={workspace?.id} timeZone={timeZone} event={event} onChange={onEventChange} />
        </div>
      )}
      {eventBased && event?.date && <p>The suggested ranges cover 14 calendar days on each side and exclude launch day.</p>}
      {(!eventBased || event?.date) && <div className="bs-srch-compare-periods">
        {(['previous', 'current'] as const).map((period) => (
          <fieldset key={period}>
            <legend>{period === 'previous' ? 'Earlier period' : 'Later period'}</legend>
            <div className="bs-srch-compare-dates">
              {(['startDate', 'endDate'] as const).map((field) => (
                <label key={field}>
                  {field === 'startDate' ? 'Start date' : 'End date'}
                  <TextInput type="date" required value={ranges[period][field]}
                    onChange={(e) => onChange({ ...ranges, [period]: { ...ranges[period], [field]: e.target.value } })} />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>}
      <div className="bs-srch-compare-action">
        <Key type="submit" size="sm" variant="primary" disabled={!valid || !workspace || (eventBased && !event?.date)}>Compare periods</Key>
        <div aria-live="polite">
          {complete && !valid && <p>Enter valid dates with each start on or before its end. The earlier period must end before the later period starts.</p>}
        </div>
      </div>
    </form>
  )
}

interface AskReply {
  answer?: string
  citations?: AskMeeting[]
  claims?: AskClaim[]
  recap?: MonthlyRecap
  comparison?: PeriodComparison
}

function AskAnswer({ question, workspaceId, workspaceName, comparisonRanges, event, timeZone, showQuestion, initial, onClip, clipped, linkState, onLeave }: {
  question: string
  workspaceId?: string
  workspaceName?: string
  comparisonRanges: ComparisonRanges | null
  event?: ComparisonEvent
  timeZone: string
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
  const [recap, setRecap] = useState(initial?.recap)
  const [comparison, setComparison] = useState(initial?.comparison)
  const [state, setState] = useState<'asking' | 'done' | 'failed'>(initial ? 'done' : 'asking')
  const [attempt, setAttempt] = useState(0)
  const checkedAt = useRef(initial?.checkedAt)

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
    const complete = (reply: AskReply) => {
      if (controller.signal.aborted || finished) return
      if (reply.answer) setText(reply.answer)
      if (Array.isArray(reply.citations)) setCitations(reply.citations)
      if (Array.isArray(reply.claims)) setClaims(reply.claims)
      setRecap(reply.recap)
      setComparison(reply.comparison)
      finished = true
      setState('done')
    }
    const data = { question, workspaceId, timeZone, ...(comparisonRanges ? { comparisonRanges } : {}) }
    if (event) {
      // Launch comparisons are validated in full on the server before any answer is sent.
      checkedAt.current = new Date().toISOString()
      searchApi.ask({
        ...data, comparisonEvent: { name: event.name.slice(0, 360), date: event.date },
      }, { signal: controller.signal, skipRetry: true }).then((value) => {
        const reply = value as unknown as AskReply
        if (typeof reply?.answer !== 'string' || !reply.comparison) return fail()
        complete(reply)
      }, fail)
      return () => controller.abort()
    }

    const askStream = (searchApi as unknown as {
      askStream: (input: typeof data, cb: {
        signal: AbortSignal
        onChunk: (c: string) => void
        onCitations: (c: AskMeeting[]) => void
        onComplete: (r: AskReply) => void
        onError: () => void
      }) => Promise<void>
    }).askStream
    askStream(data, {
      signal: controller.signal,
      onChunk: (c) => { if (!controller.signal.aborted && !finished) { streamed += c; setText(streamed) } },
      onCitations: (c) => { if (!controller.signal.aborted && !finished) setCitations(Array.isArray(c) ? c : []) },
      onComplete: complete,
      onError: fail,
    }).then(fail, fail)
    return () => controller.abort()
  }, [initial, question, workspaceId, timeZone, comparisonRanges, event, attempt])

  const meetings = claims ? [] : citations.filter((c) => c.type === 'meeting' && c.id)
  const meetingCount = new Set((claims ? claims.flatMap((claim) => claim.citations) : meetings).map((c) => c.id)).size
  const leave = (click: React.MouseEvent, id: string) => {
    if (ordinaryClick(click)) onLeave(id, { question, text, meetings, claims, recap, comparison, event, checkedAt: checkedAt.current })
  }
  const note: NewNote = {
    kind: 'answer', body: text.trim() || ' ', origin: 'ask', query: question,
    sourceLabel: meetingCount ? `${meetingCount} meeting${meetingCount === 1 ? '' : 's'}` : null,
  }
  const isClipped = clipped.has(clipKey(note))
  const grouped = new Map<string, { topic?: string; items: { claim: AskClaim; index: number }[] }>()
  claims?.forEach((claim, index) => {
    const key = claim.topic?.toLocaleLowerCase() ?? ''
    const group = grouped.get(key) ?? { topic: claim.topic, items: [] }
    group.items.push({ claim, index })
    grouped.set(key, group)
  })

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
      {state === 'done' && comparison && <ComparisonCoverage comparison={comparison} workspaceName={workspaceName}
        custom={!!comparisonRanges} event={event} checkedAt={checkedAt.current} />}
      {state === 'done' && recap && <RecapCoverage recap={recap} workspaceName={workspaceName} />}
      {state === 'failed' ? (
        <div className="bs-srch-empty">
          <p>Entomate couldn't answer right now.</p>
          <Key size="sm" onClick={() => {
            setText('')
            setCitations([])
            setClaims(undefined)
            setRecap(undefined)
            setComparison(undefined)
            setState('asking')
            setAttempt((n) => n + 1)
          }}>Try again</Key>
        </div>
      ) : state === 'done' && !!claims?.length ? (
        [...grouped].map(([key, group]) => (
          <div key={key} className={group.topic ? 'bs-srch-recap-topic' : undefined}>
            {group.topic && <h3>{group.topic}</h3>}
            <ul className="bs-srch-claims">
              {group.items.map(({ claim, index: claimIndex }) => (
                <li key={claimIndex}>
                  <p className="bs-srch-answer-p">{claim.text}</p>
                  <ul className="bs-srch-claim-sources" aria-label="Transcript sources">
                    {claim.citations.map((source, sourceIndex) => {
                      const id = `search-answer-claim-${claimIndex}-${sourceIndex}`
                      const time = timecode(source.atMs)
                      const moment = time ?? (source.passage.kind === 'segment' ? `Line ${source.passage.position}` : 'Transcript excerpt')
                      const label = citationLead(source, !!comparisonRanges)
                      return (
                        <li key={id}>
                          <Link id={id} className="bs-srch-claim-source"
                            to={meetingSourceHref(source.id, source.atMs, source.passage)} state={linkState} onClick={(e) => leave(e, id)}>
                            <span>{label ? `${label} · ` : ''}{source.title} · {moment}{source.speaker ? ` · ${source.speaker}` : ''}{source.date ? ` · ${shortDate(source.date)}` : ''}</span>
                            <q>{source.quote}</q>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ))
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

function citationLead(source: AskCitation, custom: boolean): string {
  if (source.role === 'before') return 'Before'
  if (source.role === 'after') return 'After'
  if (source.period === 'previous') return custom ? 'Earlier period' : 'Last month'
  if (source.period === 'current') return custom ? 'Later period' : 'This month'
  return ''
}

function RecapPeriod({ recap, showTimeZone }: { recap: MonthlyRecap; showTimeZone?: boolean }): React.ReactElement {
  // These are calendar dates in the recap's time zone. Format them without shifting them.
  const calendar = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  const start = new Date(`${recap.startDate}T00:00:00Z`)
  const end = new Date(`${recap.endDate}T00:00:00Z`)
  const dateRange = calendar.formatRange(start, end)
  const coverage = [
    `${recap.reviewedMeetings} of ${recap.totalMeetings} meetings reviewed`,
    recap.meetingsWithoutTranscripts ? `${recap.meetingsWithoutTranscripts} without transcripts` : '',
    recap.unindexedMeetings ? `${recap.unindexedMeetings} awaiting indexing` : '',
    recap.unsampledMeetings ? `${recap.unsampledMeetings} beyond the review limit` : '',
  ].filter(Boolean).join(' · ')
  return (
    <>
      <p>{dateRange}{showTimeZone ? ` · ${recap.timeZone}` : ''}</p>
      <p>{coverage}</p>
    </>
  )
}

function RecapCoverage({ recap, workspaceName }: { recap: MonthlyRecap; workspaceName?: string }): React.ReactElement {
  return (
    <section className="bs-srch-recap" aria-label="Monthly recap scope">
      <h2>Monthly recap{workspaceName ? ` · ${workspaceName}` : ''}</h2>
      <RecapPeriod recap={recap} showTimeZone />
      {recap.reviewedMeetings > 0 && <p>Based on selected transcript passages.</p>}
    </section>
  )
}

function ComparisonCoverage({ comparison, workspaceName, custom, event, checkedAt }: {
  comparison: PeriodComparison; workspaceName?: string; custom: boolean; event?: ComparisonEvent; checkedAt?: string
}): React.ReactElement {
  const earlier = custom ? 'Earlier period' : 'Last month'
  const later = custom ? 'Later period' : 'This month to date'
  const onePeriodHasEvidence = (comparison.previous.reviewedMeetings > 0) !== (comparison.current.reviewedMeetings > 0)
  const incomplete = event && checkedAt && comparison.current.endDate >= calendarDateInZone(new Date(checkedAt), comparison.current.timeZone)
  return (
    <section className="bs-srch-recap" aria-label={custom ? 'Date range coverage' : 'Month-over-month coverage'}>
      <h2>{custom ? 'Date range comparison' : 'Month-over-month comparison'}{workspaceName ? ` · ${workspaceName}` : ''}</h2>
      <p>{comparison.current.timeZone}</p>
      {event && <p>{event.name} · {event.date}{event.source === 'scheduled' ? ' · Scheduled date' : event.source === 'completed' ? ' · Marked complete' : ''}</p>}
      <div className="bs-srch-recap-periods">
        <section aria-label={earlier}>
          <h3>{earlier}</h3>
          <RecapPeriod recap={comparison.previous} />
        </section>
        <section aria-label={later}>
          <h3>{later}</h3>
          <RecapPeriod recap={comparison.current} />
          {incomplete && <p>This period is incomplete. Coverage runs through the time Ask ran.</p>}
        </section>
      </div>
      {custom && onePeriodHasEvidence &&
        <p>One period has no reviewed transcripts, so changes between the periods can’t be verified.</p>}
      {comparison.previous.reviewedMeetings + comparison.current.reviewedMeetings > 0 && <p>Based on selected transcript passages.</p>}
    </section>
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
