/**
 * Entomate AI Assistant Service
 * Context-aware query building, quick actions, and response caching
 */
import {
  meetingsApi,
  tasksApi,
  projectsApi,
  dashboardApi,
  calendarApi,
  workflowsApi,
  assistantApi,
  entoAiApi,
} from './api'

// ── Cache ──────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const CACHE_MAX = 20
const cache = new Map()

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null }
  return entry.value
}

function setCache(key, value) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
  cache.set(key, { value, ts: Date.now() })
}

// ── Section mapping ────────────────────────────────────
export const SECTIONS = {
  dashboard:        { label: 'Dashboard',     path: '/dashboard' },
  meetings:         { label: 'Meetings',      path: '/meetings' },
  calendar:         { label: 'Schedule',      path: '/dashboard' },
  search:           { label: 'Search',        path: '/search' },
  projects:         { label: 'Projects',      path: '/projects' },
  'project-dashboard': { label: 'Project Board', path: '/projects?view=board' },
  tasks:            { label: 'Tasks',         path: '/tasks' },
  workflows:        { label: 'Workflows',     path: '/workflows' },
  automations:      { label: 'Automations',   path: '/automations' },
  agents:           { label: 'AI Agents',     path: '/agents' },
  analytics:        { label: 'Insights',      path: '/analytics' },
  reports:          { label: 'Export',        path: '/analytics?export=' },
  settings:         { label: 'Settings',      path: '/settings' },
  guide:            { label: 'User Guide',    path: '/guide' },
}

export function resolveSection(pathname) {
  if (!pathname) return 'dashboard'
  const seg = pathname.split('/').filter(Boolean)[0] || 'dashboard'
  return SECTIONS[seg] ? seg : 'dashboard'
}

export function getSectionLabel(section) {
  return SECTIONS[section]?.label || 'Dashboard'
}

// ── Quick actions per section ──────────────────────────
const QUICK_ACTIONS = {
  dashboard: [
    { label: 'Summarize my day',    query: 'Give me a summary of my day — meetings, tasks, and action items' },
    { label: "What's urgent?",      query: 'What are my most urgent and overdue items right now?' },
    { label: 'Meeting prep',        query: 'Help me prepare for my next upcoming meeting' },
  ],
  meetings: [
    { label: 'Recent action items', query: 'What action items came out of my recent meetings?' },
    { label: 'Upcoming meetings',   query: 'What meetings do I have coming up and what should I prepare?' },
    { label: 'Meeting insights',    query: 'What patterns or insights can you find across my recent meetings?' },
  ],
  calendar: [
    { label: "Today's agenda",      query: "What's on my calendar for today?" },
    { label: 'This week',           query: 'Give me an overview of my week ahead' },
    { label: 'Schedule gaps',       query: 'Where do I have free time this week for focused work?' },
  ],
  projects: [
    { label: 'Project health',      query: 'How are my projects doing? Any at risk or behind schedule?' },
    { label: 'Blocked tasks',       query: 'Are there any blocked or stalled tasks across projects?' },
    { label: 'Budget status',       query: 'What is the budget status across my active projects?' },
  ],
  'project-dashboard': [
    { label: 'Board overview',      query: 'Give me an overview of the project board status' },
    { label: 'Bottlenecks',         query: 'Are there any bottlenecks in the project pipeline?' },
  ],
  tasks: [
    { label: 'My tasks today',      query: 'What tasks should I focus on today?' },
    { label: 'Overdue items',       query: 'What tasks are overdue and need immediate attention?' },
    { label: 'What to work on next?', query: 'Based on priorities and deadlines, what should I work on next?' },
  ],
  workflows: [
    { label: 'Active workflows',    query: 'What workflows are currently active and how are they performing?' },
    { label: 'Recent executions',   query: 'Show me recent workflow execution results' },
  ],
  automations: [
    { label: 'Automation status',   query: 'Which automations are active and how are they performing?' },
    { label: 'Failed runs',         query: 'Have any automations failed recently?' },
    { label: 'Optimization tips',   query: 'How can I optimize my current automations?' },
  ],
  agents: [
    { label: 'Agent performance',   query: 'How are my AI agents performing? Any issues?' },
    { label: 'Recent decisions',    query: 'What decisions have the AI agents made recently?' },
    { label: 'Pending actions',     query: 'Are there any pending agent actions that need my review?' },
  ],
  analytics: [
    { label: 'Key metrics',         query: 'What are my key productivity metrics this week?' },
    { label: 'Trend analysis',      query: 'What trends do you see in my meeting and task data?' },
  ],
  reports: [
    { label: 'Weekly summary',      query: 'Generate a summary of this week across all areas' },
    { label: 'Team performance',    query: 'How is the team performing based on available data?' },
  ],
  search: [
    { label: 'Search tips',         query: 'What kind of things can I search for in Entomate?' },
  ],
  settings: [
    { label: 'Setup help',          query: 'Help me configure Entomate for best results' },
  ],
  guide: [
    { label: 'Getting started',     query: 'How do I get the most out of Entomate?' },
  ],
}

export function getQuickActions(section) {
  return QUICK_ACTIONS[section] || QUICK_ACTIONS.dashboard
}

// ── Starting state ─────────────────────────────────────
// The panel's empty state is one line and three questions. The line names what the
// current page holds; the questions fit what is actually there, so an empty Meetings page
// asks how to get a first meeting in rather than "What action items came out of my
// recent meetings?".
const STARTER_SUBJECT = {
  dashboard: 'your day',
  meetings: 'your meetings',
  calendar: 'your calendar',
  projects: 'your projects',
  'project-dashboard': 'your projects',
  tasks: 'your tasks',
  workflows: 'your automations',
  automations: 'your automations',
  agents: 'your agents',
  analytics: 'your numbers',
  reports: 'your reports',
  search: 'anything you recorded',
  settings: 'setting up Entomate',
  guide: 'how Entomate works',
}

/** The data key whose emptiness means "nothing here yet" for each section. */
const STARTER_DATA_KEY = {
  meetings: 'meetings',
  calendar: 'events',
  projects: 'projects',
  'project-dashboard': 'projects',
  tasks: 'tasks',
  workflows: 'automations',
  automations: 'automations',
}

const EMPTY_QUICK_ACTIONS = {
  meetings: [
    { label: 'Record my first meeting', query: 'How do I record or import my first meeting in Entomate? Keep it to the steps.' },
    { label: 'What a meeting gives me', query: 'What does Entomate pull out of a meeting once it is recorded? Keep it short.' },
    { label: 'Connect my calendar',     query: 'How do I connect my calendar so Entomate can join my meetings?' },
  ],
  calendar: [
    { label: 'Connect my calendar',     query: 'How do I connect my calendar to Entomate?' },
    { label: 'What shows up here',      query: 'What appears on the Entomate calendar? Keep it short.' },
  ],
  projects: [
    { label: 'Start my first project',  query: 'How do I create my first project in Entomate? Keep it to the steps.' },
    { label: 'How projects fill in',    query: 'How do meeting action items and decisions end up in a project? Keep it short.' },
  ],
  tasks: [
    { label: 'Where tasks come from',   query: 'Where do tasks in Entomate come from? Keep it short.' },
    { label: 'Add my first task',       query: 'How do I add a task by hand?' },
  ],
  automations: [
    { label: 'Build my first automation', query: 'How do I build my first automation? Keep it to the steps.' },
    { label: 'What I can automate',     query: 'What kinds of things can an automation do in Entomate? Give three examples.' },
  ],
}
EMPTY_QUICK_ACTIONS['project-dashboard'] = EMPTY_QUICK_ACTIONS.projects
EMPTY_QUICK_ACTIONS.workflows = EMPTY_QUICK_ACTIONS.automations

/**
 * The starting state for a section: a short title and up to three questions.
 * `data` is the section data the panel loaded; until it arrives (or if a fetch failed and
 * the key is missing) the regular questions show, so nothing flips to "get started" on a
 * page that has content.
 */
export function getStarter(section, data) {
  const subject = STARTER_SUBJECT[section] || 'your work'
  const key = STARTER_DATA_KEY[section]
  const list = key ? data?.[key] : undefined
  const isEmpty = Array.isArray(list) && list.length === 0
  const prompts = (isEmpty && EMPTY_QUICK_ACTIONS[section]) || getQuickActions(section)
  return { title: `Ask about ${subject}`, prompts: prompts.slice(0, 3) }
}

// ── Context data loaders ───────────────────────────────
// The api client's interceptor already returns the response body, so `res` is the JSON the
// route sent ({ meetings: [...] }, { data: [...] }, ...), never an axios response. Reading
// `res.data.meetings` here made every section report "No meetings yet" whatever was there.
function pickList(res, key) {
  if (Array.isArray(res?.[key])) return res[key]
  if (Array.isArray(res?.data?.[key])) return res.data[key]
  if (Array.isArray(res?.data)) return res.data
  if (Array.isArray(res)) return res
  return []
}

const DATA_LOADERS = {
  dashboard: async () => {
    const [summary, overdue] = await Promise.allSettled([
      dashboardApi.getSummary(),
      dashboardApi.getOverdue(),
    ])
    return {
      summary: summary.status === 'fulfilled' ? summary.value || null : null,
      overdue: overdue.status === 'fulfilled' ? pickList(overdue.value, 'overdue') : [],
    }
  },
  meetings: async () => {
    const res = await meetingsApi.list({ limit: 15, sort: 'date', order: 'desc' })
    return { meetings: pickList(res, 'meetings') }
  },
  calendar: async () => {
    const res = await calendarApi.getUpcoming(14)
    return { events: pickList(res, 'upcoming') }
  },
  projects: async () => {
    const res = await projectsApi.list({ limit: 15 })
    return { projects: pickList(res, 'projects') }
  },
  'project-dashboard': async () => {
    const res = await projectsApi.list({ limit: 15 })
    return { projects: pickList(res, 'projects') }
  },
  tasks: async () => {
    const res = await tasksApi.list({ limit: 20 })
    return { tasks: pickList(res, 'tasks') }
  },
  workflows: async () => {
    const res = await workflowsApi.list({ limit: 15 })
    return { workflows: pickList(res, 'workflows') }
  },
  // Automations run on the workflow engine
  automations: async () => {
    const res = await workflowsApi.list({ limit: 15, template: false })
    return { automations: pickList(res, 'automations') }
  },
  analytics: async () => {
    const res = await dashboardApi.getSummary()
    return { metrics: res || null }
  },
  reports: async () => ({ reports: [] }), // reports are on-demand
  search:  async () => ({ }),
  settings: async () => ({ }),
  guide:   async () => ({ }),
}

export async function loadSectionData(section) {
  const loader = DATA_LOADERS[section] || DATA_LOADERS.dashboard
  try {
    return await loader()
  } catch (err) {
    console.warn('[EntoAI] Failed to load section data:', err.message)
    return {}
  }
}

// ── Section summary (one-liner for context chip) ───────
export function getSectionSummary(section, data) {
  if (!data) return ''
  try {
    switch (section) {
      case 'dashboard': {
        const s = data.summary
        if (!s) return ''
        const parts = []
        if (s.openItems) parts.push(`${s.openItems} open items`)
        const overdue = data.overdue?.length || s.overdue || 0
        if (overdue) parts.push(`${overdue} overdue`)
        return parts.join(' · ') || 'All caught up'
      }
      case 'meetings': {
        const m = data.meetings || []
        return m.length ? `${m.length} recent meetings` : 'No meetings yet'
      }
      case 'calendar': {
        const e = data.events || []
        return e.length ? `${e.length} upcoming events` : 'Calendar clear'
      }
      case 'projects': case 'project-dashboard': {
        const p = data.projects || []
        const active = p.filter(x => x.status === 'active' || x.status === 'in_progress').length
        return p.length ? `${active} active of ${p.length} projects` : 'No projects'
      }
      case 'tasks': {
        const t = data.tasks || []
        const overdue = t.filter(x => x.status !== 'completed' && x.dueDate && new Date(x.dueDate) < new Date()).length
        const inProgress = t.filter(x => x.status === 'in_progress').length
        const parts = []
        if (inProgress) parts.push(`${inProgress} in progress`)
        if (overdue) parts.push(`${overdue} overdue`)
        return parts.join(' · ') || `${t.length} tasks`
      }
      case 'workflows': {
        const w = data.workflows || []
        return w.length ? `${w.length} workflows` : 'No workflows'
      }
      case 'automations': {
        const a = data.automations || []
        const active = a.filter(x => x.enabled).length
        return a.length ? `${active} active automations` : 'No automations'
      }
      case 'agents': {
        const ag = data.agents || []
        const enabled = ag.filter(x => x.enabled).length
        return ag.length ? `${enabled} active agents` : 'No agents configured'
      }
      default:
        return ''
    }
  } catch {
    return ''
  }
}

// ── Streaming query ────────────────────────────────────
// First the agent loop with read tools (EAI-04, /api/ento-ai/query). If that
// endpoint fails before its stream starts (not deployed yet, 503, network), the
// question goes to the section-context assistant below, unchanged.
export async function streamQuery(userQuery, context, callbacks) {
  try {
    await entoAiApi.queryStream(
      { question: userQuery, section: context.section, threadId: context.threadId },
      callbacks
    )
    return
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    // A rate limit applies to the fallback too: say so instead of failing twice.
    if (err?.status === 429) {
      callbacks.onError?.(new Error('Too many questions in a short time. Wait a minute, then ask again.'))
      return
    }
    console.warn('[EntoAI] Tool endpoint unavailable, using the assistant endpoint:', err?.message)
  }
  return streamAssistantQuery(userQuery, context, callbacks)
}

// The backend handles: data loading, prompt building, and AI streaming
// The frontend only sends: question, section, conversationId
// Falls back to searchApi.askStream if dedicated endpoint is unavailable
async function streamAssistantQuery(userQuery, context, callbacks) {
  const { signal, onChunk, onCitations, onFollowUp, onComplete, onError } = callbacks

  try {
    // Try dedicated assistant endpoint first
    await assistantApi.queryStream(
      {
        question: userQuery,
        section: context.section,
        conversationId: context.conversationId,
      },
      {
        signal,
        onChunk,
        onCitations,
        onFollowUp,
        onComplete: (result) => {
          // Mark that dedicated endpoint works
          streamQuery._useFallback = false
          if (onComplete) onComplete(result)
        },
        onError: (err) => {
          // If dedicated endpoint fails, try fallback
          if (!streamQuery._useFallback) {
            streamQuery._useFallback = true
            console.warn('[EntoAI] Dedicated endpoint failed, trying fallback:', err?.message)
            streamQueryFallback(userQuery, context, callbacks)
          } else {
            if (onError) onError(err)
          }
        },
      }
    )
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    // Network error — use fallback
    console.warn('[EntoAI] Dedicated endpoint unavailable, using fallback')
    streamQuery._useFallback = true
    return streamQueryFallback(userQuery, context, callbacks)
  }
}

// Fallback: send the question through the generic search/ask/stream endpoint
async function streamQueryFallback(userQuery, context, callbacks) {
  const { searchApi } = await import('./api')
  const { signal, onChunk, onCitations, onFollowUp, onComplete, onError } = callbacks

  const sectionLabel = getSectionLabel(context.section)
  const prefix = `[Context: User is on the ${sectionLabel} page of Entomate, a meeting intelligence and project automation platform.]\n\n`

  return searchApi.askStream(
    { question: prefix + userQuery, conversationId: context.conversationId },
    { signal, onChunk, onCitations, onFollowUp, onComplete, onError }
  )
}
