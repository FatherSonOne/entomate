import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Cell, Drawer, Grid, Key, Section, Select, Signal, Switch, TextInput, useMediaQuery, PHONE_QUERY, cx } from '../bench'
import CarryForward, { type CarryForwardData } from './CarryForward'
import { calendarApi, entoAiApi, meetingsApi } from '../../services/api'
import { tokensMatch, type EntoProposal } from '../EntoAssistant/ProposalCard'
import { useOrgSafe } from '../../contexts/OrgContext'
import { useToast } from '../vc/ToastProvider'
import {
  PLATFORM_LABEL, addDays, botPlan, dayKey, dotsByDay, durationLabel, durationMin, fromDayKey, groupByDay,
  joinsCount, monthGrid, normalizeUpcoming, peopleLine, startDate, weekBlocks, withOverride,
  type UpcomingData, type UpcomingEvent,
} from '../../services/upcomingView'

/**
 * Meetings › Upcoming (Slate pick 2026-11-22): the next 60 days of calendar
 * meetings with what the bot will do for each and one key to change it.
 * Agenda by default; desktop also has a week grid. A month mini calendar sits
 * in the context column; on phone it is a strip of days above the list.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MO = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS = 60

type View = 'agenda' | 'week'
const VIEWS: { value: View; label: string }[] = [{ value: 'agenda', label: 'Agenda' }, { value: 'week', label: 'Week' }]

interface ToastApi { error: (title: string, message?: string) => void }

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
const timeOf = (e: UpcomingEvent): string => (e.allDay ? 'All day' : timeFmt.format(startDate(e)))

function Dots({ dots }: { dots?: boolean[] }): React.ReactElement {
  return (
    <span className="bs-up-dots" aria-hidden="true">
      {(dots || []).map((goes, i) => <i key={i} className={goes ? undefined : 'h'} />)}
    </span>
  )
}

function BotKey({ event, autoJoinOn, busy, onDecide }: { event: UpcomingEvent; autoJoinOn: boolean; busy: boolean; onDecide: (e: UpcomingEvent, d: 'skip' | 'join' | null) => void }): React.ReactElement | null {
  const plan = botPlan(event, autoJoinOn)
  if (!plan.key || !event.key) return null
  const { label, decision } = plan.key
  return (
    <Key
      size="sm"
      disabled={busy}
      onClick={(ev) => { ev.stopPropagation(); onDecide(event, decision) }}
      aria-label={`${label === 'Skip' ? 'Skip the bot for' : 'Send the bot to'} ${event.title}`}
    >
      {label}
    </Key>
  )
}

interface RowProps {
  event: UpcomingEvent
  autoJoinOn: boolean
  selected: boolean
  busy: boolean
  carry?: string
  onOpen: (e: UpcomingEvent) => void
  onDecide: (e: UpcomingEvent, d: 'skip' | 'join' | null) => void
}

function Row({ event: e, autoJoinOn, selected, busy, carry, onOpen, onDecide }: RowProps): React.ReactElement {
  const plan = botPlan(e, autoJoinOn)
  return (
    <div
      className={cx('bs-up-row', selected && 'is-sel')}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(e)}
      onKeyDown={(k) => { if (k.key === 'Enter' || k.key === ' ') { k.preventDefault(); onOpen(e) } }}
      aria-label={`${e.title}, ${timeOf(e)}, ${plan.word}`}
    >
      <span className="bs-up-tm">{timeOf(e)}<span>{durationLabel(durationMin(e))}</span></span>
      <span className="bs-up-main">
        <span className="bs-up-tt">{e.title}</span>
        <span className="bs-up-pp">{peopleLine(e) || (e.allDay ? 'All day' : 'No guests')}</span>
        {carry && <span className="bs-up-cf"><i aria-hidden="true" />Open from last time: {carry}</span>}
        <span className="bs-up-ph-sig"><Signal tone={plan.tone}>{plan.word}</Signal></span>
      </span>
      <span className="bs-up-plat">{e.platform ? PLATFORM_LABEL[e.platform] : '—'}</span>
      <span className="bs-up-sig"><Signal tone={plan.tone}>{plan.word}</Signal>{plan.why && <span className="bs-up-why">{plan.why}</span>}</span>
      <span className="bs-up-key"><BotKey event={e} autoJoinOn={autoJoinOn} busy={busy} onDecide={onDecide} /></span>
    </div>
  )
}

function MiniMonth({ cursor, selected, today, dots, onMonth, onPick, onToday }: {
  cursor: Date; selected: string; today: string; dots: Map<string, boolean[]>
  onMonth: (delta: number) => void; onPick: (key: string) => void; onToday: () => void
}): React.ReactElement {
  const cells = monthGrid(cursor.getFullYear(), cursor.getMonth())
  return (
    <div className="bs-up-mm">
      <div className="bs-up-mm-h">
        <b>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</b>
        <span className="bs-up-mm-keys">
          <Key size="sm" onClick={() => onMonth(-1)} aria-label="Previous month">‹</Key>
          <Key size="sm" onClick={onToday}>Today</Key>
          <Key size="sm" onClick={() => onMonth(1)} aria-label="Next month">›</Key>
        </span>
      </div>
      <div className="bs-up-mm-g" role="grid" aria-label={`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => <span key={i} className="bs-up-wd" aria-hidden="true">{w}</span>)}
        {cells.map((c) => (
          <button
            key={c.key}
            type="button"
            className={cx('bs-up-dd', !c.inMonth && 'out', c.key < today && 'past', c.key === today && 'today', c.key === selected && 'on')}
            onClick={() => onPick(c.key)}
            aria-pressed={c.key === selected}
            aria-label={`${fromDayKey(c.key).toDateString()}${dots.get(c.key)?.length ? `, ${dots.get(c.key)?.length} meetings` : ''}`}
          >
            <span>{c.day}</span>
            <Dots dots={dots.get(c.key)} />
          </button>
        ))}
      </div>
      <div className="bs-up-leg"><span><i />Bot joins</span><span><i className="h" />No bot</span></div>
    </div>
  )
}

function WeekStrip({ from, selected, today, dots, onPick, onShift }: {
  from: string; selected: string; today: string; dots: Map<string, boolean[]>
  onPick: (key: string) => void; onShift: (days: number) => void
}): React.ReactElement {
  const start = fromDayKey(from)
  return (
    <div className="bs-up-wk">
      <Key size="sm" onClick={() => onShift(-7)} aria-label="Earlier days">‹</Key>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i)
        const k = dayKey(d)
        return (
          <button key={k} type="button" className={cx('bs-up-dd', k === today && 'today', k === selected && 'on')} onClick={() => onPick(k)} aria-pressed={k === selected} aria-label={d.toDateString()}>
            <small>{WD[d.getDay()]?.[0]}</small>
            <span>{d.getDate()}</span>
            <Dots dots={dots.get(k)} />
          </button>
        )
      })}
      <Key size="sm" onClick={() => onShift(7)} aria-label="Later days">›</Key>
    </div>
  )
}

function WeekGrid({ events, monday, today, autoJoinOn, selectedId, onOpen }: {
  events: UpcomingEvent[]; monday: Date; today: string; autoJoinOn: boolean; selectedId: string | null; onOpen: (e: UpcomingEvent) => void
}): React.ReactElement {
  const { hours: [h0, h1], blocks, allDay } = weekBlocks(events, monday)
  const span = h1 - h0
  const now = new Date()
  const nowFrac = (now.getHours() + now.getMinutes() / 60 - h0) / span
  const todayIdx = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - monday.getTime()) / 86400000)
  return (
    <div className="bs-up-wg" style={{ ['--up-hours' as string]: span }}>
      <div className="bs-up-wg-hd" aria-hidden="true" />
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(monday, i)
        return <div key={i} className={cx('bs-up-wg-hd', dayKey(d) === today && 'today')}><b>{d.getDate()}</b><span>{WD[d.getDay()]}</span></div>
      })}
      <div className="bs-up-wg-hrs" aria-hidden="true">
        {Array.from({ length: span }, (_, i) => (i ? <span key={i} style={{ top: `${(i / span) * 100}%` }}>{String(h0 + i).padStart(2, '0')}</span> : null))}
      </div>
      {Array.from({ length: 7 }, (_, day) => (
        <div key={day} className="bs-up-wg-col">
          {Array.from({ length: span }, (_, i) => <i key={i} className="bs-up-wg-ln" style={{ top: `${(i / span) * 100}%` }} />)}
          {day === todayIdx && nowFrac > 0 && nowFrac < 1 && <i className="bs-up-wg-now" style={{ top: `${nowFrac * 100}%` }} aria-hidden="true" />}
          {allDay.filter((a) => a.day === day).map(({ event }) => (
            <button key={event.id} type="button" className="bs-up-ev is-off is-allday" onClick={() => onOpen(event)}><b>{event.title}</b></button>
          ))}
          {blocks.filter((b) => b.day === day).map(({ event, top, height }) => {
            const plan = botPlan(event, autoJoinOn)
            return (
              <button
                key={event.id + event.start}
                type="button"
                className={cx('bs-up-ev', !plan.goes && 'is-off', selectedId === event.id && 'is-sel')}
                style={{ top: `${top * 100}%`, height: `${height * 100}%` }}
                onClick={() => onOpen(event)}
                aria-label={`${event.title}, ${timeOf(event)}, ${plan.word}`}
              >
                <b>{event.title}</b>
                <span className="bs-up-ev-m"><span className={cx('bs-led', plan.tone)} aria-hidden="true" />{timeOf(event)}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

const ARRIVAL_OPTIONS = Array.from({ length: 6 }, (_, n) => ({
  value: String(n),
  label: n === 0 ? 'At meeting start' : `${n} minute${n === 1 ? '' : 's'} early`,
}))

function BookingControls({ event, defaultLead, onBooked }: {
  event: UpcomingEvent; defaultLead: number; onBooked: () => void
}): React.ReactElement | null {
  const workspace = useOrgSafe() as { org: { id: string } | null; myRole: string | null } | null
  const [lead, setLead] = useState(String(defaultLead))
  const [proposal, setProposal] = useState<EntoProposal | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cancelling = event.booking === 'schedule'

  if (!event.key || (workspace?.myRole && !['owner', 'admin'].includes(workspace.myRole))) return null
  if (['joining', 'in_call', 'completed', 'recording', 'in_waiting_room'].includes(event.botStatus ?? '')) return null
  if (event.booking === 'cancel' && ['pending', 'launching'].includes(event.botStatus ?? '')) return null
  if (!cancelling && !event.canSchedule) {
    return event.meetingLink && !event.allDay && startDate(event).getTime() > Date.now() && event.reason !== 'declined'
      ? <p className="bs-up-booking-note">To reserve a bot, its arrival time needs to be more than 10 minutes away.</p>
      : null
  }

  const prepare = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await entoAiApi.calendarBookings.propose({
        eventKey: event.key,
        orgId: workspace?.org?.id,
        decision: cancelling ? 'cancel' : 'schedule',
        ...(!cancelling ? { leadMinutes: Number(lead) } : {}),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      if (!res.ok || !res.proposal) throw new Error(res.error || 'Could not prepare that change.')
      setConfirmation('')
      setProposal(res.proposal)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const resolve = async (confirm: boolean): Promise<void> => {
    if (busy || !proposal || (confirm && !tokensMatch(proposal.confirmToken, confirmation))) return
    setBusy(true)
    setError('')
    try {
      const res = confirm
        ? await entoAiApi.calendarBookings.confirm(proposal.id, confirmation)
        : await entoAiApi.calendarBookings.reject(proposal.id)
      if (!res.ok) {
        if (res.proposal?.status && res.proposal.status !== 'proposed') setProposal(null)
        throw new Error(res.error || 'Could not save that change.')
      }
      setProposal(null)
      if (confirm) onBooked()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bs-up-booking">
      {proposal ? (
        <form className="bs-up-booking" onSubmit={(e) => { e.preventDefault(); void resolve(true) }}>
          <p>{proposal.summary}</p>
          <label className="bs-up-booking">
            <span>Type <strong>{proposal.confirmToken}</strong> to confirm</span>
            <TextInput value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy} />
          </label>
          <div className="bs-title-keys">
            <Key type="submit" variant="primary" disabled={busy || !tokensMatch(proposal.confirmToken, confirmation)}>Confirm</Key>
            <Key onClick={() => { void resolve(false) }} disabled={busy}>Dismiss</Key>
          </div>
        </form>
      ) : (
        <div className="bs-title-keys">
          {!cancelling && <Select label="Bot arrival" value={lead} onChange={setLead} options={ARRIVAL_OPTIONS} disabled={busy} />}
          <Key variant={cancelling ? undefined : 'primary'} disabled={busy} onClick={() => { void prepare() }}>
            {cancelling ? 'Cancel bot' : 'Schedule bot'}
          </Key>
        </div>
      )}
      {error && <p className="bs-up-booking-note" role="alert">{error}</p>}
    </div>
  )
}

function Prep({ event, autoJoinOn, busy, onDecide, defaultLead, onBooked }: { event: UpcomingEvent; autoJoinOn: boolean; busy: boolean; onDecide: (e: UpcomingEvent, d: 'skip' | 'join' | null) => void; defaultLead: number; onBooked: () => void }): React.ReactElement {
  const [carry, setCarry] = useState<CarryForwardData | null>(null)
  const plan = botPlan(event, autoJoinOn)
  const d = startDate(event)
  useEffect(() => {
    let live = true
    setCarry(null)
    const attendees = event.attendees.filter((a) => !a.self).map((a) => ({ name: a.name, email: a.email }))
    if (attendees.length === 0) return undefined
    meetingsApi.carryForwardPreview({ title: event.title, attendees, startsAt: d.toISOString() })
      .then((res: unknown) => { if (live) setCarry(res as CarryForwardData) })
      .catch(() => { /* the prep panel works without history */ })
    return () => { live = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, event.start])
  return (
    <div className="bs-up-prep">
      <h2 className="bs-up-prep-h">{event.title}</h2>
      <p className="bs-up-prep-m">
        {WD[d.getDay()]} {d.getDate()} {MO[d.getMonth()]} · {timeOf(event)}{durationMin(event) ? ` · ${durationLabel(durationMin(event))}` : ''}{event.platform ? ` · ${PLATFORM_LABEL[event.platform]}` : ''}
      </p>
      <div className="bs-up-botbox">
        <div>
          <Signal tone={plan.tone}>{plan.word}</Signal>
          <p>{plan.goes && plan.tone !== 'live' && event.joinAt
            ? `${event.booking === 'schedule' && plan.word === 'Booking queued' ? 'Requested arrival' : 'Bot arrival'} · ${timeOf({ ...event, start: event.joinAt })}`
            : plan.why}</p>
        </div>
        <BotKey event={event} autoJoinOn={autoJoinOn} busy={busy} onDecide={onDecide} />
      </div>
      <BookingControls key={event.key ?? event.id} event={event} defaultLead={defaultLead} onBooked={onBooked} />
      <CarryForward data={carry} title="Open from last time" limit={5} />
      {event.attendees.length > 0 && (
        <section className="bs-up-prep-sec">
          <Section title="People" level={3} />
          <p className="bs-up-prep-people">{peopleLine(event, 12)}</p>
        </section>
      )}
      {(event.meetingLink || event.htmlLink) && (
        <div className="bs-title-keys">
          {event.meetingLink && <a className="bs-key" href={event.meetingLink} target="_blank" rel="noopener noreferrer">Join meeting ↗</a>}
          {event.htmlLink && <a className="bs-key" href={event.htmlLink} target="_blank" rel="noopener noreferrer">Open in Google Calendar ↗</a>}
        </div>
      )}
    </div>
  )
}

export default function UpcomingMeetings(): React.ReactElement {
  const toast = useToast() as ToastApi
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [params, setParams] = useSearchParams()
  const { key: locationKey } = useLocation()
  const view: View = !isPhone && params.get('view') === 'week' ? 'week' : 'agenda'
  const today = dayKey(new Date())
  const [data, setData] = useState<UpcomingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(today)
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [stripFrom, setStripFrom] = useState(today)
  const openId = params.get('event')
  const setOpenId = (id: string | null): void => {
    const next = new URLSearchParams(params)
    if (id) next.set('event', id); else next.delete('event')
    setParams(next, { replace: true })
  }
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [carry, setCarry] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setData(normalizeUpcoming(await calendarApi.getUpcomingMeetings(DAYS)))
    } catch {
      setData({ configured: true, connected: true, autoJoin: { enabled: false, scope: 'organized' }, events: [], error: 'Upcoming meetings could not be loaded.' })
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load, locationKey])

  const events = useMemo(() => data?.events ?? [], [data])
  const autoJoinOn = Boolean(data?.autoJoin.enabled)
  const pendingBookings = events.some((e) => (e.booking === 'schedule' && !e.botStatus) ||
    (e.booking === 'cancel' && ['pending', 'launching', 'joining'].includes(e.botStatus ?? '')))
  useEffect(() => {
    if (!pendingBookings) return undefined
    const timer = window.setInterval(load, 30_000)
    return () => window.clearInterval(timer)
  }, [load, pendingBookings])


  // "Open from last time" on the next week's meetings with guests (one request each, at most 8).
  useEffect(() => {
    let live = true
    const soon = events.filter((e) => !e.allDay && e.attendees.some((a) => !a.self) && startDate(e).getTime() < Date.now() + 7 * 86400000).slice(0, 8)
    Promise.all(soon.map((e) => meetingsApi.carryForwardPreview({
      title: e.title,
      attendees: e.attendees.filter((a) => !a.self).map((a) => ({ name: a.name, email: a.email })),
      startsAt: startDate(e).toISOString(),
    }).then((res: unknown) => [e.id, (res as CarryForwardData | null)?.open?.[0]?.text] as const).catch(() => [e.id, undefined] as const)))
      .then((pairs) => {
        if (!live) return
        const next: Record<string, string> = {}
        for (const [id, text] of pairs) if (text) next[id] = text
        setCarry(next)
      })
    return () => { live = false }
  }, [events])

  const dots = useMemo(() => dotsByDay(events, autoJoinOn), [events, autoJoinOn])
  const days = useMemo(() => groupByDay(events, selectedDay), [events, selectedDay])
  const open = events.find((e) => e.id === openId) ?? null
  const joins = joinsCount(events, autoJoinOn)

  const decide = async (e: UpcomingEvent, decision: 'skip' | 'join' | null): Promise<void> => {
    if (!e.key) return
    const before = data
    setBusyKey(e.key)
    setData((d) => (d ? { ...d, events: d.events.map((x) => (x.id === e.id && x.start === e.start ? withOverride(x, decision) : x)) } : d))
    try {
      await calendarApi.setAutoJoinOverride(e.key, decision)
      load()
    } catch {
      setData(before)
      toast.error('Not saved', 'That choice could not be saved. Try again.')
    } finally {
      setBusyKey(null)
    }
  }

  const pickDay = (k: string): void => {
    setSelectedDay(k)
    const d = fromDayKey(k)
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
  }
  const goToday = (): void => { pickDay(today); setStripFrom(today) }
  const setView = (v: View): void => {
    const next = new URLSearchParams(params)
    if (v === 'week') next.set('view', 'week'); else next.delete('view')
    setParams(next, { replace: true })
  }

  if (loading && !data) {
    return <div className="bs-mtg-empty"><Signal tone="brand">Loading your calendar</Signal></div>
  }
  if (data && !data.connected) {
    const connect = async (): Promise<void> => {
      try {
        const res = await calendarApi.getAuthUrl('/meetings?tab=upcoming') as { authUrl?: string; url?: string }
        const url = res?.authUrl || res?.url
        if (url) window.location.href = url
      } catch {
        toast.error('Calendar', 'Google sign-in could not start. Try again.')
      }
    }
    return (
      <div className="bs-mtg-empty">
        <Signal tone="off">No calendar</Signal>
        <p className="bs-h3">Connect Google Calendar to see what’s coming up and choose which meetings get the bot.</p>
        {data.configured && <Key onClick={connect}>Connect calendar</Key>}
      </div>
    )
  }

  // The week view is a rolling seven days from the picked day (today by default).
  const monday = fromDayKey(selectedDay)
  const weekEvents = events.filter((e) => { const t = startDate(e).getTime(); return t >= monday.getTime() && t < addDays(monday, 7).getTime() })

  const list = days.length === 0 ? (
    <div className="bs-mtg-empty"><Signal tone="off">Nothing scheduled</Signal><p className="bs-h3">No meetings on your calendar from this day on.</p></div>
  ) : days.map((g) => (
    <section key={g.key} className="bs-up-day" aria-label={g.date.toDateString()}>
      <div className={cx('bs-up-dayh', g.key === today && 'today')}>
        <span className="bs-up-dayd"><b>{g.date.getDate()}</b><span>{g.key === today ? 'TODAY' : WD[g.date.getDay()]}</span><span>{MO[g.date.getMonth()]}</span></span>
        <span className="bs-lbl">{g.events.length} · bot joins {g.events.filter((e) => botPlan(e, autoJoinOn).goes).length}</span>
      </div>
      {g.events.map((e) => (
        <Row key={e.id + e.start} event={e} autoJoinOn={autoJoinOn} selected={openId === e.id} busy={busyKey === e.key} carry={carry[e.id]} onOpen={(x) => setOpenId(x.id)} onDecide={decide} />
      ))}
    </section>
  ))

  const note = (
    <>
      {data?.error && <div className="bs-up-note"><Signal tone="brand">Calendar</Signal><span>{data.error}</span><Key size="sm" onClick={load}>Try again</Key></div>}
      {!autoJoinOn && (
        <div className="bs-up-note">
          <Signal tone="off">Auto-join off</Signal>
          <span>The bot only goes where you send it. Turn auto-join on to choose meeting by meeting.</span>
          <Link className="bs-key sm" to="/settings?section=recording">Turn on</Link>
        </div>
      )}
    </>
  )

  const prep = (
    <Drawer open={Boolean(open)} onClose={() => setOpenId(null)} label="Upcoming meeting">
      {open && <Prep event={open} autoJoinOn={autoJoinOn} busy={busyKey === open.key} onDecide={decide} defaultLead={data?.autoJoin.leadMinutes ?? 0} onBooked={load} />}
    </Drawer>
  )

  if (isPhone) {
    return (
      <div className="bs-up">
        {note}
        <WeekStrip from={stripFrom} selected={selectedDay} today={today} dots={dots} onPick={setSelectedDay} onShift={(n) => { const k = dayKey(addDays(fromDayKey(stripFrom), n)); setStripFrom(k < today ? today : k); setSelectedDay(k < today ? today : k) }} />
        {list}
        {prep}
      </div>
    )
  }

  return (
    <div className="bs-up">
      {note}
      <Grid>
        <Cell span={8}>
          <div className="bs-up-bar">
            <Switch label="Upcoming view" options={VIEWS} value={view} onChange={setView} />
            {view === 'week' ? (
              <>
                <span className="bs-lbl bs-up-range">{monday.getDate()} {MO[monday.getMonth()]} – {addDays(monday, 6).getDate()} {MO[addDays(monday, 6).getMonth()]} · {weekEvents.length} meetings · bot joins {joinsCount(weekEvents, autoJoinOn)}</span>
                <Key size="sm" onClick={() => pickDay(dayKey(addDays(monday, -7)))} aria-label="Previous seven days">‹</Key>
                <Key size="sm" onClick={goToday}>Today</Key>
                <Key size="sm" onClick={() => pickDay(dayKey(addDays(monday, 7)))} aria-label="Next seven days">›</Key>
              </>
            ) : (
              <span className="bs-lbl bs-up-range">{selectedDay === today ? `Next ${DAYS} days` : `From ${fromDayKey(selectedDay).toDateString()}`} · {events.length} meetings · bot joins {joins}</span>
            )}
          </div>
          {view === 'week'
            ? <WeekGrid events={events} monday={monday} today={today} autoJoinOn={autoJoinOn} selectedId={openId} onOpen={(e) => setOpenId(e.id)} />
            : list}
        </Cell>
        <Cell span={4} rule>
          <MiniMonth
            cursor={cursor}
            selected={selectedDay}
            today={today}
            dots={dots}
            onMonth={(n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1))}
            onPick={pickDay}
            onToday={goToday}
          />
          <section className="bs-up-ctx">
            <div className="bs-up-ctx-h"><h3 className="bs-h3">Auto-join</h3><Link className="bs-key sm" to="/settings?section=recording">Change</Link></div>
            <div className="bs-up-ln"><span>Status</span><Signal tone={autoJoinOn ? 'mint' : 'off'}>{autoJoinOn ? 'On' : 'Off'}</Signal></div>
            <div className="bs-up-ln"><span>Joins</span><span>{data?.autoJoin.scope === 'all' ? 'Every meeting with a link' : 'Meetings you organize'}</span></div>
            <div className="bs-up-ln"><span>Next {DAYS} days</span><span className="bs-mono">{joins} of {events.length}</span></div>
          </section>
        </Cell>
      </Grid>
      {prep}
    </div>
  )
}

