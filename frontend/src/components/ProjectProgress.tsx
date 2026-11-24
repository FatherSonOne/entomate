import React, { useId, useState } from 'react'
import { Cell, Drawer, Grid, Key, Section, Select, Signal, TextArea, TextInput } from './bench'
import type { SignalTone } from './bench'
import { dayShort } from '../services/projectsView'
import type { Milestone, ProgressChange, ProjectHealth, ProjectProgressState } from '../services/projectProgress'

const HEALTH: Record<ProjectHealth, { label: string; tone: SignalTone }> = {
  on_track: { label: 'On track', tone: 'mint' },
  at_risk: { label: 'At risk', tone: 'ai' },
  off_track: { label: 'Off track', tone: 'brand' },
}
const HEALTH_OPTIONS = Object.entries(HEALTH).map(([value, { label }]) => ({ value, label }))
const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }

type Draft =
  | { kind: 'milestone'; id: string | null; title: string; dueDate: string; ownerId: string | null }
  | { kind: 'update'; health: ProjectHealth; note: string }

function milestoneDraft(item?: Milestone): Draft {
  return { kind: 'milestone', id: item?.id ?? null, title: item?.title ?? '', dueDate: item?.dueDate ?? '', ownerId: item?.ownerId ?? null }
}

export default function ProjectProgress({ progress }: { progress: ProjectProgressState }) {
  const field = useId()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showAll, setShowAll] = useState(false)
  const { data } = progress

  const start = (next: Draft) => {
    setError('')
    setNotice('')
    setDraft(next)
  }

  const save = async (change: ProgressChange, message: string) => {
    if (busy || conflict) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await progress.save(change)
      setDraft(null)
      setNotice(message)
    } catch (cause) {
      const err = cause as { status?: number; originalError?: { response?: { data?: { error?: string; details?: { message: string }[] } } } }
      const payload = err.originalError?.response?.data
      if (err.status === 409) {
        setConflict(true)
        setError('Progress changed. Copy any draft edits you want to keep before loading the latest version.')
      } else {
        setError(payload?.details?.[0]?.message || payload?.error || 'Could not save project progress. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  const reload = async () => {
    setBusy(true)
    if (await progress.reload()) {
      setConflict(false)
      setError('')
      setDraft(null)
    } else {
      setError('Could not load the latest progress. Your draft is still here.')
    }
    setBusy(false)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft || conflict) return
    if (draft.kind === 'update') {
      if (draft.note.trim()) void save({ operation: 'postUpdate', health: draft.health, note: draft.note }, 'Status update posted.')
      return
    }
    const { id, title, dueDate, ownerId } = draft
    if (!title.trim() || !dueDate) return
    const fields = { title, dueDate, ownerId }
    void save(id ? { operation: 'editMilestone', id, ...fields } : { operation: 'addMilestone', ...fields },
      id ? 'Milestone saved.' : 'Milestone added.')
  }

  const milestones = [...(data?.milestones ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const updates = data?.updates ?? []
  const status = error && (
    <div className="bs-proj-brief-error">
      <p role="alert" className="bs-tasks-err">{error}</p>
      {conflict && <Key size="sm" disabled={busy} onClick={() => void reload()}>Load latest progress</Key>}
    </div>
  )

  return (
    <Grid className="bs-proj-row2">
      <Cell span={8}>
        <section aria-labelledby="project-milestones">
          <Section id="project-milestones" title="Milestones" aside={data?.canEdit && (
            <Key size="sm" disabled={busy || conflict} onClick={() => start(milestoneDraft())}>Add milestone</Key>
          )} />
          {progress.error && (
            <div className="bs-proj-brief-error">
              <p role="alert">Could not load project progress.</p>
              <Key size="sm" disabled={busy} onClick={() => void reload()}>Retry progress</Key>
            </div>
          )}
          {!data && !progress.error && <p className="bs-mut" role="status">Loading project progress</p>}
          {data && (milestones.length ? (
            <ul className="bs-rows">
              {milestones.map((item) => (
                <li key={item.id} id={'project-milestone-' + item.id} tabIndex={-1} className="bs-row bs-proj-milestone-row">
                  <Signal tone={item.completedAt ? 'mint' : 'off'}>{item.completedAt ? 'Done' : 'Open'}</Signal>
                  <span className="bs-row-text">
                    {item.title}
                    <span className="bs-proj-dec-m">
                      <time dateTime={item.dueDate}>{dayShort(item.dueDate)}</time>
                      {' ? '}{item.ownerName ?? (item.ownerId ? 'Former workspace member' : 'No owner')}
                    </span>
                  </span>
                  {data.canEdit && (
                    <div className="bs-proj-milestone-actions">
                      <Key size="sm" disabled={busy || conflict} aria-label={'Edit milestone ' + item.title} onClick={() => start(milestoneDraft(item))}>Edit</Key>
                      <Key size="sm" disabled={busy || conflict}
                        aria-label={(item.completedAt ? 'Reopen milestone ' : 'Complete milestone ') + item.title}
                        onClick={() => void save({ operation: 'setMilestoneDone', id: item.id, done: !item.completedAt },
                          item.completedAt ? 'Milestone reopened.' : 'Milestone complete.')}>
                        {item.completedAt ? 'Reopen' : 'Complete'}
                      </Key>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="bs-proj-empty">No milestones yet.</p>)}
          {!draft && status}
          {notice && <p className="bs-mut" role="status">{notice}</p>}
        </section>
      </Cell>
      <Cell span={4} rule>
        <section aria-labelledby="project-status-updates">
          <Section id="project-status-updates" title="Status updates" level={3} aside={data?.canEdit && (
            <Key size="sm" disabled={busy || conflict} onClick={() => start({ kind: 'update', health: 'on_track', note: '' })}>Post update</Key>
          )} />
          {data && updates.length === 0 && <p className="bs-proj-empty">No status updates yet.</p>}
          {updates.length > 0 && (
            <ol className="bs-proj-updates">
              {(showAll ? updates : updates.slice(0, 3)).map(({ id, health, postedAt, note, authorName, counts }) => (
                <li key={id}>
                  <div className="bs-proj-update-head">
                    <Signal tone={HEALTH[health].tone}>{HEALTH[health].label}</Signal>
                    <span className="bs-proj-dec-m">{authorName} ? <time dateTime={postedAt}>{new Date(postedAt).toLocaleString(undefined, DATE_FORMAT)}</time></span>
                  </div>
                  <p className="bs-proj-update-note">{note}</p>
                  <p className="bs-proj-dec-m">
                    {counts.total > 0 ? counts.done + ' of ' + counts.total + ' work items complete ? ' + counts.late + ' overdue' : 'No work items at posting'}
                    {counts.milestones > 0 && ' ? ' + counts.milestonesDone + ' of ' + counts.milestones + ' milestones complete'}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {updates.length > 3 && <Key size="sm" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show recent updates' : 'Show all updates'}</Key>}
        </section>
      </Cell>

      <Drawer open={draft != null} onClose={() => { if (!busy) setDraft(null) }}
        label={draft?.kind === 'update' ? 'Post status update' : draft?.id ? 'Edit milestone' : 'Add milestone'}>
        {draft && data && (
          <form className="bs-tasks-form" onSubmit={submit}>
            {draft.kind === 'milestone' ? (
              <>
                <label className="bs-tasks-fl" htmlFor={field + '-title'}>
                  <span className="bs-lbl">Milestone</span>
                  <TextInput id={field + '-title'} required maxLength={160} value={draft.title} disabled={busy}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                </label>
                <div className="bs-tasks-fl">
                  <span className="bs-lbl">Owner</span>
                  <Select label="Milestone owner" value={draft.ownerId ?? ''} disabled={busy} onChange={(value) => setDraft({ ...draft, ownerId: value || null })}
                    options={[
                      { value: '', label: 'No owner' },
                      ...(draft.ownerId && !data.members.some((member) => member.id === draft.ownerId)
                        ? [{ value: draft.ownerId, label: 'Former workspace member', disabled: true }] : []),
                      ...data.members.map(({ id, name }) => ({ value: id, label: name })),
                    ]} />
                </div>
                <label className="bs-tasks-fl" htmlFor={field + '-date'}>
                  <span className="bs-lbl">Due date</span>
                  <TextInput id={field + '-date'} type="date" required value={draft.dueDate} disabled={busy}
                    onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
                </label>
              </>
            ) : (
              <>
                <div className="bs-tasks-fl">
                  <span className="bs-lbl">Project health</span>
                  <Select label="Project health" value={draft.health} disabled={busy} options={HEALTH_OPTIONS}
                    onChange={(value) => setDraft({ ...draft, health: value as ProjectHealth })} />
                </div>
                <label className="bs-tasks-fl" htmlFor={field + '-note'}>
                  <span className="bs-lbl">Update</span>
                  <TextArea id={field + '-note'} rows={5} required maxLength={1500} value={draft.note} disabled={busy}
                    onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
                </label>
              </>
            )}
            {status}
            <div className="bs-tasks-keys">
              <Key disabled={busy} onClick={() => setDraft(null)}>Cancel</Key>
              <Key type="submit" variant="primary" disabled={busy || conflict}>{busy ? 'Saving' : draft.kind === 'update' ? 'Post update' : 'Save milestone'}</Key>
            </div>
          </form>
        )}
      </Drawer>
    </Grid>
  )
}
