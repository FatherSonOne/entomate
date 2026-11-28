import React, { useEffect, useState } from 'react'
import { TextInput } from '../bench'
import { projectsApi } from '../../services/api'
import { calendarDateInZone, isCalendarDate } from '../../services/askDateRanges'
import type { ComparisonEvent } from '../../services/askDateRanges'

interface Milestone {
  id: string
  title: string
  projectId: string
  projectName: string
  dueDate: string
  completedAt: string | null
}

function milestoneDates(milestone: Milestone, timeZone: string): ComparisonEvent[] {
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

export function MilestonePicker({ workspaceId, timeZone, milestoneName, event, onChange }: {
  workspaceId?: string
  timeZone: string
  milestoneName?: string
  event?: ComparisonEvent
  onChange: (event?: ComparisonEvent) => void
}): React.ReactElement {
  const [manual, setManual] = useState(event?.source === 'manual')
  const [milestones, setMilestones] = useState<Milestone[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!workspaceId || manual) return
    const controller = new AbortController()
    setFailed(false)
    const request = milestoneName
      ? projectsApi.findMilestones(workspaceId, milestoneName, controller.signal)
      : projectsApi.listLaunchMilestones(workspaceId, controller.signal)
    request.then((value) => {
      const data = value as unknown as { milestones?: Milestone[] }
      if (!Array.isArray(data?.milestones)) throw new Error('Invalid milestone list')
      if (!controller.signal.aborted) setMilestones(data.milestones)
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true)
    })
    return () => controller.abort()
  }, [workspaceId, manual, milestoneName])

  const options = (milestones ?? []).flatMap((milestone) => milestoneDates(milestone, timeZone))
    .filter((value) => isCalendarDate(value.date))
  // Keep the chosen date visible on return, including when the milestone was edited meanwhile.
  const chosen = event?.source !== 'manual' ? event : undefined
  const keyFor = (option: ComparisonEvent) => option.key + '|' + option.date
  if (chosen && !options.some((option) => keyFor(option) === keyFor(chosen))) options.unshift(chosen)
  const label = milestoneName ? 'Milestone' : 'Launch'
  const manualName = event?.name ?? milestoneName ?? ''

  return (
    <fieldset>
      <legend>{label}</legend>
      <label>
        {label} source
        <select className="bs-input" value={manual ? 'manual' : 'milestone'} onChange={(change) => {
          setManual(change.target.value === 'manual')
          onChange()
        }}>
          <option value="milestone">Project milestone</option>
          <option value="manual">Enter a {label.toLowerCase()} date</option>
        </select>
      </label>
      {manual ? (
        <div className="bs-srch-compare-dates">
          <label>{label} name (optional)
            <TextInput value={manualName} placeholder={label} maxLength={160}
              onChange={(change) => onChange({ name: change.target.value, date: event?.date ?? '', source: 'manual' })} />
          </label>
          <label>{label} date
            <TextInput type="date" required value={event?.date ?? ''}
              onChange={(change) => onChange({ name: manualName, date: change.target.value, source: 'manual' })} />
          </label>
        </div>
      ) : (
        <label>
          {milestoneName ? 'Milestone and date' : 'Launch milestone and date'}
          <select className="bs-input" value={chosen ? keyFor(chosen) : ''} onChange={(change) => {
            onChange(options.find((option) => keyFor(option) === change.target.value))
          }}>
            <option value="">{milestoneName ? 'Choose a milestone' : 'Choose a launch milestone'}</option>
            {options.map((option) => (
              <option key={keyFor(option)} value={keyFor(option)}>
                {option.name} · {dateLabel(option)} · {option.date}
              </option>
            ))}
          </select>
        </label>
      )}
      {!manual && workspaceId && <div aria-live="polite">
        {failed ? <p>Could not load milestones. You can enter a date manually.</p>
          : !milestones ? <p>Loading milestones…</p>
            : !options.length && <p>{milestoneName ? <>No dated milestones match “{milestoneName}”.</> : 'No dated launch milestones found.'} You can enter a date manually.</p>}
      </div>}
    </fieldset>
  )
}
