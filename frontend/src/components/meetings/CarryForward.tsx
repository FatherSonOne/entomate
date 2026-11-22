import React from 'react'
import { Link } from 'react-router-dom'
import { Section, Signal } from '../bench'

/**
 * "From last time": commitments from earlier meetings with the same people or
 * the same recurring meeting. Open items first (overdue on top), then what got
 * done. Renders nothing when there is no history, so a first meeting stays clean.
 * Data comes from GET /api/meetings/:id/carry-forward or POST /api/meetings/carry-forward.
 */

export interface CarryForwardItem {
  id: string
  text: string
  owner: string | null
  dueDate: string | null
  status: string
  overdue?: boolean
  reason: 'people' | 'series' | 'owner'
  meeting: { id: string; title: string; date: string }
}

export interface CarryForwardData {
  lastMeeting: { id: string; title: string; date: string; sharedPeople: string[]; sameSeries: boolean } | null
  relatedMeetings: number
  openCount: number
  overdueCount: number
  doneCount: number
  open: CarryForwardItem[]
  done: CarryForwardItem[]
}

export interface CarryForwardProps {
  data: CarryForwardData | null
  /** Section title. */
  title?: string
  /** Show at most this many open items (Today keeps it short). */
  limit?: number
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

function shortDate(value: string | null): string {
  if (!value) return ''
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, SHORT_DATE)
}

function itemMeta(item: CarryForwardItem): string {
  const parts = [item.owner || 'No owner']
  if (item.dueDate) parts.push(`${item.overdue ? 'was due' : 'due'} ${shortDate(item.dueDate)}`)
  return parts.join(' · ')
}

/** The server's reply, read defensively: a missing list or count never breaks the page it sits on. */
function normalize(raw: CarryForwardData | null | undefined): CarryForwardData | null {
  if (!raw || typeof raw !== 'object') return null
  const open = Array.isArray(raw.open) ? raw.open : []
  const done = Array.isArray(raw.done) ? raw.done : []
  const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  return {
    lastMeeting: raw.lastMeeting && typeof raw.lastMeeting === 'object' ? raw.lastMeeting : null,
    relatedMeetings: num(raw.relatedMeetings, 0),
    openCount: num(raw.openCount, open.length),
    overdueCount: num(raw.overdueCount, open.filter((i) => i.overdue).length),
    doneCount: num(raw.doneCount, done.length),
    open,
    done,
  }
}

export default function CarryForward({ data: raw, title = 'From last time', limit }: CarryForwardProps): React.ReactElement | null {
  const data = normalize(raw)
  if (!data || (data.openCount === 0 && data.doneCount === 0)) return null

  const open = typeof limit === 'number' ? data.open.slice(0, limit) : data.open
  const hidden = data.openCount - open.length
  const last = data.lastMeeting
  const summary = [
    `${data.openCount} open`,
    data.overdueCount ? `${data.overdueCount} overdue` : null,
    data.doneCount ? `${data.doneCount} done` : null,
  ].filter(Boolean).join(' · ')

  return (
    <section className="bs-cf" aria-label={title}>
      <Section title={title} level={3} aside={summary} />
      {last && (
        <p className="bs-cf-src">
          <span className="bs-lbl">{last.sameSeries ? 'Last in this series' : 'Last met'}</span>{' '}
          <Link to={`/meetings/${last.id}`} className="bs-cf-link">{last.title}</Link>
          <span className="bs-mut"> · {shortDate(last.date)}</span>
        </p>
      )}

      {open.length > 0 && (
        <ul className="bs-rows">
          {open.map((item) => (
            <li key={item.id} className="bs-row bs-cf-row">
              <Signal tone={item.overdue ? 'brand' : 'off'}>{item.overdue ? 'Overdue' : 'Open'}</Signal>
              <span className="bs-row-text">
                {item.text}
                <span className="bs-cf-meta">{itemMeta(item)}</span>
              </span>
              <Link to={`/meetings/${item.meeting.id}`} className="bs-cf-from" title={item.meeting.title}>
                {shortDate(item.meeting.date)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && <p className="bs-cf-more bs-mut">{hidden} more open from earlier meetings</p>}

      {typeof limit !== 'number' && data.done.length > 0 && (
        <ul className="bs-rows bs-cf-done" aria-label="Done since">
          {data.done.map((item) => (
            <li key={item.id} className="bs-row bs-cf-row">
              <Signal tone="mint">Done</Signal>
              <span className="bs-row-text">
                {item.text}
                <span className="bs-cf-meta">{item.owner || 'No owner'}</span>
              </span>
              <Link to={`/meetings/${item.meeting.id}`} className="bs-cf-from" title={item.meeting.title}>
                {shortDate(item.meeting.date)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
