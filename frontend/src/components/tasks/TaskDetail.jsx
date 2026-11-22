import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tasksApi } from '../../services/api'
import { Key, Signal, Switch, Tag, TextInput } from '../bench'
import { useToast } from '../vc/ToastProvider'
import { agentLabel, dueLabel, isOverdue, meetingHref, priorityWord, statusTone, statusWord, timecode } from '../../services/tasksView'

/**
 * One work item in depth: fields, the meeting it came from with its timecode, the
 * agent's call, subtasks. Shared by Tasks (inspector column / drawer) and the
 * project page (drawer). Writes go through the callbacks; subtasks use tasksApi.
 */

const STATUS_EDIT = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'Doing' },
  { value: 'review', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
]

export function Priority({ p }) {
  return <span className={`bs-tasks-pri${p === 'high' ? ' hi' : ''}`}>{priorityWord(p)}</span>
}

/** The inspector: fields, the meeting it came from, the agent's call, subtasks. Column on wide screens, drawer below. */
export default function TaskDetail({ item, now, inDrawer = false, onStatus, onEdit, onDelete, onOpenMeeting }) {
  const toast = useToast()
  const [subtasks, setSubtasks] = useState([])
  const [subLoading, setSubLoading] = useState(false)
  const [newSub, setNewSub] = useState('')
  const [adding, setAdding] = useState(false)
  const isTask = item.kind === 'task'

  const loadSubs = useCallback(async () => {
    if (!isTask) return
    try {
      setSubLoading(true)
      const data = await tasksApi.get(item.id)
      setSubtasks(data.subtasks || [])
    } catch (err) {
      console.debug('[Tasks] subtasks fetch failed:', err.message)
    } finally {
      setSubLoading(false)
    }
  }, [isTask, item.id])

  useEffect(() => { loadSubs() }, [loadSubs])

  const addSub = async (e) => {
    e.preventDefault()
    if (!newSub.trim()) return
    try {
      setAdding(true)
      await tasksApi.create({ title: newSub.trim(), parentTaskId: item.id, priority: item.priority })
      setNewSub('')
      loadSubs()
    } catch (err) {
      console.error('[Tasks] add subtask error:', err)
      toast.error('Error', 'Failed to create subtask')
    } finally {
      setAdding(false)
    }
  }

  const toggleSub = async (s) => {
    const done = s.status === 'done' || s.status === 'completed'
    try {
      if (done) await tasksApi.reopen(s.id)
      else await tasksApi.complete(s.id)
      loadSubs()
    } catch (err) {
      toast.error('Error', 'Failed to update subtask')
    }
  }

  const subDone = subtasks.filter((s) => s.status === 'done' || s.status === 'completed').length
  const src = item.source

  return (
    <div className="bs-tasks-detail">
      <div className="bs-tasks-dhead">
        <span className="bs-lbl">{inDrawer ? (item.source ? 'From a meeting' : 'Added by hand') : item.kind === 'action' ? 'Action item · from a meeting' : 'Task'}</span>
        <Signal tone={statusTone(item.status)}>{statusWord(item.status)}</Signal>
      </div>
      <h2 className="bs-tasks-dtitle">{item.title}</h2>

      <dl className="bs-tasks-fields">
        {item.status !== 'done' && (
          <div className="bs-field">
            <dt className="bs-lbl">Status</dt>
            <dd><Switch label="Status" className="bs-tasks-stsw" options={STATUS_EDIT} value={item.status} onChange={(v) => onStatus(item, v)} /></dd>
          </div>
        )}
        <div className="bs-field"><dt className="bs-lbl">Owner</dt><dd>{item.owner || <span className="bs-mut">Nobody yet</span>}{item.agent?.kind === 'assignment' && <> <Signal tone="ai">Agent pick</Signal></>}</dd></div>
        <div className="bs-field"><dt className="bs-lbl">Due</dt><dd className={`bs-mono${isOverdue(item, now) ? ' bs-tasks-late' : ''}`}>{item.due ? dueLabel(item.due, now) : 'No date'}{isOverdue(item, now) ? ' · overdue' : ''}</dd></div>
        <div className="bs-field"><dt className="bs-lbl">Priority</dt><dd><Priority p={item.priority} /></dd></div>
        {item.projectId && <div className="bs-field"><dt className="bs-lbl">Project</dt><dd><Link to={`/projects/${item.projectId}`} className="bs-tasks-link">View project</Link></dd></div>}
        {item.tags.length > 0 && <div className="bs-field"><dt className="bs-lbl">Tags</dt><dd className="bs-tasks-tags">{item.tags.map((t) => <Tag key={t}>{t}</Tag>)}</dd></div>}
      </dl>

      {item.description && <p className="bs-tasks-desc">{item.description}</p>}

      {src && (
        <section className="bs-tasks-sec" aria-label="Source meeting">
          <div className="bs-tasks-sech"><span className="bs-lbl">Source meeting</span></div>
          <div className="bs-tasks-srcrow">
            <Link to={meetingHref(src)} className="bs-h3 bs-tasks-link">{src.title || 'Open the meeting'}</Link>
            {src.atMs != null && <Key size="tc" onClick={() => onOpenMeeting(meetingHref(src))} aria-label={`Play from ${timecode(src.atMs)}`}>▶ {timecode(src.atMs)}</Key>}
          </div>
          {item.agent && (
            <div className="bs-tasks-agent">
              <div className="bs-tasks-agenth">
                <Signal tone="ai">{agentLabel(item.agent)}</Signal>
                {item.agent.confidence != null && <Tag tone="ai">{item.agent.confidence}%</Tag>}
              </div>
              <p className="bs-why">{item.agent.reason}</p>
            </div>
          )}
        </section>
      )}

      {isTask && (
        <section className="bs-tasks-sec" aria-label="Subtasks">
          <div className="bs-tasks-sech"><span className="bs-lbl">Subtasks</span><span className="bs-lbl">{subLoading ? '…' : `${subDone} of ${subtasks.length}`}</span></div>
          {subtasks.length > 0 && (
            <ul className="bs-rows">
              {subtasks.map((s) => {
                const done = s.status === 'done' || s.status === 'completed'
                return (
                  <li key={s.id} className="bs-tasks-sub">
                    <input type="checkbox" className="bs-check" checked={done} onChange={() => toggleSub(s)} aria-label={`${done ? 'Reopen' : 'Complete'} ${s.title}`} />
                    <span className={done ? 'done' : ''}>{s.title}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <form onSubmit={addSub} className="bs-tasks-addsub">
            <TextInput value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Add a subtask" aria-label="Add a subtask" disabled={adding} />
          </form>
        </section>
      )}

      <div className="bs-tasks-keys">
        <Key variant={inDrawer ? 'primary' : 'plain'} onClick={() => onStatus(item, item.status === 'done' ? 'open' : 'done')}>
          {item.status === 'done' ? 'Reopen' : 'Mark done'}
        </Key>
        {isTask && <Key onClick={onEdit}>Edit</Key>}
        {isTask && <Key onClick={onDelete} className="bs-tasks-del">Delete</Key>}
        {!isTask && src && <Key onClick={() => onOpenMeeting(meetingHref(src))} className="bs-tasks-del">Open meeting</Key>}
      </div>
    </div>
  )
}
