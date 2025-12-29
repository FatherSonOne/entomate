/**
 * Customer Health Service
 *
 * Calculates and tracks customer health scores based on:
 * - Sentiment (30%)
 * - Engagement (25%)
 * - Responsiveness (15%)
 * - Deal Progress (15%)
 * - Task Completion (15%)
 */

import { supabase } from "../lib/supabase"
import { getAverageSentiment, getSentimentTrend } from "./sentimentService"
import type {
  CustomerHealth,
  CustomerHealthHistory,
  HealthDistribution,
  HealthFactors,
  HealthLabel,
  CustomerNeedingAttention,
  SentimentTrendLabel,
  ServiceResponse,
  HEALTH_WEIGHTS
} from "./types"

// Health score weights
const WEIGHTS = {
  sentiment: 0.30,
  engagement: 0.25,
  responsiveness: 0.15,
  dealProgress: 0.15,
  taskCompletion: 0.15
}

// ============================================================================
// HEALTH SCORE CALCULATION
// ============================================================================

/**
 * Calculate health score for a customer
 */
export async function calculateHealthScore(
  customerId: string
): Promise<ServiceResponse<{ score: number; factors: HealthFactors; trend: SentimentTrendLabel }>> {
  try {
    // Get all factor scores in parallel
    const [
      sentimentResult,
      engagementScore,
      responsivenessScore,
      dealProgressScore,
      taskCompletionScore,
      trendResult
    ] = await Promise.all([
      getAverageSentiment(customerId, 30),
      calculateEngagementScore(customerId),
      calculateResponsivenessScore(customerId),
      calculateDealProgressScore(customerId),
      calculateTaskCompletionScore(customerId),
      getSentimentTrend(customerId, 4, 7)
    ])

    // Convert sentiment score from [-1, 1] to [0, 100]
    const sentimentScore = sentimentResult.success && sentimentResult.data
      ? ((sentimentResult.data.average + 1) / 2) * 100
      : 50

    const factors: HealthFactors = {
      sentimentScore,
      engagementScore,
      responsivenessScore,
      dealProgressScore,
      taskCompletionScore
    }

    // Calculate weighted score
    const score = Math.round(
      factors.sentimentScore * WEIGHTS.sentiment +
      factors.engagementScore * WEIGHTS.engagement +
      factors.responsivenessScore * WEIGHTS.responsiveness +
      factors.dealProgressScore * WEIGHTS.dealProgress +
      factors.taskCompletionScore * WEIGHTS.taskCompletion
    )

    // Determine trend from sentiment analysis
    let trend: SentimentTrendLabel = 'stable'
    if (trendResult.success && trendResult.data && trendResult.data.length >= 2) {
      const recent = trendResult.data[trendResult.data.length - 1]
      trend = recent.trend
    }

    return {
      success: true,
      data: { score, factors, trend }
    }
  } catch (error) {
    console.error('Calculate health score error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate health score'
    }
  }
}

/**
 * Calculate engagement score based on interaction frequency
 */
async function calculateEngagementScore(customerId: string): Promise<number> {
  try {
    // Count meetings in last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // First, get meeting IDs through entity relationships
    const { data: meetingRelations } = await supabase
      .from('entity_relationships')
      .select('target_id')
      .eq('source_id', customerId)
      .eq('source_type', 'contact')
      .eq('target_type', 'meeting')

    if (!meetingRelations || meetingRelations.length === 0) {
      // Fallback: check if customer_id field exists on meetings
      const { count: meetingCount } = await supabase
        .from('entomate_meetings')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .gte('created_at', thirtyDaysAgo.toISOString())

      return meetingCount || 0
    }

    // Count meetings from relationships in last 30 days
    const meetingIds = meetingRelations.map(r => r.target_id)
    const { count: meetingCount } = await supabase
      .from('entomate_meetings')
      .select('*', { count: 'exact', head: true })
      .in('id', meetingIds)
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Score based on meeting frequency
    // 0 meetings = 20, 1-2 = 50, 3-4 = 70, 5+ = 100
    const meetings = meetingCount || 0
    if (meetings === 0) return 20
    if (meetings <= 2) return 50
    if (meetings <= 4) return 70
    return 100
  } catch (error) {
    console.error('Calculate engagement score error:', error)
    return 50 // Default to neutral
  }
}

/**
 * Calculate responsiveness score based on response times
 */
async function calculateResponsivenessScore(customerId: string): Promise<number> {
  // For now, return a default score
  // This can be enhanced later with actual response time tracking
  return 70
}

/**
 * Calculate deal progress score
 */
async function calculateDealProgressScore(customerId: string): Promise<number> {
  try {
    // Check if there's an associated deal and its stage
    const { data: relationships } = await supabase
      .from('entity_relationships')
      .select('target_id')
      .eq('source_id', customerId)
      .eq('source_type', 'contact')
      .eq('target_type', 'deal')
      .limit(1)

    if (!relationships || relationships.length === 0) {
      return 50 // No deal associated
    }

    // For now, return based on deal existence
    // Can be enhanced to check deal stage progression
    return 70
  } catch (error) {
    console.error('Calculate deal progress score error:', error)
    return 50
  }
}

/**
 * Calculate task completion score
 */
async function calculateTaskCompletionScore(customerId: string): Promise<number> {
  try {
    // Get tasks related to this customer through entity relationships
    const { data: taskRelations } = await supabase
      .from('entity_relationships')
      .select('target_id')
      .eq('source_id', customerId)
      .eq('source_type', 'contact')
      .eq('target_type', 'task')

    if (!taskRelations || taskRelations.length === 0) {
      // Fallback: check if contact_id/customer_id field exists on tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('contact_id', customerId)

      if (!tasks || tasks.length === 0) {
        return 70 // No tasks to complete
      }

      const completed = tasks.filter(t => t.status === 'completed' || t.status === 'done').length
      const total = tasks.length
      const rate = (completed / total) * 100
      return Math.round(rate)
    }

    // Get tasks by IDs from relationships
    const taskIds = taskRelations.map(r => r.target_id)
    const { data: tasks } = await supabase
      .from('tasks')
      .select('status')
      .in('id', taskIds)

    if (!tasks || tasks.length === 0) {
      return 70 // No tasks to complete
    }

    const completed = tasks.filter(t => t.status === 'completed' || t.status === 'done').length
    const total = tasks.length
    const rate = (completed / total) * 100

    return Math.round(rate)
  } catch (error) {
    console.error('Calculate task completion score error:', error)
    return 50
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Update customer health in database
 */
export async function updateCustomerHealth(
  customerId: string
): Promise<ServiceResponse<CustomerHealth>> {
  try {
    const result = await calculateHealthScore(customerId)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to calculate health score')
    }

    const { score, factors, trend } = result.data
    const label = scoreToLabel(score)

    // Get last interaction
    const { data: lastMeeting } = await supabase
      .from('meetings')
      .select('date')
      .ilike('title', `%${customerId}%`)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    const lastInteraction = lastMeeting?.date || null

    // Upsert customer health
    const { data, error } = await supabase
      .from('customer_health')
      .upsert({
        customer_id: customerId,
        health_score: score,
        health_label: label,
        factors,
        last_interaction: lastInteraction,
        sentiment_trend: trend,
        calculated_at: new Date().toISOString()
      }, {
        onConflict: 'customer_id'
      })
      .select()
      .single()

    if (error) throw error

    // Also record in history
    await supabase
      .from('customer_health_history')
      .insert({
        customer_id: customerId,
        health_score: score,
        health_label: label,
        factors,
        sentiment_trend: trend
      })

    return {
      success: true,
      data: mapHealthFromDb(data)
    }
  } catch (error) {
    console.error('Update customer health error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update customer health'
    }
  }
}

/**
 * Get customer health
 */
export async function getCustomerHealth(
  customerId: string
): Promise<ServiceResponse<CustomerHealth | null>> {
  try {
    const { data, error } = await supabase
      .from('customer_health')
      .select('*')
      .eq('customer_id', customerId)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return {
      success: true,
      data: data ? mapHealthFromDb(data) : null
    }
  } catch (error) {
    console.error('Get customer health error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get customer health'
    }
  }
}

/**
 * Get health history for a customer
 */
export async function getHealthHistory(
  customerId: string,
  limit: number = 30
): Promise<ServiceResponse<CustomerHealthHistory[]>> {
  try {
    const { data, error } = await supabase
      .from('customer_health_history')
      .select('*')
      .eq('customer_id', customerId)
      .order('recorded_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: data.map(mapHistoryFromDb)
    }
  } catch (error) {
    console.error('Get health history error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get health history'
    }
  }
}

/**
 * Get health score distribution
 */
export async function getHealthDistribution(): Promise<ServiceResponse<HealthDistribution>> {
  const emptyDistribution: HealthDistribution = { healthy: 0, atRisk: 0, critical: 0, total: 0 }

  try {
    const { data, error } = await supabase.rpc('get_health_distribution')

    if (error) {
      // Handle case where RPC function doesn't exist (database not configured)
      if (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('does not exist')) {
        return { success: true, data: emptyDistribution }
      }
      throw error
    }

    return {
      success: true,
      data: {
        healthy: data?.healthy || 0,
        atRisk: data?.at_risk || 0,
        critical: data?.critical || 0,
        total: (data?.healthy || 0) + (data?.at_risk || 0) + (data?.critical || 0)
      }
    }
  } catch (error) {
    // Return empty data instead of logging error - prevents console noise when DB not configured
    return { success: true, data: emptyDistribution }
  }
}

/**
 * Get customers needing attention (at-risk or critical)
 */
export async function getCustomersNeedingAttention(
  limit: number = 20
): Promise<ServiceResponse<CustomerNeedingAttention[]>> {
  try {
    const { data, error } = await supabase.rpc('get_customers_needing_attention', {
      p_limit: limit
    })

    if (error) throw error

    return {
      success: true,
      data: data.map((row: Record<string, unknown>) => ({
        customerId: row.customer_id as string,
        healthScore: row.health_score as number,
        healthLabel: row.health_label as HealthLabel,
        sentimentTrend: row.sentiment_trend as SentimentTrendLabel,
        lastInteraction: row.last_interaction as string | null,
        daysSinceInteraction: row.days_since_interaction as number | null
      }))
    }
  } catch (error) {
    console.error('Get customers needing attention error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get customers needing attention'
    }
  }
}

/**
 * Get all customer health records
 */
export async function getAllCustomerHealth(
  options: {
    label?: HealthLabel
    sortBy?: 'score' | 'last_interaction'
    sortOrder?: 'asc' | 'desc'
    limit?: number
  } = {}
): Promise<ServiceResponse<CustomerHealth[]>> {
  try {
    let query = supabase
      .from('customer_health')
      .select('*')

    if (options.label) {
      query = query.eq('health_label', options.label)
    }

    const sortField = options.sortBy === 'last_interaction' ? 'last_interaction' : 'health_score'
    const sortOrder = options.sortOrder === 'asc'
    query = query.order(sortField, { ascending: sortOrder })

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    if (error) throw error

    return {
      success: true,
      data: data.map(mapHealthFromDb)
    }
  } catch (error) {
    console.error('Get all customer health error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get customer health records'
    }
  }
}

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

/**
 * Recalculate health for all customers
 */
export async function recalculateAllHealth(): Promise<ServiceResponse<{ processed: number; failed: number }>> {
  try {
    // Get all unique customer IDs from sentiment data
    const { data: customers, error } = await supabase
      .from('customer_sentiment')
      .select('customer_id')

    if (error) throw error

    const uniqueCustomers = [...new Set(customers.map(c => c.customer_id))]
    let processed = 0
    let failed = 0

    for (const customerId of uniqueCustomers) {
      const result = await updateCustomerHealth(customerId)
      if (result.success) {
        processed++
      } else {
        failed++
      }
    }

    return {
      success: true,
      data: { processed, failed }
    }
  } catch (error) {
    console.error('Recalculate all health error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to recalculate health'
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function scoreToLabel(score: number): HealthLabel {
  if (score >= 60) return 'healthy'
  if (score >= 40) return 'at_risk'
  return 'critical'
}

function mapHealthFromDb(row: Record<string, unknown>): CustomerHealth {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    healthScore: row.health_score as number,
    healthLabel: row.health_label as HealthLabel,
    factors: row.factors as HealthFactors,
    lastInteraction: row.last_interaction as string | null,
    sentimentTrend: row.sentiment_trend as SentimentTrendLabel,
    calculatedAt: row.calculated_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

function mapHistoryFromDb(row: Record<string, unknown>): CustomerHealthHistory {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    healthScore: row.health_score as number,
    healthLabel: row.health_label as HealthLabel,
    factors: row.factors as HealthFactors,
    sentimentTrend: row.sentiment_trend as SentimentTrendLabel,
    recordedAt: row.recorded_at as string
  }
}
