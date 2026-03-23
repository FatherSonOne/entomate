import axios from 'axios'
import { supabase } from './supabaseClient'
import cache from './apiCache'

// Use relative URL to leverage Vite proxy, or fall back to full URL if configured
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// Network status tracking
let isOnline = navigator.onLine
let backendAvailable = true
const connectionListeners = new Set()

// Update network status
window.addEventListener('online', () => {
  isOnline = true
  notifyConnectionChange()
})
window.addEventListener('offline', () => {
  isOnline = false
  notifyConnectionChange()
})

function notifyConnectionChange() {
  connectionListeners.forEach(listener => listener({ isOnline, backendAvailable }))
}

// Export network status utilities
export const networkStatus = {
  isOnline: () => isOnline,
  isBackendAvailable: () => backendAvailable,
  subscribe: (listener) => {
    connectionListeners.add(listener)
    return () => connectionListeners.delete(listener)
  }
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNABORTED', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'Network Error']
}

// Exponential backoff delay
const getRetryDelay = (attempt) => RETRY_CONFIG.retryDelay * Math.pow(2, attempt)

// Check if error is retryable
const isRetryableError = (error) => {
  if (!error) return false

  // Network errors (backend unavailable)
  if (error.message === 'Network Error' || !error.response) {
    return true
  }

  // Retryable status codes
  if (error.response && RETRY_CONFIG.retryableStatuses.includes(error.response.status)) {
    return true
  }

  // Retryable error codes
  if (error.code && RETRY_CONFIG.retryableErrors.includes(error.code)) {
    return true
  }

  return false
}

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 120000, // 2 minutes for audio processing
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - async to support Supabase session retrieval
api.interceptors.request.use(
  async (config) => {
    // Check if we're offline
    if (!navigator.onLine) {
      return Promise.reject(new Error('You are offline. Please check your internet connection.'))
    }

    // Check cache for GET requests (skip retries)
    if (config.method === 'get' && !config._retryCount) {
      const cached = cache.get(config.url, config.params)
      if (cached !== null) {
        // Return cached data via a resolved adapter
        config.adapter = () => Promise.resolve({ data: cached, status: 200, statusText: 'OK', headers: {}, config })
        return config
      }
    }

    // Invalidate cache on mutations
    if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
      const resourcePath = config.url?.split('?')[0]
      if (resourcePath) cache.invalidate(resourcePath)
    }

    // Get Supabase session token
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
      }
    } catch (error) {
      // If token retrieval fails, continue without auth header
      console.debug('Failed to get auth token:', error.message)
    }

    // Add retry tracking
    config._retryCount = config._retryCount || 0

    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor with retry logic
api.interceptors.response.use(
  (response) => {
    // Mark backend as available on success
    if (!backendAvailable) {
      backendAvailable = true
      notifyConnectionChange()
    }

    // Cache GET responses
    if (response.config?.method === 'get' && response.config?.url) {
      cache.set(response.config.url, response.config.params, response.data)
    }

    return response.data
  },
  async (error) => {
    const config = error.config

    // Handle network errors (backend unavailable)
    if (error.message === 'Network Error' || !error.response) {
      if (backendAvailable) {
        backendAvailable = false
        notifyConnectionChange()
      }
    }

    // Handle 401 - clear token cache and retry once with fresh token
    if (error.response?.status === 401 && config && !config._tokenRefreshAttempted) {
      config._tokenRefreshAttempted = true
      // Clear token cache to force a fresh token
      tokenCache = null
      tokenCacheTime = 0

      // Retry the request with a fresh token
      try {
        if (tokenGetter) {
          const newToken = await tokenGetter()
          if (newToken) {
            config.headers.Authorization = `Bearer ${newToken}`
            return api(config)
          }
        }
      } catch (refreshError) {
        console.debug('Token refresh failed:', refreshError.message)
      }
    }

    // Retry logic for other errors
    if (config && isRetryableError(error) && config._retryCount < RETRY_CONFIG.maxRetries) {
      config._retryCount += 1
      const delay = getRetryDelay(config._retryCount - 1)

      console.warn(`API request failed, retrying (${config._retryCount}/${RETRY_CONFIG.maxRetries}) in ${delay}ms...`)

      await new Promise(resolve => setTimeout(resolve, delay))
      return api(config)
    }

    // Build user-friendly error message
    let message
    if (!navigator.onLine) {
      message = 'You are offline. Please check your internet connection.'
    } else if (error.message === 'Network Error' || !error.response) {
      message = 'Unable to connect to the server. Please ensure the backend is running.'
    } else if (error.response?.status === 401) {
      message = 'Your session has expired. Please log in again.'
    } else if (error.response?.status === 403) {
      message = 'You do not have permission to perform this action.'
    } else if (error.response?.status === 404) {
      message = 'The requested resource was not found.'
    } else if (error.response?.status >= 500) {
      message = 'A server error occurred. Please try again later.'
    } else {
      message = error.response?.data?.error || error.message || 'An error occurred'
    }

    console.error('API Error:', message, {
      url: config?.url,
      method: config?.method,
      status: error.response?.status,
      retries: config?._retryCount || 0
    })

    const enhancedError = new Error(message)
    enhancedError.originalError = error
    enhancedError.status = error.response?.status
    enhancedError.isNetworkError = error.message === 'Network Error' || !error.response

    return Promise.reject(enhancedError)
  }
)

// ========================================
// HEALTH
// ========================================
export const checkHealth = () => api.get('/health')

// ========================================
// MEETINGS API
// ========================================
export const meetingsApi = {
  // Process audio file
  processAudio: async (formData) => {
    return api.post('/meetings/process', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  // Process text transcript
  processTranscript: (data) => api.post('/meetings/transcript', data),

  // List meetings
  list: (params = {}) => api.get('/meetings', { params }),

  // Get meeting by ID
  get: (id) => api.get(`/meetings/${id}`),

  // Update meeting
  update: (id, data) => api.put(`/meetings/${id}`, data),

  // Delete meeting
  delete: (id) => api.delete(`/meetings/${id}`),

  // Ask question about meeting
  ask: (id, question) => api.post(`/meetings/${id}/ask`, { question }),

  // Get formatted recap
  getRecap: (id) => api.get(`/meetings/${id}/recap`),

  // ========================================
  // AI Meeting Summary Widget API (Quick Win 1)
  // ========================================

  // Get meeting summary for widget
  getMeetingSummary: (id) => api.get(`/meeting-summary/${id}`),

  // Regenerate AI summary
  regenerateSummary: (id) => api.post(`/meeting-summary/${id}/regenerate`),

  // Publish to Logos CRM
  publishToCRM: (id) => api.post(`/meeting-summary/${id}/publish-crm`)
}

// ========================================
// PROJECTS API
// ========================================
export const projectsApi = {
  // Create project
  create: (data) => api.post('/projects', data),

  // List projects
  list: (params = {}) => api.get('/projects', { params }),

  // Get project by ID
  get: (id) => api.get(`/projects/${id}`),

  // Update project
  update: (id, data) => api.put(`/projects/${id}`, data),

  // Delete project
  delete: (id) => api.delete(`/projects/${id}`),

  // Create from CRM deal
  createFromDeal: (data) => api.post('/projects/from-deal', data),

  // Get project stats
  getStats: (id) => api.get(`/projects/${id}/stats`)
}

// ========================================
// TASKS API
// ========================================
export const tasksApi = {
  // Create task
  create: (data) => api.post('/tasks', data),

  // List tasks
  list: (params = {}) => api.get('/tasks', { params }),

  // Get task by ID
  get: (id) => api.get(`/tasks/${id}`),

  // Update task
  update: (id, data) => api.put(`/tasks/${id}`, data),

  // Delete task
  delete: (id) => api.delete(`/tasks/${id}`),

  // Mark complete
  complete: (id) => api.post(`/tasks/${id}/complete`),

  // Reopen task
  reopen: (id) => api.post(`/tasks/${id}/reopen`),

  // Assign task
  assign: (id, assignedTo) => api.put(`/tasks/${id}/assign`, { assignedTo }),

  // Bulk create
  bulkCreate: (tasks, projectId) => api.post('/tasks/bulk', { tasks, projectId }),

  // Bulk update status
  bulkUpdateStatus: (taskIds, status) => api.put('/tasks/bulk/status', { taskIds, status })
}

// ========================================
// AUTOMATIONS API
// ========================================
export const automationsApi = {
  // Create automation
  create: (data) => api.post('/automations', data),

  // List automations
  list: (params = {}) => api.get('/automations', { params }),

  // Get templates
  getTemplates: () => api.get('/automations/templates'),

  // Get automation by ID
  get: (id) => api.get(`/automations/${id}`),

  // Update automation
  update: (id, data) => api.put(`/automations/${id}`, data),

  // Delete automation
  delete: (id) => api.delete(`/automations/${id}`),

  // Toggle enabled state
  toggle: (id, enabled) => api.post(`/automations/${id}/toggle`, { enabled }),

  // Execute automation manually
  execute: (id, triggerData) => api.post(`/automations/${id}/execute`, { triggerData }),

  // Get logs
  getLogs: (id, params = {}) => api.get(`/automations/${id}/logs`, { params }),

  // Test automation (dry-run preview)
  test: (id, sampleData = {}) => api.post(`/automations/${id}/test`, { sampleData }),

  // Get scheduler status (all scheduled automations)
  getSchedulerStatus: () => api.get('/automations/scheduler/status'),

  // Schedule/reschedule an automation
  schedule: (id) => api.post(`/automations/${id}/schedule`)
}

// ========================================
// SEARCH API
// ========================================
export const searchApi = {
  // Full text search
  search: (data) => api.post('/search', data),

  // Semantic search
  semantic: (data) => api.post('/search/semantic', data),

  // Ask question across meetings
  ask: (data) => api.post('/search/ask', data),

  // Ask question with streaming response (SSE)
  askStream: async (data, callbacks = {}) => {
    const { onChunk, onCitations, onFollowUp, onComplete, onError } = callbacks
    // Use relative URL to work with Vite proxy
    const streamUrl = API_BASE_URL ? `${API_BASE_URL}/api/search/ask/stream` : '/api/search/ask/stream'

      // Get token for streaming request
      let authHeader = ''
      if (tokenGetter) {
        try {
          const token = await tokenGetter()
          if (token) {
            authHeader = `Bearer ${token}`
          }
        } catch (error) {
          console.debug('Failed to get token for streaming request:', error.message)
        }
      }

      return fetch(streamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(data)
    }).then(response => {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      function read() {
        return reader.read().then(({ done, value }) => {
          if (done) return

          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))

                switch (data.type) {
                  case 'chunk':
                    if (onChunk) onChunk(data.content)
                    break
                  case 'citations':
                    if (onCitations) onCitations(data.citations)
                    break
                  case 'followUp':
                    if (onFollowUp) onFollowUp(data.suggestions)
                    break
                  case 'complete':
                    if (onComplete) onComplete(data)
                    break
                  case 'error':
                    if (onError) onError(new Error(data.message))
                    break
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }

          return read()
        })
      }

      return read()
    }).catch(error => {
      if (onError) onError(error)
    })
  },

  // Ask follow-up question
  askFollowUp: (data) => api.post('/search/ask/follow-up', data),

  // Get suggestions with autocomplete and trending
  getSuggestions: (prefix, includeTrending = true) => api.get('/search/suggestions', {
    params: { prefix, includeTrending: includeTrending ? 'true' : 'false' }
  }),

  // Get recent activity
  getRecent: () => api.get('/search/recent'),

  // Get search history
  getHistory: (limit = 50) => api.get('/search/history', { params: { limit } }),

  // Clear search history
  clearHistory: () => api.delete('/search/history'),

  // Save a search
  saveSearch: (data) => api.post('/search/save', data),

  // Get saved searches
  getSavedSearches: () => api.get('/search/saved'),

  // Delete saved search
  deleteSavedSearch: (id) => api.delete(`/search/saved/${id}`),

  // Get conversations
  getConversations: (limit = 20) => api.get('/search/conversations', { params: { limit } }),

  // Get conversation messages
  getConversation: (id) => api.get(`/search/conversations/${id}`),

  // Delete conversation
  deleteConversation: (id) => api.delete(`/search/conversations/${id}`),

  // Get search analytics
  getAnalytics: (period = '7d') => api.get('/search/analytics', { params: { period } }),

  // Export search results
  exportResults: async (results, format = 'csv', query = '', searchType = '') => {
    const response = await api.post('/search/export', {
      results,
      format,
      query,
      searchType
    })
    return response
  }
}

// ========================================
// DASHBOARD API (Phase 5 - Week 5)
// ========================================
export const dashboardApi = {
  // Get dashboard summary
  getSummary: () => api.get('/dashboard/summary'),

  // Get projects with stats
  getProjects: (params = {}) => api.get('/dashboard/projects', { params }),

  // Get single project dashboard
  getProject: (id) => api.get(`/dashboard/projects/${id}`),

  // Get action items
  getActionItems: (params = {}) => api.get('/dashboard/action-items', { params }),

  // Update action item status (for Kanban drag/drop)
  updateActionItemStatus: (id, status) => api.patch(`/dashboard/action-items/${id}`, { status }),

  // Get team workload
  getTeamWorkload: () => api.get('/dashboard/team-workload'),

  // Get overdue items
  getOverdue: () => api.get('/dashboard/overdue'),

  // Get AI insights
  getInsights: () => api.get('/dashboard/insights')
}

// ========================================
// REPORTS API (Phase 5 - Week 6)
// ========================================
export const reportsApi = {
  // Get available reports
  getAvailable: () => api.get('/reports/available'),

  // Download meeting recap PDF
  downloadMeetingPDF: (meetingId) => {
    return `${API_BASE_URL}/api/reports/meeting/${meetingId}/pdf`
  },

  // Download goals report PDF
  downloadGoalsPDF: (quarter) => {
    const params = quarter ? `?quarter=${quarter}` : ''
    return `${API_BASE_URL}/api/reports/goals/pdf${params}`
  },

  // Download project report PDF
  downloadProjectPDF: (projectId) => {
    return `${API_BASE_URL}/api/reports/project/${projectId}/pdf`
  },

  // Download weekly summary PDF
  downloadWeeklyPDF: () => {
    return `${API_BASE_URL}/api/reports/weekly/pdf`
  },

  // Download meetings CSV
  downloadMeetingsCSV: () => {
    return `${API_BASE_URL}/api/reports/meetings/csv`
  },

  // Download action items CSV
  downloadActionItemsCSV: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return `${API_BASE_URL}/api/reports/action-items/csv${query ? `?${query}` : ''}`
  },

  // Download goals CSV
  downloadGoalsCSV: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return `${API_BASE_URL}/api/reports/goals/csv${query ? `?${query}` : ''}`
  }
}

// ========================================
// CALENDAR API (Phase 5 - Week 7)
// ========================================
export const calendarApi = {
  // Get calendar status
  getStatus: () => api.get('/calendar/status'),

  // Get auth URL
  getAuthUrl: (returnUrl) => api.get('/calendar/auth', { params: { returnUrl } }),

  // Disconnect calendar
  disconnect: () => api.post('/calendar/disconnect'),

  // Get user's calendars
  getCalendars: () => api.get('/calendar/calendars'),

  // Get events
  getEvents: (params = {}) => api.get('/calendar/events', { params }),

  // Create event
  createEvent: (data) => api.post('/calendar/events', data),

  // Update event
  updateEvent: (eventId, data) => api.patch(`/calendar/events/${eventId}`, data),

  // Delete event
  deleteEvent: (eventId, calendarId) =>
    api.delete(`/calendar/events/${eventId}`, { params: { calendarId } }),

  // Sync action item to calendar
  syncActionItem: (id, calendarId) =>
    api.post(`/calendar/sync/action-item/${id}`, { calendarId }),

  // Sync all action items
  syncAllActionItems: (calendarId, meetingId) =>
    api.post('/calendar/sync/action-items', { calendarId, meetingId }),

  // Sync goal to calendar
  syncGoal: (id, calendarId) =>
    api.post(`/calendar/sync/goal/${id}`, { calendarId }),

  // Sync meeting to calendar
  syncMeeting: (id, calendarId) =>
    api.post(`/calendar/sync/meeting/${id}`, { calendarId }),

  // Get upcoming items (combined view)
  getUpcoming: (days = 14) => api.get('/calendar/upcoming', { params: { days } })
}

// ========================================
// INTEGRATIONS API
// ========================================
export const integrationsApi = {
  // Get status
  getStatus: () => api.get('/integrations/status'),

  // Get logs
  getLogs: (params = {}) => api.get('/integrations/logs', { params }),

  // Retry failed
  retry: (logIds) => api.post('/integrations/retry', { logIds }),

  // CRM
  crm: {
    syncActionItems: (actionItemIds, syncAll) =>
      api.post('/integrations/crm/sync-action-items', { actionItemIds, syncAll }),
    createDeal: (data) => api.post('/integrations/crm/create-deal', data),
    getDeals: (params) => api.get('/integrations/crm/deals', { params })
  },

  // Chat
  chat: {
    postRecap: (meetingId, channelId) =>
      api.post('/integrations/chat/post-recap', { meetingId, channelId }),
    sendMessage: (channelId, message) =>
      api.post('/integrations/chat/send-message', { channelId, message }),
    getChannels: () => api.get('/integrations/chat/channels'),
    test: () => api.post('/integrations/chat/test'),
    getStatus: () => api.get('/integrations/chat/status')
  }
}

// ========================================
// AI AGENTS API (Phase 5 - Week 7)
// ========================================
export const agentsApi = {
  // List all agents
  list: (params = {}) => api.get('/agents', { params }),

  // Get agent templates
  getTemplates: () => api.get('/agents/templates'),

  // Get available built-in agents (assignment, priority, deadline)
  getAvailable: () => api.get('/agents/available'),

  // Create agent
  create: (data) => api.post('/agents', data),

  // Create from template
  createFromTemplate: (templateId, customizations = {}) =>
    api.post('/agents/from-template', { templateId, customizations }),

  // Get agent by ID
  get: (id) => api.get(`/agents/${id}`),

  // Update agent
  update: (id, data) => api.put(`/agents/${id}`, data),

  // Delete agent
  delete: (id) => api.delete(`/agents/${id}`),

  // Toggle enabled state
  toggle: (id) => api.post(`/agents/${id}/toggle`),

  // Execute agent manually
  execute: (id, triggerType, triggerData = {}) =>
    api.post(`/agents/${id}/execute`, { trigger_type: triggerType, trigger_data: triggerData }),

  // Get agent execution logs
  getLogs: (id, limit = 50) => api.get(`/agents/${id}/logs`, { params: { limit } }),

  // Get agent stats
  getStats: (id) => api.get(`/agents/${id}/stats`),

  // Provide feedback on execution
  provideFeedback: (executionId, rating, notes = '') =>
    api.post(`/agents/executions/${executionId}/feedback`, { rating, notes }),

  // Get explanation for an agent execution
  getExplanation: (executionId) =>
    api.get(`/agents/executions/${executionId}/explanation`),

  // Trigger all matching agents
  trigger: (triggerType, data = {}) =>
    api.post('/agents/trigger', { trigger_type: triggerType, data }),

  // Run a specific built-in agent
  runAgent: (agentName, context) =>
    api.post(`/agents/run/${agentName}`, context),

  // Orchestrate multiple agents
  orchestrate: (agents, context, parallel = false) =>
    api.post('/agents/orchestrate', { agents, context, parallel }),

  // Process meeting with agents
  processMeeting: (meeting, actionItems) =>
    api.post('/agents/process-meeting', { meeting, actionItems }),

  // Apply agent suggestions
  applySuggestions: (actionItemId, suggestions, options = {}) =>
    api.post('/agents/apply-suggestions', { actionItemId, suggestions, options }),

  // Get orchestrator logs
  getOrchestratorLogs: (limit = 20) =>
    api.get('/agents/orchestrator/logs', { params: { limit } })
}

// ========================================
// TEMPLATES API (Workflow Templates - CRM, etc.)
// ========================================
export const templatesApi = {
  // List all templates with optional filtering
  list: (params = {}) => api.get('/templates', { params }),

  // Get template categories
  getCategories: () => api.get('/templates/categories'),

  // Get template by ID
  get: (id) => api.get(`/templates/${id}`),

  // Get template preview
  getPreview: (id) => api.get(`/templates/${id}/preview`),

  // Import template as new workflow
  import: (id, data = {}) => api.post(`/templates/${id}/import`, data),

  // Duplicate template (for customization)
  duplicate: (id, data = {}) => api.post(`/templates/${id}/duplicate`, data),

  // Get popular templates
  getPopular: (limit = 5) => api.get('/templates/stats/popular', { params: { limit } })
}

// ========================================
// WORKFLOWS API (v2 - Node-based)
// ========================================
export const workflowsApi = {
  // List workflows
  list: (params = {}) => api.get('/workflows', { params }),

  // Get workflow by ID
  get: (id) => api.get(`/workflows/${id}`),

  // Create workflow
  create: (data) => api.post('/workflows', data),

  // Update workflow
  update: (id, data) => api.put(`/workflows/${id}`, data),

  // Delete workflow
  delete: (id) => api.delete(`/workflows/${id}`),

  // Execute workflow
  execute: (id, inputData = {}, mode = 'production') =>
    api.post(`/workflows/${id}/execute`, { inputData, mode }),

  // Test workflow (dry run)
  test: (id, inputData = {}) =>
    api.post(`/workflows/${id}/test`, { inputData }),

  // Toggle workflow active state
  toggle: (id, active) =>
    api.post(`/workflows/${id}/toggle`, { active }),

  // Get workflow versions
  getVersions: (id, limit = 20) =>
    api.get(`/workflows/${id}/versions`, { params: { limit } }),

  // Get specific version
  getVersion: (id, version) =>
    api.get(`/workflows/${id}/versions/${version}`),

  // Restore version
  restoreVersion: (id, version) =>
    api.post(`/workflows/${id}/versions/${version}/restore`),

  // Get executions
  getExecutions: (id, params = {}) =>
    api.get(`/workflows/${id}/executions`, { params }),

  // Get specific execution
  getExecution: (workflowId, executionId) =>
    api.get(`/workflows/${workflowId}/executions/${executionId}`),

  // Get available node types
  getNodeTypes: () => api.get('/workflows/nodes/types'),

  // Get node schema
  getNodeSchema: (type) => api.get(`/workflows/nodes/${type}/schema`),

  // Pin node data (for development)
  pinNodeData: (workflowId, nodeId, data) =>
    api.post(`/workflows/${workflowId}/nodes/${nodeId}/pin`, { data }),

  // Unpin node data
  unpinNodeData: (workflowId, nodeId) =>
    api.delete(`/workflows/${workflowId}/nodes/${nodeId}/pin`),

  // Get templates
  getTemplates: () => api.get('/workflows/templates')
}

// ========================================
// EXPLAINABILITY API (AI Decision Transparency)
// ========================================
export const explainabilityApi = {
  // Create explanation
  createExplanation: (data) => api.post('/explainability/explanations', data),

  // Get explanation by execution ID
  getExplanation: (executionId) => api.get(`/explainability/explanations/${executionId}`),

  // Get recent explanations
  getRecentExplanations: (agentType = null, limit = 10) =>
    api.get('/explainability/explanations/recent', { params: { agentType, limit } }),

  // Get explanation statistics
  getStats: (days = 30) => api.get('/explainability/stats', { params: { days } }),

  // Generate natural language summary
  generateSummary: (executionId) =>
    api.post(`/explainability/explanations/${executionId}/summary`)
}

// ========================================
// LEARNING API (Agent Feedback & Pattern Detection)
// ========================================
export const learningApi = {
  // Capture user override with feedback
  captureOverride: (data) => api.post('/learning/feedback/override', data),

  // Check if user wants feedback prompts
  shouldPromptForFeedback: (agentType) =>
    api.get('/learning/feedback/should-prompt', { params: { agentType } }),

  // Set feedback preference
  setFeedbackPreference: (agentType, enabled) =>
    api.put('/learning/feedback/preference', { agentType, enabled }),

  // Get recent overrides
  getRecentOverrides: (agentType = null, limit = 10) =>
    api.get('/learning/overrides/recent', { params: { agentType, limit } }),

  // Get override statistics
  getOverrideStats: (days = 30) =>
    api.get('/learning/overrides/stats', { params: { days } }),

  // Get learning patterns
  getPatterns: (status = null, agentType = null) =>
    api.get('/learning/patterns', { params: { status, agentType } }),

  // Approve pattern
  approvePattern: (patternId, customization = null) =>
    api.post(`/learning/patterns/${patternId}/approve`, { customization }),

  // Reject pattern
  rejectPattern: (patternId, reason = null) =>
    api.post(`/learning/patterns/${patternId}/reject`, { reason }),

  // Deactivate pattern
  deactivatePattern: (patternId) =>
    api.post(`/learning/patterns/${patternId}/deactivate`),

  // Get learning report
  getReport: (period = 'month') =>
    api.get('/learning/report', { params: { period } }),

  // Track outcome for an override
  trackOutcome: (overrideId, outcome) =>
    api.post(`/learning/outcomes/${overrideId}`, outcome),

  // Get comprehensive effectiveness report
  getEffectivenessReport: (days = 30) =>
    api.get('/learning/effectiveness-report', { params: { days } }),

  // Get pattern validation metrics
  getPatternValidation: (patternId) =>
    api.get(`/learning/patterns/${patternId}/validation`)
}

// ========================================
// INTELLIGENCE API (Enhanced Intelligence Dashboard)
// ========================================
export const intelligenceApi = {
  // Get comprehensive dashboard intelligence
  getDashboard: (options = {}) => api.get('/intelligence/dashboard', { params: options }),

  // Get meeting prep for specific meeting
  getMeetingPrep: (meetingId) => api.get(`/intelligence/meeting-prep/${meetingId}`),

  // Generate meeting brief (AI)
  generateMeetingBrief: (meetingId) => api.post(`/intelligence/meeting-prep/${meetingId}/brief`),

  // Get deal risk analysis
  getDealRisks: (options = {}) => api.get('/intelligence/deal-risks', { params: options }),

  // Get action item status
  getActionItems: () => api.get('/intelligence/action-items'),

  // Send nudge for action item
  sendNudge: (itemId, channel = 'in_app') =>
    api.post(`/intelligence/action-items/${itemId}/nudge`, { channel }),

  // Get relationship insights for deal
  getRelationships: (dealId) => api.get(`/intelligence/relationships/${dealId}`)
}

// Create default export with all APIs
const apiClient = {
  // Base axios instance
  ...api,

  // API modules
  meetings: meetingsApi,
  projects: projectsApi,
  tasks: tasksApi,
  automations: automationsApi,
  search: searchApi,
  dashboard: dashboardApi,
  reports: reportsApi,
  calendar: calendarApi,
  integrations: integrationsApi,
  agents: agentsApi,
  templates: templatesApi,
  workflows: workflowsApi,
  explainability: explainabilityApi,
  learning: learningApi,
  intelligence: intelligenceApi
}

export default apiClient
