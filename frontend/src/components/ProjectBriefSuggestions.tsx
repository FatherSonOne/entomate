import React, { useId, useState } from 'react'
import { Key, Select } from './bench'
import { projectsApi } from '../services/api'
import { dayShort, type ProjectMeetingRow } from '../services/projectsView'
import { meetingHref, timecode } from '../services/tasksView'

export const BRIEF_TEXT_FIELDS = [
  { key: 'outcome', label: 'Outcome', length: 2000 },
  { key: 'scope', label: 'Scope', length: 4000 },
  { key: 'successCriteria', label: 'Success criteria', length: 4000 },
] as const

export type BriefField = typeof BRIEF_TEXT_FIELDS[number]['key']
export interface BriefSource { meetingId: string; atMs: number | null }

interface Suggestion {
  field: BriefField
  value: string
  evidence: { kind: string; text: string; atMs: number | null }
}

interface Review {
  version: string | null
  source: { meetingId: string; meetingTitle: string }
  suggestions: Suggestion[]
}

interface Props {
  projectId: string
  meetings: ProjectMeetingRow[]
  version: string | null
  currentValues: Record<BriefField, string>
  disabled: boolean
  onConflict: () => void
  onUse: (field: BriefField, value: string, source: BriefSource) => void
}

export default function ProjectBriefSuggestions({ projectId, meetings, version, currentValues, disabled, onConflict, onUse }: Props) {
  const heading = useId()
  const [meetingId, setMeetingId] = useState('')
  const [review, setReview] = useState<Review | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [applied, setApplied] = useState<BriefField[]>([])

  const select = (value: string) => {
    setMeetingId(value)
    setReview(null)
    setError('')
    setApplied([])
  }

  const suggest = async () => {
    if (busy || disabled || !meetingId) return
    setBusy(true)
    setError('')
    setReview(null)
    setApplied([])
    try {
      const next = await projectsApi.suggestBrief(projectId, meetingId) as unknown as Review
      if (next.version !== version) {
        onConflict()
        return
      }
      setReview(next)
    } catch (cause) {
      const err = cause as { originalError?: { response?: { data?: { error?: string } } } }
      setError(err.originalError?.response?.data?.error || 'Could not load suggestions. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bs-brief-review" aria-labelledby={heading}>
      <h3 className="bs-h3" id={heading}>Review a linked meeting</h3>
      <div className="bs-brief-review-controls">
        <Select label="Source meeting" value={meetingId} disabled={busy || disabled} onChange={select}
          options={[{ value: '', label: 'Choose a meeting' }, ...meetings.map((meeting) => ({
            value: meeting.id,
            label: meeting.title?.trim() || 'Untitled meeting',
            hint: meeting.start_time || meeting.created_at ? dayShort(meeting.start_time || meeting.created_at) : undefined,
          }))]} />
        <Key disabled={!meetingId || busy || disabled} onClick={() => void suggest()}>{busy ? 'Reviewing minutes' : 'Suggest changes'}</Key>
      </div>
      {error && <p className="bs-tasks-err" role="alert">{error}</p>}
      {review && review.suggestions.length === 0 && <p className="bs-mut" role="status">No changes supported by these minutes.</p>}
      {review && review.suggestions.length > 0 && (
        <>
          <p className="bs-mut" role="status">Use a suggestion to fill the draft. Save the brief to share your edits.</p>
          {review.suggestions.map(({ field, value, evidence }) => {
            const label = BRIEF_TEXT_FIELDS.find((item) => item.key === field)!.label
            const source = { meetingId: review.source.meetingId, atMs: evidence.atMs }
            return (
              <article className="bs-brief-suggestion" key={field}>
                <h4 className="bs-lbl">{label}</h4>
                {currentValues[field] && <p className="bs-brief-current"><b>Current</b> {currentValues[field]}</p>}
                <p className="bs-brief-proposal"><b>Proposed</b> {value}</p>
                <blockquote>
                  <p>{evidence.text}</p>
                  <a className="bs-tasks-link" href={meetingHref({ ...source, title: null })} target="_blank" rel="noreferrer">
                    {evidence.kind} ? {review.source.meetingTitle}{evidence.atMs != null ? ' ? ' + timecode(evidence.atMs) : ''}
                  </a>
                </blockquote>
                <Key size="sm" disabled={disabled || applied.includes(field)} onClick={() => {
                  onUse(field, value, source)
                  setApplied((fields) => [...fields, field])
                }}>{applied.includes(field) ? 'Added to draft' : 'Use for ' + label.toLowerCase()}</Key>
              </article>
            )
          })}
        </>
      )}
    </section>
  )
}
