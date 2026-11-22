/**
 * Settings view logic (pure). Direction A "Ledger" from the Settings Slate pass (2026-11-22):
 * one page, six numbered sections (Appearance got its own on 2026-11-22), every control inline, drawers for the long detail.
 * URL state: ?s=<section> scrolls to a section, ?dr=<drawer> opens a drawer, ?q= filters.
 */

export type SectionId = 'you' | 'appearance' | 'recording' | 'agents' | 'connections' | 'workspace'
export type DrawerId = 'profile' | 'invite' | 'billing' | 'learning' | 'ecosystem' | 'slack'

export interface SectionDef {
  id: SectionId
  number: string
  title: string
  summary: string
}

export const SECTIONS: ReadonlyArray<SectionDef> = [
  { id: 'you', number: '01', title: 'You', summary: 'Profile, notifications' },
  { id: 'appearance', number: '02', title: 'Appearance', summary: 'Theme, style, palette, logo and loading screen' },
  { id: 'recording', number: '03', title: 'Recording', summary: 'Microphone, calendar, bot auto-join' },
  { id: 'agents', number: '04', title: 'Meeting agents', summary: 'Which agents act, how sure they must be' },
  { id: 'connections', number: '05', title: 'Connections', summary: 'Logos Vision, Pulse, calendar, bot, AI' },
  { id: 'workspace', number: '06', title: 'Workspace', summary: 'Team, plan, data and privacy' },
]

const SECTION_IDS: ReadonlyArray<string> = SECTIONS.map((s) => s.id)
const DRAWER_IDS: ReadonlyArray<string> = ['profile', 'invite', 'billing', 'learning', 'ecosystem', 'slack']

export function isSectionId(v: string | null | undefined): v is SectionId {
  return typeof v === 'string' && SECTION_IDS.includes(v)
}
export function isDrawerId(v: string | null | undefined): v is DrawerId {
  return typeof v === 'string' && DRAWER_IDS.includes(v)
}

/**
 * The old Settings had 13 tabs. Links into it (location.state.section, ?section=, the
 * profile menu, Today, the guide) still name those tabs. Map each to where it lives now.
 */
export const LEGACY_SECTIONS: Readonly<Record<string, { section: SectionId; drawer?: DrawerId }>> = {
  organization: { section: 'workspace' },
  profile: { section: 'you' },
  appearance: { section: 'appearance' },
  notifications: { section: 'you' },
  audio: { section: 'recording' },
  permissions: { section: 'recording' },
  'auto-join': { section: 'recording' },
  calendar: { section: 'recording' },
  'meeting-agents': { section: 'agents' },
  'ai-learning': { section: 'agents' },
  'ai-learning-full': { section: 'agents', drawer: 'learning' },
  integrations: { section: 'connections' },
  system: { section: 'connections' },
  about: { section: 'connections' },
  'data-retention': { section: 'workspace' },
  billing: { section: 'workspace', drawer: 'billing' },
  team: { section: 'workspace' },
}

export function resolveSection(name: string | null | undefined): { section: SectionId; drawer?: DrawerId } | null {
  if (!name) return null
  if (isSectionId(name)) return { section: name }
  return LEGACY_SECTIONS[name] ?? null
}

export interface UrlState {
  section: SectionId | null
  drawer: DrawerId | null
  query: string
}

export function readUrlState(params: URLSearchParams): UrlState {
  const fromS = resolveSection(params.get('s') ?? params.get('section'))
  const dr = params.get('dr')
  return {
    section: fromS?.section ?? null,
    drawer: isDrawerId(dr) ? dr : (fromS?.drawer ?? null),
    query: params.get('q') ?? '',
  }
}

/** Returns new params; keeps unrelated keys (e.g. ?connected=true from Google sign-in). */
export function writeUrlState(prev: URLSearchParams, next: Partial<UrlState>): URLSearchParams {
  const p = new URLSearchParams(prev)
  p.delete('section')
  if ('section' in next) { if (next.section) p.set('s', next.section); else p.delete('s') }
  if ('drawer' in next) { if (next.drawer) p.set('dr', next.drawer); else p.delete('dr') }
  if ('query' in next) { if (next.query) p.set('q', next.query); else p.delete('q') }
  return p
}

/** Every setting a person might look for, with the words they might type. */
export interface FindEntry {
  label: string
  section: SectionId
  drawer?: DrawerId
  words: string
}

export const FIND_INDEX: ReadonlyArray<FindEntry> = [
  { label: 'Profile', section: 'you', drawer: 'profile', words: 'name email photo avatar account sign out' },
  { label: 'Theme', section: 'appearance', words: 'appearance light dark system mode' },
  { label: 'Reduce motion', section: 'appearance', words: 'appearance animation accessibility motion' },
  { label: 'Design style and palette', section: 'appearance', words: 'appearance style palette bench swiss void crimson orbital look' },
  { label: 'Logo and loading screen', section: 'appearance', words: 'appearance logo mark brand wordmark loading screen animation icon' },
  { label: 'Overdue task emails', section: 'you', words: 'notifications email overdue reminders alerts' },
  { label: 'Browser alerts', section: 'you', words: 'notifications push desktop permission' },
  { label: 'Microphone', section: 'recording', words: 'mic audio input device permission record' },
  { label: 'Add meetings to Google Calendar', section: 'recording', words: 'calendar sync google auto-sync' },
  { label: 'Bot auto-join', section: 'recording', words: 'bot recall calendar join meet zoom teams connected calendars' },
  { label: 'Meeting agents', section: 'agents', words: 'owner priority deadline confidence agent ai assign' },
  { label: 'What the agents learned', section: 'agents', drawer: 'learning', words: 'learning patterns overrides approve' },
  { label: 'Logos Vision', section: 'connections', drawer: 'ecosystem', words: 'crm ecosystem bridge token inbound api' },
  { label: 'Pulse', section: 'connections', drawer: 'ecosystem', words: 'chat ecosystem recaps' },
  { label: 'Slack', section: 'connections', drawer: 'slack', words: 'slack channel' },
  { label: 'System status', section: 'connections', words: 'health status database ai provider gemini openai test' },
  { label: 'Team members', section: 'workspace', words: 'team members invite role admin owner remove people' },
  { label: 'Plan and billing', section: 'workspace', drawer: 'billing', words: 'plan billing invoice stripe subscription upgrade' },
  { label: 'Keep recordings for', section: 'workspace', words: 'retention data privacy days delete media' },
  { label: 'Consent rules', section: 'workspace', words: 'consent gdpr two-party jurisdiction privacy' },
  { label: 'Archive or delete workspace', section: 'workspace', words: 'danger archive delete organization' },
]

export function findSettings(query: string, index: ReadonlyArray<FindEntry> = FIND_INDEX): FindEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []
  return index.filter((e) => {
    const hay = `${e.label} ${e.words}`.toLowerCase()
    return terms.every((t) => hay.includes(t))
  })
}

export function sectionDef(id: SectionId): SectionDef {
  return SECTIONS.find((s) => s.id === id) ?? (SECTIONS[0] as SectionDef)
}

export type ServiceState = 'up' | 'down' | 'unset' | 'hold' | 'unknown'

/** Normalise the many status strings /api/health, /integrations/status and /ecosystem/status return. */
export function serviceState(raw: unknown): ServiceState {
  if (raw === true) return 'up'
  if (raw === false || raw == null) return 'unset'
  const s = String(raw).toLowerCase()
  if (['connected', 'ok', 'up', 'healthy', 'configured', 'ready'].includes(s)) return 'up'
  if (['not configured', 'not_configured', 'unconfigured', 'missing'].includes(s)) return 'unset'
  if (['error', 'down', 'failed', 'disconnected', 'unhealthy'].includes(s)) return 'down'
  return 'unknown'
}

export const RETENTION_DAYS = [30, 90, 365] as const
export type RetentionDays = typeof RETENTION_DAYS[number]
export const CONSENT_RULES = [
  { value: 'permissive', label: 'Permissive' },
  { value: 'two_party', label: 'All-party' },
  { value: 'gdpr', label: 'GDPR' },
] as const
export type ConsentRule = typeof CONSENT_RULES[number]['value']

export function initials(name: string | null | undefined, email?: string | null): string {
  const src = (name || email || '?').trim()
  const parts = src.split(/[\s@._-]+/).filter(Boolean)
  const a = parts[0]?.[0] ?? '?'
  const b = parts.length > 1 ? (parts[1]?.[0] ?? '') : ''
  return (a + b).toUpperCase()
}
