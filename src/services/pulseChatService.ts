// Pulse Chat Service - Posts meeting summaries and notifications to Pulse
import { supabase, EntomateMeeting, EntoamteActionItem } from '../lib/supabase'

// ==================== PULSE CONFIGURATION ====================

const PULSE_SUPABASE_URL = 'https://ucaeuszgoihoyrvhewxk.supabase.co'
const PULSE_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYWV1c3pnb2lob3lydmhld3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjg5ODYsImV4cCI6MjA4MDgwNDk4Nn0.0VGjpsPBYjyk6QTG5rAQX4_NcpfBTyR85ofE5jiHTKo'

// ==================== TYPES ====================

export interface PulseChannel {
  id: string
  name: string
  description?: string
  type: 'public' | 'private' | 'direct'
}

export interface PulseMessage {
  id: string
  channelId: string
  content: string
  senderId?: string
  senderName: string
  senderType: 'user' | 'bot' | 'system'
  createdAt: string
  metadata?: Record<string, any>
}

export interface PostResult {
  success: boolean
  messageId?: string
  channelId?: string
  error?: string
}

// ==================== PULSE API HELPERS ====================

/**
 * Post a message to Pulse via REST API
 */
async function postToPulseApi(endpoint: string, data: any): Promise<any> {
  const response = await fetch(`${PULSE_SUPABASE_URL}/rest/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'apikey': PULSE_SUPABASE_KEY,
      'Authorization': `Bearer ${PULSE_SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Pulse API error: ${errorText}`)
  }

  return response.json()
}

/**
 * Fetch from Pulse API
 */
async function fetchFromPulseApi(endpoint: string, query: string = ''): Promise<any> {
  const response = await fetch(`${PULSE_SUPABASE_URL}/rest/v1/${endpoint}${query}`, {
    headers: {
      'apikey': PULSE_SUPABASE_KEY,
      'Authorization': `Bearer ${PULSE_SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Pulse API error: ${errorText}`)
  }

  return response.json()
}

// ==================== CHANNEL MANAGEMENT ====================

/**
 * Get available Pulse channels
 */
export async function getPulseChannels(): Promise<PulseChannel[]> {
  try {
    const channels = await fetchFromPulseApi('channels', '?select=id,name,description,type&is_archived=eq.false')
    return channels || []
  } catch (error) {
    console.error('Failed to fetch Pulse channels:', error)
    return []
  }
}

/**
 * Get or create an Entomate notifications channel in Pulse
 */
export async function getOrCreateEntomateChannel(): Promise<PulseChannel | null> {
  try {
    // Try to find existing Entomate channel
    const channels = await fetchFromPulseApi('channels', '?name=eq.entomate-meetings&limit=1')

    if (channels && channels.length > 0) {
      return channels[0]
    }

    // Create new channel if it doesn't exist
    const newChannel = await postToPulseApi('channels', {
      name: 'entomate-meetings',
      description: 'Meeting summaries and action items from Entomate',
      type: 'public',
      created_at: new Date().toISOString()
    })

    return newChannel?.[0] || null
  } catch (error) {
    console.error('Failed to get/create Entomate channel:', error)
    return null
  }
}

// ==================== MESSAGE POSTING ====================

/**
 * Post a message to a Pulse channel
 */
export async function postMessageToChannel(
  channelId: string,
  content: string,
  metadata?: Record<string, any>
): Promise<PostResult> {
  try {
    const result = await postToPulseApi('chat_messages', {
      channel_id: channelId,
      content,
      sender_name: 'Entomate Bot',
      sender_type: 'bot',
      metadata,
      created_at: new Date().toISOString()
    })

    return {
      success: true,
      messageId: result?.[0]?.id,
      channelId
    }
  } catch (error) {
    console.error('Failed to post message to Pulse:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send a notification to Pulse (via notification_queue)
 */
export async function sendPulseNotification(notification: {
  targetUserId?: string
  title: string
  body: string
  url?: string
  type: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}): Promise<PostResult> {
  try {
    const result = await postToPulseApi('notifications', {
      user_id: notification.targetUserId || 'all',
      type: notification.type,
      title: notification.title,
      body: notification.body,
      url: notification.url,
      source: 'entomate',
      priority: notification.priority || 'normal',
      created_at: new Date().toISOString()
    })

    return {
      success: true,
      messageId: result?.[0]?.id
    }
  } catch (error) {
    console.error('Failed to send Pulse notification:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ==================== MEETING SUMMARY FORMATTING ====================

/**
 * Format meeting summary for Pulse chat
 */
export function formatMeetingSummaryForPulse(
  meeting: EntomateMeeting,
  actionItems: EntoamteActionItem[]
): string {
  const lines: string[] = []

  // Header
  lines.push(`## Meeting Summary: ${meeting.title}`)
  lines.push('')
  lines.push(`**Date:** ${new Date(meeting.created_at).toLocaleDateString()}`)
  if (meeting.duration_minutes) {
    lines.push(`**Duration:** ${meeting.duration_minutes} minutes`)
  }
  if (meeting.sentiment_label) {
    const emoji = meeting.sentiment_label === 'positive' ? '🟢' : meeting.sentiment_label === 'negative' ? '🔴' : '🟡'
    lines.push(`**Sentiment:** ${emoji} ${meeting.sentiment_label}`)
  }
  lines.push('')

  // Summary
  if (meeting.summary) {
    lines.push('### Summary')
    lines.push(meeting.summary)
    lines.push('')
  }

  // Key Points
  if (meeting.key_points && meeting.key_points.length > 0) {
    lines.push('### Key Points')
    meeting.key_points.forEach(point => {
      lines.push(`• ${point}`)
    })
    lines.push('')
  }

  // Decisions
  if (meeting.decisions && meeting.decisions.length > 0) {
    lines.push('### Decisions Made')
    meeting.decisions.forEach(decision => {
      lines.push(`✓ ${decision}`)
    })
    lines.push('')
  }

  // Action Items
  if (actionItems.length > 0) {
    lines.push('### Action Items')
    actionItems.forEach(item => {
      const priority = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢'
      let line = `${priority} ${item.task_description}`
      if (item.assigned_to_name) {
        line += ` → **${item.assigned_to_name}**`
      }
      if (item.due_date) {
        line += ` (Due: ${item.due_date})`
      }
      lines.push(line)
    })
    lines.push('')
  }

  // Footer
  lines.push('---')
  lines.push('*Posted by Entomate*')

  return lines.join('\n')
}

/**
 * Format a short notification message
 */
export function formatMeetingNotification(meeting: EntomateMeeting, actionItemCount: number): string {
  let message = `New meeting processed: "${meeting.title}"`

  if (actionItemCount > 0) {
    message += ` with ${actionItemCount} action item${actionItemCount > 1 ? 's' : ''}`
  }

  return message
}

// ==================== MAIN SYNC FUNCTIONS ====================

/**
 * Post meeting summary to Pulse channel
 */
export async function postMeetingSummaryToPulse(
  meeting: EntomateMeeting,
  actionItems: EntoamteActionItem[],
  channelId?: string
): Promise<PostResult> {
  try {
    // Get channel ID (use provided, or get/create default)
    let targetChannelId = channelId

    if (!targetChannelId) {
      // Try to use meeting's pulse_channel_id if set
      if (meeting.pulse_channel_id) {
        targetChannelId = meeting.pulse_channel_id
      } else {
        // Get or create default Entomate channel
        const channel = await getOrCreateEntomateChannel()
        if (!channel) {
          return {
            success: false,
            error: 'Could not find or create Pulse channel'
          }
        }
        targetChannelId = channel.id
      }
    }

    // Format and post message
    const content = formatMeetingSummaryForPulse(meeting, actionItems)
    const result = await postMessageToChannel(targetChannelId, content, {
      meeting_id: meeting.id,
      action_item_count: actionItems.length,
      source: 'entomate'
    })

    // Update meeting record with Pulse sync info
    if (result.success) {
      await supabase
        .from('entomate_meetings')
        .update({
          pulse_channel_id: targetChannelId,
          pulse_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', meeting.id)
    }

    return result
  } catch (error) {
    console.error('Failed to post meeting summary to Pulse:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send meeting notification to specific users in Pulse
 */
export async function notifyUsersAboutMeeting(
  meeting: EntomateMeeting,
  actionItems: EntoamteActionItem[],
  userIds?: string[]
): Promise<PostResult[]> {
  const results: PostResult[] = []

  // If specific users provided, notify each
  if (userIds && userIds.length > 0) {
    for (const userId of userIds) {
      const result = await sendPulseNotification({
        targetUserId: userId,
        title: `New Meeting Summary: ${meeting.title}`,
        body: formatMeetingNotification(meeting, actionItems.length),
        type: 'meeting_summary',
        priority: 'normal'
      })
      results.push(result)
    }
  } else {
    // Send broadcast notification
    const result = await sendPulseNotification({
      title: `New Meeting Summary: ${meeting.title}`,
      body: formatMeetingNotification(meeting, actionItems.length),
      type: 'meeting_summary',
      priority: 'normal'
    })
    results.push(result)
  }

  return results
}

/**
 * Notify assignees about their action items
 */
export async function notifyAssigneesAboutActionItems(
  meeting: EntomateMeeting,
  actionItems: EntoamteActionItem[]
): Promise<PostResult[]> {
  const results: PostResult[] = []

  // Group action items by assignee
  const itemsByAssignee = new Map<string, EntoamteActionItem[]>()

  for (const item of actionItems) {
    if (item.assigned_to_user_id) {
      const existing = itemsByAssignee.get(item.assigned_to_user_id) || []
      existing.push(item)
      itemsByAssignee.set(item.assigned_to_user_id, existing)
    }
  }

  // Send notification to each assignee
  for (const [userId, items] of itemsByAssignee) {
    const taskList = items.map(i => `• ${i.task_description}`).join('\n')

    const result = await sendPulseNotification({
      targetUserId: userId,
      title: `You have ${items.length} new task${items.length > 1 ? 's' : ''} from "${meeting.title}"`,
      body: taskList,
      type: 'task_assigned',
      priority: items.some(i => i.priority === 'high') ? 'high' : 'normal'
    })
    results.push(result)
  }

  return results
}

// ==================== STATUS CHECK ====================

/**
 * Check if Pulse connection is working
 */
export async function checkPulseConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${PULSE_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': PULSE_SUPABASE_KEY,
        'Authorization': `Bearer ${PULSE_SUPABASE_KEY}`
      }
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get Pulse sync status for a meeting
 */
export async function getMeetingPulseSyncStatus(meetingId: string): Promise<{
  synced: boolean
  channelId?: string
  syncedAt?: string
}> {
  const { data, error } = await supabase
    .from('entomate_meetings')
    .select('pulse_channel_id, pulse_synced_at')
    .eq('id', meetingId)
    .single()

  if (error || !data) {
    return { synced: false }
  }

  return {
    synced: !!data.pulse_synced_at,
    channelId: data.pulse_channel_id,
    syncedAt: data.pulse_synced_at
  }
}
