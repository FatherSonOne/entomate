import React, { useCallback, useEffect, useId, useState } from 'react'
import { Drawer, Key, Section, Select, TextArea } from './bench'
import { projectsApi } from '../services/api'
import type { ProjectMeetingRow } from '../services/projectsView'
import { meetingHref } from '../services/tasksView'
import ProjectBriefSuggestions, { BRIEF_TEXT_FIELDS, type BriefField, type BriefSource } from './ProjectBriefSuggestions'

interface Person { id: string; name: string }
interface Brief {
  outcome: string
  scope: string
  successCriteria: string
  ownerId: string | null
  resources: string[]
  sources?: Partial<Record<BriefField, BriefSource>>
}
interface BriefSnapshot {
  brief: Brief
  owner: Person | null
  members: Person[]
  canEdit: boolean
  version: string | null
}
type Draft = Omit<Brief, 'resources'> & { resourceLines: string }

function draftFrom(brief: Brief): Draft {
  const { resources, ...text } = brief
  return { ...text, resourceLines: resources.join('\n') }
}

interface ApiError extends Error {
  status?: number
  originalError?: { response?: { data?: { error?: string; details?: Array<{ message: string }> } } }
}

export default function ProjectBrief({ projectId, meetings }: { projectId: string; meetings: ProjectMeetingRow[] }) {
  const formId = useId()
  const [snapshot, setSnapshot] = useState<BriefSnapshot | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async (replaceDraft = false) => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await projectsApi.getBrief(projectId) as unknown as BriefSnapshot
      setSnapshot(data)
      if (replaceDraft) {
        setDraft(data.canEdit ? draftFrom(data.brief) : null)
        setConflict(false)
        setSaveError('')
      }
    } catch {
      if (replaceDraft) setSaveError('Could not load the latest brief. Your draft is still here.')
      else setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void load() }, [load])

  const open = () => {
    if (!snapshot?.canEdit) return
    setDraft(draftFrom(snapshot.brief))
    setSaveError('')
    setConflict(false)
    setNotice('')
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!snapshot?.canEdit || !draft || saving || conflict) return
    const brief = {
      outcome: draft.outcome.trim(),
      scope: draft.scope.trim(),
      successCriteria: draft.successCriteria.trim(),
      ownerId: draft.ownerId,
      resources: draft.resourceLines.split('\n').map((line) => line.trim()).filter(Boolean),
      sources: Object.fromEntries(Object.entries(draft.sources ?? {}).filter(([field]) => draft[field as BriefField].trim())),
    }
    setSaving(true)
    setSaveError('')
    try {
      const saved = await projectsApi.saveBrief(projectId, { brief, version: snapshot.version }) as unknown as Pick<BriefSnapshot, 'version'>
      setSnapshot({ ...snapshot, brief, owner: snapshot.members.find((person) => person.id === brief.ownerId) ?? null, version: saved.version })
      setDraft(null)
      setNotice('Brief saved')
    } catch (error) {
      const err = error as ApiError
      if (err.status === 409) {
        requireLatestBrief()
      } else {
        const data = err.originalError?.response?.data
        setSaveError(data?.details?.[0]?.message || data?.error || 'Could not save the brief. Try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const requireLatestBrief = () => {
    setConflict(true)
    setSaveError('This brief changed. Copy any edits you want to keep, then load the latest version.')
  }

  const applySuggestion = (field: BriefField, value: string, source: BriefSource) => {
    setDraft((current) => current && { ...current, [field]: value, sources: { ...current.sources, [field]: source } })
  }
  const removeSource = (field: BriefField) => {
    const sources = { ...draft?.sources }
    delete sources[field]
    setDraft((current) => current && { ...current, sources })
  }

  const brief = snapshot?.brief
  const hasBody = brief && (brief.outcome || brief.scope || brief.successCriteria || brief.resources.length > 0)

  return (
    <section className="bs-proj-brief" aria-labelledby="project-brief">
      <Section id="project-brief" title="Project brief" aside={snapshot?.canEdit ? <Key size="sm" onClick={open}>Edit brief</Key> : undefined} />
      {loadError ? (
        <div className="bs-proj-brief-error"><p role="alert">Could not load the brief.</p><Key size="sm" onClick={() => void load()}>Retry brief</Key></div>
      ) : !snapshot && loading ? <p className="bs-mut">Loading brief</p> : snapshot && brief && (
        <>
          <dl className="bs-proj-brief-fields">
            <div><dt className="bs-lbl">Project lead</dt><dd>{snapshot.owner?.name ?? (brief.ownerId ? 'Former workspace member' : 'Unassigned')}</dd></div>
            {BRIEF_TEXT_FIELDS.map(({ key, label }) => {
              const source = brief.sources?.[key]
              return brief[key] && (
                <div key={key}>
                  <dt className="bs-lbl">{label}</dt>
                  <dd>
                    {brief[key]}
                    {source && <a className="bs-tasks-link bs-brief-source" href={meetingHref({ ...source, title: null })} aria-label={'Source meeting for ' + label.toLowerCase()}>Source meeting</a>}
                  </dd>
                </div>
              )
            })}
            {brief.resources.length > 0 && (
              <div>
                <dt className="bs-lbl">Resources</dt>
                <dd><ul>{brief.resources.map((link, index) => <li key={`${index}:${link}`}><a className="bs-tasks-link" href={link} target="_blank" rel="noreferrer">{link}</a></li>)}</ul></dd>
              </div>
            )}
          </dl>
          {!hasBody && <p className="bs-mut">No brief yet.</p>}
        </>
      )}
      {notice && <p className="bs-mut" role="status">{notice}</p>}

      <Drawer open={draft != null} onClose={() => { if (!saving) setDraft(null) }} label="Edit project brief">
        {draft && snapshot && (
          <form className="bs-tasks-form" onSubmit={save}>
            <p className="bs-proj-note">This brief is visible to members of this workspace.</p>
            {meetings.length > 0 && (
              <ProjectBriefSuggestions key={snapshot.version ?? 'new'} projectId={projectId} meetings={meetings} version={snapshot.version}
                currentValues={snapshot.brief} disabled={saving || conflict} onConflict={requireLatestBrief} onUse={applySuggestion} />
            )}
            <div className="bs-tasks-fl">
              <span className="bs-lbl">Project lead</span>
              <Select label="Project lead" value={draft.ownerId ?? ''} disabled={saving} onChange={(value) => setDraft({ ...draft, ownerId: value || null })}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...(draft.ownerId && !snapshot.members.some((p) => p.id === draft.ownerId) ? [{ value: draft.ownerId, label: 'Former workspace member', disabled: true }] : []),
                  ...snapshot.members.map((p) => ({ value: p.id, label: p.name })),
                ]} />
            </div>
            {BRIEF_TEXT_FIELDS.map(({ key, label, length }) => (
              <div className="bs-tasks-fl" key={key}>
                <label className="bs-lbl" htmlFor={`${formId}-${key}`}>{label}</label>
                <TextArea id={`${formId}-${key}`} rows={3} maxLength={length} disabled={saving} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
                {draft.sources?.[key] && <Key size="sm" className="bs-brief-remove" disabled={saving} onClick={() => removeSource(key)} aria-label={'Remove source for ' + label.toLowerCase()}>Remove source link</Key>}
              </div>
            ))}
            <div className="bs-tasks-fl">
              <label className="bs-lbl" htmlFor={`${formId}-resources`}>Resource links</label>
              <TextArea id={`${formId}-resources`} rows={3} disabled={saving} value={draft.resourceLines} onChange={(event) => setDraft({ ...draft, resourceLines: event.target.value })} aria-describedby={`${formId}-resource-help`} />
              <p className="bs-mut" id={`${formId}-resource-help`}>Up to 10 links, one per line.</p>
            </div>
            {saveError && <p className="bs-tasks-err" role="alert">{saveError}</p>}
            <div className="bs-tasks-keys">
              <Key type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</Key>
              {conflict && <Key type="button" disabled={loading} onClick={() => void load(true)}>Load latest brief</Key>}
              <Key type="submit" variant="primary" disabled={saving || conflict}>{saving ? 'Saving' : 'Save brief'}</Key>
            </div>
          </form>
        )}
      </Drawer>
    </section>
  )
}
