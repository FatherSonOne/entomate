import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { dashboardApi, meetingsApi, projectsApi, tasksApi } from '../services/api'
import {
  Cell, DateStamp, Display, Drawer, GroupHead, Grid, Key, Readout, Section, Signal, Switch, Tabs, TextArea, TextInput,
  TitleRule, Breadcrumbs, PHONE_QUERY, useMediaQuery,
} from '../components/bench'
import { useConfirm } from '../components/vc/ConfirmDialog'
import { useToast } from '../components/vc/ToastProvider'
import ErrorState from '../components/vc/ErrorState'
import TaskEditModal from '../components/TaskEditModal'
import TaskDetail from '../components/tasks/TaskDetail'
import {
  STATUSES, dueLabel, groupByUrgency, isOverdue, laneWord, lanes, meetingHref, statusTone, statusWord, timecode,
} from '../services/tasksView'
import type { TaskRow, WorkItem, WorkStatus } from '../services/tasksView'
import {
  countdown, dayShort, decisionHref, endsLabel, heldMeetings, linkCandidates, meetingDay, nextMeeting, normalizeProjectStatus,
  owners, plural, projectDecisions, projectName, projectSignal, projectTape, projectWork, readUrl, toTags, workCounts, writeUrl,
} from '../services/projectsView'
import type { LinkCandidate, ProjectDetailRow, ProjectStatus, ProjectsUrlState, WorkLayout } from '../services/projectsView'

/**
 * A project (route /projects/:id), Bench Swiss direction B "Bench" (2026-11-22).
 * Everything the project's meetings produced, in one place: a tape from kickoff to
 * the end date with its meetings and decisions, readouts, 01 Open work (its tasks and
 * its meetings' action items) beside who owes what, 02 Decisions beside its meetings.
 * Replaces the old project page and the per-project dashboard.
 */

interface ToastApi {
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
}
interface ConfirmOpts { title: string; message: string; confirmLabel: string; variant: 'danger' | 'primary' }
type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>
interface MeetingListRow { id: string; title?: string | null; summary?: string | null; created_at?: string | null; start_time?: string | null; project_id?: string | null }

const LAYOUTS: ReadonlyArray<{ value: WorkLayout; label: string }> = [{ value: 'list', label: 'List' }, { value: 'lanes', label: 'Lanes' }]
const STATUS_OPTIONS: ReadonlyArray<{ value: ProjectStatus; label: string }> = [
  { value: 'planning', label: 'Planning' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Done' }, { value: 'archived', label: 'Archived' },
]
const PRIORITIES = [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }] as const
type Priority = typeof PRIORITIES[number]['value']
const EMPTY_TASK = { title: '', description: '', priority: 'medium' as Priority, dueDate: '', assignedTo: '' }
const STATUS_WORD: Record<ProjectStatus, string> = { planning: 'Planning', active: 'Active', completed: 'Done', archived: 'Archived' }

interface EditForm { name: string; description: string; status: ProjectStatus; startDate: string; endDate: string; tags: string; dealValue: string }

function formOf(p: ProjectDetailRow): EditForm {
  return {
    name: projectName(p),
    description: p.description ?? '',
    status: normalizeProjectStatus(p.status),
    startDate: p.start_date?.slice(0, 10) ?? '',
    endDate: p.end_date?.slice(0, 10) ?? '',
    tags: toTags(p.tags).join(', '),
    dealValue: p.deal_value != null ? String(p.deal_value) : '',
  }
}

export default function ProjectDetail(): React.ReactElement {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast() as ToastApi
  const confirm = useConfirm() as ConfirmFn
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [params, setParams] = useSearchParams()
  const url = useMemo(() => readUrl(params), [params])

  const [project, setProject] = useState<ProjectDetailRow | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [missing, setMissing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [lane, setLane] = useState<WorkStatus>('open')
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null)
  const [taskForm, setTaskForm] = useState(EMPTY_TASK)
  const [taskError, setTaskError] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [edit, setEdit] = useState<EditForm | null>(null)
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null)
  const [linkPick, setLinkPick] = useState<Set<string>>(() => new Set())

  const setUrl = useCallback((patch: Partial<ProjectsUrlState>) => {
    setParams(writeUrl({ ...readUrl(params), ...patch }), { replace: true })
  }, [params, setParams])

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = (await projectsApi.get(id)) as unknown as ProjectDetailRow
      setProject(data)
    } catch (err) {
      const status = (err as { status?: number; response?: { status?: number } })?.response?.status ?? (err as { status?: number })?.status
      if (status === 404) setMissing(true)
      else setError(err instanceof Error ? err.message : 'Failed to load the project')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  // The Link meetings drawer loads recent meetings when it opens.
  useEffect(() => {
    if (url.drawer !== 'link' || !project) return
    let live = true
    setCandidates(null)
    meetingsApi.list({ limit: 50 })
      .then((res: unknown) => {
        if (!live) return
        const rows = (res as { meetings?: MeetingListRow[] }).meetings ?? []
        setCandidates(linkCandidates(project.id, projectName(project), rows))
        setLinkPick(new Set())
      })
      .catch(() => { if (live) setCandidates([]) })
    return () => { live = false }
  }, [url.drawer, project])

  useEffect(() => {
    if (url.drawer === 'edit' && project) setEdit(formOf(project))
  }, [url.drawer, project])

  const now = new Date()
  const work = useMemo(() => (project ? projectWork(project) : []), [project])
  const counts = workCounts(work, now)
  const groups = groupByUrgency(work, now)
  const byLane = lanes(work)
  const ownerLines = owners(work, now)
  const decisions = project ? projectDecisions(project, now) : []
  const held = project ? heldMeetings(project, now) : []
  const next = project ? nextMeeting(project, now) : null
  const tape = project ? projectTape(project, now) : null
  const selected = work.find((w) => w.key === url.item) ?? null

  // ── Writes (same endpoints as Tasks) ──
  const patchLocal = (item: WorkItem, status: WorkStatus): void => {
    setProject((p) => {
      if (!p) return p
      if (item.kind === 'task') return { ...p, tasks: (p.tasks ?? []).map((t) => (t.id === item.id ? { ...t, status } : t)) }
      return { ...p, actionItems: (p.actionItems ?? []).map((a) => (a.id === item.id ? { ...a, status } : a)) }
    })
  }

  const setStatus = async (item: WorkItem, status: WorkStatus): Promise<void> => {
    if (item.status === status) return
    patchLocal(item, status)
    try {
      if (item.kind === 'task') {
        if (status === 'done') await tasksApi.complete(item.id)
        else if (item.status === 'done' && status === 'open') await tasksApi.reopen(item.id)
        else await tasksApi.update(item.id, { status })
      } else {
        await dashboardApi.updateActionItemStatus(item.id, status)
      }
    } catch (err) {
      console.error('[Project] status error:', err)
      toast.error('Error', `Couldn't mark it ${statusWord(status).toLowerCase()}`)
      void load()
    }
  }

  const deleteTask = async (item: WorkItem): Promise<void> => {
    if (item.kind !== 'task') return
    const ok = await confirm({ title: 'Delete task', message: `Delete "${item.title}"?`, confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return
    try {
      await tasksApi.delete(item.id)
      setProject((p) => (p ? { ...p, tasks: (p.tasks ?? []).filter((t) => t.id !== item.id) } : p))
      setUrl({ item: null })
      toast.success('Deleted', 'Task deleted')
    } catch (err) {
      console.error('[Project] delete task error:', err)
      toast.error('Error', 'Failed to delete task')
    }
  }

  const addTask = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!taskForm.title.trim()) { setTaskError('Title is required'); return }
    try {
      setSaving(true)
      await tasksApi.create({
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
        assignedTo: taskForm.assignedTo.trim() || undefined,
        projectId: id,
      })
      setTaskForm(EMPTY_TASK)
      setTaskError('')
      setUrl({ drawer: null })
      toast.success('Added', 'Task added to the project')
      void load()
    } catch (err) {
      console.error('[Project] add task error:', err)
      toast.error('Error', err instanceof Error ? err.message : 'Failed to add task')
    } finally {
      setSaving(false)
    }
  }

  const saveProject = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!edit) return
    if (!edit.name.trim()) { toast.error('Name needed', 'Give the project a name'); return }
    const deal = edit.dealValue.trim() ? Number(edit.dealValue) : null
    if (deal != null && !Number.isFinite(deal)) { toast.error('Deal value', 'Use a number, like 12000'); return }
    try {
      setSaving(true)
      await projectsApi.update(id, {
        name: edit.name.trim(),
        description: edit.description.trim() || null,
        status: edit.status,
        start_date: edit.startDate || null,
        end_date: edit.endDate || null,
        tags: edit.tags.split(',').map((t) => t.trim()).filter(Boolean),
        deal_value: deal,
      })
      setUrl({ drawer: null })
      toast.success('Saved', 'Project updated')
      void load()
    } catch (err) {
      console.error('[Project] save error:', err)
      toast.error('Error', err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const deleteProject = async (): Promise<void> => {
    if (!project) return
    const ok = await confirm({
      title: 'Delete project',
      message: `Delete "${projectName(project)}" and its ${plural((project.tasks ?? []).length, 'task')}? Linked meetings and their action items stay.`,
      confirmLabel: 'Delete project',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await projectsApi.delete(id)
      toast.success('Deleted', 'Project deleted')
      navigate('/projects')
    } catch (err) {
      console.error('[Project] delete error:', err)
      toast.error('Error', 'Failed to delete project')
    }
  }

  const linkMeetings = async (): Promise<void> => {
    if (linkPick.size === 0) return
    try {
      setSaving(true)
      for (const mid of linkPick) await meetingsApi.update(mid, { project_id: id })
      toast.success('Linked', `${plural(linkPick.size, 'meeting')} linked`)
      setUrl({ drawer: null })
      void load()
    } catch (err) {
      console.error('[Project] link error:', err)
      toast.error('Error', 'Some meetings could not be linked')
      void load()
    } finally {
      setSaving(false)
    }
  }

  const unlinkMeeting = async (mid: string, title: string): Promise<void> => {
    const ok = await confirm({ title: 'Unlink meeting', message: `Unlink "${title}"? Its decisions and action items leave this project; the meeting stays.`, confirmLabel: 'Unlink', variant: 'primary' })
    if (!ok) return
    try {
      await meetingsApi.update(mid, { project_id: null })
      void load()
    } catch (err) {
      console.error('[Project] unlink error:', err)
      toast.error('Error', 'Failed to unlink the meeting')
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />
  if (missing) {
    return (
      <div className="bs-proj">
        <TitleRule title="Project not found" meta={<Link to="/projects" className="bs-proj-crumb">Projects</Link>} />
        <p className="bs-proj-empty">It may have been deleted. <Link to="/projects" className="bs-tasks-link">Back to projects</Link></p>
      </div>
    )
  }
  if (loading || !project) {
    return (
      <div className="bs-proj">
        <TitleRule title="Project" meta={<Link to="/projects" className="bs-proj-crumb">Projects</Link>} />
        <p className="bs-proj-empty">Loading</p>
      </div>
    )
  }

  const sig = projectSignal({ ...project, rollup: { ...counts, fromMeetings: 0, decisions: decisions.length, meetings: held.length, lastMeeting: null, nextMeeting: null } }, now)
  const status = normalizeProjectStatus(project.status)
  const tags = toTags(project.tags)
  const left = countdown(project.end_date, now)

  const meta = (
    <span>
      {STATUS_WORD[status]} · {project.end_date ? `ends ${dayShort(project.end_date)}` : 'no end date'}
      {project.deal_value != null && <> · ${Number(project.deal_value).toLocaleString()}</>}
      {tags.length > 0 && <> · {tags.join(', ')}</>}
    </span>
  )

  const actions = (
    <>
      <Key onClick={() => setUrl({ drawer: 'link' })}>Link meeting</Key>
      <Key onClick={() => setUrl({ drawer: 'edit' })}>Edit</Key>
      <Key variant="primary" onClick={() => setUrl({ drawer: 'task' })}>Add task</Key>
    </>
  )

  const row = (item: WorkItem): React.ReactElement => (
    <li
      key={item.key}
      className={`bs-tasks-row bs-proj-wk${selected?.key === item.key ? ' sel' : ''}${item.status === 'done' ? ' done' : ''}`}
      onClick={() => setUrl({ item: item.key })}
    >
      <input
        type="checkbox"
        className="bs-check"
        checked={item.status === 'done'}
        onChange={() => void setStatus(item, item.status === 'done' ? 'open' : 'done')}
        onClick={(e) => e.stopPropagation()}
        aria-label={item.status === 'done' ? `Reopen ${item.title}` : `Complete ${item.title}`}
      />
      <div className="bs-tasks-main">
        <button type="button" className="bs-tasks-title" onClick={(e) => { e.stopPropagation(); setUrl({ item: item.key }) }}>{item.title}</button>
        <div className="bs-tasks-meta">
          <span className="bs-proj-kind">{item.kind === 'action' ? 'Action item' : 'Task'}</span>
          {item.source && (
            <>
              <Link to={meetingHref(item.source)} className="bs-tasks-src" onClick={(e) => e.stopPropagation()}>
                <span className="bs-tasks-src-t">{item.source.title || 'Meeting'}</span>
              </Link>
              {item.source.atMs != null && (
                <Key size="tc" onClick={(e) => { e.stopPropagation(); navigate(meetingHref(item.source!)) }} aria-label={`Play from ${timecode(item.source.atMs)}`}>▶ {timecode(item.source.atMs)}</Key>
              )}
            </>
          )}
          {item.agent?.confidence != null && (
            <span className="bs-tasks-conf" title={item.agent.reason}><span className="bs-led ai" aria-hidden="true" />{item.agent.confidence}%</span>
          )}
          <span className="bs-tasks-ph">{item.owner || 'No owner'}</span>
        </div>
      </div>
      <span className="bs-dt bs-proj-own">{item.owner || <span className="bs-mut">No owner</span>}</span>
      <span className={`bs-tasks-due${isOverdue(item, now) ? ' late' : ''}`}>{dueLabel(item.due, now)}</span>
      <span className="bs-dt"><Signal tone={statusTone(item.status)}>{statusWord(item.status)}</Signal></span>
    </li>
  )

  const listView = work.length === 0 ? (
    <div className="bs-proj-empty">
      <p>No work yet. Link the meetings where this project came up and their action items land here, or add a task.</p>
      <div className="bs-tasks-keys"><Key onClick={() => setUrl({ drawer: 'link' })}>Link meeting</Key><Key variant="primary" onClick={() => setUrl({ drawer: 'task' })}>Add task</Key></div>
    </div>
  ) : (
    <>
      <div className="bs-tasks-row bs-proj-wk head bs-lbl" aria-hidden="true">
        <span /><span>Item · source</span><span className="bs-dt">Owner</span><span>Due</span><span className="bs-dt">Status</span>
      </div>
      {groups.map((g) => (
        <section key={g.key} className={`bs-tasks-grp${g.key === 'overdue' ? ' late' : ''}`} aria-label={g.label}>
          <GroupHead label={g.label} count={g.items.length} />
          <ul className="bs-rows">{g.items.map(row)}</ul>
        </section>
      ))}
    </>
  )

  const lanesView = (
    <>
      {isPhone && (
        <Tabs label="Status" idBase="proj-lanes" value={lane} onChange={setLane} className="bs-tasks-ltabs"
          items={STATUSES.map((s) => ({ value: s, label: laneWord(s), count: byLane[s].length }))} />
      )}
      <div className="bs-tasks-lanes">
        {STATUSES.filter((s) => !isPhone || s === lane).map((s) => (
          <section key={s} className="bs-tasks-lane" aria-label={statusWord(s)}>
            {!isPhone && <div className="bs-tasks-lh"><Signal tone={statusTone(s)}>{statusWord(s)}</Signal><span className="bs-mono">{byLane[s].length}</span></div>}
            <ul className="bs-tasks-li-list">
              {byLane[s].map((item) => (
                <li key={item.key} className={`bs-tasks-li${selected?.key === item.key ? ' sel' : ''}`}>
                  <button type="button" className="bs-tasks-li-btn" onClick={() => setUrl({ item: item.key })}>
                    <span className="bs-tasks-li-t">{item.title}</span>
                    <span className="bs-tasks-li-m">
                      <span>{item.owner || 'No owner'}</span>
                      <span className={isOverdue(item, now) ? 'late' : ''}>{item.due ? dueLabel(item.due, now) : 'No date'}</span>
                      {item.source && <span>{item.source.title || 'Meeting'}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {byLane[s].length === 0 && <p className="bs-tasks-empty">Nothing here.</p>}
          </section>
        ))}
      </div>
    </>
  )

  return (
    <div className="bs-proj">
      <TitleRule title={projectName(project)} crumbs={<Breadcrumbs current={projectName(project)} />} meta={meta} actions={actions} />

      <Grid>
        <Cell span={8}>
          {tape ? (
            <Display className="bs-proj-disp" aria-label="Project timeline">
              <div className="bs-proj-disp-head">
                <span className="bs-lbl">{tape.startLabel} → {tape.endLabel}</span>
                <Signal tone={sig.tone}>{sig.word}{counts.late > 0 ? ` · ${counts.late} late` : ''}</Signal>
              </div>
              <div className="bs-proj-cd">
                <span className="bs-disp-big">{left ?? endsLabel(project.end_date, now)}</span>
                {left && <span className="bs-lbl">to the end date</span>}
              </div>
              <div className="bs-proj-tape" role="img" aria-label={`${held.length} meetings, ${decisions.length} decisions, ${tape.elapsedPct.toFixed(0)}% of the time used`}>
                <div className="bs-proj-tape-base"><i style={{ width: `${tape.elapsedPct}%` }} /></div>
                {tape.marks.map((m) => (
                  <b key={m.key} className="bs-proj-tape-mk" style={{ left: `${m.pct}%` }}>
                    {m.labelled && <span className="bs-dt">{m.label}</span>}
                    {m.decisions > 0 && <i className="bs-proj-tape-dec" aria-hidden="true" />}
                  </b>
                ))}
                {tape.upcoming.map((m) => <b key={m.key} className="bs-proj-tape-mk up" style={{ left: `${m.pct}%` }}>{m.labelled && <span className="bs-dt">{m.label}</span>}</b>)}
                <span className="bs-proj-tape-now" style={{ left: `${tape.nowPct}%` }}><span>NOW</span></span>
                <span className="bs-proj-tape-st">{tape.startLabel}</span>
                {tape.nowPct < 82 && <span className="bs-proj-tape-end">ENDS {tape.endLabel}</span>}
              </div>
            </Display>
          ) : (
            <div className="bs-proj-nodisp">
              <p className="bs-mut">{project.description || 'No end date yet. Add one to see the timeline and countdown.'}</p>
              {!project.end_date && <Key size="sm" onClick={() => setUrl({ drawer: 'edit' })}>Add an end date</Key>}
            </div>
          )}
          {tape && project.description && <p className="bs-proj-desc">{project.description}</p>}
        </Cell>
        <Cell span={4} rule>
          <div className="bs-proj-ro">
            <Readout label="Open items" value={counts.open} context={`${counts.done} of ${counts.total} done`} />
            <Readout label="Late" value={<span className={counts.late ? 'bs-proj-late' : undefined}>{counts.late}</span>} context={counts.unowned ? `${counts.unowned} without an owner` : 'Everything has an owner'} />
            <Readout label="Decisions" value={decisions.length} context={`from ${plural(held.length, 'meeting')}`} />
          </div>
        </Cell>
      </Grid>

      <Grid className="bs-proj-row2">
        <Cell span={8}>
          <section aria-labelledby="proj-work">
            <Section number="01" id="proj-work" title="Open work" aside={<Switch<WorkLayout> label="Layout" options={LAYOUTS} value={url.layout} onChange={(v) => setUrl({ layout: v })} />} />
            <p className="bs-proj-src bs-mono">Tasks + action items from {plural(held.length, 'linked meeting')}</p>
            {url.layout === 'lanes' ? lanesView : listView}
          </section>
        </Cell>
        <Cell span={4} rule>
          <section aria-labelledby="proj-owners">
            <Section id="proj-owners" title="Who owes what" level={3} />
            {ownerLines.length === 0 ? <p className="bs-proj-empty">Nothing open.</p> : (
              <table className="bs-proj-ow">
                <caption className="bs-sr">Open and late items by owner</caption>
                <thead><tr><th className="bs-lbl">Owner</th><th className="bs-lbl">Open</th><th className="bs-lbl">Late</th></tr></thead>
                <tbody>
                  {ownerLines.map((o) => (
                    <tr key={o.name ?? '__none__'}>
                      <td className={o.name ? undefined : 'bs-mut'}>{o.name ?? 'No owner'}</td>
                      <td className="bs-num">{o.open}</td>
                      <td className={`bs-num${o.late ? ' bs-proj-late' : ''}`}>{o.late || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          {next && (
            <div className="bs-proj-next">
              <Signal tone="off">Next · {meetingDay(next).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')} {meetingDay(next).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Signal>
              <Link to={`/meetings/${next.id}`} className="bs-proj-next-t">{next.title || 'Meeting'}</Link>
              {counts.open > 0 && <span className="bs-proj-next-m">{plural(counts.open, 'open item')} carry into it</span>}
            </div>
          )}
        </Cell>
      </Grid>

      <Grid className="bs-proj-row2">
        <Cell span={8}>
          <section aria-labelledby="proj-dec">
            <Section number="02" id="proj-dec" title="Decisions" aside={decisions.length ? plural(decisions.length, 'decision') : undefined} />
            {decisions.length === 0 ? <p className="bs-proj-empty">No decisions yet. They come from the summaries of linked meetings.</p> : (
              <ul className="bs-rows">
                {decisions.map((d) => (
                  <li key={d.key} className="bs-row bs-row-dec bs-proj-dec">
                    <span className="bs-tick" aria-hidden="true" />
                    <span className="bs-row-text">
                      {d.text}
                      <span className="bs-proj-dec-m">{d.meetingTitle} · {dayShort(d.date.toISOString())}</span>
                    </span>
                    {d.atMs != null
                      ? <Key size="tc" onClick={() => navigate(decisionHref(d))} aria-label={`Play from ${timecode(d.atMs)}`}>▶ {timecode(d.atMs)}</Key>
                      : <Link to={decisionHref(d)} className="bs-key sm">Open</Link>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Cell>
        <Cell span={4} rule>
          <section aria-labelledby="proj-mtgs">
            <Section id="proj-mtgs" title="Meetings" level={3} aside={<Key size="sm" onClick={() => setUrl({ drawer: 'link' })}>Link</Key>} />
            {held.length === 0 ? <p className="bs-proj-empty">No meetings linked yet.</p> : (
              <ul className="bs-rows">
                {held.map((m) => (
                  <li key={m.id} className="bs-proj-mt">
                    <DateStamp date={meetingDay(m)} />
                    <span className="bs-proj-mt-main">
                      <Link to={`/meetings/${m.id}`} className="bs-proj-mt-t">{m.title || 'Untitled meeting'}</Link>
                      <span className="bs-proj-mt-m">
                        {plural(decisions.filter((d) => d.meetingId === m.id).length, 'decision')} · {plural(work.filter((w) => w.source?.meetingId === m.id).length, 'item')}
                      </span>
                    </span>
                    <button type="button" className="bs-proj-unlink" onClick={() => void unlinkMeeting(m.id, m.title || 'this meeting')} aria-label={`Unlink ${m.title || 'meeting'}`}>Unlink</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Cell>
      </Grid>

      <Drawer open={selected != null} onClose={() => setUrl({ item: null })} label={selected?.kind === 'action' ? 'Action item' : 'Task'}>
        {selected && (
          <TaskDetail
            key={selected.key}
            item={selected}
            now={now}
            inDrawer
            onStatus={(it: WorkItem, s: WorkStatus) => void setStatus(it, s)}
            onEdit={() => setEditingTask((project.tasks ?? []).find((t) => t.id === selected.id) ?? null)}
            onDelete={() => void deleteTask(selected)}
            onOpenMeeting={(href: string) => navigate(href)}
          />
        )}
      </Drawer>

      <Drawer open={url.drawer === 'task'} onClose={() => setUrl({ drawer: null })} label={`New task · ${projectName(project)}`}>
        <form className="bs-tasks-form" onSubmit={addTask} noValidate>
          <label className="bs-tasks-fl">
            <span className="bs-lbl">Title</span>
            <TextInput autoFocus value={taskForm.title} placeholder="What needs doing?" aria-invalid={Boolean(taskError) || undefined}
              onChange={(e) => { setTaskForm({ ...taskForm, title: e.target.value }); setTaskError('') }} />
          </label>
          {taskError && <p className="bs-tasks-err" role="alert">{taskError}</p>}
          <label className="bs-tasks-fl">
            <span className="bs-lbl">Details</span>
            <TextArea rows={3} value={taskForm.description} placeholder="Add details" onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
          </label>
          <div className="bs-tasks-fl">
            <span className="bs-lbl">Priority</span>
            <Switch<Priority> label="Priority" options={PRIORITIES} value={taskForm.priority} onChange={(v) => setTaskForm({ ...taskForm, priority: v })} />
          </div>
          <div className="bs-tasks-f2">
            <label className="bs-tasks-fl">
              <span className="bs-lbl">Due</span>
              <TextInput type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
            </label>
            <label className="bs-tasks-fl">
              <span className="bs-lbl">Owner</span>
              <TextInput value={taskForm.assignedTo} placeholder="Name" onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })} />
            </label>
          </div>
          <div className="bs-tasks-keys">
            <Key type="button" onClick={() => setUrl({ drawer: null })}>Cancel</Key>
            <Key type="submit" variant="primary" disabled={saving}>{saving ? 'Adding' : 'Add task'}</Key>
          </div>
        </form>
      </Drawer>

      <Drawer open={url.drawer === 'edit'} onClose={() => setUrl({ drawer: null })} label="Edit project">
        {edit && (
          <form className="bs-tasks-form" onSubmit={saveProject} noValidate>
            <label className="bs-tasks-fl">
              <span className="bs-lbl">Name</span>
              <TextInput value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </label>
            <label className="bs-tasks-fl">
              <span className="bs-lbl">Description</span>
              <TextArea rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </label>
            <div className="bs-tasks-fl">
              <span className="bs-lbl">Status</span>
              <Switch<ProjectStatus> label="Status" className="bs-tasks-stsw" options={STATUS_OPTIONS} value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} />
            </div>
            <div className="bs-tasks-f2">
              <label className="bs-tasks-fl">
                <span className="bs-lbl">Start</span>
                <TextInput type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} />
              </label>
              <label className="bs-tasks-fl">
                <span className="bs-lbl">End</span>
                <TextInput type="date" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} />
              </label>
            </div>
            <div className="bs-tasks-f2">
              <label className="bs-tasks-fl">
                <span className="bs-lbl">Tags</span>
                <TextInput value={edit.tags} placeholder="rollout, client" onChange={(e) => setEdit({ ...edit, tags: e.target.value })} />
              </label>
              <label className="bs-tasks-fl">
                <span className="bs-lbl">Deal value</span>
                <TextInput inputMode="decimal" value={edit.dealValue} placeholder="None" onChange={(e) => setEdit({ ...edit, dealValue: e.target.value })} />
              </label>
            </div>
            <div className="bs-tasks-keys">
              <Key type="button" onClick={() => setUrl({ drawer: null })}>Cancel</Key>
              <Link to="/analytics?export=project-pdf" className="bs-key">Export report</Link>
              <Key type="submit" variant="primary" disabled={saving}>{saving ? 'Saving' : 'Save'}</Key>
            </div>
            <div className="bs-proj-danger">
              <Key type="button" size="sm" onClick={() => void deleteProject()}>Delete project</Key>
              <span className="bs-mut">Deletes its tasks. Linked meetings stay.</span>
            </div>
          </form>
        )}
      </Drawer>

      <Drawer
        open={url.drawer === 'link'}
        onClose={() => setUrl({ drawer: null })}
        label={`Link meetings · ${projectName(project)}`}
        footer={<Key variant="primary" disabled={saving || linkPick.size === 0} onClick={() => void linkMeetings()}>{linkPick.size ? `Link ${plural(linkPick.size, 'meeting')}` : 'Pick meetings to link'}</Key>}
      >
        <p className="bs-proj-note">Linked meetings send their decisions and action items to this project. Meetings that mention it come first.</p>
        {candidates == null ? <p className="bs-proj-empty">Loading meetings</p> : candidates.length === 0 ? <p className="bs-proj-empty">No other meetings to link.</p> : (
          <ul className="bs-rows">
            {candidates.map((c) => {
              const on = linkPick.has(c.id)
              return (
                <li key={c.id}>
                  <label className="bs-proj-lk">
                    <input type="checkbox" className="bs-check" checked={on}
                      onChange={() => setLinkPick((prev) => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })} />
                    <span className="bs-proj-lk-main">
                      <span className="bs-proj-lk-t">{c.title}</span>
                      <span className="bs-proj-lk-m">
                        {c.at ? dayShort(c.at.toISOString()) : 'No date'}
                        {c.mentions > 0 && <> · mentions this project {plural(c.mentions, 'time')}</>}
                        {c.linkedElsewhere && <> · moves from another project</>}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </Drawer>

      {editingTask && (
        <div className="bs-skin">
          <TaskEditModal task={editingTask} onClose={() => setEditingTask(null)} onSaved={() => { setEditingTask(null); void load() }} />
        </div>
      )}
    </div>
  )
}
