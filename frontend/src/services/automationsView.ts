/**
 * Automations view logic (pure, no I/O). Automations are workflows on the
 * workflow engine; this file turns a workflow row into what the Automations
 * page shows: which group it sits in, its steps in words, its status, and
 * the meeting recipes a user can start from.
 */

export type Group = 'meeting' | 'other' | 'moved'
export type Tone = 'brand' | 'ai' | 'live' | 'mint' | 'off'

export interface WorkflowNode {
  id: string
  type?: string
  subtype?: string
  config?: Record<string, unknown>
  position?: { x: number; y: number }
}

export interface WorkflowConnection {
  id?: string
  sourceNodeId?: string
  targetNodeId?: string
  source?: string
  target?: string
  sourceOutput?: string
  targetInput?: string
}

export interface WorkflowRow {
  id: string
  name: string
  description?: string | null
  active?: boolean | null
  nodes?: WorkflowNode[] | null
  connections?: WorkflowConnection[] | null
  settings?: Record<string, unknown> | null
  last_executed_at?: string | null
  execution_count?: number | null
  is_template?: boolean | null
}

export interface RunRow {
  id: string
  workflow_id: string
  workflow_name?: string
  status?: string | null
  mode?: string | null
  started_at?: string | null
  duration_ms?: number | null
  error_message?: string | null
  triggered_by?: string | null
  meeting_id?: string | null
  meeting_title?: string | null
}

export interface Described {
  id: string
  name: string
  group: Group
  trigger: string | null
  steps: string[]
  active: boolean
  legacy: boolean
  note: string | null
}

export const GROUPS: ReadonlyArray<{ id: Group; title: string; note: string }> = [
  { id: 'meeting', title: 'After a meeting', note: 'Runs when a meeting is processed or an action item is found.' },
  { id: 'other', title: 'On a schedule or webhook', note: '' },
  { id: 'moved', title: 'From before the merge', note: 'Converted from the old Automations and Workflows pages and paused, so nothing sends until you turn it on.' },
]

const MEETING_TRIGGERS = new Set(['meeting_processed', 'action_item_created'])

const TRIGGER_WORDS: Record<string, string> = {
  meeting_processed: 'Meeting processed',
  action_item_created: 'Action item found',
  webhook: 'Webhook',
  manual: 'Run by hand',
  error: 'When another automation fails',
  deal_stage_changed: 'Deal stage changed',
  contact_created: 'Contact created',
  deal_closed: 'Deal closed',
  task_overdue: 'Task overdue',
  activity_logged: 'Activity logged',
}

const AGENT_WORDS: Record<string, string> = {
  assignment: 'Owner agent',
  priority: 'Priority agent',
  deadline: 'Deadline agent',
  followup: 'Follow-up agent',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** "Words for a subtype" fallback: send_slack → Send slack. */
export function humanize(subtype: string): string {
  const s = subtype.replace(/[_-]+/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Step'
}

/** 5-field cron in plain words where it's a common shape, else the cron. */
export function cronWords(cron: string): string {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return cron
  const [m = '', h = '', dom = '', mon = '', dow = ''] = parts
  if (!/^\d+$/.test(m) || !/^\d+$/.test(h) || dom !== '*' || mon !== '*') return cron
  const time = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  if (dow === '*') return `Daily ${time}`
  if (dow === '1-5') return `Weekdays ${time}`
  if (/^[0-6]$/.test(dow)) return `${DAYS[Number(dow)]} ${time}`
  return cron
}

function isTrigger(n: WorkflowNode): boolean {
  return n.type === 'trigger'
}

/** Old seed rows store the step kind in `type` with no subtype. */
export function isLegacy(nodes: WorkflowNode[]): boolean {
  return nodes.length > 0 && nodes.every((n) => !n.subtype)
}

export function triggerOf(nodes: WorkflowNode[]): string | null {
  const t = nodes.find(isTrigger)
  return t?.subtype || null
}

export function triggerWords(node: WorkflowNode): string {
  const sub = node.subtype || node.type || ''
  if (sub === 'schedule') {
    const cron = str(node.config?.cron)
    return cron ? cronWords(cron) : 'On a schedule'
  }
  return TRIGGER_WORDS[sub] || humanize(sub)
}

export function stepWords(node: WorkflowNode): string {
  const c = node.config || {}
  const sub = node.subtype || node.type || ''
  switch (sub) {
    case 'send_slack': return `Slack · ${str(c.channel) || 'pick a channel'}`
    case 'send_email': return `Email · ${str(c.to) || 'pick who'}`
    case 'send_pulse': return `Pulse · #${str(c.channel).replace(/^#/, '') || 'general'}`
    case 'create_task': return `Task · ${str(c.title) || 'new task'}`
    case 'sync_crm': return 'Sync to CRM'
    case 'detect_followups': return 'Detect follow-ups'
    case 'ai_agent': return AGENT_WORDS[str(c.agent)] || 'AI agent'
    case 'ai_prompt': return 'AI prompt'
    case 'ai_extract': return 'AI extract'
    case 'ai_classify': return 'AI classify'
    case 'http_request': return `Call ${str(c.url) ? 'a URL' : 'an API'}`
    case 'if': return 'If'
    case 'switch': return 'Switch'
    case 'filter': return 'Filter'
    case 'wait': return 'Wait'
    case 'get_stale_deals': return 'Stale deals'
    default: return humanize(sub)
  }
}

/** Nodes in run order: follow connections from the trigger, then the rest. */
export function orderedNodes(nodes: WorkflowNode[], connections: WorkflowConnection[]): WorkflowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const next = new Map<string, string[]>()
  for (const c of connections) {
    const s = c.sourceNodeId || c.source
    const t = c.targetNodeId || c.target
    if (!s || !t) continue
    next.set(s, [...(next.get(s) || []), t])
  }
  const start = nodes.find(isTrigger) || nodes[0]
  if (!start) return []
  const out: WorkflowNode[] = []
  const seen = new Set<string>()
  const queue = [start.id]
  while (queue.length) {
    const id = queue.shift() as string
    if (seen.has(id)) continue
    seen.add(id)
    const n = byId.get(id)
    if (n) out.push(n)
    for (const t of next.get(id) || []) queue.push(t)
  }
  for (const n of nodes) if (!seen.has(n.id)) out.push(n)
  return out
}

export function describe(w: WorkflowRow): Described {
  const nodes = Array.isArray(w.nodes) ? w.nodes : []
  const connections = Array.isArray(w.connections) ? w.connections : []
  const legacy = isLegacy(nodes)
  const settings = w.settings || {}
  const migrated = typeof settings.migrated_from_automation === 'string'
  const active = Boolean(w.active)
  const trigger = legacy ? (nodes[0]?.type || null) : triggerOf(nodes)

  const ordered = legacy ? nodes : orderedNodes(nodes, connections)
  const steps = ordered.map((n, i) => (i === 0 && (legacy || isTrigger(n)) ? triggerWords(n) : stepWords(n)))

  let group: Group
  if ((migrated || legacy) && !active) group = 'moved'
  else if (trigger && MEETING_TRIGGERS.has(trigger)) group = 'meeting'
  else group = 'other'

  let note: string | null = null
  if (legacy) note = 'Built in an older format. Open it in the builder to rebuild it.'
  else if (typeof settings.migration_note === 'string') note = settings.migration_note
  else if (nodes.length <= 1) note = 'No steps yet.'

  return { id: w.id, name: w.name || 'Untitled automation', group, trigger, steps, active, legacy, note }
}

export function groupAutomations(rows: Described[], filter: 'all' | 'on' | 'off' = 'all'): Array<{ id: Group; title: string; note: string; items: Described[]; on: number }> {
  const visible = rows.filter((r) => (filter === 'on' ? r.active : filter === 'off' ? !r.active : true))
  return GROUPS.map((g) => {
    const items = visible.filter((r) => r.group === g.id)
    return { ...g, items, on: items.filter((r) => r.active).length }
  }).filter((g) => g.items.length > 0)
}

/** Latest real run per workflow (test runs don't count). */
export function latestRuns(runs: RunRow[]): Map<string, RunRow> {
  const out = new Map<string, RunRow>()
  for (const r of runs) {
    if (r.mode === 'test') continue
    const prev = out.get(r.workflow_id)
    if (!prev || String(r.started_at || '') > String(prev.started_at || '')) out.set(r.workflow_id, r)
  }
  return out
}

export function status(d: Described, last?: RunRow | null): { tone: Tone; word: string } {
  if (!d.active) return { tone: 'off', word: 'Paused' }
  if (last?.status === 'failed') return { tone: 'brand', word: 'Failed' }
  if (last?.status === 'running') return { tone: 'live', word: 'Running' }
  if (last) return { tone: 'mint', word: 'Sent' }
  return { tone: 'mint', word: 'On' }
}

/** "09:42" today, "Thu 10:58" this week, "21 Nov" older. */
export function whenWords(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return hhmm
  const days = (now.getTime() - d.getTime()) / 86400000
  if (days >= 0 && days < 6) return `${DAYS[d.getDay()]} ${hhmm}`
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })}`
}

export interface RunGroup {
  key: string
  title: string
  kind: 'meeting' | 'other'
  at: string | null
  meetingId: string | null
  runs: RunRow[]
}

/** Recent runs grouped by the meeting (or the automation) that started them. */
export function groupRuns(runs: RunRow[], limit = 4): RunGroup[] {
  const groups: RunGroup[] = []
  const byKey = new Map<string, RunGroup>()
  for (const r of runs) {
    if (r.mode === 'test') continue
    const meeting = r.meeting_id || null
    const key = meeting ? `m:${meeting}` : `w:${r.workflow_id}:${String(r.started_at || '').slice(0, 13)}`
    let g = byKey.get(key)
    if (!g) {
      g = {
        key,
        title: meeting ? (r.meeting_title || 'Meeting') : (r.workflow_name || 'Automation'),
        kind: meeting ? 'meeting' : 'other',
        at: r.started_at || null,
        meetingId: meeting,
        runs: [],
      }
      byKey.set(key, g)
      groups.push(g)
    }
    g.runs.push(r)
  }
  return groups.slice(0, limit)
}

export function runSignal(r: RunRow): { tone: Tone; word: string } {
  if (r.status === 'failed') return { tone: 'brand', word: 'Failed' }
  if (r.status === 'running') return { tone: 'live', word: 'Running' }
  return { tone: 'mint', word: 'Sent' }
}

// ── Recipes: the meeting automations a user can switch on in one step ──

export interface Recipe {
  id: string
  name: string
  description: string
  group: Group
  /** The one field the user must fill before saving, if any. */
  blank?: { nodeId: string; field: string; label: string; placeholder: string }
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
}

function chain(nodes: WorkflowNode[]): WorkflowConnection[] {
  return nodes.slice(1).map((n, i) => ({
    id: `c${i + 1}`,
    sourceNodeId: nodes[i]?.id,
    sourceOutput: 'main',
    targetNodeId: n.id,
    targetInput: 'main',
  }))
}

function recipe(id: string, name: string, description: string, nodes: WorkflowNode[], blank?: Recipe['blank']): Recipe {
  const placed = nodes.map((n, i) => ({ ...n, position: { x: 100, y: 100 + i * 120 } }))
  const trig = placed[0]?.subtype || ''
  return { id, name, description, group: MEETING_TRIGGERS.has(trig) ? 'meeting' : 'other', blank, nodes: placed, connections: chain(placed) }
}

export const RECIPES: ReadonlyArray<Recipe> = [
  recipe('recap-slack', 'Post the recap to Slack', 'After a meeting · recap to a Slack channel', [
    { id: 'trigger', type: 'trigger', subtype: 'meeting_processed', config: {} },
    { id: 'slack', type: 'action', subtype: 'send_slack', config: { channel: '#meetings', message: 'Recap: {{title}}\n\n{{summary}}' } },
  ], { nodeId: 'slack', field: 'channel', label: 'Slack channel', placeholder: '#meetings' }),
  recipe('owners-email', 'Send each owner their action items', 'Action item found · email the person who owns it', [
    { id: 'trigger', type: 'trigger', subtype: 'action_item_created', config: {} },
    { id: 'email', type: 'action', subtype: 'send_email', config: { to: '{{assigned_to_email}}', subject: 'Action item from {{meeting_title}}', body: '{{task_description}}' } },
  ]),
  recipe('recap-email', 'Email the recap to one address', 'After a meeting · recap by email', [
    { id: 'trigger', type: 'trigger', subtype: 'meeting_processed', config: {} },
    { id: 'email', type: 'action', subtype: 'send_email', config: { to: '', subject: 'Recap: {{title}}', body: '{{summary}}' } },
  ], { nodeId: 'email', field: 'to', label: 'Send to', placeholder: 'team@company.com' }),
  recipe('recap-pulse', 'Post the recap to Pulse', 'After a meeting · recap to a Pulse channel', [
    { id: 'trigger', type: 'trigger', subtype: 'meeting_processed', config: {} },
    { id: 'pulse', type: 'action', subtype: 'send_pulse', config: { channel: 'meetings', message: 'Meeting "{{title}}" processed: {{action_items.length}} action items.' } },
  ], { nodeId: 'pulse', field: 'channel', label: 'Pulse channel', placeholder: 'meetings' }),
  recipe('followups', 'Flag follow-ups nobody owns', 'After a meeting · the Follow-up agent turns promises into tasks', [
    { id: 'trigger', type: 'trigger', subtype: 'meeting_processed', config: {} },
    { id: 'followups', type: 'ai', subtype: 'detect_followups', config: { autoCreate: true } },
  ]),
  recipe('daily-slack', 'Daily reminder in Slack', 'Weekdays 09:00 · a message to a Slack channel', [
    { id: 'trigger', type: 'trigger', subtype: 'schedule', config: { cron: '0 9 * * 1-5', timezone: 'UTC' } },
    { id: 'slack', type: 'action', subtype: 'send_slack', config: { channel: '#team', message: 'Morning. Check today’s action items in Entomate.' } },
  ], { nodeId: 'slack', field: 'channel', label: 'Slack channel', placeholder: '#team' }),
]

/** A recipe with its blank filled in, ready for workflowsApi.create. */
export function buildFromRecipe(r: Recipe, value?: string): { name: string; description: string; nodes: WorkflowNode[]; connections: WorkflowConnection[]; active: boolean } {
  const nodes = r.nodes.map((n) => {
    if (!r.blank || n.id !== r.blank.nodeId || value === undefined) return { ...n, config: { ...(n.config || {}) } }
    return { ...n, config: { ...(n.config || {}), [r.blank.field]: value.trim() } }
  })
  return { name: r.name, description: r.description, nodes, connections: r.connections.map((c) => ({ ...c })), active: true }
}

/** The editable fields on a step, for the automation drawer. */
export function editableField(node: WorkflowNode): { field: string; label: string } | null {
  switch (node.subtype) {
    case 'send_slack': return { field: 'channel', label: 'Channel' }
    case 'send_email': return { field: 'to', label: 'Send to' }
    case 'send_pulse': return { field: 'channel', label: 'Pulse channel' }
    case 'create_task': return { field: 'title', label: 'Task title' }
    case 'schedule': return { field: 'cron', label: 'Schedule (cron)' }
    default: return null
  }
}
