// Automation Service - Handles automation rules and execution
import { supabase, EntoamteAutomation, EntomateMeeting, EntoamteActionItem } from '../lib/supabase'
import { syncActionItemToCrm } from './crmSyncService'
import { postMeetingSummaryToPulse, notifyAssigneesAboutActionItems } from './pulseChatService'
import { createProjectTask } from './projectService'

// ==================== TRIGGER TYPES ====================

export type TriggerType =
  | 'meeting_completed'        // When a meeting is processed
  | 'action_item_created'      // When action items are extracted
  | 'high_priority_detected'   // When high priority items found
  | 'keyword_detected'         // When specific keywords in transcript
  | 'sentiment_negative'       // When negative sentiment detected
  | 'scheduled'                // Time-based trigger

export interface TriggerConfig {
  // For keyword_detected
  keywords?: string[]
  // For scheduled
  schedule?: string // cron expression
  // For sentiment thresholds
  sentiment_threshold?: number
}

// ==================== ACTION TYPES ====================

export type ActionType =
  | 'sync_to_crm'              // Sync action items to Logos Vision
  | 'post_to_pulse'            // Post summary to Pulse
  | 'notify_team'              // Send Pulse notifications
  | 'create_project_tasks'     // Create tasks in a project
  | 'send_email'               // Send email notification
  | 'webhook'                  // Call external webhook

export interface ActionConfig {
  // For create_project_tasks
  project_id?: string
  // For send_email
  email_to?: string
  email_subject?: string
  // For webhook
  webhook_url?: string
  // For notify_team
  user_ids?: string[]
  // For post_to_pulse
  channel_id?: string
}

// ==================== CRUD OPERATIONS ====================

export async function createAutomation(automation: Partial<EntoamteAutomation>): Promise<EntoamteAutomation | null> {
  const { data, error } = await supabase
    .from('entomate_automations')
    .insert([{
      ...automation,
      is_active: automation.is_active ?? true,
      run_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating automation:', error)
    return null
  }
  return data
}

export async function getAutomations(): Promise<EntoamteAutomation[]> {
  const { data, error } = await supabase
    .from('entomate_automations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching automations:', error)
    return []
  }
  return data || []
}

export async function getActiveAutomations(): Promise<EntoamteAutomation[]> {
  const { data, error } = await supabase
    .from('entomate_automations')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching active automations:', error)
    return []
  }
  return data || []
}

export async function getAutomationById(id: string): Promise<EntoamteAutomation | null> {
  const { data, error } = await supabase
    .from('entomate_automations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching automation:', error)
    return null
  }
  return data
}

export async function updateAutomation(id: string, updates: Partial<EntoamteAutomation>): Promise<EntoamteAutomation | null> {
  const { data, error } = await supabase
    .from('entomate_automations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating automation:', error)
    return null
  }
  return data
}

export async function deleteAutomation(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('entomate_automations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting automation:', error)
    return false
  }
  return true
}

export async function toggleAutomation(id: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('entomate_automations')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Error toggling automation:', error)
    return false
  }
  return true
}

// ==================== TRIGGER EVALUATION ====================

export function evaluateTrigger(
  trigger: TriggerType,
  config: TriggerConfig,
  context: {
    meeting?: EntomateMeeting
    actionItems?: EntoamteActionItem[]
  }
): boolean {
  switch (trigger) {
    case 'meeting_completed':
      return !!context.meeting

    case 'action_item_created':
      return (context.actionItems?.length || 0) > 0

    case 'high_priority_detected':
      return context.actionItems?.some(item => item.priority === 'high') || false

    case 'keyword_detected':
      if (!config.keywords?.length || !context.meeting?.transcript) return false
      const transcript = context.meeting.transcript.toLowerCase()
      return config.keywords.some(kw => transcript.includes(kw.toLowerCase()))

    case 'sentiment_negative':
      const threshold = config.sentiment_threshold ?? 0.4
      return (context.meeting?.sentiment_score ?? 0.5) < threshold

    case 'scheduled':
      // Scheduled triggers are handled separately by a scheduler
      return false

    default:
      return false
  }
}

// ==================== ACTION EXECUTION ====================

export interface ActionResult {
  action: ActionType
  success: boolean
  message?: string
  error?: string
}

export async function executeAction(
  action: ActionType,
  config: ActionConfig,
  context: {
    meeting?: EntomateMeeting
    actionItems?: EntoamteActionItem[]
  }
): Promise<ActionResult> {
  try {
    switch (action) {
      case 'sync_to_crm':
        if (!context.actionItems?.length) {
          return { action, success: false, message: 'No action items to sync' }
        }
        for (const item of context.actionItems) {
          await syncActionItemToCrm(item, context.meeting?.title)
        }
        return { action, success: true, message: `Synced ${context.actionItems.length} items to CRM` }

      case 'post_to_pulse':
        if (!context.meeting) {
          return { action, success: false, message: 'No meeting data' }
        }
        const pulseResult = await postMeetingSummaryToPulse(
          context.meeting,
          context.actionItems || [],
          config.channel_id
        )
        return {
          action,
          success: pulseResult.success,
          message: pulseResult.success ? 'Posted to Pulse' : 'Failed to post to Pulse',
          error: pulseResult.error
        }

      case 'notify_team':
        if (!context.meeting) {
          return { action, success: false, message: 'No meeting data' }
        }
        await notifyAssigneesAboutActionItems(context.meeting, context.actionItems || [])
        return { action, success: true, message: 'Team notified' }

      case 'create_project_tasks':
        if (!config.project_id || !context.actionItems?.length) {
          return { action, success: false, message: 'Missing project ID or no action items' }
        }
        let tasksCreated = 0
        for (const item of context.actionItems) {
          const task = await createProjectTask({
            project_id: config.project_id,
            title: item.task_description,
            assigned_to: item.assigned_to_name,
            priority: item.priority,
            due_date: item.due_date,
            meeting_id: item.meeting_id
          })
          if (task) tasksCreated++
        }
        return { action, success: true, message: `Created ${tasksCreated} project tasks` }

      case 'webhook':
        if (!config.webhook_url) {
          return { action, success: false, message: 'No webhook URL configured' }
        }
        const webhookResponse = await fetch(config.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'automation_triggered',
            meeting: context.meeting,
            action_items: context.actionItems
          })
        })
        return {
          action,
          success: webhookResponse.ok,
          message: webhookResponse.ok ? 'Webhook called successfully' : 'Webhook call failed'
        }

      case 'send_email':
        // Email sending would require integration with an email service
        return { action, success: false, message: 'Email sending not implemented' }

      default:
        return { action, success: false, message: 'Unknown action type' }
    }
  } catch (error) {
    console.error(`Error executing action ${action}:`, error)
    return {
      action,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ==================== AUTOMATION RUNNER ====================

export interface AutomationRunResult {
  automationId: string
  automationName: string
  triggered: boolean
  actionsExecuted: ActionResult[]
}

export async function runAutomationsForMeeting(
  meeting: EntomateMeeting,
  actionItems: EntoamteActionItem[]
): Promise<AutomationRunResult[]> {
  const automations = await getActiveAutomations()
  const results: AutomationRunResult[] = []

  for (const automation of automations) {
    const context = { meeting, actionItems }

    // Check if trigger matches
    const triggered = evaluateTrigger(
      automation.trigger_type as TriggerType,
      automation.trigger_config,
      context
    )

    if (!triggered) {
      results.push({
        automationId: automation.id,
        automationName: automation.name,
        triggered: false,
        actionsExecuted: []
      })
      continue
    }

    // Execute all actions
    const actionResults: ActionResult[] = []
    for (const actionDef of automation.actions) {
      const result = await executeAction(
        actionDef.type as ActionType,
        actionDef.config || {},
        context
      )
      actionResults.push(result)
    }

    // Update automation stats
    await supabase
      .from('entomate_automations')
      .update({
        last_run_at: new Date().toISOString(),
        run_count: automation.run_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', automation.id)

    results.push({
      automationId: automation.id,
      automationName: automation.name,
      triggered: true,
      actionsExecuted: actionResults
    })
  }

  return results
}

// ==================== PRESET AUTOMATIONS ====================

export const PRESET_AUTOMATIONS = [
  {
    name: 'Auto-sync to CRM',
    description: 'Automatically sync all action items to Logos Vision CRM when a meeting is processed',
    trigger_type: 'action_item_created',
    trigger_config: {},
    actions: [{ type: 'sync_to_crm', config: {} }]
  },
  {
    name: 'Post to Pulse',
    description: 'Post meeting summary to Pulse chat after every meeting',
    trigger_type: 'meeting_completed',
    trigger_config: {},
    actions: [{ type: 'post_to_pulse', config: {} }]
  },
  {
    name: 'High Priority Alert',
    description: 'Notify team when high priority action items are detected',
    trigger_type: 'high_priority_detected',
    trigger_config: {},
    actions: [{ type: 'notify_team', config: {} }]
  },
  {
    name: 'Negative Sentiment Alert',
    description: 'Send notification when meeting sentiment is negative',
    trigger_type: 'sentiment_negative',
    trigger_config: { sentiment_threshold: 0.3 },
    actions: [{ type: 'notify_team', config: {} }]
  }
]

export async function createPresetAutomation(presetIndex: number): Promise<EntoamteAutomation | null> {
  const preset = PRESET_AUTOMATIONS[presetIndex]
  if (!preset) return null

  return createAutomation({
    name: preset.name,
    description: preset.description,
    trigger_type: preset.trigger_type,
    trigger_config: preset.trigger_config,
    actions: preset.actions,
    is_active: true
  })
}
