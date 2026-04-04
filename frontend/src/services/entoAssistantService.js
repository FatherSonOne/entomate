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
  agentsApi,
  automationsApi,
  workflowsApi,
  assistantApi,
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
  calendar:         { label: 'Calendar',      path: '/calendar' },
  search:           { label: 'Search',        path: '/search' },
  projects:         { label: 'Projects',      path: '/projects' },
  'project-dashboard': { label: 'Project Board', path: '/project-dashboard' },
  tasks:            { label: 'Tasks',         path: '/tasks' },
  goals:            { label: 'Goals',         path: '/goals' },
  workflows:        { label: 'Workflows',     path: '/workflows' },
  automations:      { label: 'Automations',   path: '/automations' },
  agents:           { label: 'AI Agents',     path: '/agents' },
  analytics:        { label: 'Analytics',     path: '/analytics' },
  reports:          { label: 'Reports',       path: '/reports' },
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
  goals: [
    { label: 'Goal progress',       query: 'How am I tracking against my goals and key results?' },
    { label: 'At-risk goals',       query: 'Which goals are at risk of not being met?' },
    { label: 'Key results update',  query: 'Give me a status update on all my key results' },
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

// ── Suggested navigation after response ────────────────
const SUGGESTED_NAV = {
  dashboard:  [{ label: 'Open Tasks', to: '/tasks' }, { label: 'Check Calendar', to: '/calendar' }, { label: 'View Meetings', to: '/meetings' }],
  meetings:   [{ label: 'Open Tasks', to: '/tasks' }, { label: 'Check Calendar', to: '/calendar' }, { label: 'Go to Dashboard', to: '/dashboard' }],
  calendar:   [{ label: 'Open Meetings', to: '/meetings' }, { label: 'View Tasks', to: '/tasks' }, { label: 'Go to Dashboard', to: '/dashboard' }],
  projects:   [{ label: 'View Tasks', to: '/tasks' }, { label: 'Check Goals', to: '/goals' }, { label: 'Go to Dashboard', to: '/dashboard' }],
  tasks:      [{ label: 'View Projects', to: '/projects' }, { label: 'Check Calendar', to: '/calendar' }, { label: 'Go to Dashboard', to: '/dashboard' }],
  goals:      [{ label: 'View Tasks', to: '/tasks' }, { label: 'Check Projects', to: '/projects' }, { label: 'Go to Dashboard', to: '/dashboard' }],
  agents:     [{ label: 'View Tasks', to: '/tasks' }, { label: 'Check Automations', to: '/automations' }, { label: 'Go to Dashboard', to: '/dashboard' }],
  automations:[{ label: 'View Workflows', to: '/workflows' }, { label: 'Check Agents', to: '/agents' }, { label: 'Go to Dashboard', to: '/dashboard' }],
  workflows:  [{ label: 'Check Automations', to: '/automations' }, { label: 'View Projects', to: '/projects' }, { label: 'Go to Dashboard', to: '/dashboard' }],
  analytics:  [{ label: 'View Reports', to: '/reports' }, { label: 'Open Tasks', to: '/tasks' }, { label: 'Go to Dashboard', to: '/dashboard' }],
  reports:    [{ label: 'View Analytics', to: '/analytics' }, { label: 'Open Tasks', to: '/tasks' }, { label: 'Go to Dashboard', to: '/dashboard' }],
}

export function getSuggestedActions(section) {
  return SUGGESTED_NAV[section] || SUGGESTED_NAV.dashboard
}

// ── Context data loaders ───────────────────────────────
const DATA_LOADERS = {
  dashboard: async () => {
    const [summary, overdue] = await Promise.allSettled([
      dashboardApi.getSummary(),
      dashboardApi.getOverdue(),
    ])
    return {
      summary: summary.status === 'fulfilled' ? summary.value?.data : null,
      overdue: overdue.status === 'fulfilled' ? overdue.value?.data : null,
    }
  },
  meetings: async () => {
    const res = await meetingsApi.list({ limit: 15, sort: 'date', order: 'desc' })
    return { meetings: res?.data?.meetings || res?.data || [] }
  },
  calendar: async () => {
    const res = await calendarApi.getUpcoming(14)
    return { events: res?.data?.items || res?.data || [] }
  },
  projects: async () => {
    const res = await projectsApi.list({ limit: 15 })
    return { projects: res?.data?.projects || res?.data || [] }
  },
  'project-dashboard': async () => {
    const res = await projectsApi.list({ limit: 15 })
    return { projects: res?.data?.projects || res?.data || [] }
  },
  tasks: async () => {
    const res = await tasksApi.list({ limit: 20 })
    return { tasks: res?.data?.tasks || res?.data || [] }
  },
  goals: async () => {
    // Goals are fetched from tasks/projects with goal type
    const res = await tasksApi.list({ limit: 20, type: 'goal' })
    return { goals: res?.data?.tasks || res?.data || [] }
  },
  workflows: async () => {
    const res = await workflowsApi.list({ limit: 15 })
    return { workflows: res?.data?.workflows || res?.data || [] }
  },
  automations: async () => {
    const res = await automationsApi.list({ limit: 15 })
    return { automations: res?.data?.automations || res?.data || [] }
  },
  agents: async () => {
    const res = await agentsApi.list({ limit: 15 })
    return { agents: res?.data?.agents || res?.data || [] }
  },
  analytics: async () => {
    const res = await dashboardApi.getSummary()
    return { metrics: res?.data || null }
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
        if (s.meetingsThisWeek) parts.push(`${s.meetingsThisWeek} meetings this week`)
        if (s.tasksInProgress) parts.push(`${s.tasksInProgress} tasks in progress`)
        if (s.overdueTasks || data.overdue?.length) parts.push(`${data.overdue?.length || s.overdueTasks || 0} overdue`)
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
      case 'goals': {
        const g = data.goals || []
        return g.length ? `${g.length} goals tracked` : 'No goals set'
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

// ── Streaming query via dedicated backend endpoint ─────
// The backend handles: data loading, prompt building, and AI streaming
// The frontend only sends: question, section, conversationId
// Falls back to searchApi.askStream if dedicated endpoint is unavailable
export async function streamQuery(userQuery, context, callbacks) {
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
