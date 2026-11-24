/**
 * View logic for the Projects module (Bench Swiss, direction B "Bench", 2026-11-22).
 * A project's work is its own tasks plus the action items of the meetings linked to
 * it; its decisions come from those meetings. Pure functions over API rows, so the
 * pages stay presentational. The server-side counterpart is backend/services/projectRollup.js.
 */

import type { SignalTone } from '../components/bench'
import { asList } from './meetingView'
import { toSummaryMoments } from './meetingTranscriptService'
import { parseDay, startOfDay } from './todayView'
import { isOverdue, toWorkItems, type TaskActionRow, type TaskRow, type WorkItem } from './tasksView'

const DAY_MS = 86_400_000

// ── Rows from the API ───────────────────────────────────────────

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'archived'

export interface Rollup {
  total: number
  done: number
  open: number
  late: number
  fromMeetings: number
  decisions: number
  meetings: number
  lastMeeting: { id: string; title: string | null; at: string | null } | null
  nextMeeting: { id: string; title: string | null; at: string | null } | null
}

export interface ProjectRow {
  id: string
  name?: string | null
  description?: string | null
  status?: string | null
  start_date?: string | null
  end_date?: string | null
  deal_value?: number | null
  crm_deal_id?: string | null
  tags?: unknown
  created_at?: string | null
  rollup?: Rollup
}

export interface NeedRow {
  key: string
  kind: 'task' | 'action'
  id: string
  title: string
  owner: string | null
  due: string | null
  projectId: string
  projectName: string | null
  meetingId: string | null
  meetingTitle: string | null
}

export interface ProjectMeetingRow {
  id: string
  title?: string | null
  summary?: string | null
  created_at?: string | null
  start_time?: string | null
  duration_minutes?: number | null
  decisions?: unknown
  summary_moments?: unknown
}

export interface ProjectDetailRow extends ProjectRow {
  tasks?: TaskRow[]
  meetings?: ProjectMeetingRow[]
  actionItems?: TaskActionRow[]
}

const EMPTY_ROLLUP: Rollup = {
  total: 0, done: 0, open: 0, late: 0, fromMeetings: 0, decisions: 0, meetings: 0, lastMeeting: null, nextMeeting: null,
}

export function rollupOf(p: ProjectRow): Rollup {
  return p.rollup ?? EMPTY_ROLLUP
}

export function projectName(p: ProjectRow): string {
  return p.name?.trim() || 'Untitled project'
}

export function normalizeProjectStatus(raw: string | null | undefined): ProjectStatus {
  return raw === 'active' || raw === 'completed' || raw === 'archived' ? raw : 'planning'
}

export function toTags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string' && t.trim().length > 0) : []
}

// ── Status, dates, progress ─────────────────────────────────────

export type ProjectFilter = 'active' | 'planning' | 'done' | 'all'

export function filterGroup(p: ProjectRow): Exclude<ProjectFilter, 'all'> {
  const s = normalizeProjectStatus(p.status)
  return s === 'completed' || s === 'archived' ? 'done' : s
}

/** Whole days from today to the end date (negative once it has passed); null without an end date. */
export function daysLeft(end: string | null | undefined, now = new Date()): number | null {
  const d = parseDay(end ?? null)
  if (!d) return null
  return Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY_MS)
}

export interface ProjectSignal { tone: SignalTone; word: string }

/** One LED + word per project. Crimson means it needs someone: late work close to (or past) the end date. */
export function projectSignal(p: ProjectRow, now = new Date()): ProjectSignal {
  const s = normalizeProjectStatus(p.status)
  if (s === 'completed') return { tone: 'mint', word: 'Done' }
  if (s === 'archived') return { tone: 'off', word: 'Archived' }
  if (s === 'planning') return { tone: 'off', word: 'Planning' }
  const r = rollupOf(p)
  const left = daysLeft(p.end_date, now)
  if (left != null && left < 0 && r.open > 0) return { tone: 'brand', word: 'Overdue' }
  if (r.late > 0 && (left == null || left <= 14)) return { tone: 'brand', word: 'Slipping' }
  return { tone: 'live', word: 'On track' }
}

export function progressPct(r: Rollup): number {
  return r.total > 0 ? Math.round((r.done / r.total) * 100) : 0
}

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }

/** "Mon 1 Dec" */
export function dayShort(v: string | null | undefined): string {
  const d = parseDay(v ?? null)
  return d ? d.toLocaleDateString('en-GB', DAY_FMT).replace(',', '') : '—'
}

/** "Ends in 9 days", "Ends today", "Ended 3 days ago", "No end date". */
export function endsLabel(end: string | null | undefined, now = new Date()): string {
  const left = daysLeft(end, now)
  if (left == null) return 'No end date'
  if (left === 0) return 'Ends today'
  if (left > 0) return `Ends in ${left} ${left === 1 ? 'day' : 'days'}`
  return `Ended ${-left} ${left === -1 ? 'day' : 'days'} ago`
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// ── List ────────────────────────────────────────────────────────

const GROUP_ORDER: Record<Exclude<ProjectFilter, 'all'>, number> = { active: 0, planning: 1, done: 2 }

/** Filtered, active first, then by the nearest end date (no date last). */
export function shownProjects(list: ReadonlyArray<ProjectRow>, f: ProjectFilter, search = ''): ProjectRow[] {
  const q = search.trim().toLowerCase()
  return list
    .filter((p) => f === 'all' || filterGroup(p) === f)
    .filter((p) => !q || projectName(p).toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))
    .sort((a, b) => {
      const g = GROUP_ORDER[filterGroup(a)] - GROUP_ORDER[filterGroup(b)]
      if (g !== 0) return g
      const ea = parseDay(a.end_date ?? null)?.getTime() ?? Infinity
      const eb = parseDay(b.end_date ?? null)?.getTime() ?? Infinity
      return ea - eb
    })
}

export function filterCounts(list: ReadonlyArray<ProjectRow>): Record<ProjectFilter, number> {
  const out: Record<ProjectFilter, number> = { active: 0, planning: 0, done: 0, all: list.length }
  for (const p of list) out[filterGroup(p)] += 1
  return out
}

export interface ListSummary { active: number; slipping: number; late: number; decisions: number; meetings: number }

export function listSummary(list: ReadonlyArray<ProjectRow>, now = new Date()): ListSummary {
  const out: ListSummary = { active: 0, slipping: 0, late: 0, decisions: 0, meetings: 0 }
  for (const p of list) {
    const r = rollupOf(p)
    if (normalizeProjectStatus(p.status) === 'active') out.active += 1
    if (projectSignal(p, now).tone === 'brand') out.slipping += 1
    out.late += r.late
    out.decisions += r.decisions
    out.meetings += r.meetings
  }
  return out
}

// ── Deadlines display (portfolio timeline) ──────────────────────

export interface TimelineRow {
  id: string
  name: string
  schedule: ProjectSchedule
  startPct: number | null
  endPct: number
  done: number
  total: number
  late: number
}

export interface ProjectSchedule {
  start: number | null
  end: number | null
  dateLabel: string
  duration: number | null
  elapsed: number | null
  deadline: string | null
  overdue: boolean
  reversed: boolean
}

const clampPct = (v: number): number => Math.max(0, Math.min(100, v))

// Use local calendar dates with equal spacing, including across clock changes.
function calendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
}

function storedDay(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = Date.parse(value)
  return Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === value ? date / DAY_MS : null
}

const exactDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const tickDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const tickMonth = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })

export function projectSchedule(project: ProjectRow, now = new Date()): ProjectSchedule {
  const start = storedDay(project.start_date)
  const end = storedDay(project.end_date)
  const reversed = start != null && end != null && end < start
  const duration = start != null && end != null && !reversed ? end - start : null
  const today = calendarDay(now)
  const elapsed = duration != null && start != null ? Math.max(0, Math.min(duration, today - start)) : null
  const startLabel = start == null ? 'Start not set' : exactDate.format(start * DAY_MS)
  const endLabel = end == null ? 'End date not set' : exactDate.format(end * DAY_MS)
  const dateLabel = `${startLabel} → ${endLabel}`
  const remaining = end == null ? null : end - today
  const closed = filterGroup(project) === 'done'
  const overdue = remaining != null && remaining < 0 && !closed
  let deadline = null
  if (remaining != null && !closed) {
    deadline = remaining === 0 ? 'Due today' : remaining > 0
      ? `${plural(remaining, 'day')} remaining`
      : `${plural(-remaining, 'day')} overdue`
  }
  return { start, end, dateLabel, duration, elapsed, deadline, overdue, reversed }
}

export interface ScheduleScale {
  from: number
  to: number
  rangeLabel: string
  todayLabel: string
  nowPct: number
  unit: 'Days' | 'Weeks' | 'Months'
  ticks: Array<{ day: number; label: string; pct: number }>
}

function scalePosition(day: number, from: number, to: number): number {
  return clampPct((day - from) / (to - from) * 100)
}

function scheduleScale(first: number, last: number, today: number): ScheduleScale {
  const from = Math.min(today, first)
  const to = Math.max(today, last, from + 1)
  const span = to - from
  const unit = span <= 10 ? 'Days' : span <= 56 ? 'Weeks' : 'Months'
  const ticks: ScheduleScale['ticks'] = []
  const addTick = (day: number, format: Intl.DateTimeFormat) => {
    ticks.push({ day, label: format.format(day * DAY_MS), pct: scalePosition(day, from, to) })
  }
  if (unit === 'Months') {
    const firstMonth = new Date(from * DAY_MS)
    const lastMonth = new Date(to * DAY_MS)
    const months = (lastMonth.getUTCFullYear() - firstMonth.getUTCFullYear()) * 12 + lastMonth.getUTCMonth() - firstMonth.getUTCMonth() + 1
    const step = Math.ceil(months / 6)
    for (let m = 0; m < months; m += step) {
      const day = Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + m, 1) / DAY_MS
      if (day >= from) addTick(day, tickMonth)
    }
  } else {
    const step = unit === 'Weeks' ? 7 : span > 6 ? 2 : 1
    const untilMonday = (8 - new Date(from * DAY_MS).getUTCDay()) % 7
    for (let day = from + (unit === 'Weeks' ? untilMonday : 0); day <= to; day += step) addTick(day, tickDate)
  }
  return {
    from, to, unit, ticks,
    rangeLabel: `${exactDate.format(from * DAY_MS)} – ${exactDate.format(to * DAY_MS)}`,
    todayLabel: `Today · ${exactDate.format(today * DAY_MS)}`,
    nowPct: scalePosition(today, from, to),
  }
}

/** A deadline-only row has a marker. A project with no end date stays in its own list. */
export function timeline(list: ReadonlyArray<ProjectRow>, now = new Date(), maxRows = 6) {
  const live = list
    .filter((project) => filterGroup(project) !== 'done')
    .map((project) => ({ project, schedule: projectSchedule(project, now) }))
  const undated = live.filter(({ schedule }) => schedule.end == null)
  const dated = live.flatMap(({ project, schedule }) => schedule.end == null ? [] : [{ project, schedule, end: schedule.end }])
    .sort((a, b) => a.end - b.end)
  const shown = dated.slice(0, maxRows)
  if (shown.length === 0) return { scale: null, rows: [], datedCount: dated.length, undated }

  const scale = scheduleScale(
    Math.min(...shown.map(({ schedule, end }) => schedule.reversed ? end : schedule.start ?? end)),
    Math.max(...shown.map(({ end }) => end)), calendarDay(now),
  )
  const rows: TimelineRow[] = shown.map(({ project, schedule, end }) => {
    const r = rollupOf(project)
    return { id: project.id, name: projectName(project), schedule,
      startPct: schedule.start == null || schedule.reversed ? null : scalePosition(schedule.start, scale.from, scale.to),
      endPct: scalePosition(end, scale.from, scale.to), done: r.done, total: r.total, late: r.late }
  })
  return { scale, rows, datedCount: dated.length, undated }
}

// ── Project page ────────────────────────────────────────────────

/** The project's work: its top-level tasks and its meetings' action items, as one list. */
export function projectWork(p: ProjectDetailRow): WorkItem[] {
  return toWorkItems(p.tasks ?? [], p.actionItems ?? []).map((w) => ({ ...w, projectId: p.id }))
}

function meetingMs(m: ProjectMeetingRow): number | null {
  const t = Date.parse(m.start_time || m.created_at || '')
  return Number.isFinite(t) ? t : null
}

/** Meetings already held, newest first. */
export function heldMeetings(p: ProjectDetailRow, now = new Date()): ProjectMeetingRow[] {
  return (p.meetings ?? [])
    .filter((m) => { const t = meetingMs(m); return t == null || t <= now.getTime() })
    .sort((a, b) => (meetingMs(b) ?? 0) - (meetingMs(a) ?? 0))
}

/** The next linked meeting on the calendar, if any. */
export function nextMeeting(p: ProjectDetailRow, now = new Date()): ProjectMeetingRow | null {
  return (p.meetings ?? [])
    .filter((m) => { const t = meetingMs(m); return t != null && t > now.getTime() })
    .sort((a, b) => (meetingMs(a) ?? 0) - (meetingMs(b) ?? 0))[0] ?? null
}

export function meetingDay(m: ProjectMeetingRow): Date {
  const t = meetingMs(m)
  return t == null ? new Date(0) : new Date(t)
}

export interface ProjectDecision {
  key: string
  text: string
  meetingId: string
  meetingTitle: string
  date: Date
  atMs: number | null
}

/** Decisions from the project's meetings, newest meeting first, in the order they were made. */
export function projectDecisions(p: ProjectDetailRow, now = new Date()): ProjectDecision[] {
  const out: ProjectDecision[] = []
  for (const m of heldMeetings(p, now)) {
    const moments = toSummaryMoments(m.summary_moments).decisions
    asList(m.decisions).forEach((text, i) => {
      const at = moments[i]
      out.push({ key: `${m.id}:${i}`, text, meetingId: m.id, meetingTitle: m.title || 'Untitled meeting', date: meetingDay(m), atMs: typeof at === 'number' ? at : null })
    })
  }
  return out
}

export function decisionHref(d: ProjectDecision): string {
  return d.atMs != null ? `/meetings/${d.meetingId}?t=${d.atMs}` : `/meetings/${d.meetingId}`
}

export interface OwnerLine { name: string | null; open: number; late: number }

/** Open work by owner. Nobody first when there is unowned work, then by most open. */
export function owners(items: ReadonlyArray<WorkItem>, now = new Date()): OwnerLine[] {
  const map = new Map<string, OwnerLine>()
  for (const it of items) {
    if (it.status === 'done') continue
    const k = it.owner ?? ''
    const row = map.get(k) ?? { name: it.owner, open: 0, late: 0 }
    row.open += 1
    if (isOverdue(it, now)) row.late += 1
    map.set(k, row)
  }
  return [...map.values()].sort((a, b) => {
    if (a.name == null) return -1
    if (b.name == null) return 1
    return b.open - a.open || b.late - a.late || a.name.localeCompare(b.name)
  })
}

export interface WorkCounts { total: number; done: number; open: number; late: number; unowned: number }

export function workCounts(items: ReadonlyArray<WorkItem>, now = new Date()): WorkCounts {
  const open = items.filter((i) => i.status !== 'done')
  return {
    total: items.length,
    done: items.length - open.length,
    open: open.length,
    late: open.filter((i) => isOverdue(i, now)).length,
    unowned: open.filter((i) => !i.owner).length,
  }
}

// ── Project tape (display): kickoff → end date ──────────────────

/** `labelled` is false when the label would collide with the one before it on the tape. */
export interface TapeMark { key: string; pct: number; label: string; decisions: number; labelled: boolean }

/** Least gap, in % of the tape, between two labels before the later one is hidden. */
const TAPE_LABEL_GAP = 18

export interface ProjectTape {
  scale: ScheduleScale
  startPct: number | null
  endPct: number | null
  marks: TapeMark[]
  /** Upcoming linked meetings, drawn dim. */
  upcoming: TapeMark[]
}

export function projectTape(p: ProjectDetailRow, now = new Date(), schedule = projectSchedule(p, now)): ProjectTape | null {
  const { start, end } = schedule
  if (start == null && end == null) return null
  const first = start ?? end!
  const last = end ?? first
  const scale = scheduleScale(Math.min(first, last), Math.max(first, last), calendarDay(now))
  const at = (day: number) => scalePosition(day, scale.from, scale.to)
  const marks: TapeMark[] = []
  const upcoming: TapeMark[] = []
  for (const meeting of p.meetings ?? []) {
    const time = meetingMs(meeting)
    if (time == null) continue
    const day = calendarDay(new Date(time))
    if (day < scale.from || day > scale.to) continue
    const group = time <= now.getTime() ? marks : upcoming
    group.push({ key: meeting.id, pct: at(day), label: meeting.title?.trim() || 'Meeting', decisions: asList(meeting.decisions).length, labelled: true })
  }
  marks.sort((a, b) => a.pct - b.pct)
  upcoming.sort((a, b) => a.pct - b.pct)
  let lastLabel = -Infinity
  for (const m of [...marks, ...upcoming]) {
    m.labelled = m.pct - lastLabel >= TAPE_LABEL_GAP
    if (m.labelled) lastLabel = m.pct
  }
  return {
    scale,
    startPct: start == null ? null : at(start),
    endPct: end == null ? null : at(end),
    marks,
    upcoming,
  }
}

// ── Link meetings ───────────────────────────────────────────────

export interface LinkCandidate { id: string; title: string; at: Date | null; mentions: number; linkedElsewhere: boolean }

interface CandidateRow { id: string; title?: string | null; summary?: string | null; created_at?: string | null; start_time?: string | null; project_id?: string | null }

/** Words of the project name worth matching ("Northwind rollout" → northwind, rollout). */
export function nameWords(name: string): string[] {
  return name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4)
}

/**
 * Meetings not linked to this project, the ones that mention it most first, then newest.
 * Counts plain word matches in the title and summary; no model involved.
 */
export function linkCandidates(projectId: string, name: string, meetings: ReadonlyArray<CandidateRow>): LinkCandidate[] {
  const words = nameWords(name)
  return meetings
    .filter((m) => m.project_id !== projectId)
    .map((m) => {
      const text = `${m.title ?? ''} ${m.summary ?? ''}`.toLowerCase()
      const mentions = words.reduce((n, w) => n + (text.match(new RegExp(`\\b${w}`, 'g'))?.length ?? 0), 0)
      const t = Date.parse(m.start_time || m.created_at || '')
      return { id: m.id, title: m.title?.trim() || 'Untitled meeting', at: Number.isFinite(t) ? new Date(t) : null, mentions, linkedElsewhere: Boolean(m.project_id) }
    })
    .sort((a, b) => b.mentions - a.mentions || (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
}

// ── URL state ───────────────────────────────────────────────────

export type ProjectDrawer = 'new' | 'edit' | 'link' | 'task'
export type WorkLayout = 'list' | 'lanes'

export interface ProjectsUrlState {
  show: ProjectFilter
  /** Work item key ("task:<id>" / "action:<id>") open in the drawer. */
  item: string | null
  drawer: ProjectDrawer | null
  layout: WorkLayout
}

const FILTERS: ReadonlyArray<ProjectFilter> = ['active', 'planning', 'done', 'all']
const DRAWERS: ReadonlyArray<ProjectDrawer> = ['new', 'edit', 'link', 'task']

export function readUrl(params: URLSearchParams): ProjectsUrlState {
  const show = params.get('show') as ProjectFilter | null
  const drawer = params.get('dr') as ProjectDrawer | null
  return {
    show: show && FILTERS.includes(show) ? show : 'all',
    item: params.get('item') || null,
    drawer: drawer && DRAWERS.includes(drawer) ? drawer : null,
    layout: params.get('layout') === 'lanes' ? 'lanes' : 'list',
  }
}

export function writeUrl(s: ProjectsUrlState): Record<string, string> {
  const out: Record<string, string> = {}
  if (s.show !== 'all') out.show = s.show
  if (s.item) out.item = s.item
  if (s.drawer) out.dr = s.drawer
  if (s.layout === 'lanes') out.layout = 'lanes'
  return out
}
