/**
 * Phase 3 React Hooks
 *
 * Custom hooks for consuming Phase 3 services in React components
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Import services
import * as sentimentService from './sentimentService'
import * as healthService from './healthService'
import * as alertsService from './alertsService'
import * as coachingService from './coachingService'
import * as rbacService from './rbacService'
import * as auditService from './auditService'
import * as webhookService from './webhookService'
import * as integrationsService from './integrationsService'

// Import types
import type {
  CustomerSentiment,
  SentimentAnalysisResult,
  CustomerHealth,
  HealthDistribution,
  CustomerNeedingAttention,
  CustomerAlert,
  AlertStatistics,
  AlertStatus,
  CoachingSession,
  CoachingPrompt,
  CoachingContext,
  CoachingStats,
  Role,
  UserWithRoles,
  AuditLog,
  AuditQueryParams,
  Webhook,
  WebhookDelivery,
  Integration,
  IntegrationType
} from './types'

// ============================================================================
// SENTIMENT HOOKS
// ============================================================================

/**
 * Hook for analyzing sentiment
 */
export function useSentimentAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<SentimentAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async (text: string) => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const analysisResult = await sentimentService.analyzeSentiment(text)
      setResult(analysisResult)
      return analysisResult
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      return null
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  return { analyze, result, isAnalyzing, error }
}

/**
 * Hook for customer sentiment history
 */
export function useCustomerSentiment(customerId: string | null) {
  const [sentiments, setSentiments] = useState<CustomerSentiment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSentiments = useCallback(async () => {
    if (!customerId) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await sentimentService.getCustomerSentimentHistory(customerId)
      if (result.success && result.data) {
        setSentiments(result.data)
      } else {
        setError(result.error || 'Failed to fetch sentiments')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sentiments')
    } finally {
      setIsLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    fetchSentiments()
  }, [fetchSentiments])

  return { sentiments, isLoading, error, refetch: fetchSentiments }
}

// ============================================================================
// HEALTH HOOKS
// ============================================================================

/**
 * Hook for customer health
 */
export function useCustomerHealth(customerId: string | null) {
  const [health, setHealth] = useState<CustomerHealth | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = useCallback(async () => {
    if (!customerId) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await healthService.getCustomerHealth(customerId)
      if (result.success) {
        setHealth(result.data || null)
      } else {
        setError(result.error || 'Failed to fetch health')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health')
    } finally {
      setIsLoading(false)
    }
  }, [customerId])

  const refresh = useCallback(async () => {
    if (!customerId) return
    setIsLoading(true)
    try {
      const result = await healthService.updateCustomerHealth(customerId)
      if (result.success && result.data) {
        setHealth(result.data)
      }
    } finally {
      setIsLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  return { health, isLoading, error, refetch: fetchHealth, refresh }
}

/**
 * Hook for health distribution
 */
export function useHealthDistribution() {
  const [distribution, setDistribution] = useState<HealthDistribution | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDistribution = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await healthService.getHealthDistribution()
      if (result.success && result.data) {
        setDistribution(result.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch distribution')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDistribution()
  }, [fetchDistribution])

  return { distribution, isLoading, error, refetch: fetchDistribution }
}

/**
 * Hook for customers needing attention
 */
export function useCustomersNeedingAttention(limit: number = 20) {
  const [customers, setCustomers] = useState<CustomerNeedingAttention[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await healthService.getCustomersNeedingAttention(limit)
      if (result.success && result.data) {
        setCustomers(result.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch customers')
    } finally {
      setIsLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  return { customers, isLoading, error, refetch: fetchCustomers }
}

// ============================================================================
// ALERTS HOOKS
// ============================================================================

/**
 * Hook for customer alerts
 */
export function useCustomerAlerts(customerId: string | null, status?: AlertStatus) {
  const [alerts, setAlerts] = useState<CustomerAlert[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    if (!customerId) return
    setIsLoading(true)
    try {
      const result = await alertsService.getCustomerAlerts(customerId, status)
      if (result.success && result.data) {
        setAlerts(result.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
    } finally {
      setIsLoading(false)
    }
  }, [customerId, status])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  return { alerts, isLoading, error, refetch: fetchAlerts }
}

/**
 * Hook for active alerts
 */
export function useActiveAlerts(limit: number = 50) {
  const [alerts, setAlerts] = useState<CustomerAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await alertsService.getActiveAlerts({ limit })
      if (result.success && result.data) {
        setAlerts(result.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
    } finally {
      setIsLoading(false)
    }
  }, [limit])

  const acknowledgeAlert = useCallback(async (alertId: string, userId: string) => {
    const result = await alertsService.acknowledgeAlert(alertId, userId)
    if (result.success) {
      fetchAlerts()
    }
    return result
  }, [fetchAlerts])

  const resolveAlert = useCallback(async (alertId: string, userId: string, resolution: string) => {
    const result = await alertsService.resolveAlert(alertId, userId, resolution)
    if (result.success) {
      fetchAlerts()
    }
    return result
  }, [fetchAlerts])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  return { alerts, isLoading, error, refetch: fetchAlerts, acknowledgeAlert, resolveAlert }
}

/**
 * Hook for alert statistics
 */
export function useAlertStatistics() {
  const [stats, setStats] = useState<AlertStatistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const result = await alertsService.getAlertStatistics()
      if (result.success && result.data) {
        setStats(result.data)
      }
      setIsLoading(false)
    }
    fetchStats()
  }, [])

  return { stats, isLoading }
}

// ============================================================================
// COACHING HOOKS
// ============================================================================

/**
 * Hook for coaching session
 */
export function useCoachingSession(meetingId: string | null, userId: string | null) {
  const [session, setSession] = useState<CoachingSession | null>(null)
  const [prompts, setPrompts] = useState<CoachingPrompt[]>([])
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startSession = useCallback(async () => {
    if (!meetingId || !userId) return null
    try {
      const result = await coachingService.startCoachingSession(meetingId, userId)
      if (result.success && result.data) {
        setSession(result.data)
        setIsActive(true)
        return result.data
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
    }
    return null
  }, [meetingId, userId])

  const endSession = useCallback(async () => {
    if (!session) return
    try {
      await coachingService.endCoachingSession(session.id)
      setIsActive(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session')
    }
  }, [session])

  const markPromptUsed = useCallback(async (promptId: string) => {
    const result = await coachingService.markPromptUsed(promptId)
    if (result.success) {
      setPrompts(prev => prev.map(p =>
        p.id === promptId ? { ...p, usedAt: new Date().toISOString() } : p
      ))
    }
  }, [])

  const dismissPrompt = useCallback(async (promptId: string) => {
    const result = await coachingService.dismissPrompt(promptId)
    if (result.success) {
      setPrompts(prev => prev.map(p =>
        p.id === promptId ? { ...p, dismissedAt: new Date().toISOString() } : p
      ))
    }
  }, [])

  // Load existing session on mount
  useEffect(() => {
    const loadSession = async () => {
      if (!meetingId || !userId) return
      const result = await coachingService.getActiveSession(meetingId, userId)
      if (result.success && result.data) {
        setSession(result.data)
        setIsActive(true)
        // Load prompts
        const promptsResult = await coachingService.getSessionPrompts(result.data.id)
        if (promptsResult.success && promptsResult.data) {
          setPrompts(promptsResult.data)
        }
      }
    }
    loadSession()
  }, [meetingId, userId])

  return {
    session,
    prompts,
    isActive,
    error,
    startSession,
    endSession,
    markPromptUsed,
    dismissPrompt
  }
}

/**
 * Hook for coaching stats
 */
export function useCoachingStats(userId: string | null, days: number = 30) {
  const [stats, setStats] = useState<CoachingStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) return
      const result = await coachingService.getCoachingStats(userId, days)
      if (result.success && result.data) {
        setStats(result.data)
      }
      setIsLoading(false)
    }
    fetchStats()
  }, [userId, days])

  return { stats, isLoading }
}

// ============================================================================
// RBAC HOOKS
// ============================================================================

/**
 * Hook for permission checking
 */
export function usePermission(userId: string | null, permission: string) {
  const [hasPermission, setHasPermission] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkPermission = async () => {
      if (!userId) {
        setIsLoading(false)
        return
      }
      const result = await rbacService.hasPermission(userId, permission)
      setHasPermission(result)
      setIsLoading(false)
    }
    checkPermission()
  }, [userId, permission])

  return { hasPermission, isLoading }
}

/**
 * Hook for user roles
 */
export function useUserRoles(userId: string | null) {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRoles = async () => {
      if (!userId) {
        setIsLoading(false)
        return
      }
      const result = await rbacService.getUserWithRoles(userId)
      if (result.success && result.data) {
        setRoles(result.data.roles)
        setPermissions(result.data.permissions)
      }
      setIsLoading(false)
    }
    fetchRoles()
  }, [userId])

  return { roles, permissions, isLoading }
}

/**
 * Hook for all roles
 */
export function useAllRoles() {
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRoles = async () => {
      const result = await rbacService.getAllRoles()
      if (result.success && result.data) {
        setRoles(result.data)
      }
      setIsLoading(false)
    }
    fetchRoles()
  }, [])

  return { roles, isLoading }
}

// ============================================================================
// AUDIT HOOKS
// ============================================================================

/**
 * Hook for audit logs
 */
export function useAuditLogs(params: AuditQueryParams = {}) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await auditService.queryAuditLogs(params)
      if (result.success && result.data) {
        setLogs(result.data.data)
        setTotal(result.data.total)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setIsLoading(false)
    }
  }, [JSON.stringify(params)])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return { logs, total, isLoading, error, refetch: fetchLogs }
}

// ============================================================================
// WEBHOOK HOOKS
// ============================================================================

/**
 * Hook for webhooks
 */
export function useWebhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWebhooks = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await webhookService.getAllWebhooks()
      if (result.success && result.data) {
        setWebhooks(result.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch webhooks')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createWebhook = useCallback(async (input: Parameters<typeof webhookService.createWebhook>[0]) => {
    const result = await webhookService.createWebhook(input)
    if (result.success) {
      fetchWebhooks()
    }
    return result
  }, [fetchWebhooks])

  const deleteWebhook = useCallback(async (webhookId: string) => {
    const result = await webhookService.deleteWebhook(webhookId)
    if (result.success) {
      fetchWebhooks()
    }
    return result
  }, [fetchWebhooks])

  const testWebhook = useCallback(async (webhookId: string) => {
    return webhookService.testWebhook(webhookId)
  }, [])

  useEffect(() => {
    fetchWebhooks()
  }, [fetchWebhooks])

  return { webhooks, isLoading, error, refetch: fetchWebhooks, createWebhook, deleteWebhook, testWebhook }
}

/**
 * Hook for webhook deliveries
 */
export function useWebhookDeliveries(webhookId: string | null, limit: number = 50) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchDeliveries = async () => {
      if (!webhookId) return
      setIsLoading(true)
      const result = await webhookService.getDeliveryHistory(webhookId, limit)
      if (result.success && result.data) {
        setDeliveries(result.data)
      }
      setIsLoading(false)
    }
    fetchDeliveries()
  }, [webhookId, limit])

  return { deliveries, isLoading }
}

// ============================================================================
// INTEGRATIONS HOOKS
// ============================================================================

/**
 * Hook for integrations
 */
export function useIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await integrationsService.getAllIntegrations()
      if (result.success && result.data) {
        setIntegrations(result.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch integrations')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const connect = useCallback(async (input: Parameters<typeof integrationsService.connectIntegration>[0]) => {
    const result = await integrationsService.connectIntegration(input)
    if (result.success) {
      fetchIntegrations()
    }
    return result
  }, [fetchIntegrations])

  const disconnect = useCallback(async (integrationType: IntegrationType) => {
    const result = await integrationsService.disconnectIntegration(integrationType)
    if (result.success) {
      fetchIntegrations()
    }
    return result
  }, [fetchIntegrations])

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  return { integrations, isLoading, error, refetch: fetchIntegrations, connect, disconnect }
}

/**
 * Hook for a specific integration
 */
export function useIntegration(integrationType: IntegrationType | null) {
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchIntegration = async () => {
      if (!integrationType) return
      setIsLoading(true)
      const result = await integrationsService.getIntegration(integrationType)
      if (result.success) {
        setIntegration(result.data || null)
      }
      setIsLoading(false)
    }
    fetchIntegration()
  }, [integrationType])

  return { integration, isLoading }
}

// ============================================================================
// REAL-TIME SUBSCRIPTION HOOKS
// ============================================================================

/**
 * Hook for real-time alert updates
 */
export function useRealtimeAlerts(onNewAlert?: (alert: CustomerAlert) => void) {
  const callbackRef = useRef(onNewAlert)
  callbackRef.current = onNewAlert

  useEffect(() => {
    const channel = supabase
      .channel('customer_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'customer_alerts' },
        (payload) => {
          if (callbackRef.current && payload.new) {
            callbackRef.current(payload.new as unknown as CustomerAlert)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}

/**
 * Hook for real-time health updates
 */
export function useRealtimeHealth(customerId: string | null, onUpdate?: (health: CustomerHealth) => void) {
  const callbackRef = useRef(onUpdate)
  callbackRef.current = onUpdate

  useEffect(() => {
    if (!customerId) return

    const channel = supabase
      .channel(`customer_health_${customerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_health',
          filter: `customer_id=eq.${customerId}`
        },
        (payload) => {
          if (callbackRef.current && payload.new) {
            callbackRef.current(payload.new as unknown as CustomerHealth)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [customerId])
}
