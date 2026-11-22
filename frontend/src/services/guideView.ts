/**
 * User Guide view logic (route /guide). Pure: no React, no storage.
 * Direction A "Manual" from the User Guide Slate pass (2026-11-22): a reader
 * beside a contents column grouped like the app nav.
 */
import type { GuideCategory, GuideChange, GuideSection } from '../components/UsersGuide/guideData'

/** Module numbers, as in the rail (BENCH-SWISS.md section 9). Wayfinding only. */
export const MODULE_NUMBERS: Readonly<Record<string, string>> = {
  dashboard: '01',
  meetings: '02',
  tasks: '03',
  projects: '04',
  automations: '05',
  analytics: '06',
  settings: '00',
}

/** Where the "Open …" key on a section goes. */
export const SECTION_LINKS: Readonly<Record<string, string>> = {
  dashboard: '/dashboard',
  meetings: '/meetings',
  'meeting-details': '/meetings',
  calendar: '/dashboard',
  tasks: '/tasks',
  projects: '/projects',
  automations: '/automations',
  analytics: '/analytics',
  search: '/search',
  settings: '/settings',
}

export interface ContentsEntry {
  id: string
  group: string
  number: string | null
  section: GuideSection
}

export interface ContentsGroup {
  label: string
  entries: ContentsEntry[]
}

/** Contents in reading order, grouped. Unknown ids are skipped. */
export function buildContents(categories: ReadonlyArray<GuideCategory>, sections: ReadonlyArray<GuideSection>): ContentsGroup[] {
  const byId = new Map(sections.map((s) => [s.id, s]))
  return categories
    .map((c) => ({
      label: c.label,
      entries: c.ids.flatMap((id): ContentsEntry[] => {
        const section = byId.get(id)
        return section ? [{ id, group: c.label, number: MODULE_NUMBERS[id] ?? null, section }] : []
      }),
    }))
    .filter((g) => g.entries.length > 0)
}

export function flatten(groups: ReadonlyArray<ContentsGroup>): ContentsEntry[] {
  return groups.flatMap((g) => g.entries)
}

export function findEntry(groups: ReadonlyArray<ContentsGroup>, id: string | null): ContentsEntry | null {
  if (!id) return null
  return flatten(groups).find((e) => e.id === id) ?? null
}

export function prevNext(groups: ReadonlyArray<ContentsGroup>, id: string): { prev: ContentsEntry | null; next: ContentsEntry | null } {
  const all = flatten(groups)
  const i = all.findIndex((e) => e.id === id)
  if (i < 0) return { prev: null, next: null }
  return { prev: all[i - 1] ?? null, next: all[i + 1] ?? null }
}

/** "Work · 03" */
export function eyebrow(entry: ContentsEntry): string {
  return entry.number ? `${entry.group} · ${entry.number}` : entry.group
}

// ── What's new ──────────────────────────────────────────────

/** The date part of a version like "2026-11-22e". */
export function versionDate(version: string | null): string | null {
  const m = version ? /^(\d{4}-\d{2}-\d{2})/.exec(version) : null
  return m?.[1] ?? null
}

function daysBefore(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) - days * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/**
 * Section ids changed since the reader last opened the guide.
 * Same version → nothing. Older version → changes dated on or after that version's day.
 * Never opened (or unreadable) → changes from the 14 days up to `updated`.
 */
export function changedSince(
  changes: ReadonlyArray<GuideChange>,
  seenVersion: string | null,
  currentVersion: string,
  updated: string
): Set<string> {
  if (seenVersion === currentVersion) return new Set()
  const from = versionDate(seenVersion) ?? daysBefore(updated, 14)
  return new Set(changes.filter((c) => c.date >= from).map((c) => c.section))
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "2026-11-22" → "22 NOV" */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  const month = MONTHS[Number(m) - 1]
  return month && d ? `${Number(d)} ${month}` : date
}

// ── Search ──────────────────────────────────────────────────

export type SnippetKind = 'step' | 'topic' | 'tip' | 'question'

export interface Snippet {
  kind: SnippetKind
  text: string
  /** Subsection to scroll to, when the hit is inside one. */
  anchor: string | null
}

export interface GuideHit {
  entry: ContentsEntry
  snippets: Snippet[]
}

/** Every section that mentions the query, in contents order, with up to two matching lines. */
export function searchGuide(groups: ReadonlyArray<ContentsGroup>, query: string): GuideHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const has = (t: string | undefined): boolean => !!t && t.toLowerCase().includes(q)
  return flatten(groups).flatMap((entry): GuideHit[] => {
    const s = entry.section
    const snippets: Snippet[] = []
    const add = (kind: SnippetKind, text: string, anchor: string | null): void => {
      if (snippets.length < 2 && has(text)) snippets.push({ kind, text, anchor })
    }
    ;(s.steps ?? []).forEach((t) => add('step', t, null))
    for (const sub of s.subsections ?? []) {
      add('topic', sub.title, sub.id)
      sub.steps.forEach((t) => add('step', t, sub.id))
      if (sub.note) add('tip', sub.note, sub.id)
    }
    ;(s.tips ?? []).forEach((t) => add('tip', t, null))
    for (const uc of s.useCases ?? []) {
      add('question', uc.title, `q-${uc.id}`)
      uc.steps.forEach((t) => add('step', t, `q-${uc.id}`))
    }
    return snippets.length > 0 || has(s.title) || has(s.summary) ? [{ entry, snippets }] : []
  })
}

export interface TextPart { text: string; hit: boolean }

/** Split text around every case-insensitive match of the query. */
export function highlight(text: string, query: string): TextPart[] {
  const q = query.trim().toLowerCase()
  if (!q) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const parts: TextPart[] = []
  let at = 0
  for (let i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, i + q.length)) {
    if (i > at) parts.push({ text: text.slice(at, i), hit: false })
    parts.push({ text: text.slice(i, i + q.length), hit: true })
    at = i + q.length
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false })
  return parts
}

// ── URL state ───────────────────────────────────────────────

export interface GuideUrlState {
  /** Section id, or null for the first section. */
  section: string | null
  /** Search query (the search view shows while it is non-empty). */
  query: string
  /** What's new list instead of a section. */
  news: boolean
  /** Word to keep highlighted in the section after picking a search result. */
  mark: string
}

export function readUrlState(params: URLSearchParams): GuideUrlState {
  return {
    section: params.get('s'),
    query: params.get('q') ?? '',
    news: params.get('new') === '1',
    mark: params.get('hl') ?? '',
  }
}

export function writeUrlState(params: URLSearchParams, next: Partial<GuideUrlState>): URLSearchParams {
  const out = new URLSearchParams(params)
  const put = (key: string, value: string | null | undefined): void => {
    if (value) out.set(key, value)
    else out.delete(key)
  }
  if ('section' in next) put('s', next.section)
  if ('query' in next) put('q', next.query)
  if ('news' in next) put('new', next.news ? '1' : null)
  if ('mark' in next) put('hl', next.mark)
  return out
}

/** "Settings & help" → "settings-help". Drives the chapter colour on the guide. */
export function chapterKey(group: string): string {
  return group.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
