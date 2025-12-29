/**
 * Webhook Service
 *
 * Manages outbound webhook notifications:
 * - Webhook CRUD operations
 * - Event delivery with retry logic
 * - Delivery logging and status tracking
 */

import { supabase } from "../lib/supabase"
import type {
  Webhook,
  WebhookDelivery,
  WebhookEvent,
  WebhookPayload,
  CreateWebhookInput,
  WebhookTestResult,
  ServiceResponse,
  PaginatedResponse
} from "./types"

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAYS = [60000, 300000, 900000] // 1 min, 5 min, 15 min
const MAX_CONSECUTIVE_FAILURES = 10

// ============================================================================
// WEBHOOK MANAGEMENT
// ============================================================================

/**
 * Create a new webhook
 */
export async function createWebhook(
  input: CreateWebhookInput
): Promise<ServiceResponse<Webhook>> {
  try {
    // Generate secret
    const secret = generateSecret()

    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        name: input.name,
        url: input.url,
        secret,
        events: input.events,
        filters: input.filters || null,
        custom_headers: input.customHeaders || {},
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapWebhookFromDb(data)
    }
  } catch (error) {
    console.error('Create webhook error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create webhook'
    }
  }
}

/**
 * Get webhook by ID
 */
export async function getWebhook(
  webhookId: string
): Promise<ServiceResponse<Webhook | null>> {
  try {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return {
      success: true,
      data: data ? mapWebhookFromDb(data) : null
    }
  } catch (error) {
    console.error('Get webhook error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get webhook'
    }
  }
}

/**
 * Get all webhooks
 */
export async function getAllWebhooks(): Promise<ServiceResponse<Webhook[]>> {
  try {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return {
      success: true,
      data: data.map(mapWebhookFromDb)
    }
  } catch (error) {
    console.error('Get all webhooks error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get webhooks'
    }
  }
}

/**
 * Get active webhooks for an event
 */
export async function getWebhooksForEvent(
  event: WebhookEvent
): Promise<ServiceResponse<Webhook[]>> {
  try {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('is_active', true)
      .contains('events', [event])

    if (error) throw error

    return {
      success: true,
      data: data.map(mapWebhookFromDb)
    }
  } catch (error) {
    console.error('Get webhooks for event error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get webhooks'
    }
  }
}

/**
 * Update a webhook
 */
export async function updateWebhook(
  webhookId: string,
  updates: Partial<CreateWebhookInput> & { isActive?: boolean }
): Promise<ServiceResponse<Webhook>> {
  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.url !== undefined) updateData.url = updates.url
    if (updates.events !== undefined) updateData.events = updates.events
    if (updates.filters !== undefined) updateData.filters = updates.filters
    if (updates.customHeaders !== undefined) updateData.custom_headers = updates.customHeaders
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive

    const { data, error } = await supabase
      .from('webhooks')
      .update(updateData)
      .eq('id', webhookId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapWebhookFromDb(data)
    }
  } catch (error) {
    console.error('Update webhook error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update webhook'
    }
  }
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(
  webhookId: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', webhookId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Delete webhook error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete webhook'
    }
  }
}

/**
 * Regenerate webhook secret
 */
export async function regenerateSecret(
  webhookId: string
): Promise<ServiceResponse<string>> {
  try {
    const secret = generateSecret()

    const { error } = await supabase
      .from('webhooks')
      .update({
        secret,
        updated_at: new Date().toISOString()
      })
      .eq('id', webhookId)

    if (error) throw error

    return {
      success: true,
      data: secret
    }
  } catch (error) {
    console.error('Regenerate secret error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to regenerate secret'
    }
  }
}

// ============================================================================
// WEBHOOK DELIVERY
// ============================================================================

/**
 * Trigger webhooks for an event
 */
export async function triggerWebhooks(
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<ServiceResponse<{ triggered: number; failed: number }>> {
  try {
    const webhooksResult = await getWebhooksForEvent(event)
    if (!webhooksResult.success || !webhooksResult.data) {
      return { success: true, data: { triggered: 0, failed: 0 } }
    }

    let triggered = 0
    let failed = 0

    for (const webhook of webhooksResult.data) {
      // Check filters
      if (webhook.filters && !matchesFilters(data, webhook.filters)) {
        continue
      }

      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data
      }

      const result = await deliverWebhook(webhook, payload)
      if (result.success) {
        triggered++
      } else {
        failed++
      }
    }

    return {
      success: true,
      data: { triggered, failed }
    }
  } catch (error) {
    console.error('Trigger webhooks error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger webhooks'
    }
  }
}

/**
 * Deliver a webhook
 */
async function deliverWebhook(
  webhook: Webhook,
  payload: WebhookPayload,
  retryCount: number = 0
): Promise<ServiceResponse<WebhookDelivery>> {
  const startTime = Date.now()

  try {
    // Create signature
    const signature = await createSignature(JSON.stringify(payload), webhook.secret)

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
      ...webhook.customHeaders
    }

    // Make request
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    const responseBody = await response.text()
    const success = response.ok

    // Record delivery
    const delivery = await recordDelivery(
      webhook.id,
      payload,
      response.status,
      responseBody,
      success,
      retryCount
    )

    // Update webhook status
    await updateWebhookStatus(webhook.id, success)

    if (!success && retryCount < MAX_RETRIES) {
      // Schedule retry
      const retryDelay = RETRY_DELAYS[retryCount]
      setTimeout(() => {
        deliverWebhook(webhook, payload, retryCount + 1)
      }, retryDelay)
    }

    return {
      success: true,
      data: delivery
    }
  } catch (error) {
    console.error('Deliver webhook error:', error)

    // Record failed delivery
    const delivery = await recordDelivery(
      webhook.id,
      payload,
      null,
      error instanceof Error ? error.message : 'Unknown error',
      false,
      retryCount
    )

    // Update webhook status
    await updateWebhookStatus(webhook.id, false)

    if (retryCount < MAX_RETRIES) {
      const retryDelay = RETRY_DELAYS[retryCount]
      setTimeout(() => {
        deliverWebhook(webhook, payload, retryCount + 1)
      }, retryDelay)
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deliver webhook',
      data: delivery
    }
  }
}

/**
 * Record a webhook delivery
 */
async function recordDelivery(
  webhookId: string,
  payload: WebhookPayload,
  responseStatus: number | null,
  responseBody: string,
  success: boolean,
  retryCount: number
): Promise<WebhookDelivery> {
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .insert({
      webhook_id: webhookId,
      event: payload.event,
      payload,
      response_status: responseStatus,
      response_body: responseBody.substring(0, 5000), // Limit response body size
      success,
      retry_count: retryCount,
      next_retry_at: success || retryCount >= MAX_RETRIES
        ? null
        : new Date(Date.now() + RETRY_DELAYS[retryCount]).toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Record delivery error:', error)
  }

  return mapDeliveryFromDb(data || {})
}

/**
 * Update webhook status after delivery
 */
async function updateWebhookStatus(
  webhookId: string,
  success: boolean
): Promise<void> {
  try {
    if (success) {
      // Reset failure count on success
      await supabase
        .from('webhooks')
        .update({
          last_triggered_at: new Date().toISOString(),
          consecutive_failures: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', webhookId)
    } else {
      // Increment failure count
      const { data: webhook } = await supabase
        .from('webhooks')
        .select('consecutive_failures')
        .eq('id', webhookId)
        .single()

      const failures = (webhook?.consecutive_failures || 0) + 1

      await supabase
        .from('webhooks')
        .update({
          consecutive_failures: failures,
          is_active: failures < MAX_CONSECUTIVE_FAILURES, // Auto-disable after too many failures
          updated_at: new Date().toISOString()
        })
        .eq('id', webhookId)
    }
  } catch (error) {
    console.error('Update webhook status error:', error)
  }
}

// ============================================================================
// WEBHOOK TESTING
// ============================================================================

/**
 * Test a webhook endpoint
 */
export async function testWebhook(
  webhookId: string
): Promise<ServiceResponse<WebhookTestResult>> {
  try {
    const webhookResult = await getWebhook(webhookId)
    if (!webhookResult.success || !webhookResult.data) {
      return {
        success: false,
        error: 'Webhook not found'
      }
    }

    const webhook = webhookResult.data
    const startTime = Date.now()

    const testPayload: WebhookPayload = {
      event: 'meeting.completed' as WebhookEvent,
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook delivery'
      }
    }

    const signature = await createSignature(JSON.stringify(testPayload), webhook.secret)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': 'test',
      'X-Webhook-Timestamp': testPayload.timestamp,
      ...webhook.customHeaders
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload)
    })

    const responseTime = Date.now() - startTime

    return {
      success: true,
      data: {
        success: response.ok,
        statusCode: response.status,
        responseTime,
        error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
      }
    }
  } catch (error) {
    return {
      success: true,
      data: {
        success: false,
        statusCode: null,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Connection failed'
      }
    }
  }
}

// ============================================================================
// DELIVERY HISTORY
// ============================================================================

/**
 * Get delivery history for a webhook
 */
export async function getDeliveryHistory(
  webhookId: string,
  limit: number = 50
): Promise<ServiceResponse<WebhookDelivery[]>> {
  try {
    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('delivered_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: data.map(mapDeliveryFromDb)
    }
  } catch (error) {
    console.error('Get delivery history error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get delivery history'
    }
  }
}

/**
 * Get failed deliveries
 */
export async function getFailedDeliveries(
  limit: number = 50
): Promise<ServiceResponse<WebhookDelivery[]>> {
  try {
    const { data, error } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('success', false)
      .order('delivered_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: data.map(mapDeliveryFromDb)
    }
  } catch (error) {
    console.error('Get failed deliveries error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get failed deliveries'
    }
  }
}

/**
 * Retry a failed delivery
 */
export async function retryDelivery(
  deliveryId: string
): Promise<ServiceResponse<WebhookDelivery>> {
  try {
    const { data: delivery, error } = await supabase
      .from('webhook_deliveries')
      .select('*, webhooks(*)')
      .eq('id', deliveryId)
      .single()

    if (error) throw error

    if (!delivery || !delivery.webhooks) {
      return {
        success: false,
        error: 'Delivery or webhook not found'
      }
    }

    const webhook = mapWebhookFromDb(delivery.webhooks)
    const payload = delivery.payload as WebhookPayload

    return deliverWebhook(webhook, payload, delivery.retry_count + 1)
  } catch (error) {
    console.error('Retry delivery error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retry delivery'
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'whsec_'
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function createSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(payload)
  const keyData = encoder.encode(secret)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, data)
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function matchesFilters(
  data: Record<string, unknown>,
  filters: Record<string, unknown>
): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (data[key] !== value) {
      return false
    }
  }
  return true
}

function mapWebhookFromDb(row: Record<string, unknown>): Webhook {
  return {
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    secret: row.secret as string,
    events: row.events as WebhookEvent[],
    filters: row.filters as Record<string, unknown> | null,
    customHeaders: (row.custom_headers || {}) as Record<string, string>,
    isActive: row.is_active as boolean,
    lastTriggeredAt: row.last_triggered_at as string | null,
    consecutiveFailures: row.consecutive_failures as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

function mapDeliveryFromDb(row: Record<string, unknown>): WebhookDelivery {
  return {
    id: row.id as string,
    webhookId: row.webhook_id as string,
    event: row.event as WebhookEvent,
    payload: (row.payload || {}) as Record<string, unknown>,
    responseStatus: row.response_status as number | null,
    responseBody: row.response_body as string | null,
    deliveredAt: row.delivered_at as string,
    success: row.success as boolean,
    retryCount: row.retry_count as number,
    nextRetryAt: row.next_retry_at as string | null
  }
}
