/**
 * Ecosystem Inbound Edge Function
 *
 * Receives events from Pulse and Logos Vision via HTTP POST.
 * Validates the X-Ecosystem-Token header against ecosystem_config.inbound_token,
 * logs the event, and routes to local handlers.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-ecosystem-token, x-ecosystem-source, x-ecosystem-event-id, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const startTime = Date.now()

  try {
    // 1. Validate token
    const token = req.headers.get('X-Ecosystem-Token')
    const sourceApp = req.headers.get('X-Ecosystem-Source')
    const eventId = req.headers.get('X-Ecosystem-Event-Id')

    if (!token || !sourceApp) {
      return jsonResponse({ error: 'Missing required headers' }, 401)
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
      return jsonResponse({ error: 'Invalid token or source app not configured' }, 403)
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

    return jsonResponse({ success: status === 'processed', ...result }, 200)

  } catch (err) {
    console.error('[ecosystem-inbound] Error:', (err as Error).message)
    return jsonResponse({ error: 'Internal server error' }, 500)
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

    // From Logos Vision: meeting quality feedback for MIP analytics
    case 'meeting.feedback':
      return handleMeetingFeedback(data)

    // Health check (supports both event names for cross-app compatibility)
    case 'heartbeat':
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

async function handleMeetingFeedback(data: Record<string, unknown>) {
  const { meetingId, rating, feedback, source } = data as {
    meetingId: string
    rating: number
    feedback?: string
    source?: string
  }

  if (!meetingId || !rating) {
    return { error: 'Missing meetingId or rating' }
  }

  // Update meeting_intelligence_config with feedback
  const { error: configError } = await supabase
    .from('meeting_intelligence_config')
    .update({
      quality_feedback_rating: rating,
      quality_feedback_text: feedback || null,
      quality_feedback_source: source || 'unknown',
      quality_feedback_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('meeting_id', meetingId)

  if (configError) {
    // Config row may not exist — log to a standalone table as fallback
    console.warn('[ecosystem-inbound] meeting_intelligence_config update failed:', configError.message)

    await supabase
      .from('ecosystem_events')
      .insert({
        event_id: crypto.randomUUID(),
        source: source || 'unknown',
        target_app: 'entomate',
        event_type: 'meeting.feedback',
        direction: 'inbound',
        status: 'processed',
        payload: { meetingId, rating, feedback, source, note: 'config row not found, logged as event' }
      })
  }

  console.log(`[ecosystem-inbound] Meeting feedback received: meeting=${meetingId} rating=${rating} source=${source}`)
  return { processed: true, eventType: 'meeting.feedback', meetingId }
}
