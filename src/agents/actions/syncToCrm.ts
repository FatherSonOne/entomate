/**
 * Sync to CRM Action
 * Syncs data to Logos Vision CRM (deals, tasks, notes)
 */

import { supabase } from '../../lib/supabase';
import { upsertRelationship } from '../../graph/relationshipService';
import type { Agent, ActionStep } from '../types';

export interface SyncToCrmConfig {
  updateType: 'deal_note' | 'meeting_summary' | 'create_task';
  linkToDeal?: boolean;
  createTasks?: boolean;
  noteTemplate?: string;
  dedupeKey?: string;
}

export interface SyncToCrmResult {
  synced: boolean;
  updateType: string;
  recordsCreated: number;
  recordsUpdated: number;
  dealId?: string;
  taskIds?: string[];
  noteId?: string;
  dedupeSkipped?: boolean;
}

/**
 * Execute the sync to CRM action
 */
export async function execute(params: {
  agent: Agent;
  step: ActionStep;
  triggerPayload: Record<string, any>;
  dryRun?: boolean;
}): Promise<{
  result: SyncToCrmResult;
  countersDelta: { crmTasks: number };
}> {
  const { agent, step, triggerPayload, dryRun } = params;
  const config = step.config as SyncToCrmConfig;

  console.log('[Action:sync_to_crm] Starting sync', { dryRun, updateType: config.updateType });

  const result: SyncToCrmResult = {
    synced: false,
    updateType: config.updateType,
    recordsCreated: 0,
    recordsUpdated: 0
  };

  // Check for dedupe if configured
  if (config.dedupeKey && !dryRun) {
    const isDuplicate = await checkDedupe(config.dedupeKey, triggerPayload, agent.id);
    if (isDuplicate) {
      console.log('[Action:sync_to_crm] Skipping due to dedupe');
      return {
        result: { ...result, dedupeSkipped: true },
        countersDelta: { crmTasks: 0 }
      };
    }
  }

  if (dryRun) {
    console.log('[Action:sync_to_crm] DRY RUN - Would sync:', { config, payload: triggerPayload });
    return {
      result: {
        ...result,
        synced: false,
        recordsCreated: config.createTasks ? 2 : 0,
        recordsUpdated: 1
      },
      countersDelta: { crmTasks: 0 }
    };
  }

  try {
    let crmTasksCreated = 0;

    switch (config.updateType) {
      case 'deal_note':
        await syncDealNote(triggerPayload, config, result);
        break;

      case 'meeting_summary':
        crmTasksCreated = await syncMeetingSummary(triggerPayload, config, result);
        break;

      case 'create_task':
        crmTasksCreated = await createCrmTask(triggerPayload, config, result);
        break;
    }

    // Create relationship links if configured
    if (config.linkToDeal && triggerPayload.dealId && triggerPayload.meetingId) {
      await createDealMeetingRelationship(triggerPayload);
    }

    result.synced = true;
    console.log('[Action:sync_to_crm] Sync completed', result);

    return {
      result,
      countersDelta: { crmTasks: crmTasksCreated }
    };

  } catch (err) {
    console.error('[Action:sync_to_crm] Sync failed:', err);
    throw err;
  }
}

/**
 * Sync a note to a deal
 */
async function syncDealNote(
  payload: Record<string, any>,
  config: SyncToCrmConfig,
  result: SyncToCrmResult
): Promise<void> {
  const dealId = payload.dealId || payload.deal_id;
  if (!dealId) {
    console.warn('[Action:sync_to_crm] No dealId for deal_note sync');
    return;
  }

  const noteContent = config.noteTemplate
    ? buildNoteFromTemplate(config.noteTemplate, payload)
    : `Agent note: ${JSON.stringify(payload)}`;

  // Store note locally (would also sync to Logos Vision API)
  const { data, error } = await supabase
    .from('crm_sync_log')
    .insert({
      sync_type: 'deal_note',
      entity_type: 'deal',
      entity_id: dealId,
      content: noteContent,
      metadata: {
        source: 'entomate_agent',
        trigger_event_id: payload.triggerEventId
      }
    })
    .select()
    .single();

  if (error) {
    console.error('[Action:sync_to_crm] Failed to store note:', error);
  } else {
    result.noteId = data?.id;
    result.recordsCreated = 1;
    result.dealId = dealId;
  }

  // TODO: Call Logos Vision API to create deal note
  // await logosVisionApi.createDealNote(dealId, noteContent);
}

/**
 * Sync meeting summary and create tasks
 */
async function syncMeetingSummary(
  payload: Record<string, any>,
  config: SyncToCrmConfig,
  result: SyncToCrmResult
): Promise<number> {
  const meetingId = payload.meetingId || payload.meeting_id;
  const dealId = payload.dealId || payload.deal_id;
  let tasksCreated = 0;

  // Create tasks from action items if configured
  if (config.createTasks && payload.actionItems && Array.isArray(payload.actionItems)) {
    const taskIds: string[] = [];

    for (const item of payload.actionItems) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            title: item.title,
            description: item.description,
            priority: item.priority || 'medium',
            status: 'todo',
            source: 'agent_extraction',
            source_meeting_id: meetingId,
            deal_id: dealId,
            metadata: {
              extracted_by_agent: true,
              original_assignee: item.assignee
            }
          })
          .select()
          .single();

        if (!error && data) {
          taskIds.push(data.id);
          tasksCreated++;

          // Create relationship: meeting -> task
          if (meetingId) {
            await upsertRelationship({
              sourceType: 'meeting',
              sourceId: meetingId,
              targetType: 'task',
              targetId: data.id,
              relationshipType: 'meeting_created_action_item',
              confidence: 0.95,
              evidence: { extracted_from: 'transcript' }
            });
          }
        }
      } catch (err) {
        console.error('[Action:sync_to_crm] Failed to create task:', err);
      }
    }

    result.taskIds = taskIds;
    result.recordsCreated = tasksCreated;
  }

  return tasksCreated;
}

/**
 * Create a single CRM task
 */
async function createCrmTask(
  payload: Record<string, any>,
  config: SyncToCrmConfig,
  result: SyncToCrmResult
): Promise<number> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: payload.taskTitle || payload.title || 'Agent-created task',
      description: payload.taskDescription || payload.description,
      priority: payload.priority || 'medium',
      status: 'todo',
      deal_id: payload.dealId,
      project_id: payload.projectId,
      source: 'agent',
      metadata: payload
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  result.taskIds = [data.id];
  result.recordsCreated = 1;

  return 1;
}

/**
 * Create deal-meeting relationship
 */
async function createDealMeetingRelationship(payload: Record<string, any>): Promise<void> {
  await upsertRelationship({
    sourceType: 'meeting',
    sourceId: payload.meetingId,
    targetType: 'deal',
    targetId: payload.dealId,
    relationshipType: 'meeting_mentions_deal',
    confidence: 1.0,
    evidence: { linked_by: 'agent' }
  });
}

/**
 * Check for duplicate based on dedupe key
 */
async function checkDedupe(
  dedupeKey: string,
  payload: Record<string, any>,
  agentId: string
): Promise<boolean> {
  // Build dedupe value from key pattern (e.g., "meetingId+taskTitle")
  const parts = dedupeKey.split('+').map(k => payload[k] || payload[camelToSnake(k)] || '');
  const dedupeValue = parts.join(':');

  const { data } = await supabase
    .from('crm_sync_log')
    .select('id')
    .eq('dedupe_key', dedupeValue)
    .limit(1);

  return (data?.length || 0) > 0;
}

/**
 * Build note content from template
 */
function buildNoteFromTemplate(template: string, payload: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return String(payload[varName] || payload[camelToSnake(varName)] || match);
  });
}

/**
 * Convert camelCase to snake_case
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
