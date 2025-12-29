/**
 * Audit Logging Service
 *
 * Provides comprehensive audit trail for:
 * - Authentication events
 * - Data access
 * - Modifications
 * - Admin actions
 * - Security events
 */

import { supabase } from "../lib/supabase"
import type {
  AuditLog,
  AuditLogInput,
  AuditQueryParams,
  AuditStatistics,
  AuditAction,
  AuditCategory,
  AuditResourceType,
  ServiceResponse,
  PaginatedResponse
} from "./types"

// ============================================================================
// AUDIT LOG CREATION
// ============================================================================

/**
 * Log an audit event
 */
export async function logAudit(
  input: AuditLogInput,
  options: {
    userId?: string
    ipAddress?: string
    userAgent?: string
    sessionId?: string
  } = {}
): Promise<ServiceResponse<AuditLog>> {
  try {
    const { data, error } = await supabase.rpc('log_audit_event', {
      p_user_id: options.userId || null,
      p_action: input.action,
      p_category: input.category,
      p_resource_type: input.resourceType,
      p_resource_id: input.resourceId || null,
      p_changes: input.changes || null,
      p_metadata: input.metadata || {},
      p_ip_address: options.ipAddress || null,
      p_user_agent: options.userAgent || null,
      p_session_id: options.sessionId || null
    })

    if (error) throw error

    // Fetch created log
    const { data: log, error: fetchError } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('id', data)
      .single()

    if (fetchError) throw fetchError

    return {
      success: true,
      data: mapAuditFromDb(log)
    }
  } catch (error) {
    console.error('Log audit error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to log audit event'
    }
  }
}

/**
 * Log a login event
 */
export async function logLogin(
  userId: string,
  options: {
    ipAddress?: string
    userAgent?: string
    method?: string
  } = {}
): Promise<ServiceResponse<AuditLog>> {
  return logAudit(
    {
      action: 'login',
      category: 'auth',
      resourceType: 'user',
      resourceId: userId,
      metadata: { method: options.method || 'password' }
    },
    {
      userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    }
  )
}

/**
 * Log a logout event
 */
export async function logLogout(
  userId: string,
  options: {
    ipAddress?: string
    userAgent?: string
    sessionId?: string
  } = {}
): Promise<ServiceResponse<AuditLog>> {
  return logAudit(
    {
      action: 'logout',
      category: 'auth',
      resourceType: 'user',
      resourceId: userId
    },
    {
      userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      sessionId: options.sessionId
    }
  )
}

/**
 * Log a data access event
 */
export async function logAccess(
  userId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  metadata?: Record<string, unknown>
): Promise<ServiceResponse<AuditLog>> {
  return logAudit(
    {
      action: 'read',
      category: 'access',
      resourceType,
      resourceId,
      metadata
    },
    { userId }
  )
}

/**
 * Log a create event
 */
export async function logCreate(
  userId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  data: Record<string, unknown>
): Promise<ServiceResponse<AuditLog>> {
  return logAudit(
    {
      action: 'create',
      category: 'modification',
      resourceType,
      resourceId,
      changes: { after: data }
    },
    { userId }
  )
}

/**
 * Log an update event
 */
export async function logUpdate(
  userId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Promise<ServiceResponse<AuditLog>> {
  return logAudit(
    {
      action: 'update',
      category: 'modification',
      resourceType,
      resourceId,
      changes: { before, after }
    },
    { userId }
  )
}

/**
 * Log a delete event
 */
export async function logDelete(
  userId: string,
  resourceType: AuditResourceType,
  resourceId: string,
  data?: Record<string, unknown>
): Promise<ServiceResponse<AuditLog>> {
  return logAudit(
    {
      action: 'delete',
      category: 'modification',
      resourceType,
      resourceId,
      changes: data ? { before: data } : undefined
    },
    { userId }
  )
}

/**
 * Log a permission change
 */
export async function logPermissionChange(
  userId: string,
  targetUserId: string,
  changes: { before?: Record<string, unknown>; after?: Record<string, unknown> }
): Promise<ServiceResponse<AuditLog>> {
  return logAudit(
    {
      action: 'permission_change',
      category: 'admin',
      resourceType: 'user',
      resourceId: targetUserId,
      changes
    },
    { userId }
  )
}

/**
 * Log a security event
 */
export async function logSecurityEvent(
  eventType: string,
  details: Record<string, unknown>,
  userId?: string
): Promise<ServiceResponse<AuditLog>> {
  return logAudit(
    {
      action: 'read',
      category: 'security',
      resourceType: 'user',
      resourceId: userId,
      metadata: { eventType, ...details }
    },
    { userId }
  )
}

// ============================================================================
// AUDIT LOG QUERIES
// ============================================================================

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(
  params: AuditQueryParams
): Promise<ServiceResponse<PaginatedResponse<AuditLog>>> {
  const emptyResponse: PaginatedResponse<AuditLog> = {
    data: [],
    total: 0,
    page: 1,
    pageSize: params.limit || 50,
    hasMore: false
  }

  try {
    const { data, error } = await supabase.rpc('query_audit_logs', {
      p_user_id: params.userId || null,
      p_action: params.action || null,
      p_category: params.category || null,
      p_resource_type: params.resourceType || null,
      p_resource_id: params.resourceId || null,
      p_start_date: params.startDate || null,
      p_end_date: params.endDate || null,
      p_limit: params.limit || 50,
      p_offset: params.offset || 0
    })

    if (error) {
      // Handle case where RPC function doesn't exist (database not configured)
      if (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('does not exist')) {
        return { success: true, data: emptyResponse }
      }
      throw error
    }

    // Get total count
    const countQuery = supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })

    if (params.userId) countQuery.eq('user_id', params.userId)
    if (params.action) countQuery.eq('action', params.action)
    if (params.category) countQuery.eq('category', params.category)
    if (params.resourceType) countQuery.eq('resource_type', params.resourceType)
    if (params.resourceId) countQuery.eq('resource_id', params.resourceId)
    if (params.startDate) countQuery.gte('created_at', params.startDate)
    if (params.endDate) countQuery.lte('created_at', params.endDate)

    const { count } = await countQuery

    const limit = params.limit || 50
    const offset = params.offset || 0

    return {
      success: true,
      data: {
        data: data.map(mapAuditFromDb),
        total: count || 0,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasMore: (count || 0) > offset + data.length
      }
    }
  } catch (error) {
    // Return empty data instead of logging error - prevents console noise when DB not configured
    return { success: true, data: emptyResponse }
  }
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 50
): Promise<ServiceResponse<AuditLog[]>> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: data.map(mapAuditFromDb)
    }
  } catch (error) {
    console.error('Get user audit logs error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user audit logs'
    }
  }
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(
  resourceType: AuditResourceType,
  resourceId: string,
  limit: number = 50
): Promise<ServiceResponse<AuditLog[]>> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: data.map(mapAuditFromDb)
    }
  } catch (error) {
    console.error('Get resource audit logs error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get resource audit logs'
    }
  }
}

/**
 * Get recent audit logs
 */
export async function getRecentAuditLogs(
  limit: number = 100
): Promise<ServiceResponse<AuditLog[]>> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: data.map(mapAuditFromDb)
    }
  } catch (error) {
    console.error('Get recent audit logs error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recent audit logs'
    }
  }
}

/**
 * Get audit logs by category
 */
export async function getAuditLogsByCategory(
  category: AuditCategory,
  limit: number = 50
): Promise<ServiceResponse<AuditLog[]>> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: data.map(mapAuditFromDb)
    }
  } catch (error) {
    console.error('Get audit logs by category error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get audit logs by category'
    }
  }
}

/**
 * Search audit logs by metadata
 */
export async function searchAuditLogs(
  searchTerm: string,
  limit: number = 50
): Promise<ServiceResponse<AuditLog[]>> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .or(`resource_id.ilike.%${searchTerm}%,metadata->>'eventType'.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: data.map(mapAuditFromDb)
    }
  } catch (error) {
    console.error('Search audit logs error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search audit logs'
    }
  }
}

// ============================================================================
// AUDIT STATISTICS
// ============================================================================

/**
 * Get audit log statistics
 */
export async function getAuditStatistics(
  startDate?: string,
  endDate?: string
): Promise<ServiceResponse<AuditStatistics>> {
  try {
    const { data, error } = await supabase.rpc('get_audit_statistics', {
      p_start_date: startDate || null,
      p_end_date: endDate || null
    })

    if (error) throw error

    return {
      success: true,
      data: {
        totalLogs: data?.total_logs || 0,
        byCategory: data?.by_category || {},
        byAction: data?.by_action || {},
        uniqueUsers: data?.unique_users || 0,
        dateRange: {
          start: data?.date_range_start || startDate || '',
          end: data?.date_range_end || endDate || ''
        }
      }
    }
  } catch (error) {
    console.error('Get audit statistics error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get audit statistics'
    }
  }
}

/**
 * Get daily audit counts
 */
export async function getDailyAuditCounts(
  days: number = 30
): Promise<ServiceResponse<Array<{ date: string; count: number }>>> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('audit_logs')
      .select('created_at')
      .gte('created_at', startDate.toISOString())

    if (error) throw error

    // Group by date
    const counts: Record<string, number> = {}
    for (const log of data) {
      const date = log.created_at.split('T')[0]
      counts[date] = (counts[date] || 0) + 1
    }

    return {
      success: true,
      data: Object.entries(counts)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    }
  } catch (error) {
    console.error('Get daily audit counts error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get daily counts'
    }
  }
}

// ============================================================================
// AUDIT EXPORT
// ============================================================================

/**
 * Export audit logs to JSON
 */
export async function exportAuditLogs(
  params: AuditQueryParams
): Promise<ServiceResponse<AuditLog[]>> {
  // Remove pagination limits for export
  const exportParams = { ...params, limit: 10000, offset: 0 }
  const result = await queryAuditLogs(exportParams)

  if (!result.success) {
    return {
      success: false,
      error: result.error
    }
  }

  return {
    success: true,
    data: result.data?.data || []
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mapAuditFromDb(row: Record<string, unknown>): AuditLog {
  return {
    id: row.id as string,
    userId: row.user_id as string | null,
    action: row.action as AuditAction,
    category: row.category as AuditCategory,
    resourceType: row.resource_type as AuditResourceType,
    resourceId: row.resource_id as string | null,
    changes: row.changes as { before?: Record<string, unknown>; after?: Record<string, unknown> } | null,
    metadata: (row.metadata || {}) as Record<string, unknown>,
    ipAddress: row.ip_address as string | null,
    userAgent: row.user_agent as string | null,
    sessionId: row.session_id as string | null,
    createdAt: row.created_at as string
  }
}
