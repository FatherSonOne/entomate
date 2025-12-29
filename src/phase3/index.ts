/**
 * Phase 3: Enterprise & Intelligence Layer
 *
 * This module exports all Phase 3 services, hooks, and types for:
 * - Real-time Coaching
 * - Customer Sentiment Analysis
 * - Customer Health Scoring
 * - Customer Alerts
 * - RBAC (Role-Based Access Control)
 * - Audit Logging
 * - Webhooks
 * - Integrations
 */

// Export all types
export * from './types'

// Export services
export * as sentimentService from './sentimentService'
export * as healthService from './healthService'
export * as alertsService from './alertsService'
export * as coachingService from './coachingService'
export * as rbacService from './rbacService'
export * as auditService from './auditService'
export * as webhookService from './webhookService'
export * as integrationsService from './integrationsService'

// Export hooks
export {
  // Sentiment hooks
  useSentimentAnalysis,
  useCustomerSentiment,

  // Health hooks
  useCustomerHealth,
  useHealthDistribution,
  useCustomersNeedingAttention,

  // Alert hooks
  useCustomerAlerts,
  useActiveAlerts,
  useAlertStatistics,

  // Coaching hooks
  useCoachingSession,
  useCoachingStats,

  // RBAC hooks
  usePermission,
  useUserRoles,
  useAllRoles,

  // Audit hooks
  useAuditLogs,

  // Webhook hooks
  useWebhooks,
  useWebhookDeliveries,

  // Integration hooks
  useIntegrations,
  useIntegration,

  // Real-time hooks
  useRealtimeAlerts,
  useRealtimeHealth
} from './hooks'

// Export components
export {
  CustomerHealthDashboard,
  CustomerAlertsPanel,
  SentimentAnalysisCard,
  CoachingPanel,
  RolesManagement,
  AuditLogViewer,
  WebhooksManagement,
  IntegrationsManagement
} from './components'
