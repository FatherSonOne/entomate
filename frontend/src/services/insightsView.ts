/**
 * Insights view logic (pure, tested in __tests__/insightsView.test.ts).
 * Data comes from GET /api/analytics/insights?days=7|30|90
 * (backend/services/insights.js).
 */

export type Period = '7' | '30' | '90'
export const PERIODS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
]

export interface OwnerItem {
  id: string
  text: string
  dueDate: string | null
  overdue: boolean
  priority: string | null
  meeting: { id: string; title: string; date: string | null } | null
}

export interface OwnerRow {
  /** null means nobody owns these items. */
  name: string | null
  open: number
  overdue: number
  done: number
  onTimeRate: number | null
  items: OwnerItem[]
}

export interface WeekRow {
  start: string
  end: string
  current: boolean
  meetings: number
  decisions: number
  items: number
  done: number
  due: number
  onTimeRate: number | null
}

export interface AgentRow {
  key: 'assignment' | 'deadline' | 'priority'
  label: string
  agent: string
  calls: number
  kept: number
  rate: number | null
}

export interface InsightsData {
  period: { days: number; from: string; to: string }
  followThrough: { due: number; onTime: number; rate: number | null }
  overdue: number
  meetings: number
  decisions: number
  actionItems: { created: number; done: number }
  agents: { calls: number; kept: number; rate: number | null; byAgent: AgentRow[] }
  owners: OwnerRow[]
  weeks: WeekRow[]
}

/** Follow-through under this reads as behind (crimson). */
export const BEHIND_BELOW = 70

export function isBehind(rate: number | null): boolean {
  return rate != null && rate < BEHIND_BELOW
}

export function rateLabel(rate: number | null): string {
  return rate == null ? '—' : `${rate}%`
}

export function ownerLabel(name: string | null): string {
  return name ?? 'No owner'
}

/** Stable key for an owner row (used in the URL). */
export function ownerKey(name: string | null): string {
  return name ?? '__none__'
}

export function findOwner(owners: ReadonlyArray<OwnerRow>, key: string | null): OwnerRow | null {
  if (key == null) return null
  return owners.find((o) => ownerKey(o.name) === key) ?? null
}

function parseDay(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "17–23 Nov", or "27 Oct–2 Nov" across a month. */
export function weekLabel(start: string, end: string): string {
  const a = parseDay(start)
  const b = parseDay(end)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return ''
  const am = MONTHS[a.getMonth()] ?? ''
  const bm = MONTHS[b.getMonth()] ?? ''
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${bm}`
    : `${a.getDate()} ${am}–${b.getDate()} ${bm}`
}

/** "24 Nov" */
export function shortDay(value: string | null): string {
  if (!value) return ''
  const d = parseDay(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`
}

export interface MeterBar {
  key: string
  /** Day of the month the week starts on ("16"). */
  label: string
  /** 0-100 bar height; weeks with nothing due draw a stub. */
  height: number
  tone: 'live' | 'brand' | 'off'
  title: string
}

/** Oldest to newest, for the display meter. */
export function meterBars(weeks: ReadonlyArray<WeekRow>): MeterBar[] {
  return [...weeks].reverse().map((w) => {
    const d = parseDay(w.start)
    const label = Number.isNaN(d.getTime()) ? '' : String(d.getDate()).padStart(2, '0')
    const range = weekLabel(w.start, w.end)
    if (w.onTimeRate == null) {
      return { key: w.start, label, height: 6, tone: 'off', title: `${range}: nothing due` }
    }
    return {
      key: w.start,
      label,
      height: Math.max(6, w.onTimeRate),
      tone: isBehind(w.onTimeRate) ? 'brand' : 'live',
      title: `${range}: ${w.onTimeRate}% done on time (${w.due} due)`,
    }
  })
}

export function periodLabel(days: number): string {
  return `Last ${days} days`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Title meta: "Last 30 days · 14 meetings · 5 overdue". */
export function titleMeta(data: InsightsData | null, period: Period): string {
  const parts = [periodLabel(Number(period))]
  if (data) {
    parts.push(plural(data.meetings, 'meeting'))
    parts.push(`${data.overdue} overdue`)
  }
  return parts.join(' · ')
}

/* ── Exports ─────────────────────────────────────────────── */

export type ExportKind = 'meeting-pdf' | 'weekly-pdf' | 'project-pdf' | 'meetings-csv' | 'action-items-csv' | 'tasks-csv'

export interface ExportDef {
  kind: ExportKind
  title: string
  format: 'PDF' | 'CSV'
  desc: string
  needs?: 'meeting' | 'project'
}

export const EXPORTS: ReadonlyArray<ExportDef> = [
  { kind: 'meeting-pdf', title: 'Meeting recap', format: 'PDF', desc: 'Summary, decisions and action items of one meeting', needs: 'meeting' },
  { kind: 'weekly-pdf', title: 'Weekly summary', format: 'PDF', desc: 'Your last 7 days: meetings and action items' },
  { kind: 'project-pdf', title: 'Project report', format: 'PDF', desc: 'Status, action items and owners for one project', needs: 'project' },
  { kind: 'meetings-csv', title: 'Meetings', format: 'CSV', desc: 'Every meeting you can see' },
  { kind: 'action-items-csv', title: 'Action items', format: 'CSV', desc: 'All action items, or one status' },
  { kind: 'tasks-csv', title: 'Tasks', format: 'CSV', desc: 'Tasks with status, owner and due date' },
]

export function findExport(kind: string | null): ExportDef | null {
  return EXPORTS.find((e) => e.kind === kind) ?? null
}

/* ── URL state ───────────────────────────────────────────── */

export interface InsightsUrlState {
  period: Period
  /** Owner key of the open owner drawer. */
  owner: string | null
  /** Export drawer: open with this report selected ('' = open, nothing picked). */
  exportKind: ExportKind | '' | null
}

export function readUrlState(params: URLSearchParams): InsightsUrlState {
  const per = params.get('per')
  const ex = params.get('export')
  return {
    period: per === '7' || per === '90' ? per : '30',
    owner: params.get('owner'),
    exportKind: ex == null ? null : (findExport(ex)?.kind ?? ''),
  }
}

export function writeUrlState(params: URLSearchParams, next: Partial<InsightsUrlState>): URLSearchParams {
  const out = new URLSearchParams(params)
  if ('period' in next) {
    if (next.period && next.period !== '30') out.set('per', next.period)
    else out.delete('per')
  }
  if ('owner' in next) {
    if (next.owner) out.set('owner', next.owner)
    else out.delete('owner')
  }
  if ('exportKind' in next) {
    if (next.exportKind == null) out.delete('export')
    else out.set('export', next.exportKind)
  }
  return out
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const rateOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/**
 * Fill every field the page reads, so a partial or older response renders with
 * zeros and dashes instead of crashing the page (surface audit 2026-11-22).
 */
export function normalizeInsights(raw: unknown): InsightsData | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const ft = (r.followThrough ?? {}) as Record<string, unknown>
  const ai = (r.actionItems ?? {}) as Record<string, unknown>
  const ag = (r.agents ?? {}) as Record<string, unknown>
  const p = (r.period ?? {}) as Record<string, unknown>
  return {
    period: { days: num(p.days), from: String(p.from ?? ''), to: String(p.to ?? '') },
    followThrough: { due: num(ft.due), onTime: num(ft.onTime), rate: rateOrNull(ft.rate) },
    overdue: num(r.overdue),
    meetings: num(r.meetings),
    decisions: num(r.decisions),
    actionItems: { created: num(ai.created), done: num(ai.done) },
    agents: { calls: num(ag.calls), kept: num(ag.kept), rate: rateOrNull(ag.rate), byAgent: arr<AgentRow>(ag.byAgent) },
    owners: arr<OwnerRow>(r.owners).filter(Boolean).map((o) => ({ ...o, items: arr<OwnerItem>((o as { items?: unknown }).items) })),
    weeks: arr<WeekRow>(r.weeks),
  }
}
