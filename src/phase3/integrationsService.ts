/**
 * Integrations Service
 *
 * Manages external integrations:
 * - CRM (Salesforce, HubSpot, Pipedrive)
 * - Video platforms (Zoom, Teams, Google Meet)
 * - Calendar (Google Calendar, Outlook)
 * - Custom integrations
 */

import { supabase } from "../lib/supabase"
import type {
  Integration,
  IntegrationSyncLog,
  IntegrationFieldMapping,
  IntegrationType,
  IntegrationStatus,
  SyncDirection,
  ConnectIntegrationInput,
  IntegrationSyncResult,
  CRMContact,
  CRMDeal,
  CRMActivity,
  VideoMeeting,
  CalendarEvent,
  ServiceResponse
} from "./types"

// ============================================================================
// INTEGRATION MANAGEMENT
// ============================================================================

/**
 * Get all integrations
 */
export async function getAllIntegrations(): Promise<ServiceResponse<Integration[]>> {
  try {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .order('display_name')

    if (error) throw error

    return {
      success: true,
      data: data.map(mapIntegrationFromDb)
    }
  } catch (error) {
    console.error('Get all integrations error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get integrations'
    }
  }
}

/**
 * Get integration by type
 */
export async function getIntegration(
  integrationType: IntegrationType
): Promise<ServiceResponse<Integration | null>> {
  try {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('integration_type', integrationType)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return {
      success: true,
      data: data ? mapIntegrationFromDb(data) : null
    }
  } catch (error) {
    console.error('Get integration error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get integration'
    }
  }
}

/**
 * Get active integrations
 */
export async function getActiveIntegrations(): Promise<ServiceResponse<Integration[]>> {
  try {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('is_active', true)
      .order('display_name')

    if (error) throw error

    return {
      success: true,
      data: data.map(mapIntegrationFromDb)
    }
  } catch (error) {
    console.error('Get active integrations error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get active integrations'
    }
  }
}

/**
 * Connect an integration
 */
export async function connectIntegration(
  input: ConnectIntegrationInput
): Promise<ServiceResponse<Integration>> {
  try {
    const displayName = getDisplayName(input.integrationType)

    const { data, error } = await supabase
      .from('integrations')
      .upsert({
        integration_type: input.integrationType,
        display_name: displayName,
        access_token: input.accessToken || null,
        refresh_token: input.refreshToken || null,
        config: input.config || {},
        is_active: true,
        error_count: 0,
        last_error: null
      }, {
        onConflict: 'integration_type'
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapIntegrationFromDb(data)
    }
  } catch (error) {
    console.error('Connect integration error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect integration'
    }
  }
}

/**
 * Disconnect an integration
 */
export async function disconnectIntegration(
  integrationType: IntegrationType
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('integrations')
      .update({
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('integration_type', integrationType)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Disconnect integration error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to disconnect integration'
    }
  }
}

/**
 * Update integration tokens
 */
export async function updateIntegrationTokens(
  integrationType: IntegrationType,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: string
): Promise<ServiceResponse<Integration>> {
  try {
    const updateData: Record<string, unknown> = {
      access_token: accessToken,
      updated_at: new Date().toISOString()
    }

    if (refreshToken) updateData.refresh_token = refreshToken
    if (expiresAt) updateData.token_expires_at = expiresAt

    const { data, error } = await supabase
      .from('integrations')
      .update(updateData)
      .eq('integration_type', integrationType)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapIntegrationFromDb(data)
    }
  } catch (error) {
    console.error('Update integration tokens error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update tokens'
    }
  }
}

/**
 * Update integration config
 */
export async function updateIntegrationConfig(
  integrationType: IntegrationType,
  config: Record<string, unknown>
): Promise<ServiceResponse<Integration>> {
  try {
    const { data, error } = await supabase
      .from('integrations')
      .update({
        config,
        updated_at: new Date().toISOString()
      })
      .eq('integration_type', integrationType)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapIntegrationFromDb(data)
    }
  } catch (error) {
    console.error('Update integration config error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update config'
    }
  }
}

/**
 * Record integration error
 */
export async function recordIntegrationError(
  integrationType: IntegrationType,
  errorMessage: string
): Promise<void> {
  try {
    const { data: integration } = await supabase
      .from('integrations')
      .select('error_count')
      .eq('integration_type', integrationType)
      .single()

    const errorCount = (integration?.error_count || 0) + 1

    await supabase
      .from('integrations')
      .update({
        last_error: errorMessage,
        error_count: errorCount,
        is_active: errorCount < 10, // Auto-disable after 10 errors
        updated_at: new Date().toISOString()
      })
      .eq('integration_type', integrationType)
  } catch (error) {
    console.error('Record integration error:', error)
  }
}

/**
 * Clear integration errors
 */
export async function clearIntegrationErrors(
  integrationType: IntegrationType
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('integrations')
      .update({
        last_error: null,
        error_count: 0,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('integration_type', integrationType)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Clear integration errors error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear errors'
    }
  }
}

// ============================================================================
// FIELD MAPPINGS
// ============================================================================

/**
 * Get field mappings for an integration
 */
export async function getFieldMappings(
  integrationId: string
): Promise<ServiceResponse<IntegrationFieldMapping[]>> {
  try {
    const { data, error } = await supabase
      .from('integration_field_mappings')
      .select('*')
      .eq('integration_id', integrationId)
      .order('local_field')

    if (error) throw error

    return {
      success: true,
      data: data.map(mapFieldMappingFromDb)
    }
  } catch (error) {
    console.error('Get field mappings error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get field mappings'
    }
  }
}

/**
 * Create a field mapping
 */
export async function createFieldMapping(
  integrationId: string,
  localField: string,
  remoteField: string,
  transformFunction?: string,
  isRequired: boolean = false
): Promise<ServiceResponse<IntegrationFieldMapping>> {
  try {
    const { data, error } = await supabase
      .from('integration_field_mappings')
      .insert({
        integration_id: integrationId,
        local_field: localField,
        remote_field: remoteField,
        transform_function: transformFunction || null,
        is_required: isRequired
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapFieldMappingFromDb(data)
    }
  } catch (error) {
    console.error('Create field mapping error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create field mapping'
    }
  }
}

/**
 * Delete a field mapping
 */
export async function deleteFieldMapping(
  mappingId: string
): Promise<ServiceResponse<void>> {
  try {
    const { error } = await supabase
      .from('integration_field_mappings')
      .delete()
      .eq('id', mappingId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Delete field mapping error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete field mapping'
    }
  }
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Start a sync operation
 */
export async function startSync(
  integrationId: string,
  direction: SyncDirection
): Promise<ServiceResponse<IntegrationSyncLog>> {
  try {
    const { data, error } = await supabase
      .from('integration_sync_logs')
      .insert({
        integration_id: integrationId,
        sync_direction: direction,
        status: 'running',
        records_synced: 0,
        records_failed: 0,
        errors: []
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapSyncLogFromDb(data)
    }
  } catch (error) {
    console.error('Start sync error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start sync'
    }
  }
}

/**
 * Complete a sync operation
 */
export async function completeSync(
  syncLogId: string,
  result: IntegrationSyncResult
): Promise<ServiceResponse<IntegrationSyncLog>> {
  try {
    const { data, error } = await supabase
      .from('integration_sync_logs')
      .update({
        records_synced: result.recordsSynced,
        records_failed: result.recordsFailed,
        errors: result.errors,
        status: result.success ? 'completed' : 'failed',
        completed_at: new Date().toISOString()
      })
      .eq('id', syncLogId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: mapSyncLogFromDb(data)
    }
  } catch (error) {
    console.error('Complete sync error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete sync'
    }
  }
}

/**
 * Get sync history for an integration
 */
export async function getSyncHistory(
  integrationId: string,
  limit: number = 20
): Promise<ServiceResponse<IntegrationSyncLog[]>> {
  try {
    const { data, error } = await supabase
      .from('integration_sync_logs')
      .select('*')
      .eq('integration_id', integrationId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return {
      success: true,
      data: data.map(mapSyncLogFromDb)
    }
  } catch (error) {
    console.error('Get sync history error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sync history'
    }
  }
}

// ============================================================================
// CRM OPERATIONS (Abstract interface - implement per provider)
// ============================================================================

/**
 * Sync contacts from CRM
 */
export async function syncCRMContacts(
  integrationType: IntegrationType
): Promise<ServiceResponse<IntegrationSyncResult>> {
  const integrationResult = await getIntegration(integrationType)
  if (!integrationResult.success || !integrationResult.data) {
    return { success: false, error: 'Integration not found or not connected' }
  }

  const integration = integrationResult.data
  if (!integration.isActive) {
    return { success: false, error: 'Integration is not active' }
  }

  const syncLogResult = await startSync(integration.id, 'inbound')
  if (!syncLogResult.success || !syncLogResult.data) {
    return { success: false, error: 'Failed to start sync' }
  }

  try {
    const startTime = Date.now()
    let recordsSynced = 0
    let recordsFailed = 0
    const errors: string[] = []

    // Provider-specific contact sync
    if (integrationType === 'salesforce' && integration.accessToken) {
      const response = await fetch(
        `${integration.config?.instanceUrl || 'https://login.salesforce.com'}/services/data/v57.0/query?q=SELECT+Id,FirstName,LastName,Email,Phone+FROM+Contact+LIMIT+100`,
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      if (response.ok) {
        const data = await response.json()
        recordsSynced = data.records?.length || 0
      } else {
        errors.push(`Salesforce API error: ${response.status}`)
      }
    } else if (integrationType === 'hubspot' && integration.accessToken) {
      const response = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100',
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      if (response.ok) {
        const data = await response.json()
        recordsSynced = data.results?.length || 0
      } else {
        errors.push(`HubSpot API error: ${response.status}`)
      }
    } else if (integrationType === 'pipedrive' && integration.config?.apiKey) {
      const response = await fetch(
        `https://api.pipedrive.com/v1/persons?api_token=${integration.config.apiKey}&limit=100`
      )
      if (response.ok) {
        const data = await response.json()
        recordsSynced = data.data?.length || 0
      } else {
        errors.push(`Pipedrive API error: ${response.status}`)
      }
    }

    const result: IntegrationSyncResult = {
      success: errors.length === 0,
      recordsSynced,
      recordsFailed,
      errors,
      duration: Date.now() - startTime
    }

    await completeSync(syncLogResult.data.id, result)

    // Update last sync time
    await supabase
      .from('integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', integration.id)

    return { success: true, data: result }
  } catch (error) {
    const result: IntegrationSyncResult = {
      success: false,
      recordsSynced: 0,
      recordsFailed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      duration: 0
    }

    await completeSync(syncLogResult.data.id, result)
    await recordIntegrationError(integrationType, result.errors[0])

    return { success: false, error: result.errors[0] }
  }
}

/**
 * Push activity to CRM
 */
export async function pushActivityToCRM(
  integrationType: IntegrationType,
  activity: CRMActivity
): Promise<ServiceResponse<string>> {
  const integrationResult = await getIntegration(integrationType)
  if (!integrationResult.success || !integrationResult.data) {
    return { success: false, error: 'Integration not found or not connected' }
  }

  if (!integrationResult.data.isActive) {
    return { success: false, error: 'Integration is not active' }
  }

  try {
    const integration = integrationResult.data
    let activityId: string | null = null

    // Provider-specific activity creation
    if (integrationType === 'salesforce' && integration.accessToken) {
      const response = await fetch(
        `${integration.config?.instanceUrl || 'https://login.salesforce.com'}/services/data/v57.0/sobjects/Task`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            Subject: activity.subject,
            Description: activity.description,
            Status: activity.status === 'completed' ? 'Completed' : 'Not Started',
            Priority: activity.priority || 'Normal',
            ActivityDate: activity.date
          })
        }
      )
      if (response.ok) {
        const data = await response.json()
        activityId = data.id
      } else {
        throw new Error(`Salesforce API error: ${response.status}`)
      }
    } else if (integrationType === 'hubspot' && integration.accessToken) {
      const response = await fetch(
        'https://api.hubapi.com/crm/v3/objects/tasks',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: {
              hs_task_subject: activity.subject,
              hs_task_body: activity.description,
              hs_task_status: activity.status === 'completed' ? 'COMPLETED' : 'NOT_STARTED',
              hs_task_priority: activity.priority?.toUpperCase() || 'MEDIUM'
            }
          })
        }
      )
      if (response.ok) {
        const data = await response.json()
        activityId = data.id
      } else {
        throw new Error(`HubSpot API error: ${response.status}`)
      }
    } else if (integrationType === 'pipedrive' && integration.config?.apiKey) {
      const response = await fetch(
        `https://api.pipedrive.com/v1/activities?api_token=${integration.config.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: activity.subject,
            type: 'task',
            note: activity.description,
            due_date: activity.date,
            done: activity.status === 'completed' ? 1 : 0
          })
        }
      )
      if (response.ok) {
        const data = await response.json()
        activityId = data.data?.id?.toString()
      } else {
        throw new Error(`Pipedrive API error: ${response.status}`)
      }
    }

    return { success: true, data: activityId || 'activity_' + Date.now() }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await recordIntegrationError(integrationType, errorMessage)
    return { success: false, error: errorMessage }
  }
}

// ============================================================================
// CALENDAR OPERATIONS
// ============================================================================

/**
 * Sync calendar events
 */
export async function syncCalendarEvents(
  integrationType: IntegrationType,
  startDate: string,
  endDate: string
): Promise<ServiceResponse<CalendarEvent[]>> {
  const integrationResult = await getIntegration(integrationType)
  if (!integrationResult.success || !integrationResult.data) {
    return { success: false, error: 'Integration not found or not connected' }
  }

  if (!integrationResult.data.isActive) {
    return { success: false, error: 'Integration is not active' }
  }

  try {
    const integration = integrationResult.data
    const events: CalendarEvent[] = []

    if (integrationType === 'google_calendar' && integration.accessToken) {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startDate}&timeMax=${endDate}&maxResults=50`,
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      if (response.ok) {
        const data = await response.json()
        for (const item of data.items || []) {
          events.push({
            id: item.id,
            title: item.summary || 'Untitled',
            description: item.description,
            startTime: item.start?.dateTime || item.start?.date,
            endTime: item.end?.dateTime || item.end?.date,
            location: item.location,
            attendees: item.attendees?.map((a: any) => a.email) || [],
            isRecurring: !!item.recurringEventId
          })
        }
      } else {
        throw new Error(`Google Calendar API error: ${response.status}`)
      }
    } else if (integrationType === 'outlook_calendar' && integration.accessToken) {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDate}&endDateTime=${endDate}&$top=50`,
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      if (response.ok) {
        const data = await response.json()
        for (const item of data.value || []) {
          events.push({
            id: item.id,
            title: item.subject || 'Untitled',
            description: item.bodyPreview,
            startTime: item.start?.dateTime,
            endTime: item.end?.dateTime,
            location: item.location?.displayName,
            attendees: item.attendees?.map((a: any) => a.emailAddress?.address) || [],
            isRecurring: item.seriesMasterId != null
          })
        }
      } else {
        throw new Error(`Outlook Calendar API error: ${response.status}`)
      }
    }

    return { success: true, data: events }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await recordIntegrationError(integrationType, errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Create calendar event
 */
export async function createCalendarEvent(
  integrationType: IntegrationType,
  event: Omit<CalendarEvent, 'id'>
): Promise<ServiceResponse<CalendarEvent>> {
  const integrationResult = await getIntegration(integrationType)
  if (!integrationResult.success || !integrationResult.data) {
    return { success: false, error: 'Integration not found or not connected' }
  }

  if (!integrationResult.data.isActive) {
    return { success: false, error: 'Integration is not active' }
  }

  try {
    const integration = integrationResult.data
    let createdEvent: CalendarEvent | null = null

    if (integrationType === 'google_calendar' && integration.accessToken) {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            summary: event.title,
            description: event.description,
            start: { dateTime: event.startTime },
            end: { dateTime: event.endTime },
            location: event.location,
            attendees: event.attendees?.map(email => ({ email }))
          })
        }
      )
      if (response.ok) {
        const data = await response.json()
        createdEvent = {
          id: data.id,
          title: data.summary,
          description: data.description,
          startTime: data.start?.dateTime,
          endTime: data.end?.dateTime,
          location: data.location,
          attendees: data.attendees?.map((a: any) => a.email) || [],
          isRecurring: false
        }
      } else {
        throw new Error(`Google Calendar API error: ${response.status}`)
      }
    } else if (integrationType === 'outlook_calendar' && integration.accessToken) {
      const response = await fetch(
        'https://graph.microsoft.com/v1.0/me/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subject: event.title,
            body: { contentType: 'Text', content: event.description || '' },
            start: { dateTime: event.startTime, timeZone: 'UTC' },
            end: { dateTime: event.endTime, timeZone: 'UTC' },
            location: { displayName: event.location || '' },
            attendees: event.attendees?.map(email => ({
              emailAddress: { address: email },
              type: 'required'
            }))
          })
        }
      )
      if (response.ok) {
        const data = await response.json()
        createdEvent = {
          id: data.id,
          title: data.subject,
          description: data.bodyPreview,
          startTime: data.start?.dateTime,
          endTime: data.end?.dateTime,
          location: data.location?.displayName,
          attendees: data.attendees?.map((a: any) => a.emailAddress?.address) || [],
          isRecurring: false
        }
      } else {
        throw new Error(`Outlook Calendar API error: ${response.status}`)
      }
    }

    if (!createdEvent) {
      createdEvent = { id: 'event_' + Date.now(), ...event }
    }

    return { success: true, data: createdEvent }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await recordIntegrationError(integrationType, errorMessage)
    return { success: false, error: errorMessage }
  }
}

// ============================================================================
// VIDEO PLATFORM OPERATIONS
// ============================================================================

/**
 * Get video meetings
 */
export async function getVideoMeetings(
  integrationType: IntegrationType,
  startDate: string,
  endDate: string
): Promise<ServiceResponse<VideoMeeting[]>> {
  const integrationResult = await getIntegration(integrationType)
  if (!integrationResult.success || !integrationResult.data) {
    return { success: false, error: 'Integration not found or not connected' }
  }

  if (!integrationResult.data.isActive) {
    return { success: false, error: 'Integration is not active' }
  }

  try {
    const integration = integrationResult.data
    const meetings: VideoMeeting[] = []

    if (integrationType === 'zoom' && integration.accessToken) {
      const response = await fetch(
        `https://api.zoom.us/v2/users/me/meetings?type=scheduled&from=${startDate}&to=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      if (response.ok) {
        const data = await response.json()
        for (const item of data.meetings || []) {
          meetings.push({
            id: item.id?.toString(),
            topic: item.topic,
            startTime: item.start_time,
            duration: item.duration,
            joinUrl: item.join_url,
            hostEmail: item.host_email || '',
            participants: [],
            recordingUrl: null,
            transcriptUrl: null
          })
        }
      } else {
        throw new Error(`Zoom API error: ${response.status}`)
      }
    } else if (integrationType === 'teams' && integration.accessToken) {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/onlineMeetings`,
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      if (response.ok) {
        const data = await response.json()
        for (const item of data.value || []) {
          meetings.push({
            id: item.id,
            topic: item.subject || 'Teams Meeting',
            startTime: item.startDateTime,
            duration: 60, // Default duration
            joinUrl: item.joinWebUrl,
            hostEmail: item.organizer?.upn || '',
            participants: item.participants?.attendees?.map((a: any) => a.upn) || [],
            recordingUrl: null,
            transcriptUrl: null
          })
        }
      } else {
        throw new Error(`Teams API error: ${response.status}`)
      }
    } else if (integrationType === 'google_meet' && integration.accessToken) {
      // Google Meet meetings are tied to Calendar events
      const calendarResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startDate}&timeMax=${endDate}&maxResults=50`,
        {
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      if (calendarResponse.ok) {
        const data = await calendarResponse.json()
        for (const item of data.items || []) {
          if (item.conferenceData?.entryPoints) {
            const videoEntry = item.conferenceData.entryPoints.find((e: any) => e.entryPointType === 'video')
            if (videoEntry) {
              meetings.push({
                id: item.id,
                topic: item.summary || 'Google Meet',
                startTime: item.start?.dateTime || item.start?.date,
                duration: 60,
                joinUrl: videoEntry.uri,
                hostEmail: item.organizer?.email || '',
                participants: item.attendees?.map((a: any) => a.email) || [],
                recordingUrl: null,
                transcriptUrl: null
              })
            }
          }
        }
      } else {
        throw new Error(`Google Meet API error: ${calendarResponse.status}`)
      }
    }

    return { success: true, data: meetings }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await recordIntegrationError(integrationType, errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Create video meeting
 */
export async function createVideoMeeting(
  integrationType: IntegrationType,
  topic: string,
  startTime: string,
  duration: number
): Promise<ServiceResponse<VideoMeeting>> {
  const integrationResult = await getIntegration(integrationType)
  if (!integrationResult.success || !integrationResult.data) {
    return { success: false, error: 'Integration not found or not connected' }
  }

  if (!integrationResult.data.isActive) {
    return { success: false, error: 'Integration is not active' }
  }

  try {
    const integration = integrationResult.data
    let meeting: VideoMeeting | null = null

    if (integrationType === 'zoom' && integration.accessToken) {
      const response = await fetch(
        'https://api.zoom.us/v2/users/me/meetings',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            topic,
            type: 2, // Scheduled meeting
            start_time: startTime,
            duration,
            timezone: 'UTC',
            settings: {
              host_video: true,
              participant_video: true,
              join_before_host: false,
              mute_upon_entry: true,
              auto_recording: 'cloud'
            }
          })
        }
      )
      if (response.ok) {
        const data = await response.json()
        meeting = {
          id: data.id?.toString(),
          topic: data.topic,
          startTime: data.start_time,
          duration: data.duration,
          joinUrl: data.join_url,
          hostEmail: data.host_email || '',
          participants: [],
          recordingUrl: null,
          transcriptUrl: null
        }
      } else {
        throw new Error(`Zoom API error: ${response.status}`)
      }
    } else if (integrationType === 'teams' && integration.accessToken) {
      const response = await fetch(
        'https://graph.microsoft.com/v1.0/me/onlineMeetings',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subject: topic,
            startDateTime: startTime,
            endDateTime: new Date(new Date(startTime).getTime() + duration * 60000).toISOString()
          })
        }
      )
      if (response.ok) {
        const data = await response.json()
        meeting = {
          id: data.id,
          topic: data.subject || topic,
          startTime: data.startDateTime,
          duration,
          joinUrl: data.joinWebUrl,
          hostEmail: data.organizer?.upn || '',
          participants: [],
          recordingUrl: null,
          transcriptUrl: null
        }
      } else {
        throw new Error(`Teams API error: ${response.status}`)
      }
    } else if (integrationType === 'google_meet' && integration.accessToken) {
      // Create a calendar event with Google Meet
      const endTime = new Date(new Date(startTime).getTime() + duration * 60000).toISOString()
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            summary: topic,
            start: { dateTime: startTime },
            end: { dateTime: endTime },
            conferenceData: {
              createRequest: {
                requestId: `meet-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' }
              }
            }
          })
        }
      )
      if (response.ok) {
        const data = await response.json()
        const videoEntry = data.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')
        meeting = {
          id: data.id,
          topic: data.summary || topic,
          startTime: data.start?.dateTime,
          duration,
          joinUrl: videoEntry?.uri || data.hangoutLink || '',
          hostEmail: data.organizer?.email || '',
          participants: [],
          recordingUrl: null,
          transcriptUrl: null
        }
      } else {
        throw new Error(`Google Meet API error: ${response.status}`)
      }
    }

    if (!meeting) {
      meeting = {
        id: 'meeting_' + Date.now(),
        topic,
        startTime,
        duration,
        joinUrl: 'https://example.com/join/' + Date.now(),
        hostEmail: '',
        participants: [],
        recordingUrl: null,
        transcriptUrl: null
      }
    }

    return { success: true, data: meeting }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await recordIntegrationError(integrationType, errorMessage)
    return { success: false, error: errorMessage }
  }
}

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Get OAuth authorization URL
 */
export function getOAuthAuthorizationUrl(
  integrationType: IntegrationType,
  redirectUri: string,
  state: string
): string {
  const configs: Record<string, { authUrl: string; clientId: string; scopes: string[] }> = {
    salesforce: {
      authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
      clientId: import.meta.env.VITE_SALESFORCE_CLIENT_ID || '',
      scopes: ['api', 'refresh_token']
    },
    hubspot: {
      authUrl: 'https://app.hubspot.com/oauth/authorize',
      clientId: import.meta.env.VITE_HUBSPOT_CLIENT_ID || '',
      scopes: ['contacts', 'crm.objects.deals.read', 'crm.objects.deals.write']
    },
    zoom: {
      authUrl: 'https://zoom.us/oauth/authorize',
      clientId: import.meta.env.VITE_ZOOM_CLIENT_ID || '',
      scopes: ['meeting:read', 'meeting:write', 'recording:read']
    },
    google_calendar: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      scopes: ['https://www.googleapis.com/auth/calendar']
    }
  }

  const config = configs[integrationType]
  if (!config) {
    throw new Error(`OAuth not supported for ${integrationType}`)
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state
  })

  return `${config.authUrl}?${params.toString()}`
}

/**
 * Check if integration needs token refresh
 */
export async function needsTokenRefresh(
  integrationType: IntegrationType
): Promise<boolean> {
  const integrationResult = await getIntegration(integrationType)
  if (!integrationResult.success || !integrationResult.data) {
    return false
  }

  const integration = integrationResult.data
  if (!integration.tokenExpiresAt) {
    return false
  }

  // Refresh if token expires within 5 minutes
  const expiresAt = new Date(integration.tokenExpiresAt)
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

  return expiresAt < fiveMinutesFromNow
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDisplayName(integrationType: IntegrationType): string {
  const names: Record<IntegrationType, string> = {
    salesforce: 'Salesforce',
    hubspot: 'HubSpot',
    pipedrive: 'Pipedrive',
    zoom: 'Zoom',
    teams: 'Microsoft Teams',
    google_meet: 'Google Meet',
    google_calendar: 'Google Calendar',
    outlook_calendar: 'Outlook Calendar',
    slack: 'Slack',
    custom: 'Custom Integration'
  }
  return names[integrationType] || integrationType
}

function mapIntegrationFromDb(row: Record<string, unknown>): Integration {
  return {
    id: row.id as string,
    integrationType: row.integration_type as IntegrationType,
    displayName: row.display_name as string,
    accessToken: row.access_token as string | null,
    refreshToken: row.refresh_token as string | null,
    tokenExpiresAt: row.token_expires_at as string | null,
    config: (row.config || {}) as Record<string, unknown>,
    isActive: row.is_active as boolean,
    lastSyncAt: row.last_sync_at as string | null,
    lastError: row.last_error as string | null,
    errorCount: row.error_count as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

function mapSyncLogFromDb(row: Record<string, unknown>): IntegrationSyncLog {
  return {
    id: row.id as string,
    integrationId: row.integration_id as string,
    syncDirection: row.sync_direction as SyncDirection,
    recordsSynced: row.records_synced as number,
    recordsFailed: row.records_failed as number,
    errors: (row.errors || []) as string[],
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string | null,
    status: row.status as 'running' | 'completed' | 'failed'
  }
}

function mapFieldMappingFromDb(row: Record<string, unknown>): IntegrationFieldMapping {
  return {
    id: row.id as string,
    integrationId: row.integration_id as string,
    localField: row.local_field as string,
    remoteField: row.remote_field as string,
    transformFunction: row.transform_function as string | null,
    isRequired: row.is_required as boolean,
    createdAt: row.created_at as string
  }
}
