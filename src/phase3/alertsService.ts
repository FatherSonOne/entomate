/**
 * Customer Alerts Service
 *
 * Monitors customer health and triggers alerts for:
 * - Score drops
 * - Declining trends
 * - No interaction periods
 * - Repeated negative sentiment
 * - Churn risk
 * - Engagement drops
 */

import { supabase } from "../lib/supabase"
import type {
  CustomerAlert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  AlertStatistics,
  CreateAlertInput,
  ServiceResponse
} from "./types"

// Alert thresholds
const THRESHOLDS = {
  scoreDrop: 15,
  lowScore: 40,
  criticalScore: 25,
  noInteractionDays: 14,
  repeatedNegativeCount: 3
}

// ============================================================================
// ALERT CREATION
// ============================================================================

/**
 * Create a new customer alert
 */
export async function createAlert(
  input: CreateAlertInput
): Promise<ServiceResponse<CustomerAlert>> {
  try {
    // Check for duplicate active alerts
    const { data: existing } = await supabase
      .from('customer_alerts')
      .select('id')
      .eq('customer_id', input.customerId)
      .eq('alert_type', input.alertType)
      .eq('status', 'active')
      .single()

    if (existing) {
      return {
        success: false,
        error: 'An active alert of this type already exists for this customer'
      }
    }

    const { data, error } = await supabase
      .from('customer_alerts')
      .insert({
        customer_id: input.customerId,
        alert_type: input.alertType,
        severity: input.severity,
        status: 'active',
        title: input.title,
        message: input.message,
        suggested_action: input.suggestedAction || null,
        context: input.context || {}
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapAlertFromDb(data)
    }
  } catch (error) {
    console.error('Create alert error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create alert'
    }
  }
}

/**
 * Create alert using database function
 */
export async function createAlertViaDb(
  customerId: string,
  alertType: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string,
  suggestedAction?: string,
  context?: Record<string, unknown>
): Promise<ServiceResponse<string>> {
  try {
    const { data, error } = await supabase.rpc('create_customer_alert', {
      p_customer_id: customerId,
      p_alert_type: alertType,
      p_severity: severity,
      p_title: title,
      p_message: message,
      p_suggested_action: suggestedAction || null,
      p_context: context || {}
    })

    if (error) throw error

    return {
      success: true,
      data: data
    }
  } catch (error) {
    console.error('Create alert via db error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create alert'
    }
  }
}

// ============================================================================
// ALERT MANAGEMENT
// ============================================================================

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string
): Promise<ServiceResponse<CustomerAlert>> {
  try {
    const { data, error } = await supabase.rpc('acknowledge_alert', {
      p_alert_id: alertId,
      p_user_id: userId
    })

    if (error) throw error

    // Fetch updated alert
    const { data: alert, error: fetchError } = await supabase
      .from('customer_alerts')
      .select('*')
      .eq('id', alertId)
      .single()

    if (fetchError) throw fetchError

    return {
      success: true,
      data: mapAlertFromDb(alert)
    }
  } catch (error) {
    console.error('Acknowledge alert error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acknowledge alert'
    }
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(
  alertId: string,
  userId: string,
  resolution: string
): Promise<ServiceResponse<CustomerAlert>> {
  try {
    const { data, error } = await supabase.rpc('resolve_alert', {
      p_alert_id: alertId,
      p_user_id: userId,
      p_resolution: resolution
    })

    if (error) throw error

    // Fetch updated alert
    const { data: alert, error: fetchError } = await supabase
      .from('customer_alerts')
      .select('*')
      .eq('id', alertId)
      .single()

    if (fetchError) throw fetchError

    return {
      success: true,
      data: mapAlertFromDb(alert)
    }
  } catch (error) {
    console.error('Resolve alert error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve alert'
    }
  }
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(
  alertId: string
): Promise<ServiceResponse<CustomerAlert>> {
  try {
    const { data, error } = await supabase
      .from('customer_alerts')
      .update({
        status: 'dismissed',
        updated_at: new Date().toISOString()
      })
      .eq('id', alertId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapAlertFromDb(data)
    }
  } catch (error) {
    console.error('Dismiss alert error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to dismiss alert'
    }
  }
}

// ============================================================================
// ALERT QUERIES
// ============================================================================

/**
 * Get alert by ID
 */
export async function getAlert(
  alertId: string
): Promise<ServiceResponse<CustomerAlert | null>> {
  try {
    const { data, error } = await supabase
      .from('customer_alerts')
      .select('*')
      .eq('id', alertId)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return {
      success: true,
      data: data ? mapAlertFromDb(data) : null
    }
  } catch (error) {
    console.error('Get alert error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get alert'
    }
  }
}

/**
 * Get alerts for a customer
 */
export async function getCustomerAlerts(
  customerId: string,
  status?: AlertStatus
): Promise<ServiceResponse<CustomerAlert[]>> {
  try {
    let query = supabase
      .from('customer_alerts')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return {
      success: true,
      data: data.map(mapAlertFromDb)
    }
  } catch (error) {
    console.error('Get customer alerts error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get customer alerts'
    }
  }
}

/**
 * Get all active alerts
 */
export async function getActiveAlerts(
  options: {
    severity?: AlertSeverity
    type?: AlertType
    limit?: number
  } = {}
): Promise<ServiceResponse<CustomerAlert[]>> {
  try {
    let query = supabase
      .from('customer_alerts')
      .select('*')
      .eq('status', 'active')
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })

    if (options.severity) {
      query = query.eq('severity', options.severity)
    }
    if (options.type) {
      query = query.eq('alert_type', options.type)
    }
    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) throw error

    return {
      success: true,
      data: data.map(mapAlertFromDb)
    }
  } catch (error) {
    console.error('Get active alerts error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get active alerts'
    }
  }
}

/**
 * Get alerts by type
 */
export async function getAlertsByType(
  alertType: AlertType,
  limit: number = 50
): Promise<ServiceResponse<CustomerAlert[]>> {
  try {
    const { data, error } = await supabase.rpc('get_alerts_by_type', {
      p_alert_type: alertType,
      p_limit: limit
    })

    if (error) throw error

    return {
      success: true,
      data: data.map(mapAlertFromDb)
    }
  } catch (error) {
    console.error('Get alerts by type error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get alerts by type'
    }
  }
}

/**
 * Get alert statistics
 */
export async function getAlertStatistics(): Promise<ServiceResponse<AlertStatistics>> {
  try {
    const { data, error } = await supabase.rpc('get_alert_statistics')

    if (error) throw error

    return {
      success: true,
      data: {
        totalActive: data?.total_active || 0,
        totalAcknowledged: data?.total_acknowledged || 0,
        totalResolved: data?.total_resolved || 0,
        bySeverity: {
          info: data?.info_count || 0,
          warning: data?.warning_count || 0,
          critical: data?.critical_count || 0
        },
        byType: data?.by_type || {}
      }
    }
  } catch (error) {
    console.error('Get alert statistics error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get alert statistics'
    }
  }
}

// ============================================================================
// ALERT EVALUATION
// ============================================================================

/**
 * Evaluate alerts for a specific customer
 */
export async function evaluateCustomerAlerts(
  customerId: string
): Promise<ServiceResponse<{ alertsCreated: number }>> {
  try {
    const { data, error } = await supabase.rpc('evaluate_customer_alerts', {
      p_customer_id: customerId
    })

    if (error) throw error

    return {
      success: true,
      data: { alertsCreated: data || 0 }
    }
  } catch (error) {
    console.error('Evaluate customer alerts error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to evaluate alerts'
    }
  }
}

/**
 * Evaluate alerts for all customers (batch job)
 */
export async function evaluateAllCustomerAlerts(): Promise<ServiceResponse<{ alertsCreated: number }>> {
  try {
    const { data, error } = await supabase.rpc('evaluate_all_customer_alerts')

    if (error) throw error

    return {
      success: true,
      data: { alertsCreated: data || 0 }
    }
  } catch (error) {
    console.error('Evaluate all customer alerts error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to evaluate all alerts'
    }
  }
}

/**
 * Check and create alerts based on health data (manual evaluation)
 */
export async function checkHealthAlerts(
  customerId: string,
  currentScore: number,
  previousScore: number,
  sentimentTrend: string,
  daysSinceInteraction: number | null
): Promise<ServiceResponse<CustomerAlert[]>> {
  const createdAlerts: CustomerAlert[] = []

  try {
    // Check for score drop
    if (previousScore - currentScore >= THRESHOLDS.scoreDrop) {
      const result = await createAlert({
        customerId,
        alertType: 'score_drop',
        severity: currentScore < THRESHOLDS.criticalScore ? 'critical' : 'warning',
        title: 'Health Score Drop Detected',
        message: `Health score dropped by ${previousScore - currentScore} points (${previousScore} → ${currentScore})`,
        suggestedAction: 'Review recent interactions and reach out to customer',
        context: { previousScore, currentScore, drop: previousScore - currentScore }
      })
      if (result.success && result.data) {
        createdAlerts.push(result.data)
      }
    }

    // Check for critical score
    if (currentScore < THRESHOLDS.criticalScore) {
      const result = await createAlert({
        customerId,
        alertType: 'churn_risk',
        severity: 'critical',
        title: 'High Churn Risk',
        message: `Customer health score is critically low at ${currentScore}`,
        suggestedAction: 'Immediate executive outreach recommended',
        context: { currentScore }
      })
      if (result.success && result.data) {
        createdAlerts.push(result.data)
      }
    }

    // Check for declining trend
    if (sentimentTrend === 'declining') {
      const result = await createAlert({
        customerId,
        alertType: 'declining_trend',
        severity: 'warning',
        title: 'Declining Sentiment Trend',
        message: 'Customer sentiment has been declining over recent interactions',
        suggestedAction: 'Schedule a check-in call to understand concerns',
        context: { sentimentTrend }
      })
      if (result.success && result.data) {
        createdAlerts.push(result.data)
      }
    }

    // Check for no interaction
    if (daysSinceInteraction && daysSinceInteraction >= THRESHOLDS.noInteractionDays) {
      const result = await createAlert({
        customerId,
        alertType: 'no_interaction',
        severity: daysSinceInteraction >= 30 ? 'critical' : 'warning',
        title: 'No Recent Interaction',
        message: `No interaction with customer in ${daysSinceInteraction} days`,
        suggestedAction: 'Schedule a touchpoint call or send check-in email',
        context: { daysSinceInteraction }
      })
      if (result.success && result.data) {
        createdAlerts.push(result.data)
      }
    }

    return {
      success: true,
      data: createdAlerts
    }
  } catch (error) {
    console.error('Check health alerts error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check health alerts'
    }
  }
}

/**
 * Check for repeated negative sentiment
 */
export async function checkRepeatedNegativeSentiment(
  customerId: string
): Promise<ServiceResponse<CustomerAlert | null>> {
  try {
    // Get recent sentiment records
    const { data: sentiments, error } = await supabase
      .from('customer_sentiment')
      .select('sentiment_label')
      .eq('customer_id', customerId)
      .order('analyzed_at', { ascending: false })
      .limit(THRESHOLDS.repeatedNegativeCount)

    if (error) throw error

    // Check if all recent sentiments are negative
    if (sentiments && sentiments.length >= THRESHOLDS.repeatedNegativeCount) {
      const allNegative = sentiments.every(s => s.sentiment_label === 'negative')

      if (allNegative) {
        const result = await createAlert({
          customerId,
          alertType: 'repeated_negative',
          severity: 'critical',
          title: 'Repeated Negative Sentiment',
          message: `Last ${THRESHOLDS.repeatedNegativeCount} interactions have negative sentiment`,
          suggestedAction: 'Urgent attention needed - customer is consistently unhappy',
          context: { negativeCount: THRESHOLDS.repeatedNegativeCount }
        })

        if (result.success && result.data) {
          return { success: true, data: result.data }
        }
      }
    }

    return { success: true, data: null }
  } catch (error) {
    console.error('Check repeated negative sentiment error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check repeated negative sentiment'
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapAlertFromDb(row: Record<string, unknown>): CustomerAlert {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    alertType: row.alert_type as AlertType,
    severity: row.severity as AlertSeverity,
    status: row.status as AlertStatus,
    title: row.title as string,
    message: row.message as string,
    suggestedAction: row.suggested_action as string | null,
    context: (row.context || {}) as Record<string, unknown>,
    acknowledgedBy: row.acknowledged_by as string | null,
    acknowledgedAt: row.acknowledged_at as string | null,
    resolvedBy: row.resolved_by as string | null,
    resolvedAt: row.resolved_at as string | null,
    resolution: row.resolution as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}
