import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { dashboardApi, tasksApi } from '../services/api'
import {
  Drawer, GroupHead, Key, PHONE_QUERY, Signal, Switch, Tabs, TextArea, TextInput, TitleRule, useMediaQuery,
} from '../components/bench'
import { useConfirm } from '../components/vc/ConfirmDialog'
import { useToast } from '../components/vc/ToastProvider'
import ErrorState from '../components/vc/ErrorState'
import TaskEditModal from '../components/TaskEditModal'
import TaskDetail, { Priority } from '../components/tasks/TaskDetail'
import {
  STATUSES, agentLabel, allTags, dueLabel, filterItems, groupByUrgency, isOverdue, laneWord, lanes, meetingHref,
  readUrl, sortItems, statusTone, statusWord, summarize, timecode, toWorkItems, writeUrl,
} from '../services/tasksView'

/**
 * 07 Tasks (Bench Swiss, picked mix): one work list of the tasks people add and
 * the action items meetings produce. Desktop: grouped by urgency with an
 * inspector column (a drawer below 1200px); Lanes is the second view. Phone:
 * Lanes first, one status per tab, with the urgency list behind List.
 * View logic lives in services/tasksView.ts.
 */

const LOAD_LIMIT = 200
const WIDE_QUERY = '(min-width: 1200px)'

const SHOW_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'meetings', label: <><span className="bs-dt">From meetings</span><span className="bs-tasks-ph">Meetings</span></> },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
]
const SOURCE_OPTIONS = [{ value: 'all', label: 'All' }, { value: 'meetings', label: <><span className="bs-dt">From meetings</span><span className="bs-tasks-ph">Meetings</span></> }]
const LAYOUT_OPTIONS = [{ value: 'list', label: 'List' }, { value: 'lanes', label: 'Lanes' }]
const SORT_OPTIONS = [
  { value: 'due', label: 'Due' },
  { value: 'priority', label: 'Priority' },
  { value: 'created', label: 'Created' },
  { value: 'title', label: 'Title' },
]
const PRIORITY_OPTIONS = [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]
const EMPTY_NEW = { title: '', description: '', priority: 'medium', dueDate: '', assignedTo: '', tags: '' }


function SourceLine({ item }) {
  if (!item.source) return <span className="bs-mono bs-tasks-added">Added by hand</span>
  return (
    <Link to={meetingHref(item.source)} className="bs-tasks-src" onClick={(e) => e.stopPropagation()}>
      <span className="bs-tick" aria-hidden="true" />
      <span className="bs-tasks-src-t">{item.source.title || 'Meeting'}</span>
      {item.source.atMs != null && <span className="bs-mono"> · {timecode(item.source.atMs)}</span>}
    </Link>
  )
}

export default function Tasks() {
  const confirm = useConfirm()
  const toast = useToast()
  const navigate = useNavigate()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const isWide = useMediaQuery(WIDE_QUERY)
  const [params, setParams] = useSearchParams()
  const url = useMemo(() => readUrl(params), [params])
  const layout = url.layout ?? (isPhone ? 'lanes' : 'list')

  const [taskRows, setTaskRows] = useState([])
  const [actionRows, setActionRows] = useState([])
  const [taskTotal, setTaskTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState(() => new Set())
  const [drawer, setDrawer] = useState(null) // 'new' | 'filter' | null
  const [newTask, setNewTask] = useState(EMPTY_NEW)
  const [newError, setNewError] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [dragKey, setDragKey] = useState(null)
  const searchRef = useRef(null)

  // The command palette opens the same draft drawer as this page's New task key.
  useEffect(() => {
    if (params.get('new') !== 'true') return
    setDrawer('new')
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
  }, [params, setParams])

  const setUrl = useCallback((patch) => {
    setParams(writeUrl({ ...readUrl(params), ...patch }), { replace: true })
  }, [params, setParams])

  const load = useCallback(async () => {
    try {
      setError(null)
      const [t, a] = await Promise.all([
        tasksApi.list({ limit: LOAD_LIMIT, sortBy: 'due_date', sortDir: 'asc' }),
        dashboardApi.getActionItems({ status: 'all', sort: 'due_date', limit: LOAD_LIMIT }).catch(() => ({ actionItems: [] })),
      ])
      setTaskRows(t.tasks || [])
      setTaskTotal(t.count || 0)
      setActionRows(a.actionItems || a.data?.actionItems || [])
    } catch (err) {
      console.error('[Tasks] load error:', err)
      setError(err.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Keys: / searches, N opens a new task.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (e.metaKey || e.ctrlKey || e.altKey || (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setDrawer('new') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const items = useMemo(() => toWorkItems(taskRows, actionRows), [taskRows, actionRows])
  const now = new Date()
  const summary = summarize(items, now)
  const tags = useMemo(() => allTags(items), [items])
  const shown = useMemo(
    () => sortItems(filterItems(items, { show: url.show, search, tag: url.tag }), url.sort),
    [items, url.show, url.sort, url.tag, search]
  )
  // Lanes show every status, so only the search, source and tag filters apply there.
  const laneItems = useMemo(
    () => sortItems(filterItems(items, { show: url.show === 'meetings' ? 'meetings' : 'all', search, tag: url.tag }), url.sort),
    [items, url.show, url.sort, url.tag, search]
  )
  const groups = groupByUrgency(shown, now)
  const byLane = lanes(laneItems)
  const selected = items.find((i) => i.key === url.item) ?? null
  const inlineInspector = isWide && layout === 'list'
  const inspected = inlineInspector ? (selected ?? shown[0] ?? null) : selected

  // ── Writes (business logic unchanged: same endpoints as before) ──
  const patchLocal = (item, status) => {
    if (item.kind === 'task') setTaskRows((rows) => rows.map((r) => (r.id === item.id ? { ...r, status } : r)))
    else setActionRows((rows) => rows.map((r) => (r.id === item.id ? { ...r, status } : r)))
  }

  const patchAction = (saved) => setActionRows((rows) => rows.map((r) => r.id === saved.id ? { ...r, ...saved } : r))

  const setStatus = async (item, status) => {
    if (item.status === status) return
    patchLocal(item, status)
    try {
      if (item.kind === 'task') {
        if (status === 'done') await tasksApi.complete(item.id)
        else if (item.status === 'done' && status === 'open') await tasksApi.reopen(item.id)
        else await tasksApi.update(item.id, { status })
      } else {
        const { actionItem } = await dashboardApi.updateActionItemStatus(item.id, status)
        if (actionItem) patchAction(actionItem)
      }
    } catch (err) {
      console.error('[Tasks] status error:', err)
      toast.error('Error', `Couldn't mark it ${statusWord(status).toLowerCase()}`)
      load()
    }
  }

  const toggleDone = (item) => setStatus(item, item.status === 'done' ? 'open' : 'done')

  const handleDelete = async (item) => {
    if (item.kind !== 'task') return
    const ok = await confirm({ title: 'Delete task', message: `Delete "${item.title}"?`, confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return
    try {
      await tasksApi.delete(item.id)
      setTaskRows((rows) => rows.filter((r) => r.id !== item.id))
      if (url.item === item.key) setUrl({ item: null })
      toast.success('Deleted', 'Task deleted')
    } catch (err) {
      console.error('[Tasks] delete error:', err)
      toast.error('Error', 'Failed to delete task')
    }
  }

  const pickedItems = items.filter((i) => picked.has(i.key))
  const togglePick = (key) => setPicked((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const stopPicking = () => { setPicking(false); setPicked(new Set()) }

  const handleBulkStatus = async (status) => {
    if (pickedItems.length === 0) return
    const ok = await confirm({ title: 'Bulk update', message: `Mark ${pickedItems.length} as "${statusWord(status)}"?`, confirmLabel: 'Update', variant: 'primary' })
    if (!ok) return
    try {
      const taskIds = pickedItems.filter((i) => i.kind === 'task').map((i) => i.id)
      if (taskIds.length) await tasksApi.bulkUpdateStatus(taskIds, status)
      for (const i of pickedItems.filter((x) => x.kind === 'action')) await dashboardApi.updateActionItemStatus(i.id, status)
      toast.success('Updated', `${pickedItems.length} updated to ${statusWord(status)}`)
      stopPicking()
      load()
    } catch (err) {
      console.error('[Tasks] bulk status error:', err)
      toast.error('Error', 'Bulk update failed')
      load()
    }
  }

  const handleBulkDelete = async () => {
    const del = pickedItems.filter((i) => i.kind === 'task')
    if (del.length === 0) {
      toast.error('Nothing to delete', 'Action items stay with their meeting. Mark them done instead.')
      return
    }
    const skipped = pickedItems.length - del.length
    const ok = await confirm({
      title: 'Delete tasks',
      message: `Delete ${del.length} task(s)? This cannot be undone.${skipped ? ` ${skipped} action item(s) stay with their meeting.` : ''}`,
      confirmLabel: 'Delete all',
      variant: 'danger',
    })
    if (!ok) return
    try {
      let deleted = 0
      for (const i of del) { await tasksApi.delete(i.id); deleted++ }
      toast.success('Deleted', `${deleted} task(s) deleted`)
      stopPicking()
      load()
    } catch (err) {
      console.error('[Tasks] bulk delete error:', err)
      toast.error('Error', 'Some tasks could not be deleted')
      load()
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newTask.title.trim()) { setNewError('Title is required'); return }
    if (newTask.dueDate && Number.isNaN(new Date(newTask.dueDate).getTime())) { setNewError('Invalid date'); return }
    try {
      setCreating(true)
      await tasksApi.create({
        title: newTask.title.trim(),
        priority: newTask.priority,
        dueDate: newTask.dueDate || undefined,
        description: newTask.description || undefined,
        assignedTo: newTask.assignedTo || undefined,
        tags: newTask.tags ? newTask.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      })
      setNewTask(EMPTY_NEW)
      setNewError('')
      setDrawer(null)
      load()
      toast.success('Created', 'Task created')
    } catch (err) {
      console.error('[Tasks] create error:', err)
      toast.error('Error', err.message || 'Failed to create task')
    } finally {
      setCreating(false)
    }
  }

  const openItem = (item) => {
    if (picking) { togglePick(item.key); return }
    setUrl({ item: item.key })
  }

  // ── Drag between lanes (desktop) ──
  const onDrop = (status) => (e) => {
    e.preventDefault()
    const item = items.find((i) => i.key === dragKey)
    setDragKey(null)
    if (item) setStatus(item, status)
  }

  const meta = (
    <span>
      <b>{summary.open} open</b>
      {summary.overdue > 0 && <> · <span className="bs-tasks-late">{summary.overdue} overdue</span></>}
      {' · '}{summary.fromMeetings} from meetings
      {summary.agentCalls > 0 && <> · {summary.agentCalls} agent {summary.agentCalls === 1 ? 'call' : 'calls'}</>}
    </span>
  )

  const actions = (
    <>
      <Switch label="Layout" options={LAYOUT_OPTIONS} value={layout} onChange={(v) => setUrl({ layout: v })} />
      <Key className="bs-tasks-select" disabled={layout !== 'list'} onClick={() => (picking ? stopPicking() : setPicking(true))} aria-pressed={picking}>Select</Key>
      <Key variant="primary" kbd={isPhone ? undefined : 'N'} onClick={() => setDrawer('new')}>New task</Key>
    </>
  )

  const filterBar = (
    <div className="bs-tasks-fbar">
      <TextInput
        ref={searchRef}
        icon={<Search aria-hidden="true" />}
        placeholder="Search tasks"
        aria-label="Search tasks"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bs-tasks-search"
      />
      <Key size="sm" className="bs-tasks-filter-key" onClick={() => setDrawer('filter')} aria-haspopup="dialog"
        aria-label={url.tag ? `Tag: ${url.tag}, filter and sort` : undefined}>
        <span>{url.tag ? `Tag: ${url.tag}` : 'Filter · sort'}</span>
      </Key>
      {layout === 'lanes' ? (
        <Switch label="Source" options={SOURCE_OPTIONS} value={url.show === 'meetings' ? 'meetings' : 'all'} onChange={(v) => setUrl({ show: v === 'meetings' ? 'meetings' : 'open' })} />
      ) : (
        <Switch label="Show" options={SHOW_OPTIONS} value={url.show} onChange={(v) => setUrl({ show: v })} />
      )}
    </div>
  )

  const row = (item) => {
    const isSel = inlineInspector && inspected?.key === item.key && !picking
    const isPicked = picked.has(item.key)
    return (
      <li
        key={item.key}
        className={`bs-tasks-row${isSel || isPicked ? ' sel' : ''}${item.status === 'done' ? ' done' : ''}`}
        onClick={() => openItem(item)}
      >
        <input
          type="checkbox"
          className={`bs-check${picking ? ' bs-tasks-pick' : ''}`}
          checked={picking ? isPicked : item.status === 'done'}
          onChange={() => (picking ? togglePick(item.key) : toggleDone(item))}
          onClick={(e) => e.stopPropagation()}
          aria-label={picking ? `Select ${item.title}` : item.status === 'done' ? `Reopen ${item.title}` : `Complete ${item.title}`}
        />
        <div className="bs-tasks-main">
          <button type="button" className="bs-tasks-title" onClick={(e) => { e.stopPropagation(); openItem(item) }}>{item.title}</button>
          <div className="bs-tasks-meta">
            <SourceLine item={item} />
            {item.owner && <span>{item.owner}</span>}
            {item.agent?.confidence != null && (
              <span className="bs-tasks-conf" title={`${agentLabel(item.agent)}: ${item.agent.reason}`}>
                <span className="bs-led ai" aria-hidden="true" />{item.agent.confidence}%
              </span>
            )}
            <span className="bs-tasks-ph"><Signal tone={statusTone(item.status)}>{statusWord(item.status)}</Signal></span>
          </div>
        </div>
        <span className={`bs-tasks-due${isOverdue(item, now) ? ' late' : ''}`}>{dueLabel(item.due, now)}</span>
        <span className="bs-dt"><Priority p={item.priority} /></span>
        <span className="bs-dt"><Signal tone={statusTone(item.status)}>{statusWord(item.status)}</Signal></span>
      </li>
    )
  }

  const listView = (
    <div className="bs-tasks-list">
      {picking && (
        <div className="bs-bulk-actions" role="toolbar" aria-label="Bulk actions">
          <b>{picked.size} selected</b>
          <Key size="sm" onClick={() => handleBulkStatus('done')} disabled={!picked.size}>Mark done</Key>
          <Key size="sm" onClick={() => handleBulkStatus('in_progress')} disabled={!picked.size}>In progress</Key>
          <Key size="sm" onClick={() => handleBulkStatus('blocked')} disabled={!picked.size}>Blocked</Key>
          <Key size="sm" onClick={handleBulkDelete} disabled={!picked.size}>Delete</Key>
          <Key size="sm" onClick={stopPicking}>Cancel</Key>
        </div>
      )}
      <div className="bs-tasks-row head bs-lbl" aria-hidden="true">
        <span />
        <span>Task · source</span>
        <span>Due</span>
        <span className="bs-dt">Priority</span>
        <span className="bs-dt">Status</span>
      </div>
      {loading ? (
        <p className="bs-tasks-empty">Loading tasks</p>
      ) : groups.length === 0 ? (
        <div className="bs-tasks-empty">
          <p>{search || url.tag || url.show !== 'open' ? 'Nothing matches these filters.' : 'No open tasks. Action items from your meetings land here too.'}</p>
          <Key variant="primary" onClick={() => setDrawer('new')}>New task</Key>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} className={`bs-tasks-grp${g.key === 'overdue' ? ' late' : ''}`} aria-label={g.label}>
            <GroupHead label={g.label} count={g.items.length} />
            <ul className="bs-rows">{g.items.map(row)}</ul>
          </section>
        ))
      )}
      {!loading && taskTotal > LOAD_LIMIT && (
        <p className="bs-lbl bs-tasks-cap">Showing the first {LOAD_LIMIT} of {taskTotal} tasks · search to narrow</p>
      )}
    </div>
  )

  const lanesView = (
    <div className="bs-tasks-lanes-wrap">
      {isPhone && (
        <Tabs
          label="Status"
          idBase="task-lanes"
          value={url.lane}
          onChange={(v) => setUrl({ lane: v })}
          items={STATUSES.map((s) => ({ value: s, label: laneWord(s), count: byLane[s].length }))}
          className="bs-tasks-ltabs"
        />
      )}
      <div className="bs-tasks-lanes">
        {STATUSES.filter((s) => !isPhone || s === url.lane).map((s) => (
          <section
            key={s}
            className={`bs-tasks-lane${dragKey ? ' dropping' : ''}`}
            aria-label={isPhone ? undefined : statusWord(s)}
            onDragOver={(e) => { if (dragKey) e.preventDefault() }}
            onDrop={onDrop(s)}
            id={isPhone ? `task-lanes-panel-${s}` : undefined}
            role={isPhone ? 'tabpanel' : undefined}
            aria-labelledby={isPhone ? `task-lanes-tab-${s}` : undefined}
          >
            {!isPhone && (
              <div className="bs-tasks-lh">
                <Signal tone={statusTone(s)}>{statusWord(s)}</Signal>
                <span className="bs-mono">{byLane[s].length}</span>
              </div>
            )}
            <ul className="bs-tasks-li-list">
              {byLane[s].map((item) => (
                <li
                  key={item.key}
                  className={`bs-tasks-li${selected?.key === item.key ? ' sel' : ''}`}
                  draggable={!isPhone}
                  onDragStart={(e) => { setDragKey(item.key); e.dataTransfer.effectAllowed = 'move' }}
                  onDragEnd={() => setDragKey(null)}
                >
                  <button type="button" className="bs-tasks-li-btn" onClick={() => openItem(item)}>
                    <span className="bs-tasks-li-t">{item.title}</span>
                    <span className="bs-tasks-li-m">
                      <span className={isOverdue(item, now) ? 'late' : ''}>{item.due ? dueLabel(item.due, now) : 'No date'}</span>
                      {item.priority === 'high' && <span className="hi">High</span>}
                      {item.source && (
                        <span>{item.source.title || 'Meeting'}{item.source.atMs != null ? ` · ${timecode(item.source.atMs)}` : ''}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {loading && <p className="bs-tasks-empty">Loading</p>}
            {!loading && byLane[s].length === 0 && <p className="bs-tasks-empty">Nothing here.</p>}
          </section>
        ))}
      </div>
    </div>
  )

  return (
    <div className="bs-tasks">
      <TitleRule title="Tasks" meta={meta} actions={actions} />
      {filterBar}
      {error ? <ErrorState message={error} onRetry={load} /> : layout === 'lanes' ? lanesView : (
        <div className={`bs-tasks-split${inlineInspector ? ' with-insp' : ''}`}>
          {listView}
          {inlineInspector && (
            <aside className="bs-tasks-insp" aria-label="Selected task">
              {inspected ? (
                <TaskDetail
                  key={inspected.key}
                  item={inspected}
                  now={now}
                  onStatus={setStatus}
                  onEdit={() => setEditing(taskRows.find((t) => t.id === inspected.id) ?? null)}
                  onActionSaved={patchAction}
                  onDelete={() => handleDelete(inspected)}
                  onOpenMeeting={(href) => navigate(href)}
                />
              ) : (
                <p className="bs-tasks-empty">Pick a task to see its details and the meeting it came from.</p>
              )}
            </aside>
          )}
        </div>
      )}

      <Drawer open={!inlineInspector && Boolean(selected)} onClose={() => setUrl({ item: null })} label={selected?.kind === 'action' ? 'Action item' : 'Task'}>
        {selected && (
          <TaskDetail
            key={selected.key}
            item={selected}
            now={now}
            inDrawer
            onStatus={setStatus}
            onEdit={() => setEditing(taskRows.find((t) => t.id === selected.id) ?? null)}
            onActionSaved={patchAction}
            onDelete={() => handleDelete(selected)}
            onOpenMeeting={(href) => navigate(href)}
          />
        )}
      </Drawer>

      <Drawer open={drawer === 'new'} onClose={() => setDrawer(null)} label="New task">
        <form className="bs-tasks-form" onSubmit={handleCreate} noValidate>
          <label className="bs-tasks-fl">
            <span className="bs-lbl">Title</span>
            <TextInput autoFocus value={newTask.title} placeholder="What needs to be done?" aria-invalid={Boolean(newError) || undefined}
              onChange={(e) => { setNewTask({ ...newTask, title: e.target.value }); setNewError('') }} />
          </label>
          {newError && <p className="bs-tasks-err" role="alert">{newError}</p>}
          <label className="bs-tasks-fl">
            <span className="bs-lbl">Details</span>
            <TextArea rows={3} value={newTask.description} placeholder="Add details" onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
          </label>
          <div className="bs-tasks-fl">
            <span className="bs-lbl">Priority</span>
            <Switch label="Priority" options={PRIORITY_OPTIONS} value={newTask.priority} onChange={(v) => setNewTask({ ...newTask, priority: v })} />
          </div>
          <div className="bs-tasks-f2">
            <label className="bs-tasks-fl">
              <span className="bs-lbl">Due</span>
              <TextInput type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
            </label>
            <label className="bs-tasks-fl">
              <span className="bs-lbl">Owner</span>
              <TextInput value={newTask.assignedTo} placeholder="Name" onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })} />
            </label>
          </div>
          <label className="bs-tasks-fl">
            <span className="bs-lbl">Tags</span>
            <TextInput value={newTask.tags} placeholder="design, backend" onChange={(e) => setNewTask({ ...newTask, tags: e.target.value })} />
          </label>
          <div className="bs-tasks-keys">
            <Key onClick={() => setDrawer(null)}>Cancel</Key>
            <Key type="submit" variant="primary" disabled={creating}>{creating ? 'Creating' : 'Create task'}</Key>
          </div>
        </form>
      </Drawer>

      <Drawer open={drawer === 'filter'} onClose={() => setDrawer(null)} label="Filter and sort">
        <div className="bs-tasks-fl">
          <span className="bs-lbl">Sort</span>
          <Switch label="Sort" options={SORT_OPTIONS} value={url.sort} onChange={(v) => setUrl({ sort: v })} />
        </div>
        <div className="bs-tasks-fl">
          <span className="bs-lbl">Tag</span>
          {tags.length === 0 ? <p className="bs-tasks-empty">No tags yet.</p> : (
            <div className="bs-tasks-tags">
              {tags.map((t) => (
                <button key={t} type="button" className="bs-tasks-tagbtn" aria-pressed={url.tag === t} onClick={() => setUrl({ tag: url.tag === t ? null : t })}>{t}</button>
              ))}
            </div>
          )}
        </div>
        <div className="bs-tasks-keys">
          <Key onClick={() => setUrl({ tag: null, sort: 'due' })}>Clear</Key>
          <Key variant="primary" onClick={() => setDrawer(null)}>Show {layout === 'lanes' ? laneItems.length : shown.length}</Key>
        </div>
      </Drawer>

      {editing && (
        <div className="bs-skin">
          <TaskEditModal task={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
        </div>
      )}
    </div>
  )
}
