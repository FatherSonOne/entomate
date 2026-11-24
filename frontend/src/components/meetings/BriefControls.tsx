import { useEffect, useState } from 'react'
import { entoAiApi } from '../../services/api'
import { useOrgSafe } from '../../contexts/OrgContext'
import type { UpcomingEvent } from '../../services/upcomingView'
import { Key, Select, Signal } from '../bench'

const LEADS = [5, 15, 30, 60].map((minutes) => ({ value: String(minutes), label: `${minutes} minutes before` }))
const runTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

interface BriefSchedule {
  status: 'scheduled' | 'ready' | 'failed'
  runAt: string
  threadId: string | null
}

interface BriefScheduleResponse { schedule: BriefSchedule | null }

export default function BriefControls({ event, onBrief, onOpenThread }: {
  event: UpcomingEvent
  onBrief: () => void
  onOpenThread: (id: string) => void
}) {
  const workspace = useOrgSafe() as { org: { id: string } | null } | null
  const orgId = workspace?.org?.id
  const [schedule, setSchedule] = useState<BriefSchedule | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [lead, setLead] = useState('15')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = schedule?.status === 'scheduled'
  const canSchedule = Date.parse(event.start) > Date.now()

  useEffect(() => {
    if (!orgId || event.allDay || busy) return undefined
    let live = true
    const refresh = async () => {
      try {
        const { schedule: next } = await entoAiApi.meetingBriefs.status(event.id, orgId) as unknown as BriefScheduleResponse
        if (live) setSchedule(next)
      } catch (err) {
        if (live) setError((err as Error).message || 'The brief schedule could not be loaded.')
      }
    }
    void refresh()
    const timer = pending ? window.setInterval(refresh, 20_000) : undefined
    return () => { live = false; window.clearInterval(timer) }
  }, [orgId, event.id, event.allDay, pending, busy])

  const save = async (cancel = false) => {
    if (busy || !orgId) return
    setBusy(true)
    setError('')
    try {
      const result = (cancel
        ? await entoAiApi.meetingBriefs.cancel(event.id, orgId)
        : await entoAiApi.meetingBriefs.schedule(event.id, {
          orgId,
          leadMinutes: Number(lead),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })) as unknown as BriefScheduleResponse
      setSchedule(result.schedule)
      setEditing(false)
    } catch (err) {
      setError((err as Error).message || 'The brief schedule could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const threadId = schedule?.threadId
  return (
    <div className="bs-up-booking">
      <div className="bs-title-keys">
        <Key onClick={onBrief}>Pre-meeting brief</Key>
        {schedule?.status === 'ready' && threadId && <Key onClick={() => onOpenThread(threadId)}>Open prepared brief</Key>}
        {orgId && !event.allDay && schedule !== undefined && !pending && !threadId && canSchedule && !editing && (
          <Key onClick={() => setEditing(true)}>Schedule brief</Key>
        )}
      </div>
      {editing && (
        <div className="bs-title-keys">
          <Select label="Prepare brief" value={lead} onChange={setLead} options={LEADS} disabled={busy} />
          <Key variant="primary" disabled={busy} onClick={() => { void save() }}>Schedule brief</Key>
          <Key disabled={busy} onClick={() => setEditing(false)}>Dismiss</Key>
        </div>
      )}
      {pending && schedule && (
        <div className="bs-title-keys">
          <span role="status">
            <Signal tone="brand">Brief scheduled</Signal>{' '}
            {Date.parse(schedule.runAt) > Date.now() ? runTime.format(new Date(schedule.runAt)) : 'Preparing soon'}
          </span>
          <Key size="sm" disabled={busy} onClick={() => { void save(true) }}>Cancel scheduled brief</Key>
        </div>
      )}
      {schedule?.status === 'failed' && !editing && <p className="bs-up-booking-note" role="status">The scheduled brief couldn’t be prepared. You can request it now or schedule it again.</p>}
      {error && <p className="bs-up-booking-note" role="alert">{error}</p>}
    </div>
  )
}
