import React from 'react'
import { plural, type ProjectSchedule, type ScheduleScale } from '../services/projectsView'

export function ScheduleFacts({ schedule, showElapsed = false }: { schedule: ProjectSchedule; showElapsed?: boolean }) {
  return (
    <>
      <span className="bs-proj-dates">{schedule.dateLabel}</span>
      <span className="bs-proj-measures">
        {schedule.reversed && <span className="bs-proj-due-late">End date is before start</span>}
        {schedule.duration != null && (
          <span>{schedule.duration === 0 ? 'Same-day schedule' : showElapsed
            ? `${schedule.elapsed} of ${schedule.duration} calendar days elapsed`
            : plural(schedule.duration, 'calendar day')}</span>
        )}
        {schedule.deadline && <span className={schedule.overdue ? 'bs-proj-due-late' : undefined}>{schedule.deadline}</span>}
      </span>
    </>
  )
}

export function ScheduleAxis({ scale }: { scale: ScheduleScale }) {
  return (
    <>
      <div className="bs-proj-scale-meta"><span>{scale.unit} · {scale.rangeLabel}</span><span>{scale.todayLabel}</span></div>
      <div className="bs-proj-axis" aria-hidden="true">
        {scale.ticks.map((tick) => (
          <span className="bs-proj-axis-tick" key={tick.day} style={{ left: `${tick.pct}%` }}>
            <span style={{ transform: `translateX(-${tick.pct}%)` }}>{tick.label}</span>
          </span>
        ))}
      </div>
    </>
  )
}

/** The exact dates and deadline status are displayed as text alongside the track. */
export function ScheduleTrack({ scale, startPct, endPct, overdue = false }: {
  scale: ScheduleScale
  startPct: number | null
  endPct: number | null
  overdue?: boolean
}) {
  return (
    <span className="bs-proj-track" aria-hidden="true">
      {scale.ticks.map((tick) => <i key={tick.day} className="bs-proj-gridline" style={{ left: `${tick.pct}%` }} />)}
      <i className="bs-proj-today" style={{ left: `${scale.nowPct}%` }} />
      {startPct != null && endPct != null && endPct > startPct && (
        <i className="bs-proj-span" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
      )}
      {startPct != null && endPct == null && <i className="bs-proj-end" style={{ left: `${startPct}%` }} />}
      {endPct != null && <i className={`bs-proj-end${overdue ? ' late' : ''}`} style={{ left: `${endPct}%` }} />}
    </span>
  )
}
