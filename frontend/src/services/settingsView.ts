/** Shared Settings navigation and URL compatibility. */
export const SETTINGS_GROUPS = [
  {
    id: 'personal',
    title: 'Personal',
    sections: [
      { id: 'profile', title: 'Profile', summary: 'Display name, photo and sign-in' },
      { id: 'notifications', title: 'Notifications', summary: 'Overdue task emails and browser alerts' },
      { id: 'appearance', title: 'Appearance', summary: 'Theme, motion and visual style' },
    ],
  },
  {
    id: 'meetings',
    title: 'Meetings & integrations',
    sections: [
      { id: 'recording', title: 'Recording', summary: 'Microphone, calendar sync and bot auto-join' },
      { id: 'agents', title: 'Meeting agents', summary: 'Agent rules and learned preferences' },
      { id: 'connections', title: 'Integrations', summary: 'Calendar, connected services and system status' },
    ],
  },
  {
    id: 'workspace',
    title: 'Workspace',
    sections: [
      { id: 'workspace', title: 'General', summary: 'Workspace details, archive and deletion' },
      { id: 'people', title: 'People & access', summary: 'Members, roles and invitations' },
      { id: 'billing', title: 'Plan & billing', summary: 'Subscription, usage and invoices' },
      { id: 'privacy', title: 'Data & privacy', summary: 'Recording retention and consent' },
    ],
  },
] as const

type SettingsGroup = (typeof SETTINGS_GROUPS)[number]
export type SectionId = SettingsGroup['sections'][number]['id']
export type DrawerId = 'invite' | 'learning' | 'ecosystem' | 'slack' | 'calendar'
type SectionDef = SettingsGroup['sections'][number]

export const SECTIONS = SETTINGS_GROUPS.flatMap<SectionDef>((group) => group.sections)
const DRAWER_SECTIONS: Readonly<Record<DrawerId, SectionId>> = {
  invite: 'people', learning: 'agents', ecosystem: 'connections', slack: 'connections', calendar: 'connections',
}

export function isDrawerId(value: string | null): value is DrawerId {
  return value !== null && Object.prototype.hasOwnProperty.call(DRAWER_SECTIONS, value)
}

const LEGACY_SECTIONS: Readonly<Record<string, { section: SectionId; drawer?: DrawerId }>> = {
  you: { section: 'profile' },
  organization: { section: 'workspace' },
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
  'data-retention': { section: 'privacy' },
  team: { section: 'people' },
}

export function resolveSection(name: string | null | undefined): { section: SectionId; drawer?: DrawerId } | null {
  const section = SECTIONS.find((entry) => entry.id === name)
  if (section) return { section: section.id }
  if (!name || !Object.prototype.hasOwnProperty.call(LEGACY_SECTIONS, name)) return null
  return LEGACY_SECTIONS[name] ?? null
}

export interface UrlState {
  section: SectionId | null
  drawer: DrawerId | null
  query: string
}

export function readUrlState(params: URLSearchParams): UrlState {
  const resolved = resolveSection(params.get('s') ?? params.get('section'))
  const requestedDrawer = params.get('dr')
  const drawer = isDrawerId(requestedDrawer) ? requestedDrawer : resolved?.drawer ?? null
  const legacyPage = requestedDrawer === 'profile' || requestedDrawer === 'billing' ? requestedDrawer : null
  return {
    section: legacyPage ?? (drawer ? DRAWER_SECTIONS[drawer] : resolved?.section ?? null),
    drawer: legacyPage ? null : drawer,
    query: params.get('q') ?? '',
  }
}

export function sectionGroup(id: SectionId): SettingsGroup {
  return SETTINGS_GROUPS.find((group) => group.sections.some((section) => section.id === id)) ?? SETTINGS_GROUPS[0]
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
  { label: 'Profile', section: 'profile', words: 'name email photo picture avatar account upload replace remove sign out' },
  { label: 'Theme', section: 'appearance', words: 'appearance light dark system mode' },
  { label: 'Reduce motion', section: 'appearance', words: 'appearance animation accessibility motion' },
  { label: 'Design style and palette', section: 'appearance', words: 'appearance style palette bench swiss void crimson orbital look' },
  { label: 'Logo and loading screen', section: 'appearance', words: 'appearance logo mark brand wordmark loading screen animation icon' },
  { label: 'Overdue task emails', section: 'notifications', words: 'notifications email overdue reminders alerts' },
  { label: 'Browser alerts', section: 'notifications', words: 'notifications push desktop permission' },
  { label: 'Microphone', section: 'recording', words: 'mic audio input device permission record' },
  { label: 'Add meetings to Google Calendar', section: 'recording', words: 'calendar sync google auto-sync' },
  { label: 'Bot auto-join', section: 'recording', words: 'bot recall calendar join meet zoom teams connected calendars' },
  { label: 'Meeting agents', section: 'agents', words: 'owner priority deadline confidence agent ai assign' },
  { label: 'What the agents learned', section: 'agents', drawer: 'learning', words: 'learning patterns overrides approve' },
  { label: 'Logos Vision', section: 'connections', drawer: 'ecosystem', words: 'crm ecosystem bridge token inbound api' },
  { label: 'Pulse', section: 'connections', drawer: 'ecosystem', words: 'chat ecosystem recaps' },
  { label: 'Slack', section: 'connections', drawer: 'slack', words: 'slack channel' },
  { label: 'Google Calendar', section: 'connections', drawer: 'calendar', words: 'connect switch account work personal oauth' },
  { label: 'System status', section: 'connections', words: 'health status database ai provider gemini openai test' },
  { label: 'Team members', section: 'people', words: 'team members invite role admin owner remove people' },
  { label: 'Plan and billing', section: 'billing', words: 'plan billing invoice stripe subscription upgrade' },
  { label: 'Keep recordings for', section: 'privacy', words: 'retention data privacy days delete media' },
  { label: 'Consent rules', section: 'privacy', words: 'consent gdpr two-party jurisdiction privacy' },
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
  return SECTIONS.find((s) => s.id === id) ?? SETTINGS_GROUPS[0].sections[0]
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
