import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { projectsApi } from '../services/api'
import {
  Cell, Display, Drawer, Grid, Key, Readout, Section, Signal, Switch, TextArea, TextInput, TitleRule,
} from '../components/bench'
import { useToast } from '../components/vc/ToastProvider'
import ErrorState from '../components/vc/ErrorState'
import { ScheduleAxis, ScheduleFacts, ScheduleTrack } from '../components/ProjectSchedule'
import {
  dayShort, endsLabel, filterCounts, listSummary, plural, progressPct, projectName, projectSignal, readUrl, rollupOf,
  shownProjects, timeline, writeUrl,
} from '../services/projectsView'
import type { NeedRow, ProjectFilter, ProjectRow, ProjectsUrlState } from '../services/projectsView'

/**
 * 04 Projects (Bench Swiss, direction B "Bench", 2026-11-22): which project is slipping
 * and what needs you. A measured deadlines display beside readouts, then the
 * projects table beside the late items across them.
 * Counts include the action items of each project's linked meetings (projectRollup.js).
 * View logic lives in services/projectsView.ts.
 */

interface ToastApi {
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
}

interface ListResponse { projects?: ProjectRow[]; needsYou?: NeedRow[]; lateTotal?: number; count?: number; hasMore?: boolean }

const LOAD_LIMIT = 100
const SCHEDULE_PREVIEW = 6
const EMPTY_NEW = { name: '', description: '', startDate: '', endDate: '', tags: '' }

export default function Projects(): React.ReactElement {
  const toast = useToast() as ToastApi
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const url = useMemo(() => readUrl(params), [params])
  const archived = url.show === 'archived'
  const request = useRef(0)

  const [rows, setRows] = useState<ProjectRow[]>([])
  const [needs, setNeeds] = useState<NeedRow[]>([])
  const [lateTotal, setLateTotal] = useState<number>(0)
  const [count, setCount] = useState<number>(0)
  const [offset, setOffset] = useState<number>(0)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<string>('')
  const [showAllDates, setShowAllDates] = useState(false)
  const [draft, setDraft] = useState(EMPTY_NEW)
  const [draftError, setDraftError] = useState<string>('')
  const [creating, setCreating] = useState<boolean>(false)

  const setUrl = useCallback((patch: Partial<ProjectsUrlState>) => {
    setParams(writeUrl({ ...readUrl(params), ...patch }), { replace: true })
  }, [params, setParams])

  const load = useCallback(async () => {
    const token = ++request.current
    try {
      setError(null)
      setLoading(true)
      const res = (await projectsApi.list({ limit: LOAD_LIMIT, offset, status: archived ? 'archived' : undefined })) as unknown as ListResponse
      if (token !== request.current) return
      setRows(res.projects ?? [])
      setNeeds(res.needsYou ?? [])
      setLateTotal(res.lateTotal ?? 0)
      setCount(res.count ?? 0)
      setHasMore(res.hasMore ?? false)
    } catch (err) {
      if (token !== request.current) return
      console.error('[Projects] load error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      if (token === request.current) setLoading(false)
    }
  }, [archived, offset])

  useEffect(() => {
    void load()
    return () => { request.current++ }
  }, [load])

  // The old portfolio Board (?view=board) is cut: its kanban lives in Tasks › Lanes.
  useEffect(() => {
    if (params.get('view') === 'board') navigate('/tasks?view=lanes', { replace: true })
  }, [params, navigate])

  const now = new Date()
  const counts = filterCounts(rows)
  const shown = shownProjects(rows, url.show, search)
  const sum = listSummary(rows, now)
  const tl = loading ? null : timeline(rows, now, showAllDates ? rows.length : SCHEDULE_PREVIEW)
  const scale = tl?.scale
  const paged = offset > 0 || hasMore

  const create = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!draft.name.trim()) { setDraftError('Give the project a name'); return }
    try {
      setCreating(true)
      const res = (await projectsApi.create({
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        startDate: draft.startDate || undefined,
        endDate: draft.endDate || undefined,
        tags: draft.tags ? draft.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      })) as unknown as { project?: { id?: string } }
      setDraft(EMPTY_NEW)
      setDraftError('')
      toast.success('Created', 'Project created')
      if (res.project?.id) navigate(`/projects/${res.project.id}`)
      else { setUrl({ drawer: null }); void load() }
    } catch (err) {
      console.error('[Projects] create error:', err)
      toast.error('Error', err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  if (error) return (
    <>
      <ErrorState message={error} onRetry={load} />
      {offset > 0 && <Key onClick={() => setOffset(offset - LOAD_LIMIT)}>Previous page</Key>}
    </>
  )

  const filterOptions: Array<{ value: ProjectFilter; label: React.ReactNode }> = [
    { value: 'active', label: <>Active {!archived && <span className="bs-proj-n">{counts.active}</span>}</> },
    { value: 'planning', label: <>Planning {!archived && <span className="bs-proj-n">{counts.planning}</span>}</> },
    { value: 'done', label: <>Done {!archived && <span className="bs-proj-n">{counts.done}</span>}</> },
    { value: 'archived', label: 'Archived' },
    { value: 'all', label: <>All {!archived && <span className="bs-proj-n">{counts.all}</span>}</> },
  ]

  const meta = loading
    ? <span>Loading</span>
    : archived
      ? <span><b>{plural(count, 'archived project')}</b></span>
      : <span><b>{paged ? `${rows.length} of ${count} projects` : plural(rows.length, 'project')}</b> · {sum.active} active{lateTotal > 0 && <> · <span className="bs-proj-late">{plural(lateTotal, 'late item')}</span></>}{paged && ' · Totals for this page'}</span>

  return (
    <div className="bs-proj">
      <TitleRule
        title="Projects"
        meta={meta}
        actions={<Key variant="primary" onClick={() => setUrl({ drawer: 'new' })}>New project</Key>}
      />

      {!archived && <Grid>
        <Cell span={8}>
          <Display className="bs-proj-disp" role="region" aria-label="Deadlines">
            <div className="bs-proj-disp-head">
              <h2 className="bs-lbl">Deadlines</h2>
              {!loading && sum.slipping > 0 && <Signal tone="brand">{plural(sum.slipping, 'project')} slipping</Signal>}
            </div>
            {tl && scale ? (
              <>
                <ScheduleAxis scale={scale} />
                <ul className="bs-proj-schedule-rows">
                  {tl.rows.map((r) => (
                    <li key={r.id}>
                      <Link to={`/projects/${r.id}`} className="bs-proj-schedule-row">
                        <span className="bs-proj-schedule-info">
                          <strong>{r.name}</strong>
                          <ScheduleFacts schedule={r.schedule} />
                        </span>
                        <span className="bs-proj-schedule-work">
                          <ScheduleTrack scale={scale} startPct={r.startPct} endPct={r.endPct} overdue={r.schedule.overdue} />
                          <span className="bs-proj-measures">
                            <span>{r.total ? `${r.done} of ${r.total} items complete` : 'No work items'}</span>
                            {r.late > 0 && <span className="bs-proj-due-late">{plural(r.late, 'late item')}</span>}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {tl.datedCount > SCHEDULE_PREVIEW && (
                  <div className="bs-proj-schedule-more">
                    <span>{tl.rows.length} of {tl.datedCount} dated projects{paged ? ' on this page' : ''}</span>
                    <button type="button" className="bs-proj-display-link" aria-expanded={showAllDates} onClick={() => setShowAllDates(!showAllDates)}>
                      {showAllDates ? 'Show nearest deadlines' : 'Show all dated projects'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="bs-proj-disp-empty">{loading ? 'Loading deadlines' : 'No active or planning projects with an end date.'}</p>
            )}
            {tl && tl.undated.length > 0 && (
              <details className="bs-proj-undated">
                <summary>No end date ({tl.undated.length})</summary>
                <ul>
                  {tl.undated.map(({ project, schedule }) => (
                    <li key={project.id}>
                      <Link className="bs-proj-display-link" to={`/projects/${project.id}`}>{projectName(project)}</Link>
                      {schedule.start != null && <span className="bs-proj-dates">{schedule.dateLabel}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Display>
        </Cell>
        <Cell span={4} rule>
          <div className="bs-proj-ro">
            <Readout label="Active projects" value={loading ? '—' : sum.active} context={sum.slipping > 0 ? `${sum.slipping} slipping` : 'None slipping'} />
            <Readout label="Late items" value={<span className={lateTotal ? 'bs-proj-late' : undefined}>{loading ? '—' : lateTotal}</span>} context="Tasks and meeting action items" />
            <Readout label="Decisions" value={loading ? '—' : sum.decisions} context={`from ${plural(sum.meetings, 'linked meeting')}`} />
          </div>
        </Cell>
      </Grid>}

      <Grid className={archived ? undefined : 'bs-proj-row2'}>
        <Cell span={archived ? 12 : 8}>
          <section aria-labelledby="proj-list">
            <Section number={archived ? undefined : '01'} id="proj-list" title={archived ? 'Archived projects' : 'Projects'} aside={<Switch<ProjectFilter> label="Status" options={filterOptions} value={url.show} onChange={(v) => {
              if ((v === 'archived') !== archived) {
                setLoading(true)
                setOffset(0)
              }
              setUrl({ show: v })
            }} className="bs-proj-filter" />} />
            <div className="bs-proj-search">
              <TextInput icon={<Search aria-hidden="true" />} placeholder={paged ? 'Search this page' : 'Search projects'} aria-label={paged ? 'Search projects on this page' : 'Search projects'} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="bs-proj-pt head bs-lbl" aria-hidden="true">
              <span>Project</span><span className="bs-dt bs-proj-c-end">Ends</span><span className="bs-dt bs-proj-c-prog">Progress</span><span className="bs-dt bs-proj-c-num bs-proj-r">Open</span><span className="bs-dt bs-proj-c-num bs-proj-r">Late</span><span>Status</span>
            </div>
            {loading ? <p className="bs-proj-empty">Loading projects</p> : shown.length === 0 ? (
              <div className="bs-proj-empty">
                <p>{paged ? 'No projects match on this page.' : search || url.show !== 'all' ? 'No projects match.' : 'No projects yet. A project collects the decisions and action items of the meetings you link to it.'}</p>
                {!paged && !search && url.show === 'all' && <Key onClick={() => setUrl({ drawer: 'new' })}>New project</Key>}
              </div>
            ) : (
              <ul className="bs-rows">
                {shown.map((p) => {
                  const r = rollupOf(p)
                  const sig = projectSignal(p, now)
                  return (
                    <li key={p.id}>
                      <Link to={`/projects/${p.id}`} className="bs-proj-pt">
                        <span className="bs-proj-pt-main">
                          <span className="bs-proj-pt-name">{projectName(p)}</span>
                          <span className="bs-proj-pt-sub">
                            {r.lastMeeting ? <>Last: {r.lastMeeting.title || 'Meeting'}</> : 'No meetings linked'}
                          </span>
                          <span className="bs-proj-pt-ph bs-mono">
                            {p.end_date ? `Ends ${dayShort(p.end_date)}` : 'No end date'} · {r.open} open{r.late > 0 && <> · <span className="bs-proj-late">{r.late} late</span></>}
                          </span>
                        </span>
                        <span className="bs-dt bs-proj-c-end bs-mono bs-proj-pt-end" title={endsLabel(p.end_date, now)}>{dayShort(p.end_date)}</span>
                        <span className="bs-dt bs-proj-c-prog bs-proj-prog">
                          <span className="bs-mono">{r.done}/{r.total} done</span>
                          <span className="bs-proj-bar" aria-hidden="true"><i style={{ width: `${progressPct(r)}%` }} /></span>
                        </span>
                        <span className={`bs-dt bs-proj-c-num bs-num bs-proj-r${r.open ? '' : ' bs-proj-z'}`}>{r.open}</span>
                        <span className={`bs-dt bs-proj-c-num bs-num bs-proj-r${r.late ? ' bs-proj-late' : ' bs-proj-z'}`}>{r.late}</span>
                        <Signal tone={sig.tone}>{sig.word}</Signal>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
            {paged && (
              <nav className="bs-tasks-keys bs-proj-cap" aria-label="Project pages">
                <Key disabled={loading || offset === 0} onClick={() => { setLoading(true); setOffset(offset - LOAD_LIMIT) }}>Previous page</Key>
                <span className="bs-lbl" aria-live="polite">{loading ? 'Loading projects' : rows.length ? `${offset + 1}–${offset + rows.length} of ${count}` : `0 on this page · ${count} total`}</span>
                <Key disabled={loading || !hasMore} onClick={() => { setLoading(true); setOffset(offset + LOAD_LIMIT) }}>Next page</Key>
              </nav>
            )}
          </section>
        </Cell>
        {!archived && <Cell span={4} rule>
          <section aria-labelledby="proj-needs">
            <Section number="02" id="proj-needs" title="Needs you" level={3} aside={lateTotal > needs.length ? `${needs.length} of ${lateTotal}` : undefined} />
            {loading ? <p className="bs-proj-empty">Loading</p> : needs.length === 0 ? (
              <p className="bs-proj-empty">{paged ? 'Nothing late in the projects on this page.' : 'Nothing late across your projects.'}</p>
            ) : (
              <ul className="bs-rows">
                {needs.map((n) => (
                  <li key={n.key}>
                    <Link to={`/projects/${n.projectId}?item=${encodeURIComponent(n.key)}`} className="bs-proj-need">
                      <span className="bs-led brand" aria-hidden="true" />
                      <span className="bs-proj-need-main">
                        <span className="bs-proj-need-t">{n.title}</span>
                        <span className="bs-proj-need-m">{n.projectName} · {n.owner || 'No owner'} · was due {dayShort(n.due)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Cell>}
      </Grid>

      <Drawer open={url.drawer === 'new'} onClose={() => setUrl({ drawer: null })} label="New project">
        <form className="bs-tasks-form" onSubmit={create} noValidate>
          <label className="bs-tasks-fl">
            <span className="bs-lbl">Name</span>
            <TextInput autoFocus value={draft.name} placeholder="e.g. Northwind rollout" aria-invalid={Boolean(draftError) || undefined}
              onChange={(e) => { setDraft({ ...draft, name: e.target.value }); setDraftError('') }} />
          </label>
          {draftError && <p className="bs-tasks-err" role="alert">{draftError}</p>}
          <label className="bs-tasks-fl">
            <span className="bs-lbl">Description</span>
            <TextArea rows={3} value={draft.description} placeholder="What does done look like?" onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <div className="bs-tasks-f2">
            <label className="bs-tasks-fl">
              <span className="bs-lbl">Start</span>
              <TextInput type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
            </label>
            <label className="bs-tasks-fl">
              <span className="bs-lbl">End</span>
              <TextInput type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
            </label>
          </div>
          <label className="bs-tasks-fl">
            <span className="bs-lbl">Tags</span>
            <TextInput value={draft.tags} placeholder="rollout, client" onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
          </label>
          <p className="bs-proj-note bs-mut">Link meetings from the project page once it exists.</p>
          <div className="bs-tasks-keys">
            <Key type="button" onClick={() => setUrl({ drawer: null })}>Cancel</Key>
            <Key type="submit" variant="primary" disabled={creating}>{creating ? 'Creating' : 'Create project'}</Key>
          </div>
        </form>
      </Drawer>
    </div>
  )
}
