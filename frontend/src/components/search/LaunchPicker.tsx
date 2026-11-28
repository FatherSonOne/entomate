import React, { useEffect, useState } from 'react'
import { TextInput } from '../bench'
import { projectsApi } from '../../services/api'
import { calendarDateInZone, isCalendarDate } from '../../services/askDateRanges'
import type { ComparisonEvent } from '../../services/askDateRanges'

interface LaunchMilestone {
  id: string
  title: string
  projectId: string
  projectName: string
  dueDate: string
  completedAt: string | null
}

function milestoneDates(milestone: LaunchMilestone, timeZone: string): ComparisonEvent[] {
  const name = milestone.projectName + ' · ' + milestone.title
  const key = milestone.projectId + ':' + milestone.id + ':'
  const scheduled: ComparisonEvent = { name, key: key + 'scheduled', source: 'scheduled', date: milestone.dueDate }
  const completed = milestone.completedAt ? new Date(milestone.completedAt) : null
  if (!completed || !Number.isFinite(completed.getTime())) return [scheduled]
  const date = calendarDateInZone(completed, timeZone)
  return date === scheduled.date ? [scheduled] : [
    scheduled, { name, key: key + 'completed', source: 'completed', date },
  ]
}

const dateLabel = (event: ComparisonEvent) => event.source === 'completed' ? 'Marked complete' : 'Scheduled date'

export function LaunchPicker({ workspaceId, timeZone, event, onChange }: {
  workspaceId?: string
  timeZone: string
  event?: ComparisonEvent
  onChange: (event?: ComparisonEvent) => void
}): React.ReactElement {
  const [manual, setManual] = useState(event?.source === 'manual')
  const [milestones, setMilestones] = useState<LaunchMilestone[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!workspaceId || manual) return
    const controller = new AbortController()
    setFailed(false)
    projectsApi.listLaunchMilestones(workspaceId, controller.signal).then((value) => {
      const data = value as unknown as { milestones?: LaunchMilestone[] }
      if (!Array.isArray(data?.milestones)) throw new Error('Invalid milestone list')
      if (!controller.signal.aborted) setMilestones(data.milestones)
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true)
    })
    return () => controller.abort()
  }, [workspaceId, manual])

  const options = (milestones ?? []).flatMap((milestone) => milestoneDates(milestone, timeZone))
    .filter((value) => isCalendarDate(value.date))
  // Keep the chosen date visible on return, including when the milestone was edited meanwhile.
  const chosen = event?.source !== 'manual' ? event : undefined
  const keyFor = (option: ComparisonEvent) => option.key + '|' + option.date
  if (chosen && !options.some((option) => keyFor(option) === keyFor(chosen))) options.unshift(chosen)

  return (
    <fieldset>
      <legend>Launch</legend>
      <label>
        Launch source
        <select className="bs-input" value={manual ? 'manual' : 'milestone'} onChange={(change) => {
          setManual(change.target.value === 'manual')
          onChange()
        }}>
          <option value="milestone">Project milestone</option>
          <option value="manual">Enter a launch date</option>
        </select>
      </label>
      {manual ? (
        <div className="bs-srch-compare-dates">
          <label>Launch name (optional)
            <TextInput value={event?.name ?? ''} placeholder="Launch" maxLength={160}
              onChange={(change) => onChange({ name: change.target.value, date: event?.date ?? '', source: 'manual' })} />
          </label>
          <label>Launch date
            <TextInput type="date" required value={event?.date ?? ''}
              onChange={(change) => onChange({ name: event?.name ?? '', date: change.target.value, source: 'manual' })} />
          </label>
        </div>
      ) : (
        <label>
          Launch milestone and date
          <select className="bs-input" value={chosen ? keyFor(chosen) : ''} onChange={(change) => {
            onChange(options.find((option) => keyFor(option) === change.target.value))
          }}>
            <option value="">Choose a launch milestone</option>
            {options.map((option) => (
              <option key={keyFor(option)} value={keyFor(option)}>
                {option.name} · {dateLabel(option)} · {option.date}
              </option>
            ))}
          </select>
        </label>
      )}
      {!manual && workspaceId && <div aria-live="polite">
        {failed ? <p>Could not load launch milestones. You can enter a date manually.</p>
          : !milestones ? <p>Loading launch milestones…</p>
            : !options.length && <p>No dated launch milestones found. You can enter a date manually.</p>}
      </div>}
    </fieldset>
  )
}
