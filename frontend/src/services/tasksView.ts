/**
 * View logic for the Tasks module (Bench Swiss pass): one work list made of the
 * tasks people add and the action items meetings produce, grouped by urgency or
 * by status lane, with the meeting each one came from. Pure functions over API
 * rows, so the page stays presentational.
 */

import type { SignalTone } from '../components/bench'
import {
  agentWhy,
  dueBucket,
  itemTitle,
  parseDay,
  startOfDay,
  type ActionItemRow,
  type AgentWhy,
  type DueBucket,
} from './todayView'

// ── Rows from the API ───────────────────────────────────────────

/** The fields of a `tasks` row (from /tasks) these helpers read. */
export interface TaskRow {
  id: string
  title?: string | null
  description?: string | null
  status?: string | null
  priority?: string | null
  assigned_to?: string | null
  due_date?: string | null
  tags?: unknown
  project_id?: string | null
  parent_task_id?: string | null
  custom_fields?: unknown
  created_at?: string | null
  completed_at?: string | null
}

export interface TaskActionRow extends ActionItemRow {
  transcript_at_ms?: number | null
  created_at?: string | null
  context?: string | null
  assigned_to_email?: string | null
  last_nudged_at?: string | null
}

// ── The work item ───────────────────────────────────────────────

export type WorkStatus = 'open' | 'in_progress' | 'review' | 'blocked' | 'done'
export type WorkPriority = 'high' | 'medium' | 'low'
export type WorkKind = 'task' | 'action'

export interface MeetingSource {
  meetingId: string
  title: string | null
  /** Where in the recording it was said, in ms. */
  atMs: number | null
}

export interface WorkItem {
  /** Unique across both sources: "task:<id>" or "action:<id>". */
  key: string
  id: string
  kind: WorkKind
  title: string
  description: string | null
  status: WorkStatus
  priority: WorkPriority
  due: string | null
  owner: string | null
  /** Action items only: where a Nudge reminder goes, and when the last one went. */
  ownerEmail?: string | null
  nudgedAt?: string | null
  tags: string[]
  projectId: string | null
  source: MeetingSource | null
  agent: AgentWhy | null
  createdAt: string | null
}

export const STATUSES: ReadonlyArray<WorkStatus> = ['open', 'in_progress', 'review', 'blocked', 'done']

const STATUS_WORDS: Record<WorkStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  review: 'Review',
  blocked: 'Blocked',
  done: 'Done',
}

const STATUS_TONES: Record<WorkStatus, SignalTone> = {
  open: 'off',
  in_progress: 'live',
  review: 'ai',
  blocked: 'brand',
  done: 'mint',
}

export function statusWord(s: WorkStatus): string {
  return STATUS_WORDS[s]
}

/** The short label for a lane tab on phone. */
export function laneWord(s: WorkStatus): string {
  return s === 'in_progress' ? 'Doing' : STATUS_WORDS[s]
}

export function statusTone(s: WorkStatus): SignalTone {
  return STATUS_TONES[s]
}

/** Legacy rows say todo / completed; action items may say complete or pending. */
export function normalizeStatus(raw: string | null | undefined): WorkStatus {
  switch (raw) {
    case 'in_progress':
    case 'review':
    case 'blocked':
    case 'done':
      return raw
    case 'completed':
    case 'complete':
      return 'done'
    default:
      return 'open'
  }
}

export function normalizePriority(raw: string | null | undefined): WorkPriority {
  if (raw === 'high' || raw === 'urgent' || raw === 'critical') return 'high'
  if (raw === 'low') return 'low'
  return 'medium'
}

function toTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map((t) => t.trim())
}

function finiteMs(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null
}

/**
 * A task's meeting link, kept in `custom_fields.source` (no schema change):
 * `{ meeting_id, meeting_title?, at_ms? }`.
 */
export function taskSource(row: TaskRow): MeetingSource | null {
  const cf = row.custom_fields
  if (!cf || typeof cf !== 'object' || Array.isArray(cf)) return null
  const src = (cf as Record<string, unknown>).source
  if (!src || typeof src !== 'object' || Array.isArray(src)) return null
  const s = src as Record<string, unknown>
  if (typeof s.meeting_id !== 'string' || !s.meeting_id) return null
  return {
    meetingId: s.meeting_id,
    title: typeof s.meeting_title === 'string' ? s.meeting_title : null,
    atMs: finiteMs(s.at_ms),
  }
}

export function fromTask(row: TaskRow): WorkItem {
  return {
    key: `task:${row.id}`,
    id: row.id,
    kind: 'task',
    title: (row.title || 'Untitled task').trim(),
    description: row.description?.trim() || null,
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    due: row.due_date || null,
    owner: row.assigned_to?.trim() || null,
    tags: toTags(row.tags),
    projectId: row.project_id || null,
    source: taskSource(row),
    agent: null,
    createdAt: row.created_at || null,
  }
}

export function fromActionItem(row: TaskActionRow): WorkItem {
  return {
    key: `action:${row.id}`,
    id: row.id,
    kind: 'action',
    title: itemTitle(row),
    description: row.context?.trim() || null,
    status: normalizeStatus(row.status),
    priority: normalizePriority(row.priority),
    due: row.due_date || null,
    owner: row.assigned_to_name?.trim() || null,
    ownerEmail: row.assigned_to_email?.trim() || null,
    nudgedAt: row.last_nudged_at || null,
    tags: [],
    projectId: null,
    source: row.meeting_id
      ? { meetingId: row.meeting_id, title: row.meetings?.title?.trim() || null, atMs: finiteMs(row.transcript_at_ms) }
      : null,
    agent: agentWhy(row),
    createdAt: row.created_at || null,
  }
}

/** Tasks (top level only: subtasks live inside their parent) plus action items, as one list. */
export function toWorkItems(tasks: ReadonlyArray<TaskRow>, actions: ReadonlyArray<TaskActionRow>): WorkItem[] {
  return [
    ...tasks.filter((t) => !t.parent_task_id).map(fromTask),
    ...actions.map(fromActionItem),
  ]
}

// ── Filter and sort ─────────────────────────────────────────────

export type ShowFilter = 'open' | 'meetings' | 'done' | 'all'
export type SortKey = 'due' | 'priority' | 'created' | 'title'

export interface WorkFilter {
  show: ShowFilter
  search?: string
  tag?: string | null
  status?: WorkStatus | null
}

export function filterItems(items: ReadonlyArray<WorkItem>, f: WorkFilter): WorkItem[] {
  const q = f.search?.trim().toLowerCase() ?? ''
  return items.filter((it) => {
    if (f.show === 'open' && it.status === 'done') return false
    if (f.show === 'done' && it.status !== 'done') return false
    if (f.show === 'meetings' && (!it.source || it.status === 'done')) return false
    if (f.tag && !it.tags.includes(f.tag)) return false
    if (f.status && it.status !== f.status) return false
    if (q) {
      const hay = [it.title, it.description, it.owner, it.source?.title, ...it.tags].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

const PRIORITY_RANK: Record<WorkPriority, number> = { high: 0, medium: 1, low: 2 }

function dueTime(it: WorkItem): number {
  return parseDay(it.due)?.getTime() ?? Number.POSITIVE_INFINITY
}

export function sortItems(items: ReadonlyArray<WorkItem>, key: SortKey): WorkItem[] {
  const out = [...items]
  out.sort((a, b) => {
    if (key === 'title') return a.title.localeCompare(b.title)
    if (key === 'created') return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    if (key === 'priority') {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      return p !== 0 ? p : dueTime(a) - dueTime(b)
    }
    const d = dueTime(a) - dueTime(b)
    if (d !== 0 && !(Number.isNaN(d))) return d
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  })
  return out
}

/** All tags in use, sorted. */
export function allTags(items: ReadonlyArray<WorkItem>): string[] {
  return [...new Set(items.flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b))
}

// ── Groups and lanes ────────────────────────────────────────────

export type UrgencyKey = DueBucket | 'done'

export interface UrgencyGroup {
  key: UrgencyKey
  label: string
  items: WorkItem[]
}

const URGENCY: Array<{ key: UrgencyKey; label: string }> = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'later', label: 'Later' },
  { key: 'none', label: 'No date' },
  { key: 'done', label: 'Done' },
]

export function urgencyOf(it: WorkItem, now = new Date()): UrgencyKey {
  return it.status === 'done' ? 'done' : dueBucket({ id: it.id, due_date: it.due }, now)
}

/** Overdue, Due today, Next 7 days, Later, No date, then Done. Order inside a group is kept. */
export function groupByUrgency(items: ReadonlyArray<WorkItem>, now = new Date()): UrgencyGroup[] {
  const map = new Map<UrgencyKey, WorkItem[]>()
  for (const it of items) {
    const k = urgencyOf(it, now)
    const list = map.get(k) ?? []
    list.push(it)
    map.set(k, list)
  }
  return URGENCY.filter((g) => (map.get(g.key)?.length ?? 0) > 0).map((g) => ({ ...g, items: map.get(g.key) ?? [] }))
}

export function lanes(items: ReadonlyArray<WorkItem>): Record<WorkStatus, WorkItem[]> {
  const out: Record<WorkStatus, WorkItem[]> = { open: [], in_progress: [], review: [], blocked: [], done: [] }
  for (const it of items) out[it.status].push(it)
  return out
}

export function isOverdue(it: WorkItem, now = new Date()): boolean {
  return it.status !== 'done' && urgencyOf(it, now) === 'overdue'
}

export interface WorkSummary {
  open: number
  overdue: number
  fromMeetings: number
  agentCalls: number
}

export function summarize(items: ReadonlyArray<WorkItem>, now = new Date()): WorkSummary {
  let open = 0
  let overdue = 0
  let fromMeetings = 0
  let agentCalls = 0
  for (const it of items) {
    if (it.status === 'done') continue
    open++
    if (isOverdue(it, now)) overdue++
    if (it.source) fromMeetings++
    if (it.agent) agentCalls++
  }
  return { open, overdue, fromMeetings, agentCalls }
}

// ── Labels ──────────────────────────────────────────────────────

/** "12:04" under an hour, "1:02:09" over. */
export function timecode(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`
}

/** Link to the moment on the meeting page (MeetingDetail honours ?t=<ms>). */
export function meetingHref(src: MeetingSource): string {
  return src.atMs != null ? `/meetings/${src.meetingId}?t=${src.atMs}` : `/meetings/${src.meetingId}`
}

/** The due date the way rows show it: "Today", "Tomorrow", "Fri 28 Nov". */
export function dueLabel(due: string | null, now = new Date()): string {
  const d = parseDay(due)
  if (!d) return '—'
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' })
  const mo = d.toLocaleDateString('en-US', { month: 'short' })
  return `${wd} ${d.getDate()} ${mo}`
}

export function priorityWord(p: WorkPriority): string {
  return p === 'high' ? 'High' : p === 'medium' ? 'Medium' : 'Low'
}

const AGENT_LABEL: Record<AgentWhy['kind'], string> = {
  priority: 'Priority agent',
  deadline: 'Deadline agent',
  assignment: 'Assignment agent',
}

export function agentLabel(a: AgentWhy): string {
  return AGENT_LABEL[a.kind]
}

// ── URL state ───────────────────────────────────────────────────

export type TasksLayout = 'list' | 'lanes'

export interface TasksUrlState {
  layout: TasksLayout | null
  show: ShowFilter
  sort: SortKey
  tag: string | null
  item: string | null
  lane: WorkStatus
}

const SHOWS: ReadonlyArray<ShowFilter> = ['open', 'meetings', 'done', 'all']
const SORTS: ReadonlyArray<SortKey> = ['due', 'priority', 'created', 'title']

export function readUrl(params: URLSearchParams): TasksUrlState {
  const layout = params.get('view')
  const show = params.get('show') as ShowFilter | null
  const sort = params.get('sort') as SortKey | null
  const lane = params.get('lane') as WorkStatus | null
  return {
    layout: layout === 'list' || layout === 'lanes' ? layout : null,
    show: show && SHOWS.includes(show) ? show : 'open',
    sort: sort && SORTS.includes(sort) ? sort : 'due',
    tag: params.get('tag') || null,
    item: params.get('item') || null,
    lane: lane && STATUSES.includes(lane) ? lane : 'open',
  }
}

/** Only non-default values go in the URL. */
export function writeUrl(s: TasksUrlState): Record<string, string> {
  const out: Record<string, string> = {}
  if (s.layout) out.view = s.layout
  if (s.show !== 'open') out.show = s.show
  if (s.sort !== 'due') out.sort = s.sort
  if (s.tag) out.tag = s.tag
  if (s.item) out.item = s.item
  if (s.lane !== 'open') out.lane = s.lane
  return out
}

const NUDGE_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Nudge key state for an action item: hidden for tasks and done items, "Nudged"
 * within 24 hours of the last reminder, otherwise ready when the owner has an email.
 */
export function nudgeState(item: WorkItem, now: Date = new Date()): 'hidden' | 'no_email' | 'recent' | 'ready' {
  if (item.kind !== 'action' || item.status === 'done') return 'hidden'
  if (item.nudgedAt && now.getTime() - Date.parse(item.nudgedAt) < NUDGE_WINDOW_MS) return 'recent'
  return item.ownerEmail ? 'ready' : 'no_email'
}
