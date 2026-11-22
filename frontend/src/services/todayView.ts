/**
 * View logic for the Today module (Bench Swiss pass): what's live or next, action
 * items grouped by when they're due, the calls agents made on them, this week's
 * decisions and today's schedule. Pure functions over API rows, so the page stays
 * presentational.
 */

import type { SignalTone } from '../components/bench'
import { asList, meetingDate, meetingStatus, type MeetingRow } from './meetingView'
import { toSummaryMoments } from './meetingTranscriptService'

const DAY_MS = 86_400_000

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfWeek(d: Date): Date {
  const s = startOfDay(d)
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)) // Monday
  return s
}

/** A due date as a local day. Date-only strings ("2026-11-28") are read as local midnight, not UTC. */
export function parseDay(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 24-hour clock, as the Meetings pass shows times: "09:05". */
export function clock(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** "Today", "Tomorrow", "Yesterday", else "Fri 28 Nov". */
export function dayLabel(d: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY_MS)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' })
  const mo = d.toLocaleDateString('en-US', { month: 'short' })
  return `${wd} ${d.getDate()} ${mo}`
}

/** A countdown or elapsed time: "00:42:10". Negative values clamp to zero. */
export function hms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [h, m, s % 60].map((n) => String(n).padStart(2, '0')).join(':')
}

// ── Action items ────────────────────────────────────────────────

export type AgentKind = 'priority' | 'deadline' | 'assignment'

export interface AgentNote {
  recommended: string | null
  reason?: string | null
  confidence?: number | null
  applied: boolean
}

export interface AgentNotes {
  reviewed_at?: string
  priority?: AgentNote
  deadline?: AgentNote
  assignment?: AgentNote
}

/** The fields of an `action_items` row (from /dashboard/action-items) these helpers read. */
export interface ActionItemRow {
  id: string
  task_description?: string | null
  title?: string | null
  assigned_to_name?: string | null
  due_date?: string | null
  priority?: string | null
  status?: string | null
  meeting_id?: string | null
  agent_notes?: unknown
  meetings?: { title?: string | null } | null
}

export function itemTitle(item: ActionItemRow): string {
  return (item.task_description || item.title || 'Untitled action item').trim()
}

export function isOpen(item: ActionItemRow): boolean {
  return item.status !== 'done' && item.status !== 'complete' && item.status !== 'completed'
}

const KINDS: AgentKind[] = ['priority', 'deadline', 'assignment']

export function toAgentNotes(raw: unknown): AgentNotes | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as AgentNotes
}

function validNote(n: unknown): n is AgentNote {
  if (!n || typeof n !== 'object') return false
  const note = n as AgentNote
  return Boolean(note.recommended || note.reason)
}

export interface AgentWhy {
  kind: AgentKind
  reason: string
  /** 0–100, or null when the agent gave none. */
  confidence: number | null
  applied: boolean
}

function pct(c: number | null | undefined): number | null {
  return typeof c === 'number' && Number.isFinite(c) ? Math.round(c <= 1 ? c * 100 : c) : null
}

/** The agent's reason to show under an item: the first note with a reason, priority first. */
export function agentWhy(item: ActionItemRow): AgentWhy | null {
  const notes = toAgentNotes(item.agent_notes)
  if (!notes) return null
  for (const kind of KINDS) {
    const n = notes[kind]
    if (validNote(n) && n.reason) {
      return { kind, reason: n.reason, confidence: pct(n.confidence), applied: Boolean(n.applied) }
    }
  }
  return null
}

/** Confidence of the priority call when an agent set the priority; null when a person did. */
export function priorityConfidence(item: ActionItemRow): number | null {
  const n = toAgentNotes(item.agent_notes)?.priority
  return validNote(n) && n.applied ? pct(n.confidence) : null
}

export function priorityTone(p: string | null | undefined): { tone: SignalTone; word: string } {
  if (p === 'high' || p === 'urgent') return { tone: 'brand', word: 'High' }
  if (p === 'medium') return { tone: 'off', word: 'Medium' }
  return { tone: 'off', word: 'Low' }
}

export type DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none'

const BUCKETS: Array<{ key: DueBucket; label: string }> = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'later', label: 'Later' },
  { key: 'none', label: 'No date' },
]

export function dueBucket(item: ActionItemRow, now = new Date()): DueBucket {
  const due = parseDay(item.due_date)
  if (!due) return 'none'
  const today = startOfDay(now).getTime()
  const day = startOfDay(due).getTime()
  if (day < today) return 'overdue'
  if (day === today) return 'today'
  if (day < today + 8 * DAY_MS) return 'week'
  return 'later'
}

export interface ItemGroup {
  key: DueBucket
  label: string
  rows: ActionItemRow[]
  /** Open items in this bucket, including any cut by the cap. */
  total: number
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 0, medium: 1, low: 2 }

/**
 * Open items under Overdue / Due today / Next 7 days / Later / No date, soonest first
 * and High before Medium on the same day. At most `max` rows in all.
 */
export function groupActionItems(items: ReadonlyArray<ActionItemRow>, now = new Date(), max = 8): ItemGroup[] {
  const open = items.filter(isOpen)
  const byBucket = new Map<DueBucket, ActionItemRow[]>()
  for (const item of open) {
    const b = dueBucket(item, now)
    const list = byBucket.get(b) ?? []
    list.push(item)
    byBucket.set(b, list)
  }
  let left = max
  const groups: ItemGroup[] = []
  for (const { key, label } of BUCKETS) {
    const list = byBucket.get(key)
    if (!list || list.length === 0) continue
    list.sort((a, b) => {
      const da = parseDay(a.due_date)?.getTime() ?? Infinity
      const db = parseDay(b.due_date)?.getTime() ?? Infinity
      if (startOfDay(new Date(da)).getTime() !== startOfDay(new Date(db)).getTime() && da !== db) return da - db
      return (PRIORITY_RANK[a.priority ?? ''] ?? 3) - (PRIORITY_RANK[b.priority ?? ''] ?? 3)
    })
    if (left <= 0) {
      groups.push({ key, label, rows: [], total: list.length })
      continue
    }
    groups.push({ key, label, rows: list.slice(0, left), total: list.length })
    left -= Math.min(left, list.length)
  }
  return groups.filter((g) => g.rows.length > 0)
}

export interface DueSummary {
  dueToday: number
  overdue: number
  open: number
}

export function dueSummary(items: ReadonlyArray<ActionItemRow>, now = new Date()): DueSummary {
  let dueToday = 0
  let overdue = 0
  let open = 0
  for (const item of items) {
    if (!isOpen(item)) continue
    open++
    const b = dueBucket(item, now)
    if (b === 'today') dueToday++
    if (b === 'overdue') overdue++
  }
  return { dueToday, overdue, open }
}

// ── Agent calls ─────────────────────────────────────────────────

export interface AgentCall {
  key: string
  kind: AgentKind
  itemId: string
  meetingId: string | null
  itemTitle: string
  recommended: string | null
  reason: string | null
  confidence: number | null
  applied: boolean
  at: Date
}

export const AGENT_NAMES: Record<AgentKind, string> = {
  priority: 'Priority',
  deadline: 'Deadline',
  assignment: 'Assignment',
}

/** Every call the Priority, Deadline and Assignment agents made, newest first. */
export function agentCalls(items: ReadonlyArray<ActionItemRow>): AgentCall[] {
  const out: AgentCall[] = []
  for (const item of items) {
    const notes = toAgentNotes(item.agent_notes)
    if (!notes) continue
    const at = notes.reviewed_at ? new Date(notes.reviewed_at) : null
    if (!at || Number.isNaN(at.getTime())) continue
    for (const kind of KINDS) {
      const n = notes[kind]
      if (!validNote(n)) continue
      out.push({
        key: `${item.id}:${kind}`,
        kind,
        itemId: item.id,
        meetingId: item.meeting_id ?? null,
        itemTitle: itemTitle(item),
        recommended: n.recommended ?? null,
        reason: n.reason ?? null,
        confidence: pct(n.confidence),
        applied: Boolean(n.applied),
        at,
      })
    }
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime())
}

function quote(s: string, max = 44): string {
  const t = s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
  return `“${t}”`
}

/** One line a person reads: what the agent did, or what it suggested and held back. */
export function describeCall(c: AgentCall, now = new Date()): string {
  const what = quote(c.itemTitle)
  let value = c.recommended ?? 'none'
  if (c.kind === 'priority') value = priorityTone(c.recommended).word
  if (c.kind === 'deadline') {
    const d = parseDay(c.recommended)
    if (d) value = dayLabel(d, now)
  }
  if (c.kind === 'assignment') return c.applied ? `Gave ${what} to ${value}` : `Suggests ${value} for ${what}`
  if (c.kind === 'deadline') return c.applied ? `Set ${what} due ${value}` : `Suggests ${value} for ${what}`
  return c.applied ? `Set ${what} to ${value}` : `Suggests ${value} for ${what}`
}

export interface CallSummary {
  today: number
  suggested: number
}

/** Calls made since midnight; "suggested" ones were held back and wait for a person. */
export function callSummary(calls: ReadonlyArray<AgentCall>, now = new Date()): CallSummary {
  const since = startOfDay(now).getTime()
  const todays = calls.filter((c) => c.at.getTime() >= since)
  return { today: todays.length, suggested: todays.filter((c) => !c.applied).length }
}

// ── Meetings: live, decisions, schedule ─────────────────────────

/** When a recording in this browser started (`recording_job.startedAt`), if it did. */
export function recordingStartedAt(m: MeetingRow): Date | null {
  const raw = m.recording_job
  if (!raw || typeof raw !== 'object') return null
  const v = (raw as { startedAt?: unknown }).startedAt
  if (typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** The meeting being recorded right now, else one whose minutes are being written. */
export function liveMeeting<T extends MeetingRow>(meetings: ReadonlyArray<T>, now = Date.now()): T | null {
  return (
    meetings.find((m) => meetingStatus(m, now).key === 'recording') ??
    meetings.find((m) => meetingStatus(m, now).key === 'writing') ??
    null
  )
}

export interface WeekDecision {
  key: string
  text: string
  meetingId: string
  meetingTitle: string
  date: Date
  atMs: number | null
}

/** Decisions from meetings held since Monday, newest meeting first, in the order they were made. */
export function decisionsThisWeek(meetings: ReadonlyArray<MeetingRow>, now = new Date()): WeekDecision[] {
  const since = startOfWeek(now).getTime()
  const out: WeekDecision[] = []
  const rows = [...meetings].sort((a, b) => meetingDate(b).getTime() - meetingDate(a).getTime())
  for (const m of rows) {
    const date = meetingDate(m)
    if (date.getTime() < since) continue
    const moments = toSummaryMoments(m.summary_moments).decisions
    asList(m.decisions).forEach((text, i) => {
      const at = moments[i]
      out.push({
        key: `${m.id}:${i}`,
        text,
        meetingId: m.id,
        meetingTitle: m.title || 'Untitled meeting',
        date,
        atMs: typeof at === 'number' ? at : null,
      })
    })
  }
  return out
}

/** An event from /calendar/upcoming. Action items and goals come back too; only `calendar` ones are meetings. */
export interface UpcomingRow {
  type?: string
  id: string
  title?: string | null
  date?: string | null
  allDay?: boolean
}

export interface CalendarEvent {
  id: string
  title: string
  at: Date
  allDay: boolean
}

export function calendarEvents(rows: ReadonlyArray<UpcomingRow>): CalendarEvent[] {
  const out: CalendarEvent[] = []
  for (const r of rows) {
    if (r.type !== 'calendar' || !r.date) continue
    const at = parseDay(r.date)
    if (!at) continue
    out.push({ id: r.id, title: r.title?.trim() || 'Untitled event', at, allDay: Boolean(r.allDay) })
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/** The next timed meeting that starts within `withinMs`. */
export function nextEvent(events: ReadonlyArray<CalendarEvent>, now = new Date(), withinMs = DAY_MS): CalendarEvent | null {
  const t = now.getTime()
  return events.find((e) => !e.allDay && e.at.getTime() > t && e.at.getTime() - t <= withinMs) ?? null
}

export interface ScheduleEntry {
  key: string
  at: Date | null
  title: string
  tone: SignalTone
  word: string
  /** Recorded meetings link to their minutes. */
  meetingId: string | null
  past: boolean
}

/**
 * Today on one line per meeting: what was recorded (with its status) and what the
 * calendar still holds (scheduled), in time order. All-day events lead.
 */
export function todaySchedule(meetings: ReadonlyArray<MeetingRow>, events: ReadonlyArray<CalendarEvent>, now = new Date()): ScheduleEntry[] {
  const today = startOfDay(now).getTime()
  const tomorrow = today + DAY_MS
  const t = now.getTime()
  const out: ScheduleEntry[] = []
  for (const m of meetings) {
    const at = meetingDate(m)
    if (at.getTime() < today || at.getTime() >= tomorrow) continue
    const s = meetingStatus(m, t)
    out.push({ key: `m:${m.id}`, at, title: m.title || 'Untitled meeting', tone: s.tone, word: s.word, meetingId: m.id, past: at.getTime() <= t })
  }
  for (const e of events) {
    if (e.at.getTime() < today || e.at.getTime() >= tomorrow) continue
    out.push({
      key: `e:${e.id}`,
      at: e.allDay ? null : e.at,
      title: e.title,
      tone: 'off',
      word: e.allDay ? 'All day' : 'Scheduled',
      meetingId: null,
      past: !e.allDay && e.at.getTime() <= t,
    })
  }
  return out.sort((a, b) => (a.at?.getTime() ?? -Infinity) - (b.at?.getTime() ?? -Infinity))
}
