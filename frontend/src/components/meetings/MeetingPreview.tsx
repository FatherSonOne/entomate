import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Drawer, Key, Section, Signal, Tag } from '../bench'
import { meetingsApi } from '../../services/api'
import {
  asList, attendeeLine, formatLength, meetingDate, meetingLengthMs, meetingStatus, type MeetingRow,
} from '../../services/meetingView'

/** The action item fields the preview reads. */
interface PreviewAction {
  id: string
  task_description?: string | null
  assigned_to_name?: string | null
  assigned_to_email?: string | null
  due_date?: string | null
  status?: string | null
}

interface PreviewMeeting extends MeetingRow {
  actionItems?: PreviewAction[]
}

const getMeeting = (meetingsApi as unknown as { get: (id: string) => Promise<PreviewMeeting> }).get

export interface MeetingPreviewProps {
  /** The list row that was clicked; null closes the panel. */
  meeting: MeetingRow | null
  onClose: () => void
  /** The signed-in person's email, to pick out the actions on them. */
  myEmail?: string | null
}

const dueLabel = (d: string): string =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * A meeting's outcome at a glance, sliding out beside the list: summary, every
 * decision, and the open action items (yours first). "Open meeting" launches
 * the full page. A side panel on desktop (the list stays usable), a sheet on phone.
 */
export default function MeetingPreview({ meeting, onClose, myEmail }: MeetingPreviewProps): React.ReactElement | null {
  const [detail, setDetail] = useState<PreviewMeeting | null>(null)
  const [failed, setFailed] = useState(false)
  // Keep the last meeting while the panel snaps shut, so it doesn't empty mid-animation.
  const [shown, setShown] = useState<MeetingRow | null>(meeting)
  useEffect(() => { if (meeting) setShown(meeting) }, [meeting])

  const id = meeting?.id
  useEffect(() => {
    if (!id) return
    let alive = true
    setDetail(null)
    setFailed(false)
    getMeeting(id)
      .then((d) => { if (alive) setDetail(d) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [id])

  const m: PreviewMeeting | null = detail && detail.id === shown?.id ? detail : shown
  if (!m) return null

  const date = meetingDate(m)
  const length = meetingLengthMs(m)
  const status = meetingStatus(m)
  const people = attendeeLine(m)
  const decisions = asList(m.decisions)
  const me = (myEmail || '').toLowerCase()
  const open = (detail?.id === m.id ? detail.actionItems ?? [] : []).filter((a) => a.status !== 'done')
  const isMine = (a: PreviewAction): boolean => Boolean(me) && (a.assigned_to_email || '').toLowerCase() === me
  const ordered = [...open.filter(isMine), ...open.filter((a) => !isMine(a))]
  const mine = open.filter(isMine).length
  const loadingActions = !failed && detail?.id !== m.id

  return (
    <Drawer
      open={Boolean(meeting)}
      onClose={onClose}
      label="Meeting"
      modal={false}
      className="bs-mtg-preview"
      footer={(
        <>
          <Link to={`/meetings/${m.id}?share=1`} className="bs-key">Share recap</Link>
          <Link to={`/meetings/${m.id}`} className="bs-key pri">Open meeting</Link>
        </>
      )}
    >
      <div className="bs-mtg-pv">
        <span className="bs-lbl">
          {date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
          {' · '}
          {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
        <h2 className="bs-h2">{m.title || 'Untitled meeting'}</h2>
        {people && <p className="bs-mtg-pv-people">{people}</p>}
        <span className="bs-mtg-pv-status">
          <Signal tone={status.tone}>{status.word}</Signal>
          {length > 0 && <Tag className="bs-mtg-pv-length"><span className="sr-only">Length </span>{formatLength(length)}</Tag>}
        </span>
        {m.summary && <p className="bs-mtg-pv-sum">{m.summary}</p>}

        <div className="bs-mtg-block">
          <Section title="Decisions" level={3} aside={decisions.length ? String(decisions.length) : undefined} />
          {decisions.length === 0 ? (
            <p className="bs-mtg-none">No decisions were recorded.</p>
          ) : (
            <ul className="bs-rows">
              {decisions.map((d, i) => (
                <li key={i} className="bs-row bs-row-dec">
                  <span className="bs-tick" aria-hidden="true" />
                  <span className="bs-row-text">{d}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bs-mtg-block">
          <Section
            title="Open action items"
            level={3}
            aside={loadingActions ? undefined : mine > 0 ? `${open.length} · ${mine} on you` : String(open.length)}
          />
          {loadingActions ? (
            <p className="bs-mtg-none"><Signal tone="off">Loading</Signal></p>
          ) : failed ? (
            <p className="bs-mtg-none">The action items could not be loaded. Open the meeting to see them.</p>
          ) : ordered.length === 0 ? (
            <p className="bs-mtg-none">Nothing open.</p>
          ) : (
            <ul className="bs-rows">
              {ordered.map((a) => (
                <li key={a.id} className="bs-row bs-mtg-pv-act">
                  <span className="bs-row-text">
                    {a.task_description || 'Untitled action item'}
                    <span className="bs-mtg-pv-meta">
                      <span data-mine={isMine(a) || undefined}>{a.assigned_to_name || 'No owner'}{isMine(a) ? ' · you' : ''}</span>
                      {a.due_date && <span>Due {dueLabel(a.due_date)}</span>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  )
}
