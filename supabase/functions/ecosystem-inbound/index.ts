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

    // From Logos Vision: a CRM task was edited (description, status, due date, etc.)
    case 'task.updated':
      return handleTaskUpdated(data)

    // From Logos Vision: a contact was created or updated. Both shapes get
    // cached to intelligence_context_cache so the MIP context assembler can
    // use them without another round trip.
    case 'contact.created':
    case 'contact.updated':
      return handleContactEvent(eventType, data, sourceApp)

    // From Pulse: send a notification within Entomate
    case 'notification.send':
      return handleNotification(data)

    // From Logos Vision: meeting quality feedback for MIP analytics
    case 'meeting.feedback':
      return handleMeetingFeedback(data)

    // From Pulse: export a meeting recording for AI processing
    case 'meeting.export':
      return handleMeetingExport(data, sourceApp)

    // From Logos Vision: CRM meeting lifecycle. We store minimal state so the
    // MIP context assembler and the briefing trigger can see what's scheduled
    // / in-flight / done without hitting LV synchronously.
    case 'meeting.scheduled':
    case 'meeting.started':
    case 'meeting.completed':
    case 'meeting.cancelled':
      return handleMeetingLifecycle(eventType, data, sourceApp)

    // From Pulse: workspace decisions / extracted tasks. Cached as MIP context
    // so the meeting briefing can surface "the team decided X / has open task Y"
    // when prepping a related meeting.
    case 'decision.created':
      return handlePulseDecisionCreated(data, sourceApp)
    case 'task.created':
      return handlePulseTaskCreated(data, sourceApp)

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

// LV uses 'Done' / 'In Progress' / 'To Do'; Entomate uses 'completed' / 'in_progress' / 'pending'.
function reverseMapStatus(lvStatus: string): string | null {
  switch (lvStatus) {
    case 'Done': return 'completed'
    case 'In Progress': return 'in_progress'
    case 'To Do': return 'pending'
    default: return null
  }
}

async function handleTaskUpdated(data: Record<string, unknown>) {
  const { taskId, entomateActionItemId, changes } = data as {
    taskId?: string
    entomateActionItemId?: string
    changes?: Record<string, unknown>
  }

  if (!entomateActionItemId && !taskId) {
    return { error: 'Missing entomateActionItemId or taskId' }
  }
  if (!changes || typeof changes !== 'object') {
    return { error: 'Missing changes object' }
  }

  // Translate LV task fields → Entomate action_items columns.
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof changes.description === 'string') update.task_description = changes.description
  if (typeof changes.due_date === 'string' || changes.due_date === null) update.due_date = changes.due_date
  if (typeof changes.priority === 'string') update.priority = changes.priority
  if (typeof changes.status === 'string') {
    const mapped = reverseMapStatus(changes.status)
    if (mapped) update.status = mapped
  }

  // Resolve the local action_item id.
  let localId = entomateActionItemId || null
  if (!localId && taskId) {
    const { data: mapping } = await supabase
      .from('ecosystem_entity_map')
      .select('local_entity_id')
      .eq('remote_app', 'logos_vision')
      .eq('remote_entity_id', String(taskId))
      .single()
    localId = mapping?.local_entity_id || null
  }

  if (!localId) {
    return { error: 'No matching action_item found' }
  }

  const { error } = await supabase.from('action_items').update(update).eq('id', localId)
  if (error) return { error: error.message }

  return { processed: true, eventType: 'task.updated', actionItemId: localId, fieldsUpdated: Object.keys(update) }
}

/**
 * Handle contact.created and contact.updated from Logos Vision.
 *
 * Senders use two different payload shapes:
 *   contact.created:  { contact: { id, name, email, ... } }
 *   contact.updated:  { contactId, changes: {...} }
 * We accept either, derive a stable remote id + flat snapshot, then cache to
 * intelligence_context_cache (keyed by entity_type/entity_id/source_app) and
 * upsert a row in ecosystem_entity_map so future MIP lookups can resolve it.
 */
async function handleContactEvent(
  eventType: string,
  data: Record<string, unknown>,
  sourceApp: string
) {
  const nestedContact = (data.contact || {}) as Record<string, unknown>
  const remoteContactId =
    (data.contactId as string) ||
    (nestedContact.id as string) ||
    null

  if (!remoteContactId) {
    return { error: 'Missing contactId or contact.id', eventType }
  }

  // Build a flat snapshot for the cache. For 'updated' we store changes; for
  // 'created' we store the full contact object. Either way the assembler reads
  // the latest cached blob, so 'updated' will overwrite the previous snapshot
  // with a partial — acceptable since changes always come from the source of
  // truth (LV) and downstream consumers should treat the cache as advisory.
  const cachedSnapshot: Record<string, unknown> = {
    ...(eventType === 'contact.created' ? nestedContact : {}),
    ...((data.changes as Record<string, unknown>) || {}),
    _lastEvent: eventType,
    _lastSeen: new Date().toISOString(),
  }

  // Cache for MIP context assembly. 7-day TTL — context_assembler can refresh.
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error: cacheError } = await supabase
    .from('intelligence_context_cache')
    .upsert(
      {
        entity_type: 'contact',
        entity_id: remoteContactId,
        source_app: sourceApp,
        context_data: cachedSnapshot,
        expires_at: expiresAt,
      },
      { onConflict: 'entity_type,entity_id,source_app' }
    )

  if (cacheError) {
    console.warn('[ecosystem-inbound] context cache upsert failed:', cacheError.message)
  }

  // We deliberately do NOT insert into ecosystem_entity_map. That table
  // requires a real local_entity_id (UUID NOT NULL) — Entomate has no local
  // contacts table to point at, so a "mirror-only" row would be misleading.
  // The cache above is the canonical place for cross-app context data.

  return {
    processed: true,
    eventType,
    contactId: remoteContactId,
    cached: !cacheError,
  }
}

/**
 * Handle CRM meeting lifecycle events from Logos Vision.
 *
 * meeting.scheduled / .started / .completed / .cancelled
 *
 * We don't synthesize an Entomate meetings row here (that's reserved for
 * meeting.export which carries the actual recording). Instead we cache the
 * lifecycle state so the MIP briefing trigger and the context assembler can
 * see "LV says this meeting starts in 10 minutes" without a synchronous
 * round trip.
 */
async function handleMeetingLifecycle(
  eventType: string,
  data: Record<string, unknown>,
  sourceApp: string
) {
  const remoteMeetingId =
    (data.meetingId as string) ||
    (data.id as string) ||
    null

  if (!remoteMeetingId) {
    return { error: 'Missing meetingId', eventType }
  }

  const lifecycleState = eventType.replace('meeting.', '') // scheduled | started | completed | cancelled

  const cachedSnapshot: Record<string, unknown> = {
    ...data,
    _lifecycle: lifecycleState,
    _lastEvent: eventType,
    _lastSeen: new Date().toISOString(),
  }

  // 24-hour TTL — these are short-lived state markers, not durable records.
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { error: cacheError } = await supabase
    .from('intelligence_context_cache')
    .upsert(
      {
        entity_type: 'meeting_lifecycle',
        entity_id: remoteMeetingId,
        source_app: sourceApp,
        context_data: cachedSnapshot,
        expires_at: expiresAt,
      },
      { onConflict: 'entity_type,entity_id,source_app' }
    )

  if (cacheError) {
    console.warn('[ecosystem-inbound] lifecycle cache upsert failed:', cacheError.message)
  }

  // We do NOT insert into ecosystem_entity_map here — local_entity_id is UUID
  // NOT NULL and remoteMeetingId may not be UUID-shaped, plus we have no real
  // local meetings row yet. meeting.export creates the proper map row once a
  // recording materializes locally.

  return {
    processed: true,
    eventType,
    meetingId: remoteMeetingId,
    lifecycle: lifecycleState,
    cached: !cacheError,
  }
}

/**
 * Handle decision.created from Pulse.
 *
 * Cache the decision in intelligence_context_cache so the MIP context
 * assembler can surface "the team decided X" when prepping a related
 * meeting. Keyed per-workspace so a single user with multiple workspaces
 * sees only the right decisions.
 */
async function handlePulseDecisionCreated(data: Record<string, unknown>, sourceApp: string) {
  const { decisionId, workspaceId, title, description, decisionType, proposedBy } = data as {
    decisionId?: string
    workspaceId?: string
    title?: string
    description?: string | null
    decisionType?: string
    proposedBy?: string
  }

  if (!decisionId || !workspaceId) {
    return { error: 'Missing decisionId or workspaceId', eventType: 'decision.created' }
  }

  const cachedSnapshot: Record<string, unknown> = {
    decisionId,
    workspaceId,
    title,
    description: description ?? null,
    decisionType: decisionType ?? 'general',
    proposedBy: proposedBy ?? null,
    _lastEvent: 'decision.created',
    _lastSeen: new Date().toISOString(),
  }

  // 30-day TTL — decisions stay relevant for context longer than contacts.
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error: cacheError } = await supabase
    .from('intelligence_context_cache')
    .upsert(
      {
        entity_type: 'decision',
        entity_id: decisionId,
        source_app: sourceApp,
        context_data: cachedSnapshot,
        expires_at: expiresAt,
      },
      { onConflict: 'entity_type,entity_id,source_app' }
    )

  if (cacheError) {
    console.warn('[ecosystem-inbound] decision cache upsert failed:', cacheError.message)
  }

  return { processed: true, eventType: 'decision.created', decisionId, cached: !cacheError }
}

/**
 * Handle task.created from Pulse.
 *
 * Cache the task in intelligence_context_cache so the MIP context
 * assembler can surface "open Pulse tasks for this participant" during
 * meeting prep. Pulse tasks are NOT mirrored as Entomate action_items —
 * they're context-only.
 */
async function handlePulseTaskCreated(data: Record<string, unknown>, sourceApp: string) {
  const { taskId, workspaceId, title, description, assigneeId, deadline, priority, originMessageId } = data as {
    taskId?: string
    workspaceId?: string
    title?: string
    description?: string | null
    assigneeId?: string | null
    deadline?: string | null
    priority?: string
    originMessageId?: string | null
  }

  if (!taskId || !workspaceId) {
    return { error: 'Missing taskId or workspaceId', eventType: 'task.created' }
  }

  const cachedSnapshot: Record<string, unknown> = {
    taskId,
    workspaceId,
    title,
    description: description ?? null,
    assigneeId: assigneeId ?? null,
    deadline: deadline ?? null,
    priority: priority ?? 'medium',
    originMessageId: originMessageId ?? null,
    _lastEvent: 'task.created',
    _lastSeen: new Date().toISOString(),
  }

  // 14-day TTL — tasks decay faster than decisions; expect status churn.
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const { error: cacheError } = await supabase
    .from('intelligence_context_cache')
    .upsert(
      {
        entity_type: 'task',
        entity_id: taskId,
        source_app: sourceApp,
        context_data: cachedSnapshot,
        expires_at: expiresAt,
      },
      { onConflict: 'entity_type,entity_id,source_app' }
    )

  if (cacheError) {
    console.warn('[ecosystem-inbound] task cache upsert failed:', cacheError.message)
  }

  return { processed: true, eventType: 'task.created', taskId, cached: !cacheError }
}

async function handleNotification(data: Record<string, unknown>) {
  // Persist into the lightweight ecosystem_notifications inbox so the Entomate
  // UI can poll/render alerts from connected apps without a real-time channel.
  const { title, body, content, urgency, recipientIds, userIds, metadata } = data as {
    title?: string
    body?: string
    content?: string
    urgency?: string
    recipientIds?: string[]
    userIds?: string[]
    metadata?: Record<string, unknown>
  }

  // Either an explicit recipient list, or NULL = broadcast row.
  const recipients: (string | null)[] =
    (Array.isArray(recipientIds) ? recipientIds : null) ||
    (Array.isArray(userIds) ? userIds : null) ||
    [null]

  const sourceApp = (metadata?.source as string) || 'unknown'
  const allowedUrgency = ['low', 'normal', 'high', 'urgent']
  const safeUrgency = urgency && allowedUrgency.includes(urgency) ? urgency : 'normal'

  const rows = recipients.map(userId => ({
    user_id: userId,
    source_app: sourceApp,
    title: title || null,
    body: body || content || null,
    urgency: safeUrgency,
    metadata: metadata || {},
  }))

  const { error, count } = await supabase
    .from('ecosystem_notifications')
    .insert(rows, { count: 'exact' })

  if (error) {
    console.warn('[ecosystem-inbound] notification insert failed:', error.message)
    return { acknowledged: true, eventType: 'notification.send', persisted: 0, error: error.message }
  }

  return { acknowledged: true, eventType: 'notification.send', persisted: count ?? rows.length }
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

/**
 * Handle meeting.export from Pulse
 *
 * Receives a meeting recording (audio URL and/or transcript) from Pulse,
 * downloads the audio if available, and forwards to the Entomate meetings
 * processing pipeline via internal API call.
 */
async function handleMeetingExport(data: Record<string, unknown>, sourceApp: string) {
  const {
    meetingId: pulseMeetingId,
    title,
    audioUrl,
    transcript,
    attendees,
    durationMinutes,
    recordedAt,
    source: recordingSource,
  } = data as {
    meetingId: string
    title: string
    audioUrl: string | null
    transcript: string | null
    attendees: Array<{ name: string; email?: string; userId?: string }>
    durationMinutes: number
    recordedAt: string
    source: string
  }

  if (!audioUrl && !transcript) {
    return { error: 'Either audioUrl or transcript is required' }
  }

  const meetingTitle = title || `Pulse Meeting ${new Date(recordedAt || Date.now()).toLocaleDateString()}`
  const attendeeList = Array.isArray(attendees)
    ? attendees.map(a => (typeof a === 'string' ? a : a.name)).filter(Boolean)
    : []

  // Determine the Entomate backend API URL
  // In production this would be the Entomate backend URL; for edge function
  // we call the Supabase DB directly to avoid circular edge function calls.
  const ai = await getAIConfig()

  if (transcript && !audioUrl) {
    // Text-only path: process transcript directly via DB insert + AI
    return processTranscriptExport({
      title: meetingTitle,
      transcript,
      attendees: attendeeList,
      durationMinutes: durationMinutes || 0,
      pulseMeetingId,
      recordingSource: recordingSource || sourceApp,
    })
  }

  if (audioUrl) {
    // Audio path: download audio, transcribe, then process
    return processAudioExport({
      title: meetingTitle,
      audioUrl,
      transcript,
      attendees: attendeeList,
      durationMinutes: durationMinutes || 0,
      pulseMeetingId,
      recordingSource: recordingSource || sourceApp,
    })
  }

  return { error: 'No processable content provided' }
}

/** Check if AI is configured by looking for API keys in env */
async function getAIConfig() {
  return {
    hasOpenAI: !!Deno.env.get('OPENAI_API_KEY'),
    hasGemini: !!Deno.env.get('GEMINI_API_KEY'),
  }
}

/**
 * Process a transcript-only export from Pulse.
 * Saves the meeting directly to the meetings table and triggers async processing.
 */
async function processTranscriptExport(params: {
  title: string
  transcript: string
  attendees: string[]
  durationMinutes: number
  pulseMeetingId: string
  recordingSource: string
}) {
  const meetingId = crypto.randomUUID()

  // Save the raw meeting to DB — the backend cron/webhook will pick up
  // meetings without summaries and process them, OR we do inline processing.
  const { error } = await supabase
    .from('meetings')
    .insert({
      id: meetingId,
      title: params.title,
      transcript: params.transcript,
      attendees: params.attendees,
      duration_minutes: params.durationMinutes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.error('[ecosystem-inbound] Failed to save exported meeting:', error.message)
    return { error: `Failed to save meeting: ${error.message}` }
  }

  // Store cross-reference mapping
  await supabase
    .from('ecosystem_entity_map')
    .insert({
      id: crypto.randomUUID(),
      local_entity_type: 'meeting',
      local_entity_id: meetingId,
      remote_app: 'pulse',
      remote_entity_type: 'meeting',
      remote_entity_id: params.pulseMeetingId,
      created_at: new Date().toISOString(),
    })
    .single()

  console.log(`[ecosystem-inbound] Meeting exported from Pulse: ${params.pulseMeetingId} → ${meetingId} (transcript-only)`)

  // Trigger AI processing via backend
  triggerReprocess(meetingId)

  return {
    processed: true,
    eventType: 'meeting.export',
    meetingId,
    pulseMeetingId: params.pulseMeetingId,
    mode: 'transcript',
  }
}

/**
 * Process an audio export from Pulse.
 * Downloads audio from URL, uploads to Entomate storage, and saves meeting record.
 */
async function processAudioExport(params: {
  title: string
  audioUrl: string
  transcript: string | null
  attendees: string[]
  durationMinutes: number
  pulseMeetingId: string
  recordingSource: string
}) {
  const meetingId = crypto.randomUUID()

  // Download audio from Pulse storage URL
  let audioBuffer: ArrayBuffer | null = null
  let mimeType = 'audio/webm'

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const audioResp = await fetch(params.audioUrl, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!audioResp.ok) {
      console.warn(`[ecosystem-inbound] Audio download failed (${audioResp.status}), falling back to transcript`)
      // Fall back to transcript-only if we have one
      if (params.transcript) {
        return processTranscriptExport({
          title: params.title,
          transcript: params.transcript,
          attendees: params.attendees,
          durationMinutes: params.durationMinutes,
          pulseMeetingId: params.pulseMeetingId,
          recordingSource: params.recordingSource,
        })
      }
      return { error: `Audio download failed: ${audioResp.status}` }
    }

    mimeType = audioResp.headers.get('content-type') || 'audio/webm'
    audioBuffer = await audioResp.arrayBuffer()
  } catch (downloadErr) {
    console.error('[ecosystem-inbound] Audio download error:', (downloadErr as Error).message)
    if (params.transcript) {
      return processTranscriptExport({
        title: params.title,
        transcript: params.transcript,
        attendees: params.attendees,
        durationMinutes: params.durationMinutes,
        pulseMeetingId: params.pulseMeetingId,
        recordingSource: params.recordingSource,
      })
    }
    return { error: `Audio download failed: ${(downloadErr as Error).message}` }
  }

  // Upload audio to Entomate's recordings bucket
  let audioFileUrl: string | null = null
  const ext = mimeType.split('/')[1]?.split(';')[0] || 'webm'
  const storagePath = `meetings/${meetingId}.${ext}`

  try {
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('recordings')
      .upload(storagePath, audioBuffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (!uploadError && uploadData?.path) {
      const { data: urlData } = supabase
        .storage
        .from('recordings')
        .getPublicUrl(uploadData.path)
      audioFileUrl = urlData?.publicUrl || null
    }
  } catch (uploadErr) {
    console.warn('[ecosystem-inbound] Audio upload to storage failed:', (uploadErr as Error).message)
  }

  // Save meeting record
  const { error } = await supabase
    .from('meetings')
    .insert({
      id: meetingId,
      title: params.title,
      transcript: params.transcript || null,
      audio_file_url: audioFileUrl,
      attendees: params.attendees,
      duration_minutes: params.durationMinutes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.error('[ecosystem-inbound] Failed to save exported meeting:', error.message)
    return { error: `Failed to save meeting: ${error.message}` }
  }

  // Store cross-reference mapping
  await supabase
    .from('ecosystem_entity_map')
    .insert({
      id: crypto.randomUUID(),
      local_entity_type: 'meeting',
      local_entity_id: meetingId,
      remote_app: 'pulse',
      remote_entity_type: 'meeting',
      remote_entity_id: params.pulseMeetingId,
      created_at: new Date().toISOString(),
    })
    .single()

  console.log(`[ecosystem-inbound] Meeting exported from Pulse: ${params.pulseMeetingId} → ${meetingId} (audio, ${Math.round((audioBuffer?.byteLength || 0) / 1024)}KB)`)

  // Trigger AI processing via backend
  triggerReprocess(meetingId)

  return {
    processed: true,
    eventType: 'meeting.export',
    meetingId,
    pulseMeetingId: params.pulseMeetingId,
    mode: 'audio',
    audioStored: !!audioFileUrl,
  }
}

/**
 * Fire-and-forget trigger to the Entomate backend's reprocess endpoint.
 * If ENTOMATE_BACKEND_URL is not set, the backend's own scheduler will
 * eventually pick up unprocessed meetings.
 */
function triggerReprocess(meetingId: string) {
  const backendUrl = Deno.env.get('ENTOMATE_BACKEND_URL')
  if (!backendUrl) {
    console.log(`[ecosystem-inbound] ENTOMATE_BACKEND_URL not set, skipping reprocess trigger for ${meetingId}`)
    return
  }

  fetch(`${backendUrl}/api/meetings/${meetingId}/reprocess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'pulse_export' }),
  })
    .then(resp => {
      if (resp.ok) {
        console.log(`[ecosystem-inbound] Reprocess triggered for meeting ${meetingId}`)
      } else {
        console.warn(`[ecosystem-inbound] Reprocess trigger returned ${resp.status} for ${meetingId}`)
      }
    })
    .catch(err => console.warn(`[ecosystem-inbound] Reprocess trigger failed for ${meetingId}:`, err.message))
}
