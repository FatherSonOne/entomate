/**
 * Search engine: the one data layer behind the ⌘K palette and the Search page.
 *
 * Results come from POST /api/search/everything (backend/services/searchEverything.js).
 * Page commands ("Go to Tasks", "New meeting") are matched here, client-side, so the
 * palette and the page find the same things. The pure helpers are tested in
 * __tests__/searchEngine.test.ts.
 */

import api from './api'

export type ResultType = 'meeting' | 'decision' | 'action_item' | 'task' | 'project' | 'note' | 'meeting_note'
export type GroupKey = 'meetings' | 'decisions' | 'action_items' | 'tasks' | 'projects' | 'notes'
export type Range = [number, number]

export interface ContextLine {
  atMs: number | null
  speaker: string | null
  text: string
  hit: boolean
}

export interface ResultMeta {
  spellingMatch?: boolean
  date?: string | null
  atMs?: number | null
  speaker?: string | null
  context?: ContextLine[]
  decisions?: string[]
  byMeaning?: boolean
  meetingId?: string | null
  meetingTitle?: string | null
  status?: string | null
  priority?: string | null
  owner?: string | null
  dueDate?: string | null
  agent?: { field: string; confidence: number } | null
  projectId?: string | null
  projectName?: string | null
  kind?: string | null
  sourceType?: string | null
  sourceId?: string | null
  visibility?: string | null
}

export interface SearchResult {
  type: ResultType
  id: string
  title: string
  titleHits: Range[]
  snippet: string
  snippetHits: Range[]
  meta: ResultMeta
}

export type Engine = 'words' | 'words+meaning'

export interface SearchResponse {
  query: string
  terms: string[]
  groups: Partial<Record<GroupKey, SearchResult[]>>
  counts: Partial<Record<GroupKey, number>>
  total: number
  engine: Engine
}

export const GROUPS: ReadonlyArray<{ key: GroupKey; label: string; short: string }> = [
  { key: 'meetings', label: 'Meetings', short: 'Meetings' },
  { key: 'decisions', label: 'Decisions', short: 'Decisions' },
  { key: 'action_items', label: 'Action items', short: 'Actions' },
  { key: 'tasks', label: 'Tasks', short: 'Tasks' },
  { key: 'projects', label: 'Projects', short: 'Projects' },
  { key: 'notes', label: 'Your notes', short: 'Notes' },
]

export type Filter = 'all' | GroupKey
export const FILTERS: ReadonlyArray<Filter> = ['all', ...GROUPS.map((g) => g.key)]

export function isFilter(v: string | null): v is Filter {
  return v !== null && (FILTERS as ReadonlyArray<string>).includes(v)
}

const http = api as unknown as { post: (url: string, body: unknown) => Promise<unknown> }

/** Run the shared search. `log` records the query in history (page / Enter only). */
export async function searchEverything(
  query: string,
  opts: { limit?: number; log?: boolean; types?: GroupKey[] } = {},
): Promise<SearchResponse> {
  const raw = await http.post('/search/everything', { query, limit: opts.limit ?? 8, log: opts.log === true, types: opts.types })
  return normalizeResponse(raw, query)
}

export function normalizeResponse(raw: unknown, query: string): SearchResponse {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const groups = (r.groups && typeof r.groups === 'object' ? r.groups : {}) as SearchResponse['groups']
  const counts = (r.counts && typeof r.counts === 'object' ? r.counts : {}) as SearchResponse['counts']
  return {
    query: typeof r.query === 'string' ? r.query : query,
    terms: Array.isArray(r.terms) ? (r.terms as string[]) : [],
    groups,
    counts,
    total: typeof r.total === 'number' ? r.total : 0,
    engine: r.engine === 'words+meaning' ? 'words+meaning' : 'words',
  }
}

/** Split text into plain and highlighted parts from hit ranges. */
export function highlightParts(text: string, hits: ReadonlyArray<Range>): Array<{ text: string; hit: boolean }> {
  const parts: Array<{ text: string; hit: boolean }> = []
  let at = 0
  for (const [s, e] of [...hits].sort((a, b) => a[0] - b[0])) {
    if (s < at || e <= s || e > text.length) continue
    if (s > at) parts.push({ text: text.slice(at, s), hit: false })
    parts.push({ text: text.slice(s, e), hit: true })
    at = e
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false })
  return parts
}

/** 895000 → "14:55"; 3725000 → "1:02:05". */
export function timecode(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Where a result opens. Meetings and decisions jump to the moment when known. */
export function resultHref(r: SearchResult): string {
  const at = (ms: number | null | undefined) => (ms != null && ms >= 0 ? `?t=${Math.round(ms)}` : '')
  switch (r.type) {
    case 'meeting': return `/meetings/${r.id}${at(r.meta.atMs)}`
    case 'decision': return r.meta.meetingId ? `/meetings/${r.meta.meetingId}${at(r.meta.atMs)}` : '/meetings'
    case 'action_item': return `/tasks?item=action:${r.id}`
    case 'task': return `/tasks?item=task:${r.id}`
    case 'project': return `/projects/${r.id}`
    case 'meeting_note': return r.meta.meetingId ? `/meetings/${r.meta.meetingId}` : '/meetings'
    case 'note': return `/search?note=${r.id}`
  }
}

/** A due date ("2026-11-17") is a local day; new Date() alone reads it as UTC midnight. */
function toDate(v: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v)
}

/** Short day for meta lines: "Wed 12 Nov" (adds the year when not this year). */
export function shortDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return ''
  const d = toDate(iso)
  if (Number.isNaN(d.getTime())) return ''
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString('en-GB', opts).replace(',', '')
}

/** Status word + LED tone for action items, tasks and projects. */
export function statusSignal(r: SearchResult, now: Date = new Date()): { tone: 'brand' | 'live' | 'mint' | 'off'; word: string } | null {
  const s = (r.meta.status || '').toLowerCase()
  if (r.type === 'project') return s ? { tone: s === 'active' ? 'live' : 'off', word: titleCase(s) } : null
  if (r.type !== 'action_item' && r.type !== 'task') return null
  if (s === 'done' || s === 'completed') return { tone: 'mint', word: 'Done' }
  const due = r.meta.dueDate ? toDate(r.meta.dueDate) : null
  if (due && !Number.isNaN(due.getTime()) && endOfDay(due) < now.getTime()) return { tone: 'brand', word: 'Late' }
  if (s === 'in_progress') return { tone: 'live', word: 'In progress' }
  if (s === 'blocked') return { tone: 'brand', word: 'Blocked' }
  return { tone: 'off', word: 'Open' }
}

function endOfDay(d: Date): number {
  const e = new Date(d)
  e.setHours(23, 59, 59, 999)
  return e.getTime()
}

function titleCase(s: string): string {
  const t = s.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** One meta line for a result row ("Wed 12 Nov · Ana R.", "Frankie · due Tue 25 Nov"). */
export function metaLine(r: SearchResult, now: Date = new Date()): string {
  const m = r.meta
  const parts: string[] = []
  switch (r.type) {
    case 'meeting':
      parts.push(shortDate(m.date, now))
      if (m.speaker) parts.push(m.speaker)
      if (m.byMeaning) parts.push('found by meaning')
      break
    case 'decision':
      if (m.meetingTitle) parts.push(m.meetingTitle)
      parts.push(shortDate(m.date, now))
      break
    case 'action_item':
      parts.push(m.owner || 'No owner')
      if (m.dueDate) parts.push(`due ${shortDate(m.dueDate, now)}`)
      if (m.meetingTitle) parts.push(m.meetingTitle)
      break
    case 'task':
      if (m.projectName) parts.push(m.projectName)
      if (m.dueDate) parts.push(`due ${shortDate(m.dueDate, now)}`)
      break
    case 'project':
      parts.push(shortDate(m.date, now))
      break
    case 'note':
      parts.push(`Clipped ${shortDate(m.date, now)}`)
      break
    case 'meeting_note':
      parts.push(m.visibility === 'team' ? 'Team note' : 'Your note')
      parts.push(shortDate(m.date, now))
      break
  }
  if (m.spellingMatch) parts.push('closest spelling')
  return parts.filter(Boolean).join(' · ')
}

/** A query that reads as a question goes to Ask Entomate as well. */
export function isQuestion(q: string): boolean {
  const t = q.trim().toLowerCase()
  if (!t) return false
  if (t.endsWith('?')) return true
  return /^(what|who|when|where|why|how|did|does|do|is|are|was|were|which|can|should)\b/.test(t) && t.split(/\s+/).length >= 3
}

/** Results in display order, for keyboard navigation in the palette. */
export function flatten(resp: SearchResponse | null, filter: Filter = 'all'): SearchResult[] {
  if (!resp) return []
  return GROUPS.filter((g) => filter === 'all' || g.key === filter).flatMap((g) => resp.groups[g.key] || [])
}

export function groupCount(resp: SearchResponse | null, key: GroupKey): number {
  if (!resp) return 0
  return resp.counts[key] ?? (resp.groups[key] || []).length
}

// ── Commands (pages and actions). Shared so the page finds them too. ──

export interface Command {
  id: string
  label: string
  hint: string
  path: string
  /** Extra words that should match ("dashboard" finds Today). */
  keywords?: string
  shortcut?: string
  state?: Record<string, string>
  adminOnly?: boolean
}

export const COMMANDS: ReadonlyArray<Command> = [
  { id: 'go-today', label: 'Go to Today', hint: 'Page', path: '/dashboard', keywords: 'dashboard home', shortcut: 'mod+1' },
  { id: 'go-meetings', label: 'Go to Meetings', hint: 'Page', path: '/meetings', keywords: 'recordings calls', shortcut: 'mod+2' },
  { id: 'go-tasks', label: 'Go to Tasks', hint: 'Page', path: '/tasks', keywords: 'action items todo', shortcut: 'mod+3' },
  { id: 'go-projects', label: 'Go to Projects', hint: 'Page', path: '/projects', keywords: 'board', shortcut: 'mod+4' },
  { id: 'go-automations', label: 'Go to Automations', hint: 'Page', path: '/automations', keywords: 'workflows recipes', shortcut: 'mod+5' },
  { id: 'go-insights', label: 'Go to Insights', hint: 'Page', path: '/analytics', keywords: 'analytics reports follow-through', shortcut: 'mod+6' },
  { id: 'go-search', label: 'Go to Search', hint: 'Page', path: '/search', keywords: 'find everything', shortcut: 'mod+7' },
  { id: 'go-guide', label: 'User Guide', hint: 'Help', path: '/guide', keywords: 'users guide manual help', shortcut: 'mod+8' },
  { id: 'go-bot', label: 'Go to Bot', hint: 'Page', path: '/bot', keywords: 'launcher recording join', shortcut: 'mod+9', adminOnly: true },
  { id: 'go-notes', label: 'Your notes', hint: 'Page', path: '/search?notes=1', keywords: 'clips notebook saved', shortcut: 'mod+0' },
  { id: 'go-docs', label: 'Documentation', hint: 'Help', path: '/guide', keywords: 'reference instructions help docs' },
  { id: 'go-settings', label: 'Go to Settings', hint: 'Page', path: '/settings', keywords: 'preferences account', shortcut: 'mod+,' },
  { id: 'go-agents', label: 'Meeting agents', hint: 'Settings', path: '/settings', keywords: 'agents ai', state: { section: 'meeting-agents' } },
  { id: 'new-meeting', label: 'New meeting', hint: 'Action', path: '/meetings?new=true', keywords: 'record start', shortcut: 'mod+m' },
  { id: 'new-task', label: 'New task', hint: 'Action', path: '/tasks?new=true', keywords: 'add todo' },
  { id: 'new-project', label: 'New project', hint: 'Action', path: '/projects?dr=new', keywords: 'add' },
  { id: 'new-automation', label: 'Browse automation recipes', hint: 'Action', path: '/automations?new=1', keywords: 'new create workflow template' },
  { id: 'new-note', label: 'Write a note', hint: 'Action', path: '/search?notes=1', keywords: 'new add create notes' },
  { id: 'ai-history', label: 'AI conversations', hint: 'Page', path: '/assistant/history', keywords: 'assistant history chat' },
  { id: 'export', label: 'Export a report', hint: 'Action', path: '/analytics?export=', keywords: 'pdf csv download' },
]

/** Bounded edit distance, including adjacent transpositions ("proejcts"). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0]![j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1)
  }
  return d[a.length]![b.length]!
}

/** Shared ranking: exact labels, prefixes, keywords, then close spelling. */
export function matchCommands(query: string, limit = 4, isAdmin = false): Command[] {
  const q = query.replace(/^>/, '').trim().toLowerCase().slice(0, 120)
  const words = q.split(/\s+/).filter(Boolean)
  const visible = COMMANDS.filter((c) => !c.adminOnly || isAdmin)
  if (!words.length) return visible.slice(0, limit)
  return visible.map((command) => {
    const label = command.label.toLowerCase().replace(/^go to /, '')
    const tokens = `${label} ${command.keywords || ''} ${command.hint}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    let score = label === q ? 100 : label.startsWith(q) ? 60 : 0
    for (const word of words) {
      const best = Math.max(...tokens.map((token) => {
        if (token === word) return 30
        if (token.startsWith(word)) return 20
        if (token.includes(word)) return 12
        if (word.length < 3 || Math.abs(word.length - token.length) > 2) return 0
        const edits = distance(word, token)
        return edits <= (word.length >= 6 ? 2 : 1) ? 8 - edits : 0
      }))
      if (!best) return { command, score: -1 }
      score += best
    }
    return { command, score }
  }).filter((r) => r.score >= 0).sort((a, b) => b.score - a.score).slice(0, limit).map((r) => r.command)
}

// ── Recent searches (from GET /api/search/history) ──

export interface RecentSearch { query: string; results: number | null; at: string | null }

/** Newest first, one row per query (case-insensitive). */
export function recentFromHistory(history: unknown, limit = 6): RecentSearch[] {
  if (!Array.isArray(history)) return []
  const seen = new Set<string>()
  const out: RecentSearch[] = []
  for (const h of history as Array<Record<string, unknown>>) {
    const q = typeof h.query === 'string' ? h.query.trim() : ''
    if (!q || seen.has(q.toLowerCase())) continue
    seen.add(q.toLowerCase())
    out.push({ query: q, results: typeof h.result_count === 'number' ? h.result_count : null, at: typeof h.created_at === 'string' ? h.created_at : null })
    if (out.length >= limit) break
  }
  return out
}

// ── URL state for the Search page ──

export interface SearchUrlState { q: string; filter: Filter; ask: boolean; notes: boolean }

export function readUrlState(params: URLSearchParams): SearchUrlState {
  const f = params.get('f')
  return {
    q: params.get('q') || '',
    filter: isFilter(f) ? f : 'all',
    ask: params.get('ask') === '1',
    notes: params.get('notes') === '1',
  }
}

export function writeUrlState(prev: URLSearchParams, next: Partial<SearchUrlState>): URLSearchParams {
  const p = new URLSearchParams(prev)
  const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k))
  if (next.q !== undefined) set('q', next.q.trim())
  if (next.filter !== undefined) set('f', next.filter === 'all' ? null : next.filter)
  if (next.ask !== undefined) set('ask', next.ask ? '1' : null)
  if (next.notes !== undefined) set('notes', next.notes ? '1' : null)
  return p
}

/** Path that opens a query on the full Search page (palette ⌘↵). */
export function searchPagePath(q: string, ask = false): string {
  const p = new URLSearchParams()
  if (q.trim()) p.set('q', q.trim())
  if (ask) p.set('ask', '1')
  const s = p.toString()
  return s ? `/search?${s}` : '/search'
}
