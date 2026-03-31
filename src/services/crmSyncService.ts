// CRM Sync Service - Syncs Entomate action items to Logos Vision CRM tasks
//
// This service handles bidirectional sync between Entomate and Logos Vision CRM.
// - Action items from meetings → Logos Vision tasks
// - Meetings → Logos Vision activities
// - Projects → Logos Vision projects (linked)
//
// Uses logosVisionSupabase for CRM operations and main supabase for Entomate data.

import { supabase, EntoamateActionItem, EntomateMeeting, EntoamateProject } from '../lib/supabase'
import {
  logosVisionSupabase,
  LogosVisionTeamMember,
  LogosVisionTask,
  LogosVisionActivity,
  LogosVisionProject,
  testLogosVisionConnection,
  getConnectionInfo,
} from '../lib/logosVisionClient'
import { ecosystemBridge } from './ecosystemBridge'

// Re-export types for convenience
export type { LogosVisionTeamMember, LogosVisionTask, LogosVisionActivity, LogosVisionProject }

// ==================== TYPES ====================

export interface SyncResult {
  success: boolean
  actionItemId: string
  crmTaskId?: string
  error?: string
}

export interface MeetingSyncResult {
  success: boolean
  meetingId: string
  activityId?: string
  actionItemResults?: SyncResult[]
  error?: string
}

export interface ProjectSyncResult {
  success: boolean
  entoamteProjectId: string
  logosProjectId?: string
  error?: string
}

export interface SyncStatusSummary {
  total: number
  synced: number
  pending: number
  failed: number
  lastSyncAt: string | null
}

// Export connection helpers
export { testLogosVisionConnection, getConnectionInfo }

// ==================== TEAM MEMBER LOOKUP ====================

/**
 * Find a team member in Logos Vision CRM by name (fuzzy match)
 */
export async function findTeamMemberByName(name: string): Promise<LogosVisionTeamMember | null> {
  if (!name) return null

  // Try exact match first (using Logos Vision client)
  const { data: exactMatch, error: exactError } = await logosVisionSupabase
    .from('team_members')
    .select('id, name, email, role')
    .ilike('name', name)
    .limit(1)
    .single()

  if (exactMatch && !exactError) {
    return exactMatch
  }

  // Try partial match (first name or last name)
  const { data: partialMatches, error: partialError } = await logosVisionSupabase
    .from('team_members')
    .select('id, name, email, role')
    .ilike('name', `%${name}%`)
    .limit(5)

  if (partialError) {
    console.error('Error searching team members:', partialError)
    return null
  }

  if (partialMatches && partialMatches.length > 0) {
    // Return the best match (shortest name that contains the search term)
    return partialMatches.sort((a, b) => a.name.length - b.name.length)[0]
  }

  return null
}

/**
 * Get all team members from Logos Vision CRM
 */
export async function getAllTeamMembers(): Promise<LogosVisionTeamMember[]> {
  const { data, error } = await logosVisionSupabase
    .from('team_members')
    .select('id, name, email, role')
    .order('name')

  if (error) {
    console.error('Error fetching team members:', error)
    return []
  }

  return data || []
}

// ==================== TASK CREATION ====================

/**
 * Create a task in Logos Vision CRM from an Entomate action item
 */
export async function createCrmTask(
  actionItem: EntoamateActionItem,
  teamMemberId: string | null,
  meetingTitle?: string
): Promise<{ id: string } | null> {
  // Build notes with Entomate reference (for traceability)
  const noteParts = []
  if (meetingTitle) {
    noteParts.push(`[Entomate Meeting: ${meetingTitle}]`)
  } else {
    noteParts.push('[From Entomate]')
  }
  noteParts.push(`Priority: ${actionItem.priority}`)
  noteParts.push(`Action Item ID: ${actionItem.id}`)

  const taskData: Record<string, any> = {
    description: actionItem.task_description,
    team_member_id: teamMemberId,
    due_date: actionItem.due_date || null,
    status: 'To Do',
    notes: noteParts.join('\n'),
    priority: actionItem.priority === 'high' ? 'High' : actionItem.priority === 'medium' ? 'Medium' : 'Low',
    // Entomate reference fields for bidirectional sync
    entomate_action_item_id: actionItem.id,
    entomate_meeting_id: actionItem.meeting_id,
  }

  // Create task in Logos Vision CRM
  const { data, error } = await logosVisionSupabase
    .from('tasks')
    .insert([taskData])
    .select('id')
    .single()

  if (error) {
    console.error('Error creating CRM task:', error)
    return null
  }

  return data
}

// ==================== SYNC OPERATIONS ====================

/**
 * Sync a single action item to Logos Vision CRM
 */
export async function syncActionItemToCrm(
  actionItem: EntoamateActionItem,
  meetingTitle?: string
): Promise<SyncResult> {
  try {
    // Skip if already synced
    if (actionItem.crm_sync_status === 'synced' && actionItem.crm_task_id) {
      return {
        success: true,
        actionItemId: actionItem.id,
        crmTaskId: actionItem.crm_task_id
      }
    }

    // Find team member by name
    let teamMemberId: string | null = null
    if (actionItem.assigned_to_name) {
      const teamMember = await findTeamMemberByName(actionItem.assigned_to_name)
      if (teamMember) {
        teamMemberId = teamMember.id
      }
    }

    // Create task in CRM
    const crmTask = await createCrmTask(actionItem, teamMemberId, meetingTitle)

    if (!crmTask) {
      // Update action item with failed status
      await supabase
        .from('action_items')
        .update({
          crm_sync_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', actionItem.id)

      return {
        success: false,
        actionItemId: actionItem.id,
        error: 'Failed to create task in CRM'
      }
    }

    // Update action item with success status and CRM task ID
    await supabase
      .from('action_items')
      .update({
        crm_sync_status: 'synced',
        crm_task_id: crmTask.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', actionItem.id)

    return {
      success: true,
      actionItemId: actionItem.id,
      crmTaskId: crmTask.id
    }
  } catch (error) {
    console.error('Error syncing action item:', error)

    // Update action item with failed status
    await supabase
      .from('action_items')
      .update({
        crm_sync_status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', actionItem.id)

    return {
      success: false,
      actionItemId: actionItem.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Sync all action items from a meeting to Logos Vision CRM
 */
export async function syncMeetingActionItemsToCrm(
  meetingId: string,
  meetingTitle?: string
): Promise<SyncResult[]> {
  // Get all action items for the meeting
  const { data: actionItems, error } = await supabase
    .from('action_items')
    .select('*')
    .eq('meeting_id', meetingId)

  if (error) {
    console.error('Error fetching action items:', error)
    return []
  }

  if (!actionItems || actionItems.length === 0) {
    return []
  }

  // Sync each action item
  const results: SyncResult[] = []
  for (const actionItem of actionItems) {
    const result = await syncActionItemToCrm(actionItem, meetingTitle)
    results.push(result)
  }

  return results
}

/**
 * Sync all pending action items to Logos Vision CRM
 */
export async function syncAllPendingActionItems(): Promise<SyncResult[]> {
  // Get all pending action items
  const { data: actionItems, error } = await supabase
    .from('action_items')
    .select('*, meetings(title)')
    .eq('crm_sync_status', 'pending')

  if (error) {
    console.error('Error fetching pending action items:', error)
    return []
  }

  if (!actionItems || actionItems.length === 0) {
    return []
  }

  // Sync each action item
  const results: SyncResult[] = []
  for (const actionItem of actionItems) {
    const meetingTitle = (actionItem as any).meetings?.title
    const result = await syncActionItemToCrm(actionItem, meetingTitle)
    results.push(result)
  }

  return results
}

/**
 * Retry failed syncs
 */
export async function retryFailedSyncs(): Promise<SyncResult[]> {
  // Get all failed action items
  const { data: actionItems, error } = await supabase
    .from('action_items')
    .select('*, meetings(title)')
    .eq('crm_sync_status', 'failed')

  if (error) {
    console.error('Error fetching failed action items:', error)
    return []
  }

  if (!actionItems || actionItems.length === 0) {
    return []
  }

  // Reset to pending and sync
  for (const actionItem of actionItems) {
    await supabase
      .from('action_items')
      .update({ crm_sync_status: 'pending' })
      .eq('id', actionItem.id)
  }

  // Sync each action item
  const results: SyncResult[] = []
  for (const actionItem of actionItems) {
    const meetingTitle = (actionItem as any).meetings?.title
    const result = await syncActionItemToCrm(actionItem, meetingTitle)
    results.push(result)
  }

  return results
}

// ==================== SYNC STATUS ====================

/**
 * Get sync status summary for a meeting
 */
export async function getMeetingSyncStatus(meetingId: string): Promise<{
  total: number
  synced: number
  pending: number
  failed: number
}> {
  const { data: actionItems, error } = await supabase
    .from('action_items')
    .select('crm_sync_status')
    .eq('meeting_id', meetingId)

  if (error || !actionItems) {
    return { total: 0, synced: 0, pending: 0, failed: 0 }
  }

  return {
    total: actionItems.length,
    synced: actionItems.filter(i => i.crm_sync_status === 'synced').length,
    pending: actionItems.filter(i => i.crm_sync_status === 'pending').length,
    failed: actionItems.filter(i => i.crm_sync_status === 'failed').length
  }
}

// ==================== MEETING SYNC ====================

/**
 * Create an activity in Logos Vision from an Entomate meeting
 */
export async function createActivityFromMeeting(
  meeting: EntomateMeeting,
  teamMemberId: string
): Promise<{ id: string } | null> {
  // Build notes with meeting summary and key points
  const noteParts: string[] = []
  noteParts.push('📋 Synced from Entomate')
  noteParts.push(`Entomate Meeting ID: ${meeting.id}`)

  if (meeting.summary) {
    noteParts.push('\n--- Summary ---')
    noteParts.push(meeting.summary)
  }

  if (meeting.key_points && meeting.key_points.length > 0) {
    noteParts.push('\n--- Key Points ---')
    meeting.key_points.forEach((point, i) => {
      noteParts.push(`${i + 1}. ${point}`)
    })
  }

  if (meeting.decisions && meeting.decisions.length > 0) {
    noteParts.push('\n--- Decisions ---')
    meeting.decisions.forEach((decision, i) => {
      noteParts.push(`${i + 1}. ${decision}`)
    })
  }

  if (meeting.attendees && meeting.attendees.length > 0) {
    noteParts.push(`\nAttendees: ${meeting.attendees.join(', ')}`)
  }

  const activityData = {
    type: 'Meeting',
    title: meeting.title,
    activity_date: (meeting.start_time || meeting.created_at).split('T')[0],
    activity_time: meeting.start_time?.includes('T')
      ? meeting.start_time.split('T')[1]?.substring(0, 5)
      : undefined,
    status: 'Completed',
    notes: noteParts.join('\n'),
    created_by_id: teamMemberId,
    entomate_meeting_id: meeting.id,
  }

  const { data, error } = await logosVisionSupabase
    .from('activities')
    .insert([activityData])
    .select('id')
    .single()

  if (error) {
    console.error('Error creating activity from meeting:', error)
    return null
  }

  return data
}

/**
 * Sync a complete meeting to Logos Vision (creates activity + syncs action items)
 */
export async function syncMeetingToCrm(
  meetingId: string,
  teamMemberId: string
): Promise<MeetingSyncResult> {
  try {
    // Get meeting data
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single()

    if (meetingError || !meeting) {
      return {
        success: false,
        meetingId,
        error: 'Meeting not found',
      }
    }

    // Check if activity already exists in Logos Vision
    const { data: existingActivity } = await logosVisionSupabase
      .from('activities')
      .select('id')
      .eq('entomate_meeting_id', meetingId)
      .single()

    let activityId: string | undefined

    if (!existingActivity) {
      // Create activity from meeting
      const activity = await createActivityFromMeeting(meeting, teamMemberId)
      activityId = activity?.id
    } else {
      activityId = existingActivity.id
    }

    // Sync all action items from this meeting
    const actionItemResults = await syncMeetingActionItemsToCrm(meetingId, meeting.title)

    return {
      success: true,
      meetingId,
      activityId,
      actionItemResults,
    }
  } catch (error) {
    return {
      success: false,
      meetingId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Sync a meeting to Logos Vision via the Ecosystem Bridge.
 * Includes intelligence profile metadata when available.
 * Falls back to direct sync if the bridge is unavailable.
 */
export async function syncMeetingViaBridge(
  meetingId: string,
  teamMemberId: string,
  intelligenceProfile?: {
    name: string;
    icon?: string;
    slug?: string;
    category?: string;
    sections?: { heading: string; content: string }[];
    outputQualityScore?: number;
    contextSources?: { type: string; count: number }[];
  }
): Promise<MeetingSyncResult> {
  // Check if bridge is available
  if (!ecosystemBridge.isConnected('logos_vision')) {
    console.log('[crmSync] Bridge not available, falling back to direct sync');
    return syncMeetingToCrm(meetingId, teamMemberId);
  }

  try {
    // Load meeting data
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single()

    if (meetingError || !meeting) {
      return { success: false, meetingId, error: 'Meeting not found' }
    }

    // Load action items
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', meetingId)

    // Send via bridge
    const result = await ecosystemBridge.sendMeetingProcessed({
      meeting: {
        id: meeting.id,
        title: meeting.title,
        summary: meeting.summary || null,
        meeting_date: meeting.start_time || meeting.created_at,
        key_points: meeting.key_points || [],
        decisions: meeting.decisions || [],
        attendees: meeting.attendees || [],
      },
      actionItems: (actionItems || []).map(item => ({
        id: item.id,
        task_description: item.task_description,
        assigned_to_name: item.assigned_to_name,
        assigned_to_email: item.assigned_to_email,
        due_date: item.due_date,
        priority: item.priority,
        status: item.status,
        meeting_id: item.meeting_id,
      })),
      teamMemberId,
      intelligenceProfile,
    });

    if (!result) {
      console.warn('[crmSync] Bridge send failed, falling back to direct sync');
      return syncMeetingToCrm(meetingId, teamMemberId);
    }

    // Update action item sync statuses
    for (const item of actionItems || []) {
      await supabase
        .from('action_items')
        .update({
          crm_sync_status: 'synced',
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
    }

    return {
      success: true,
      meetingId,
      activityId: result.activityId as string | undefined,
    }
  } catch (error) {
    console.error('[crmSync] Bridge sync error, falling back:', error);
    return syncMeetingToCrm(meetingId, teamMemberId);
  }
}

// ==================== PROJECT SYNC ====================

/**
 * Link an Entomate project to a Logos Vision project
 */
export async function linkProjectToCrm(
  entoamteProjectId: string,
  logosProjectId: string
): Promise<ProjectSyncResult> {
  try {
    // Update the Logos Vision project with the Entomate reference
    const { error } = await logosVisionSupabase
      .from('projects')
      .update({
        entomate_project_id: entoamteProjectId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', logosProjectId)

    if (error) {
      return {
        success: false,
        entoamteProjectId,
        error: `Failed to link project: ${error.message}`,
      }
    }

    // Update the Entomate project with the Logos Vision reference
    await supabase
      .from('entomate_projects')
      .update({
        logos_project_id: logosProjectId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entoamteProjectId)

    return {
      success: true,
      entoamteProjectId,
      logosProjectId,
    }
  } catch (error) {
    return {
      success: false,
      entoamteProjectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create a Logos Vision project from an Entomate project
 */
export async function createProjectInCrm(
  entoamteProject: EntoamateProject,
  clientId?: string
): Promise<ProjectSyncResult> {
  try {
    const projectData = {
      name: entoamteProject.name,
      description: entoamteProject.description || `Synced from Entomate. Deal Value: ${entoamteProject.deal_value ? `$${entoamteProject.deal_value}` : 'N/A'}`,
      client_id: clientId || null,
      status: entoamteProject.status === 'active' ? 'In Progress' : entoamteProject.status === 'completed' ? 'Completed' : 'Planning',
      start_date: entoamteProject.start_date || new Date().toISOString().split('T')[0],
      end_date: entoamteProject.end_date || null,
      entomate_project_id: entoamteProject.id,
      entomate_deal_id: entoamteProject.crm_deal_id,
    }

    const { data, error } = await logosVisionSupabase
      .from('projects')
      .insert([projectData])
      .select('id')
      .single()

    if (error) {
      return {
        success: false,
        entoamteProjectId: entoamteProject.id,
        error: `Failed to create project: ${error.message}`,
      }
    }

    // Update Entomate project with Logos Vision reference
    await supabase
      .from('entomate_projects')
      .update({
        logos_project_id: data.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entoamteProject.id)

    return {
      success: true,
      entoamteProjectId: entoamteProject.id,
      logosProjectId: data.id,
    }
  } catch (error) {
    return {
      success: false,
      entoamteProjectId: entoamteProject.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get Logos Vision projects for linking
 */
export async function getLogosVisionProjects(): Promise<LogosVisionProject[]> {
  const { data, error } = await logosVisionSupabase
    .from('projects')
    .select('id, name, description, client_id, status, start_date, end_date, entomate_project_id')
    .order('name')

  if (error) {
    console.error('Error fetching Logos Vision projects:', error)
    return []
  }

  return (data || []) as LogosVisionProject[]
}

/**
 * Get Logos Vision clients for project association
 */
export async function getLogosVisionClients(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await logosVisionSupabase
    .from('clients')
    .select('id, name')
    .order('name')

  if (error) {
    console.error('Error fetching Logos Vision clients:', error)
    return []
  }

  return data || []
}

// ==================== OVERALL SYNC STATUS ====================

/**
 * Get overall sync status for all action items
 */
export async function getOverallSyncStatus(): Promise<SyncStatusSummary> {
  const { data: actionItems, error } = await supabase
    .from('action_items')
    .select('crm_sync_status, updated_at')
    .order('updated_at', { ascending: false })

  if (error || !actionItems) {
    return { total: 0, synced: 0, pending: 0, failed: 0, lastSyncAt: null }
  }

  const synced = actionItems.filter(i => i.crm_sync_status === 'synced')

  return {
    total: actionItems.length,
    synced: synced.length,
    pending: actionItems.filter(i => i.crm_sync_status === 'pending').length,
    failed: actionItems.filter(i => i.crm_sync_status === 'failed').length,
    lastSyncAt: synced.length > 0 ? synced[0].updated_at : null,
  }
}
