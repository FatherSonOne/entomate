/**
 * Agent Trigger Service
 * Fires agent triggers based on app events and schedules
 * Integrates Phase 2 agents with the existing app
 */

import { supabase } from '../lib/supabase';
import { runAgentForTrigger } from './agentRunner';
import { getEnabledAgentsByTrigger } from './agentService';
import type { TriggerEvent, AgentRunResult } from './types';

// ==================== EVENT-BASED TRIGGERS ====================

/**
 * Fire meeting.completed trigger
 * Call this when a meeting is processed/completed
 */
export async function fireMeetingCompletedTrigger(
  meetingId: string,
  options: { dryRun?: boolean } = {}
): Promise<AgentRunResult[]> {
  console.log('[AgentTriggerService] Firing meeting.completed', { meetingId });

  // Load meeting data
  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (!meeting) {
    console.error('[AgentTriggerService] Meeting not found:', meetingId);
    return [];
  }

  // Load meeting intelligence config if one exists
  let intelligenceConfig = null;
  try {
    const { data: configRow } = await supabase
      .from('meeting_intelligence_config')
      .select('*')
      .eq('meeting_id', meetingId)
      .single();

    if (configRow) {
      intelligenceConfig = {
        id: configRow.id,
        meetingId: configRow.meeting_id,
        profileId: configRow.profile_id,
        customFieldValues: configRow.custom_field_values || {},
        assembledContext: configRow.assembled_context || null,
        composedPrompt: configRow.composed_prompt,
        toneOverride: configRow.tone_override,
        focusOverride: configRow.focus_override,
        additionalInstructions: configRow.additional_instructions,
        status: configRow.status,
      };
      console.log('[AgentTriggerService] Found intelligence config for meeting:', meetingId);
    }
  } catch (err) {
    // Not having an intelligence config is normal — continue without it
    console.log('[AgentTriggerService] No intelligence config for meeting (expected for unconfigured meetings)');
  }

  // Create trigger event
  const triggerEvent: TriggerEvent = {
    type: 'meeting.completed',
    payload: {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      transcript: meeting.transcript,
      summary: meeting.summary,
      sentiment: meeting.sentiment_score,
      participants: meeting.participants || [],
      dealId: meeting.deal_id,
      createdAt: meeting.created_at,
      intelligenceConfig,
    },
    timestamp: new Date().toISOString(),
    sourceId: `meeting:${meetingId}:${Date.now()}`
  };

  return runAgentsForTrigger(triggerEvent, options.dryRun);
}

/**
 * Fire deal.stage_changed trigger
 * Call this when a deal moves to a new stage
 */
export async function fireDealStageChangedTrigger(
  dealId: string,
  previousStage: string,
  newStage: string,
  options: { dryRun?: boolean } = {}
): Promise<AgentRunResult[]> {
  console.log('[AgentTriggerService] Firing deal.stage_changed', { dealId, previousStage, newStage });

  // Create trigger event
  const triggerEvent: TriggerEvent = {
    type: 'deal.stage_changed',
    payload: {
      dealId,
      previousStage,
      newStage,
      changedAt: new Date().toISOString()
    },
    timestamp: new Date().toISOString(),
    sourceId: `deal_stage:${dealId}:${Date.now()}`
  };

  return runAgentsForTrigger(triggerEvent, options.dryRun);
}

/**
 * Fire task.overdue trigger for a specific task
 */
export async function fireTaskOverdueTrigger(
  taskId: string,
  options: { dryRun?: boolean } = {}
): Promise<AgentRunResult[]> {
  console.log('[AgentTriggerService] Firing task.overdue', { taskId });

  // Load task data
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (!task) {
    console.error('[AgentTriggerService] Task not found:', taskId);
    return [];
  }

  const triggerEvent: TriggerEvent = {
    type: 'task.overdue',
    payload: {
      taskId: task.id,
      taskTitle: task.title,
      dueDate: task.due_date,
      assigneeId: task.assignee_id,
      projectId: task.project_id,
      priority: task.priority,
      daysOverdue: calculateDaysOverdue(task.due_date)
    },
    timestamp: new Date().toISOString(),
    sourceId: `task_overdue:${taskId}:${Date.now()}`
  };

  return runAgentsForTrigger(triggerEvent, options.dryRun);
}

// ==================== SCHEDULED TRIGGERS ====================

/**
 * Check for overdue tasks and fire triggers
 * Run this on a schedule (e.g., every hour or daily)
 */
export async function checkOverdueTasks(
  options: { dryRun?: boolean } = {}
): Promise<{ tasksChecked: number; triggersRun: AgentRunResult[] }> {
  console.log('[AgentTriggerService] Checking for overdue tasks');

  const now = new Date().toISOString();

  // Find overdue tasks
  const { data: overdueTasks, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, assignee_id, project_id, priority')
    .lt('due_date', now)
    .in('status', ['todo', 'in_progress'])
    .order('due_date', { ascending: true })
    .limit(50);

  if (error || !overdueTasks) {
    console.error('[AgentTriggerService] Error fetching overdue tasks:', error);
    return { tasksChecked: 0, triggersRun: [] };
  }

  console.log(`[AgentTriggerService] Found ${overdueTasks.length} overdue tasks`);

  const allResults: AgentRunResult[] = [];

  for (const task of overdueTasks) {
    const results = await fireTaskOverdueTrigger(task.id, options);
    allResults.push(...results);
  }

  return { tasksChecked: overdueTasks.length, triggersRun: allResults };
}

/**
 * Check for at-risk deals and fire triggers
 * Run this on a schedule (e.g., daily)
 */
export async function checkAtRiskDeals(
  options: { dryRun?: boolean } = {}
): Promise<{ dealsChecked: number; triggersRun: AgentRunResult[] }> {
  console.log('[AgentTriggerService] Checking for at-risk deals');

  // Get deals with no activity in the last 14 days
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: staleDeals, error } = await supabase
    .from('deals')
    .select('id, name, stage, value, last_activity_at')
    .lt('last_activity_at', fourteenDaysAgo.toISOString())
    .not('stage', 'in', '("Closed Won","Closed Lost")')
    .order('value', { ascending: false })
    .limit(20);

  if (error || !staleDeals) {
    console.error('[AgentTriggerService] Error fetching stale deals:', error);
    return { dealsChecked: 0, triggersRun: [] };
  }

  console.log(`[AgentTriggerService] Found ${staleDeals.length} stale deals`);

  // For stale deals, we can fire a deal.stage_changed trigger with special payload
  const allResults: AgentRunResult[] = [];

  for (const deal of staleDeals) {
    const triggerEvent: TriggerEvent = {
      type: 'deal.stage_changed',
      payload: {
        dealId: deal.id,
        dealName: deal.name,
        previousStage: deal.stage,
        newStage: deal.stage, // Same stage - just checking for risk
        dealValue: deal.value,
        lastActivityAt: deal.last_activity_at,
        isStale: true,
        daysSinceActivity: Math.floor(
          (Date.now() - new Date(deal.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
        )
      },
      timestamp: new Date().toISOString(),
      sourceId: `deal_risk_check:${deal.id}:${Date.now()}`
    };

    const results = await runAgentsForTrigger(triggerEvent, options.dryRun);
    allResults.push(...results);
  }

  return { dealsChecked: staleDeals.length, triggersRun: allResults };
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Run all enabled agents for a trigger event
 */
async function runAgentsForTrigger(
  triggerEvent: TriggerEvent,
  dryRun: boolean = false
): Promise<AgentRunResult[]> {
  // Get all enabled agents that respond to this trigger
  const agents = await getEnabledAgentsByTrigger(triggerEvent.type);

  console.log(`[AgentTriggerService] Found ${agents.length} agents for trigger: ${triggerEvent.type}`);

  const results: AgentRunResult[] = [];

  for (const agent of agents) {
    try {
      const result = await runAgentForTrigger(agent, triggerEvent, dryRun);
      results.push(result);
    } catch (err) {
      console.error(`[AgentTriggerService] Agent ${agent.id} failed:`, err);
      results.push({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        counters: { pulseMessages: 0, crmTasks: 0, totalActions: 0 }
      });
    }
  }

  return results;
}

/**
 * Calculate days overdue from a due date
 */
function calculateDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ==================== MEETING UPCOMING TRIGGER ====================

/**
 * Fire meeting.upcoming trigger to assemble intelligence context
 * Call this before a meeting starts (e.g., from a scheduler)
 */
export async function fireMeetingUpcomingTrigger(
  meetingId: string,
  options: { dryRun?: boolean } = {}
): Promise<AgentRunResult[]> {
  console.log('[AgentTriggerService] Firing meeting.upcoming', { meetingId });

  // Load meeting data
  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (!meeting) {
    console.error('[AgentTriggerService] Meeting not found:', meetingId);
    return [];
  }

  // Load intelligence config
  let intelligenceConfig = null;
  const { data: configRow } = await supabase
    .from('meeting_intelligence_config')
    .select('*')
    .eq('meeting_id', meetingId)
    .single();

  if (configRow) {
    intelligenceConfig = {
      id: configRow.id,
      meetingId: configRow.meeting_id,
      profileId: configRow.profile_id,
      customFieldValues: configRow.custom_field_values || {},
      assembledContext: configRow.assembled_context || null,
      composedPrompt: configRow.composed_prompt,
      toneOverride: configRow.tone_override,
      focusOverride: configRow.focus_override,
      additionalInstructions: configRow.additional_instructions,
      status: configRow.status,
    };
  }

  if (!intelligenceConfig || !intelligenceConfig.profileId) {
    console.log('[AgentTriggerService] No intelligence profile for meeting — skipping upcoming trigger');
    return [];
  }

  const triggerEvent: TriggerEvent = {
    type: 'meeting.upcoming',
    payload: {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      scheduledAt: meeting.start_time || meeting.scheduled_at,
      participants: meeting.attendees || meeting.participants || [],
      intelligenceConfig,
    },
    timestamp: new Date().toISOString(),
    sourceId: `meeting:${meetingId}:upcoming:${Date.now()}`
  };

  return runAgentsForTrigger(triggerEvent, options.dryRun);
}

// ==================== MANUAL TRIGGER FOR TESTING ====================

/**
 * Manually trigger an agent for testing
 */
export async function manualTriggerAgent(
  agentId: string,
  testPayload: Record<string, any>,
  options: { dryRun?: boolean } = {}
): Promise<AgentRunResult> {
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const triggerEvent: TriggerEvent = {
    type: agent.trigger_type,
    payload: testPayload,
    timestamp: new Date().toISOString(),
    sourceId: `manual_test:${agentId}:${Date.now()}`
  };

  return runAgentForTrigger(agent, triggerEvent, options.dryRun ?? true);
}

// ==================== INTEGRATION WITH EXISTING SERVICES ====================

/**
 * Hook to call after a meeting is processed
 * Add this to meetingService or call from UI after processing
 */
export async function onMeetingProcessed(meetingId: string): Promise<void> {
  console.log('[AgentTriggerService] Meeting processed hook:', meetingId);

  // Fallback: assemble intelligence context if pending
  // (Primary path is the meeting.upcoming trigger, but for manual meetings
  // or recordings uploaded after the fact, this ensures context is ready)
  try {
    const { data: config } = await supabase
      .from('meeting_intelligence_config')
      .select('id, profile_id, status')
      .eq('meeting_id', meetingId)
      .single();

    if (config && config.profile_id && config.status === 'pending') {
      console.log('[AgentTriggerService] Assembling intelligence context (fallback path)');
      const { assembleContext } = await import('../intelligence/contextAssembler');
      const { getProfileById } = await import('../intelligence/profileService');
      const profile = await getProfileById(config.profile_id);
      if (profile) {
        await assembleContext(meetingId, profile);
      }
    }
  } catch (err) {
    console.error('[AgentTriggerService] Fallback context assembly failed (non-blocking):', err);
  }

  // Fire agent triggers (in production, not dry run)
  const results = await fireMeetingCompletedTrigger(meetingId, { dryRun: false });

  console.log(`[AgentTriggerService] Ran ${results.length} agents for meeting:`,
    results.map(r => ({ success: r.success, runId: r.runId }))
  );
}

/**
 * Hook to call when a deal stage changes
 */
export async function onDealStageChanged(
  dealId: string,
  previousStage: string,
  newStage: string
): Promise<void> {
  console.log('[AgentTriggerService] Deal stage changed hook:', { dealId, previousStage, newStage });

  const results = await fireDealStageChangedTrigger(dealId, previousStage, newStage, { dryRun: false });

  console.log(`[AgentTriggerService] Ran ${results.length} agents for deal stage change:`,
    results.map(r => ({ success: r.success, runId: r.runId }))
  );
}
