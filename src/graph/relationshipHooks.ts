/**
 * Relationship Hooks - High-level functions to create Knowledge Graph relationships
 * These are called from various app flows (meeting processing, task creation, etc.)
 */

import { upsertRelationship, RelationshipType } from './relationshipService';
import type { EntomateMeeting, EntoamateActionItem, EntoamateProject, EntoamateProjectTask } from '../lib/supabase';

// ============================================
// Meeting Relationships
// ============================================

/**
 * Link a meeting to a CRM deal
 * Called when a meeting is associated with a deal (explicit or inferred)
 */
export async function linkMeetingToDeal(
  meetingId: string,
  dealId: string,
  options: {
    confidence?: number;
    method?: 'explicit' | 'transcript_match' | 'user_linked';
    matchedText?: string;
  } = {}
): Promise<void> {
  const { confidence = 1.0, method = 'explicit', matchedText } = options;

  await upsertRelationship({
    sourceType: 'meeting',
    sourceId: meetingId,
    targetType: 'deal',
    targetId: dealId,
    relationshipType: 'meeting_mentions_deal',
    confidence,
    evidence: {
      method,
      matchedText,
      linkedAt: new Date().toISOString()
    },
    createdBy: 'system'
  });

  console.log(`[KnowledgeGraph] Linked meeting:${meetingId} -> deal:${dealId} (${method})`);
}

/**
 * Link a meeting to a project
 */
export async function linkMeetingToProject(
  meetingId: string,
  projectId: string,
  options: {
    confidence?: number;
    method?: 'explicit' | 'inferred';
  } = {}
): Promise<void> {
  const { confidence = 1.0, method = 'explicit' } = options;

  await upsertRelationship({
    sourceType: 'meeting',
    sourceId: meetingId,
    targetType: 'project',
    targetId: projectId,
    relationshipType: 'meeting_related_to_project',
    confidence,
    evidence: {
      method,
      linkedAt: new Date().toISOString()
    },
    createdBy: 'system'
  });

  console.log(`[KnowledgeGraph] Linked meeting:${meetingId} -> project:${projectId}`);
}

/**
 * Process meeting and create relationships from its context
 * Called after meeting is processed/saved
 */
export async function processMeetingRelationships(meeting: EntomateMeeting): Promise<void> {
  const meetingId = meeting.id;

  // Link to CRM deal if present
  if (meeting.crm_deal_id) {
    await linkMeetingToDeal(meetingId, meeting.crm_deal_id, {
      method: 'explicit',
      confidence: 1.0
    });
  }

  // Link to Pulse channel if present (as context)
  if (meeting.pulse_channel_id) {
    await upsertRelationship({
      sourceType: 'meeting',
      sourceId: meetingId,
      targetType: 'pulse_channel',
      targetId: meeting.pulse_channel_id,
      relationshipType: 'meeting_linked_to_channel',
      confidence: 1.0,
      evidence: {
        method: 'explicit',
        linkedAt: new Date().toISOString()
      },
      createdBy: 'system'
    });
  }

  console.log(`[KnowledgeGraph] Processed relationships for meeting:${meetingId}`);
}

// ============================================
// Action Item Relationships
// ============================================

/**
 * Link a meeting to its action items
 * Called when action items are extracted from a meeting
 */
export async function linkMeetingToActionItem(
  meetingId: string,
  actionItemId: string
): Promise<void> {
  await upsertRelationship({
    sourceType: 'meeting',
    sourceId: meetingId,
    targetType: 'action_item',
    targetId: actionItemId,
    relationshipType: 'meeting_created_action_item',
    confidence: 1.0,
    evidence: {
      method: 'extraction',
      extractedAt: new Date().toISOString()
    },
    createdBy: 'system'
  });

  console.log(`[KnowledgeGraph] Linked meeting:${meetingId} -> action_item:${actionItemId}`);
}

/**
 * Link an action item to a task created from it
 */
export async function linkActionItemToTask(
  actionItemId: string,
  taskId: string,
  meetingId?: string
): Promise<void> {
  await upsertRelationship({
    sourceType: 'action_item',
    sourceId: actionItemId,
    targetType: 'task',
    targetId: taskId,
    relationshipType: 'action_item_created_task',
    confidence: 1.0,
    evidence: {
      method: 'task_creation',
      meetingId,
      createdAt: new Date().toISOString()
    },
    createdBy: 'system'
  });

  console.log(`[KnowledgeGraph] Linked action_item:${actionItemId} -> task:${taskId}`);
}

/**
 * Process action items from a meeting and create relationships
 * Called after action items are extracted
 */
export async function processActionItemRelationships(
  meetingId: string,
  actionItems: EntoamateActionItem[]
): Promise<void> {
  for (const item of actionItems) {
    await linkMeetingToActionItem(meetingId, item.id);
  }

  console.log(`[KnowledgeGraph] Linked ${actionItems.length} action items to meeting:${meetingId}`);
}

// ============================================
// Task Relationships
// ============================================

/**
 * Link a task to its project
 */
export async function linkTaskToProject(
  taskId: string,
  projectId: string
): Promise<void> {
  await upsertRelationship({
    sourceType: 'task',
    sourceId: taskId,
    targetType: 'project',
    targetId: projectId,
    relationshipType: 'task_belongs_to_project',
    confidence: 1.0,
    evidence: {
      method: 'explicit',
      linkedAt: new Date().toISOString()
    },
    createdBy: 'system'
  });

  console.log(`[KnowledgeGraph] Linked task:${taskId} -> project:${projectId}`);
}

/**
 * Link a task to the meeting it originated from
 */
export async function linkTaskToMeeting(
  taskId: string,
  meetingId: string
): Promise<void> {
  await upsertRelationship({
    sourceType: 'task',
    sourceId: taskId,
    targetType: 'meeting',
    targetId: meetingId,
    relationshipType: 'task_from_meeting',
    confidence: 1.0,
    evidence: {
      method: 'task_creation',
      linkedAt: new Date().toISOString()
    },
    createdBy: 'system'
  });

  console.log(`[KnowledgeGraph] Linked task:${taskId} -> meeting:${meetingId}`);
}

/**
 * Process a newly created task and create relationships
 */
export async function processTaskRelationships(task: EntoamateProjectTask): Promise<void> {
  // Link task to project
  if (task.project_id) {
    await linkTaskToProject(task.id, task.project_id);
  }

  // Link task to meeting if it originated from one
  if (task.meeting_id) {
    await linkTaskToMeeting(task.id, task.meeting_id);
  }

  console.log(`[KnowledgeGraph] Processed relationships for task:${task.id}`);
}

// ============================================
// Project Relationships
// ============================================

/**
 * Link a project to a CRM deal
 * Called when a project is created from a deal
 */
export async function linkProjectToDeal(
  projectId: string,
  dealId: string
): Promise<void> {
  await upsertRelationship({
    sourceType: 'deal',
    sourceId: dealId,
    targetType: 'project',
    targetId: projectId,
    relationshipType: 'deal_created_project',
    confidence: 1.0,
    evidence: {
      method: 'project_creation',
      createdAt: new Date().toISOString()
    },
    createdBy: 'system'
  });

  console.log(`[KnowledgeGraph] Linked deal:${dealId} -> project:${projectId}`);
}

/**
 * Process a newly created project and create relationships
 */
export async function processProjectRelationships(project: EntoamateProject): Promise<void> {
  // Link project to CRM deal if present
  if (project.crm_deal_id) {
    await linkProjectToDeal(project.id, project.crm_deal_id);
  }

  console.log(`[KnowledgeGraph] Processed relationships for project:${project.id}`);
}

// ============================================
// Deal/Contact Relationships
// ============================================

/**
 * Link a deal to a contact
 */
export async function linkDealToContact(
  dealId: string,
  contactId: string,
  options: {
    role?: string;
  } = {}
): Promise<void> {
  await upsertRelationship({
    sourceType: 'deal',
    sourceId: dealId,
    targetType: 'contact',
    targetId: contactId,
    relationshipType: 'deal_has_contact',
    confidence: 1.0,
    evidence: {
      role: options.role,
      linkedAt: new Date().toISOString()
    },
    createdBy: 'system'
  });

  console.log(`[KnowledgeGraph] Linked deal:${dealId} -> contact:${contactId}`);
}

// ============================================
// Pulse Message Relationships
// ============================================

/**
 * Link a Pulse message to a deal
 * Called when a message mentions a deal
 */
export async function linkPulseMessageToDeal(
  messageId: string,
  dealId: string,
  options: {
    confidence?: number;
    matchedText?: string;
  } = {}
): Promise<void> {
  const { confidence = 0.8, matchedText } = options;

  await upsertRelationship({
    sourceType: 'pulse_message',
    sourceId: messageId,
    targetType: 'deal',
    targetId: dealId,
    relationshipType: 'pulse_message_mentions_deal',
    confidence,
    evidence: {
      method: 'text_match',
      matchedText,
      linkedAt: new Date().toISOString()
    },
    createdBy: 'system'
  });

  console.log(`[KnowledgeGraph] Linked pulse_message:${messageId} -> deal:${dealId}`);
}

// ============================================
// Batch Operations
// ============================================

/**
 * Create multiple task relationships at once
 * Used when bulk creating tasks from action items
 */
export async function processTasksFromMeeting(
  meetingId: string,
  projectId: string,
  tasks: EntoamateProjectTask[],
  actionItemMap?: Map<string, string> // taskId -> actionItemId
): Promise<void> {
  for (const task of tasks) {
    // Link task to project
    await linkTaskToProject(task.id, projectId);

    // Link task to meeting
    await linkTaskToMeeting(task.id, meetingId);

    // Link action item to task if mapping exists
    if (actionItemMap) {
      const actionItemId = actionItemMap.get(task.id);
      if (actionItemId) {
        await linkActionItemToTask(actionItemId, task.id, meetingId);
      }
    }
  }

  console.log(`[KnowledgeGraph] Processed ${tasks.length} tasks from meeting:${meetingId}`);
}
