/**
 * View logic for the Meetings module (Bench Swiss pass): a meeting's status as an
 * LED + word, its length, its tape markers, and the time groups of the index list.
 * Pure functions over the row the API returns, so the pages stay presentational.
 */

import type { SignalTone } from '../components/bench'
import { canRetry, toRecordingJob } from './meetingRecorderService'
import { toSegments, toSummaryMoments, type TranscriptSegment } from './meetingTranscriptService'

/** The fields of a `meetings` row these helpers read. Everything else passes through. */
export interface MeetingRow {
  id: string
  title?: string | null
  summary?: string | null
  created_at: string
  start_time?: string | null
  duration_minutes?: number | null
  attendees?: unknown
  decisions?: unknown
  key_points?: unknown
  summary_moments?: unknown
  transcript_segments?: unknown
  recording_job?: unknown
  chat_posted?: boolean | null
  /** From GET /api/meetings: open action items and how many are on the caller. */
  action_counts?: unknown
}

export interface ActionCounts {
  total: number
  open: number
  mine: number
}

export type MeetingStatusKey = 'recording' | 'writing' | 'attention' | 'posted' | 'ready' | 'empty'

export interface MeetingStatus {
  key: MeetingStatusKey
  tone: SignalTone
  word: string
}

/** One LED + word per meeting (signal law: live = now, brand = needs you, mint = done). */
export function meetingStatus(m: MeetingRow, now = Date.now()): MeetingStatus {
  const job = toRecordingJob(m.recording_job)
  if (job?.status === 'recording') return { key: 'recording', tone: 'live', word: 'Recording' }
  if (job?.status === 'transcribing' && !canRetry(job, now)) return { key: 'writing', tone: 'brand', word: 'Writing' }
  if (job && (job.status === 'failed' || job.status === 'transcribing')) return { key: 'attention', tone: 'brand', word: 'Retry' }
  if (job?.status === 'done' && job.summaryError && !m.summary) return { key: 'attention', tone: 'brand', word: 'No summary' }
  if (m.chat_posted) return { key: 'posted', tone: 'mint', word: 'Posted' }
  if (m.summary) return { key: 'ready', tone: 'mint', word: 'Ready' }
  return { key: 'empty', tone: 'off', word: 'No summary' }
}

export type MeetingFilter = 'all' | 'live' | 'ready' | 'attention'

export function matchesFilter(m: MeetingRow, filter: MeetingFilter, now = Date.now()): boolean {
  if (filter === 'all') return true
  const { key } = meetingStatus(m, now)
  if (filter === 'live') return key === 'recording' || key === 'writing'
  if (filter === 'ready') return key === 'ready' || key === 'posted'
  return key === 'attention' || key === 'empty'
}

export function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []
}

/** When the meeting happened: its start time if known, else when it was saved. */
export function meetingDate(m: MeetingRow): Date {
  const d = new Date(m.start_time || m.created_at)
  return Number.isNaN(d.getTime()) ? new Date(m.created_at) : d
}

/**
 * Length in ms: the longer of the transcript's last line and the recorded duration_minutes.
 * The transcript alone under-reports when a bot joins late or transcription stops early,
 * so it never wins over a longer recorded length.
 */
export function meetingLengthMs(m: MeetingRow, segments: TranscriptSegment[] | null = toSegments(m.transcript_segments)): number {
  let end = 0
  if (segments && segments.length) {
    const last = segments[segments.length - 1]!
    end = Math.max(last.endMs ?? last.atMs, last.atMs)
  }
  const recorded = typeof m.duration_minutes === 'number' && m.duration_minutes > 0 ? m.duration_minutes * 60_000 : 0
  return Math.max(end, recorded)
}

/** 46m, 1h 05m: a length a person reads in a list. */
export function formatLength(ms: number): string {
  if (ms <= 0) return '—'
  const mins = Math.max(1, Math.round(ms / 60_000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export interface DecisionMarker {
  atMs: number
  label: string
}

/** Decisions that have a transcript timecode, for the tape. */
export function decisionMarkers(m: MeetingRow): DecisionMarker[] {
  const decisions = asList(m.decisions)
  const moments = toSummaryMoments(m.summary_moments).decisions
  const out: DecisionMarker[] = []
  decisions.forEach((label, i) => {
    const at = moments[i]
    if (typeof at === 'number') out.push({ atMs: at, label })
  })
  return out
}

export interface MeetingGroup<T extends MeetingRow> {
  key: string
  label: string
  rows: T[]
}

function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (s.getDay() + 6) % 7 // Monday = 0
  s.setDate(s.getDate() - day)
  return s
}

/** This week, Last week, then one group per month ("October 2026"). Keeps the input order. */
export function groupByTime<T extends MeetingRow>(rows: ReadonlyArray<T>, now = new Date()): Array<MeetingGroup<T>> {
  const start = startOfWeek(now)
  const thisWeek = start.getTime()
  start.setDate(start.getDate() - 7)
  const lastWeek = start.getTime()
  const groups: Array<MeetingGroup<T>> = []
  const byKey = new Map<string, MeetingGroup<T>>()
  for (const row of rows) {
    const d = meetingDate(row)
    const t = d.getTime()
    let key: string
    let label: string
    if (t >= thisWeek) {
      key = 'this-week'
      label = 'This week'
    } else if (t >= lastWeek) {
      key = 'last-week'
      label = 'Last week'
    } else {
      key = `${d.getFullYear()}-${d.getMonth()}`
      label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    let g = byKey.get(key)
    if (!g) {
      g = { key, label, rows: [] }
      byKey.set(key, g)
      groups.push(g)
    }
    g.rows.push(row)
  }
  return groups
}

/** People in a meeting as a short line: "Priya S., Jon B. +2". */
export function attendeeLine(m: MeetingRow, max = 3): string {
  const people = asList(m.attendees)
  if (people.length === 0) return ''
  const shown = people.slice(0, max).join(', ')
  return people.length > max ? `${shown} +${people.length - max}` : shown
}

/**
 * Speech density for the tape meter: words spoken in each slice of the meeting,
 * scaled so the busiest slice is 1. A line without an end counts at its start.
 */
export function speechDensity(segments: ReadonlyArray<TranscriptSegment> | null, lengthMs: number, slices = 96): number[] {
  if (!segments || !segments.length || lengthMs <= 0) return []
  const out = new Array<number>(slices).fill(0)
  const slice = lengthMs / slices
  for (const s of segments) {
    const words = s.text.trim().split(/\s+/).length
    const start = Math.max(0, s.atMs)
    const end = Math.max(start + 1, s.endMs ?? start + 1)
    const first = Math.min(slices - 1, Math.floor(start / slice))
    const last = Math.min(slices - 1, Math.floor((end - 1) / slice))
    const per = words / (last - first + 1)
    for (let i = first; i <= last; i++) out[i]! += per
  }
  const max = Math.max(...out)
  return max > 0 ? out.map((v) => v / max) : out
}

/** The list's follow-through figures for a row; zeros when the API sent none. */
export function actionCounts(m: MeetingRow): ActionCounts {
  const raw = m.action_counts
  if (!raw || typeof raw !== 'object') return { total: 0, open: 0, mine: 0 }
  const r = raw as Record<string, unknown>
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)
  return { total: n(r.total), open: n(r.open), mine: n(r.mine) }
}

/** The first decision and how many more there are: the line under a list row's title. */
export function firstDecision(m: MeetingRow): { text: string; more: number } | null {
  const list = asList(m.decisions)
  return list.length ? { text: list[0]!, more: list.length - 1 } : null
}

/** "1 action", "3 actions". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}


const DATE_PART = '[A-Z][a-z]{2} \\d{1,2}(?:, \\d{4})?'
const AUTO_TITLE = new RegExp(`^(?:(?:Google Meet|Zoom|Microsoft Teams|Bot) meeting(?:, ${DATE_PART})?|Recording, ${DATE_PART}|Untitled meeting)$`)

/** A name the app made up (the bot's "Zoom meeting, Nov 20", a recording's "Recording, Nov 22, 2026"), worth a rename. */
export function isAutoTitle(title: string | null | undefined): boolean {
  const t = (title || '').trim()
  return t === '' || AUTO_TITLE.test(t)
}
