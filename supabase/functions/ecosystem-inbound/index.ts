/**
 * Ecosystem Inbound Edge Function
 *
 * Receives events from Pulse and Logos Vision via HTTP POST.
 * Validates the X-Ecosystem-Token header against ecosystem_config.inbound_token,
 * logs the event, and routes to local handlers.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const startTime = Date.now()

  try {
    // 1. Validate token
    const token = req.headers.get('X-Ecosystem-Token')
    const sourceApp = req.headers.get('X-Ecosystem-Source')
    const eventId = req.headers.get('X-Ecosystem-Event-Id')

    if (!token || !sourceApp) {
      return new Response(JSON.stringify({ error: 'Missing required headers' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Look up the source app's config and validate its inbound token
    const { data: config, error: configError } = await supabase
      .from('ecosystem_config')
      .select('*')
      .eq('app_name', sourceApp)
      .eq('inbound_token', token)
      .eq('enabled', true)
      .single()

    if (configError || !config) {
      return new Response(JSON.stringify({ error: 'Invalid token or source app not configured' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 2. Parse event body
    const event = await req.json()

    // 3. Log inbound event
    const { data: eventLog } = await supabase
      .from('ecosystem_events')
      .insert({
        event_id: eventId || event.id || crypto.randomUUID(),
        source: sourceApp,
        target_app: 'entomate',
        event_type: event.eventType,
        entity_type: event.entityType || null,
        entity_id: event.entityId || null,
        direction: 'inbound',
        status: 'pending',
        payload: event
      })
      .select('id')
      .single()

    // 4. Route to handler
    let result: Record<string, unknown> = {}
    let status = 'processed'

    try {
      result = await routeEvent(event, sourceApp)
    } catch (handlerError) {
      status = 'failed'
      result = { error: (handlerError as Error).message }
    }

    // 5. Update event log
    const processingTime = Date.now() - startTime
    if (eventLog?.id) {
      await supabase
        .from('ecosystem_events')
        .update({
          status,
          response_data: result,
          processing_time_ms: processingTime
        })
        .eq('id', eventLog.id)
    }

    return new Response(JSON.stringify({ success: status === 'processed', ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[ecosystem-inbound] Error:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

// ── Event Router ──

async function routeEvent(event: Record<string, unknown>, sourceApp: string) {
  const eventType = event.eventType as string
  const data = (event.data || {}) as Record<string, unknown>

  switch (eventType) {
    // From Logos Vision: a CRM task was completed
    case 'task.completed':
      return handleTaskCompleted(data)

    // From Logos Vision: a contact was updated
    case 'contact.updated':
      return handleContactUpdated(data)

    // From Pulse: send a notification within Entomate
    case 'notification.send':
      return handleNotification(data)

    // Health check ping
    case 'health.ping':
      return { pong: true, timestamp: new Date().toISOString(), app: 'entomate' }

    default:
      console.warn(`[ecosystem-inbound] Unhandled event type: ${eventType} from ${sourceApp}`)
      return { acknowledged: true, handled: false }
  }
}

// ── Event Handlers ──

async function handleTaskCompleted(data: Record<string, unknown>) {
  const { taskId, crmTaskId } = data

  if (!taskId) return { error: 'Missing taskId' }

  // Update the local action item's status
  const { error } = await supabase
    .from('action_items')
    .update({
      status: 'completed',
      crm_sync_status: 'synced',
      updated_at: new Date().toISOString()
    })
    .eq('crm_task_id', crmTaskId)

  if (error) {
    // Try matching by entity map
    const { data: mapping } = await supabase
      .from('ecosystem_entity_map')
      .select('local_entity_id')
      .eq('remote_app', 'logos_vision')
      .eq('remote_entity_id', String(crmTaskId))
      .single()

    if (mapping) {
      await supabase
        .from('action_items')
        .update({
          status: 'completed',
          crm_sync_status: 'synced',
          updated_at: new Date().toISOString()
        })
        .eq('id', mapping.local_entity_id)
    }
  }

  return { processed: true, eventType: 'task.completed' }
}

async function handleContactUpdated(data: Record<string, unknown>) {
  // Log contact update for potential future use (meeting prep, etc.)
  console.log('[ecosystem-inbound] Contact updated:', data.email)
  return { acknowledged: true, eventType: 'contact.updated' }
}

async function handleNotification(data: Record<string, unknown>) {
  // Store notification for Entomate UI to display
  console.log('[ecosystem-inbound] Notification from Pulse:', data.title)
  return { acknowledged: true, eventType: 'notification.send' }
}
