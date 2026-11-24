/**
 * Meetings › Upcoming (Slate pick 2026-11-22: A agenda, B week grid as a
 * second desktop view). Pure view logic: the server's reply read defensively,
 * the bot's plan per meeting as LED + word + reason + one key, day groups,
 * the month mini calendar and the week grid. Data: GET /api/calendar/upcoming-meetings.
 */
import type { SignalTone } from '../components/bench'

export type BotReason =
  | 'skipped' | 'not_organizer' | 'no_invitees' | 'no_link' | 'declined'
  | 'all_day' | 'started' | 'cancelled' | 'later' | string

export interface UpcomingAttendee { name: string | null; email: string | null; self: boolean }

export interface UpcomingEvent {
  id: string
  /** Event id + start; the override key. Null for all-day events. */
  key: string | null
  title: string
  /** ISO date-time, or YYYY-MM-DD for all-day events. */
  start: string
  end: string | null
  allDay: boolean
  platform: 'meet' | 'zoom' | 'teams' | null
  join: boolean
  reason: BotReason | null
  override: 'skip' | 'join' | null
  canJoin: boolean
  /** 'you', a display name or email, or null. */
  organizer: string | null
  attendees: UpcomingAttendee[]
  botStatus: string | null
  htmlLink: string | null
  meetingLink?: string | null
  joinAt?: string | null
}

export interface UpcomingData {
  configured: boolean
  connected: boolean
  autoJoin: { enabled: boolean; scope: 'organized' | 'all' }
  events: UpcomingEvent[]
  error: string | null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const PLATFORMS = ['meet', 'zoom', 'teams'] as const

function readEvent(raw: unknown): UpcomingEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  const start = str(r.start)
  if (!id || !start) return null
  const platform = PLATFORMS.find((p) => p === r.platform) ?? null
  const override = r.override === 'skip' || r.override === 'join' ? r.override : null
  const attendees = Array.isArray(r.attendees)
    ? r.attendees.filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === 'object')
      .map((a) => ({ name: str(a.name), email: str(a.email), self: a.self === true }))
    : []
  return {
    id,
    key: str(r.key),
    title: str(r.title) ?? 'Untitled event',
    start,
    end: str(r.end),
    allDay: r.allDay === true,
    platform,
    join: r.join === true,
    reason: str(r.reason),
    override,
    canJoin: r.canJoin === true,
    organizer: str(r.organizer),
    attendees,
    botStatus: str(r.botStatus),
    htmlLink: str(r.htmlLink),
    meetingLink: platform && typeof r.meetingLink === 'string' && r.meetingLink.startsWith('https://') ? r.meetingLink : null,
    joinAt: str(r.joinAt),
  }
}

/** The server's reply; a missing field never breaks the page. */
export function normalizeUpcoming(raw: unknown): UpcomingData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const aj = (r.autoJoin && typeof r.autoJoin === 'object' ? r.autoJoin : {}) as Record<string, unknown>
  const events = Array.isArray(r.events) ? r.events.map(readEvent).filter((e): e is UpcomingEvent => e !== null) : []
  events.sort((a, b) => startMs(a) - startMs(b))
  return {
    configured: r.configured !== false,
    connected: r.connected === true,
    autoJoin: { enabled: aj.enabled === true, scope: aj.scope === 'all' ? 'all' : 'organized' },
    events,
    error: str(r.error),
  }
}

/** Local midnight for all-day dates, so 2026-11-26 stays on the 26th. */
export function startDate(e: Pick<UpcomingEvent, 'start' | 'allDay'>): Date {
  return new Date(e.allDay && e.start.length === 10 ? `${e.start}T00:00:00` : e.start)
}
const startMs = (e: UpcomingEvent): number => startDate(e).getTime()

/** YYYY-MM-DD in local time. */
export function dayKey(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function fromDayKey(key: string): Date {
  return new Date(`${key}T00:00:00`)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Minutes between start and end, or null. */
export function durationMin(e: UpcomingEvent): number | null {
  if (e.allDay || !e.end) return null
  const m = Math.round((new Date(e.end).getTime() - startMs(e)) / 60000)
  return m > 0 ? m : null
}

export function durationLabel(min: number | null): string {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h${m ? ` ${String(m).padStart(2, '0')}m` : ''}` : `${m}m`
}

export const PLATFORM_LABEL: Record<'meet' | 'zoom' | 'teams', string> = { meet: 'Meet', zoom: 'Zoom', teams: 'Teams' }

export interface BotPlan {
  tone: SignalTone
  word: string
  why: string
  /** The row key, and the override it saves. */
  key: { label: 'Skip' | 'Join'; decision: 'skip' | 'join' | null } | null
  /** Filled dot (bot goes) or hollow (no bot) in the calendars. */
  goes: boolean
}

const LIVE = ['in_call', 'joining', 'recording', 'in_waiting_room']
const BOOKED = ['pending', 'launching']

/** What the bot will do for this meeting, and the one key that changes it. */
export function botPlan(e: UpcomingEvent, autoJoinOn: boolean): BotPlan {
  if (e.botStatus && LIVE.includes(e.botStatus)) return { tone: 'live', word: 'Bot in call', why: 'Recording now', key: null, goes: true }
  if (e.allDay) return { tone: 'off', word: 'No bot', why: 'All-day event', key: null, goes: false }
  if (!autoJoinOn) {
    return { tone: 'off', word: 'Auto-join off', why: e.platform ? 'Send a bot by hand, or turn auto-join on' : 'No video link', key: null, goes: false }
  }
  if (e.join) {
    const booked = Boolean(e.botStatus && BOOKED.includes(e.botStatus))
    const why = e.override === 'join' ? 'You asked for it' : e.organizer === 'you' ? 'You organize it' : 'Auto-join takes all meetings'
    return {
      tone: 'brand',
      word: booked ? 'Bot booked' : 'Bot joins',
      why,
      key: { label: 'Skip', decision: e.override === 'join' ? null : 'skip' },
      goes: true,
    }
  }
  const join = e.canJoin ? { label: 'Join' as const, decision: e.reason === 'skipped' ? null : 'join' as const } : null
  switch (e.reason) {
    case 'skipped': return { tone: 'off', word: 'Skipped', why: 'You skipped this one', key: join, goes: false }
    case 'not_organizer': return { tone: 'off', word: 'Not yours', why: `${e.organizer || 'Someone else'} organizes it`, key: join, goes: false }
    case 'no_invitees': return { tone: 'off', word: 'Just you', why: 'Nobody else is invited', key: join, goes: false }
    case 'no_link': return { tone: 'off', word: 'No video link', why: 'Add a Meet, Zoom or Teams link', key: null, goes: false }
    case 'declined': return { tone: 'off', word: 'Declined', why: 'You declined it', key: null, goes: false }
    case 'started': return { tone: 'off', word: 'Started', why: 'It began without a bot', key: null, goes: false }
    default: return { tone: 'off', word: 'No bot', why: '', key: join, goes: false }
  }
}

/** Apply a saved override locally, the way the server will decide it. */
export function withOverride(e: UpcomingEvent, decision: 'skip' | 'join' | null): UpcomingEvent {
  if (decision === 'skip') return { ...e, override: 'skip', join: false, reason: 'skipped' }
  if (decision === 'join') return { ...e, override: 'join', join: true, reason: null }
  // Clearing: back to what auto-join decides on its own.
  if (e.override === 'skip') return { ...e, override: null, join: true, reason: null }
  if (e.override === 'join') return { ...e, override: null, join: false, reason: e.organizer === 'you' ? 'no_invitees' : 'not_organizer' }
  return e
}

export interface DayGroup { key: string; date: Date; events: UpcomingEvent[] }

/** Events from `fromKey` on, grouped by local day. */
export function groupByDay(events: UpcomingEvent[], fromKey?: string): DayGroup[] {
  const out: DayGroup[] = []
  for (const e of events) {
    const k = dayKey(startDate(e))
    if (fromKey && k < fromKey) continue
    const last = out[out.length - 1]
    if (last && last.key === k) last.events.push(e)
    else out.push({ key: k, date: fromDayKey(k), events: [e] })
  }
  return out
}

/** Dots per day for the calendars: true = the bot goes. At most three. */
export function dotsByDay(events: UpcomingEvent[], autoJoinOn: boolean): Map<string, boolean[]> {
  const m = new Map<string, boolean[]>()
  for (const e of events) {
    const k = dayKey(startDate(e))
    const dots = m.get(k) ?? []
    if (dots.length < 3) dots.push(botPlan(e, autoJoinOn).goes)
    m.set(k, dots)
  }
  return m
}

export interface MonthCell { key: string; day: number; inMonth: boolean }

/** Six Monday-first weeks covering the month. */
export function monthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = addDays(first, -offset)
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(start, i)
    return { key: dayKey(d), day: d.getDate(), inMonth: d.getMonth() === month }
  })
}

/** Monday of the week holding `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return addDays(x, -((x.getDay() + 6) % 7))
}

export interface WeekBlock { event: UpcomingEvent; day: number; top: number; height: number }

/**
 * Timed events of the week from `monday`, placed on an hour grid. Hours
 * default to 08–18 and widen to fit. top/height are fractions of the grid.
 */
export function weekBlocks(events: UpcomingEvent[], monday: Date): { hours: [number, number]; blocks: WeekBlock[]; allDay: { event: UpcomingEvent; day: number }[] } {
  const end = addDays(monday, 7).getTime()
  const inWeek = events.filter((e) => { const t = startMs(e); return t >= monday.getTime() && t < end })
  const timed = inWeek.filter((e) => !e.allDay)
  let h0 = 8
  let h1 = 18
  for (const e of timed) {
    const s = startDate(e)
    const endH = s.getHours() + (s.getMinutes() + (durationMin(e) ?? 30)) / 60
    h0 = Math.min(h0, s.getHours())
    h1 = Math.max(h1, Math.min(24, Math.ceil(endH)))
  }
  const span = h1 - h0
  const blocks = timed.map((e) => {
    const s = startDate(e)
    const day = Math.floor((new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime() - monday.getTime()) / 86400000)
    const top = (s.getHours() + s.getMinutes() / 60 - h0) / span
    const height = Math.max((durationMin(e) ?? 30) / 60 / span, 0.04)
    return { event: e, day, top, height }
  })
  const allDay = inWeek.filter((e) => e.allDay).map((e) => {
    const s = startDate(e)
    return { event: e, day: Math.floor((new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime() - monday.getTime()) / 86400000) }
  })
  return { hours: [h0, h1], blocks, allDay }
}

/** People line for a row: names (or emails), you first as "You". */
export function peopleLine(e: UpcomingEvent, max = 3): string {
  const names = e.attendees.map((a) => (a.self ? 'You' : a.name || a.email || '')).filter(Boolean)
  names.sort((a, b) => (a === 'You' ? -1 : b === 'You' ? 1 : 0))
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} +${names.length - max}`
}

export function joinsCount(events: UpcomingEvent[], autoJoinOn: boolean): number {
  return events.filter((e) => botPlan(e, autoJoinOn).goes).length
}
