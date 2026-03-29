/**
 * Agent Registry
 * Defines available triggers and actions, validates agent configurations
 */

import type { Agent, TriggerType, ActionType, ActionStep } from './types';

// Import action handlers
import * as extractActionItemsAction from './actions/extractActionItems';
import * as syncToCrmAction from './actions/syncToCrm';
import * as postToPulseAction from './actions/postToPulse';
import * as createOnboardingProjectAction from './actions/createOnboardingProject';
import * as assignTaskAction from './actions/assignTask';
import * as prepareContextAction from './actions/prepareContext';

/**
 * Trigger handler interface
 */
export interface TriggerHandler {
  type: TriggerType;
  description: string;
  evaluate: (config: Record<string, any>, context: Record<string, any>) => Promise<boolean>;
}

/**
 * Action handler interface
 */
export interface ActionHandler {
  type: ActionType;
  description: string;
  execute: (params: {
    agent: Agent;
    step: ActionStep;
    triggerPayload: Record<string, any>;
    dryRun?: boolean;
  }) => Promise<{
    result: any;
    countersDelta?: {
      pulseMessages?: number;
      crmTasks?: number;
    };
  }>;
}

/**
 * Available triggers registry
 */
export const TRIGGERS: Record<TriggerType, TriggerHandler> = {
  'meeting.completed': {
    type: 'meeting.completed',
    description: 'Fires when a meeting is completed and transcript is ready',
    evaluate: async (config, context) => {
      // Check if meeting meets criteria (min duration, has transcript, etc.)
      const { minDurationSec = 60, mustHaveTranscript = true } = config;
      const { meeting } = context;

      if (!meeting) return false;
      if (mustHaveTranscript && !meeting.transcript) return false;
      if (meeting.duration_seconds && meeting.duration_seconds < minDurationSec) return false;

      return true;
    }
  },

  'task.overdue': {
    type: 'task.overdue',
    description: 'Fires when a task becomes overdue',
    evaluate: async (config, context) => {
      const { overdueByDays = 1, priorityFilter = 'all' } = config;
      const { task } = context;

      if (!task || !task.due_date) return false;

      const dueDate = new Date(task.due_date);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff < overdueByDays) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

      return true;
    }
  },

  'deal.stage_changed': {
    type: 'deal.stage_changed',
    description: 'Fires when a deal moves to a specific stage',
    evaluate: async (config, context) => {
      const { fromStage, toStage } = config;
      const { deal, previousStage, newStage } = context;

      if (!deal) return false;
      if (fromStage && previousStage !== fromStage) return false;
      if (toStage && newStage !== toStage) return false;

      return true;
    }
  },

  'action_item.missed_deadline': {
    type: 'action_item.missed_deadline',
    description: 'Fires when an action item deadline is missed',
    evaluate: async (config, context) => {
      const { actionItem } = context;

      if (!actionItem || !actionItem.deadline) return false;

      const deadline = new Date(actionItem.deadline);
      const now = new Date();

      return now > deadline && actionItem.status !== 'completed';
    }
  },

  'meeting.upcoming': {
    type: 'meeting.upcoming',
    description: 'Fires before a meeting to prepare intelligence context',
    evaluate: async (_config, context) => {
      const { meeting, intelligenceConfig } = context;

      if (!meeting) return false;
      if (!intelligenceConfig || !intelligenceConfig.profileId) return false;
      if (intelligenceConfig.status !== 'pending') return false;

      // Check if meeting hasn't passed
      const scheduledAt = meeting.scheduled_at || meeting.start_time;
      if (scheduledAt && new Date(scheduledAt) < new Date()) return false;

      return true;
    }
  }
};

/**
 * Available actions registry
 */
export const ACTIONS: Record<ActionType, ActionHandler> = {
  'extract_action_items': {
    type: 'extract_action_items',
    description: 'Extract action items from meeting transcript using Gemini',
    execute: extractActionItemsAction.execute
  },

  'sync_to_crm': {
    type: 'sync_to_crm',
    description: 'Sync data to Logos Vision CRM',
    execute: syncToCrmAction.execute
  },

  'post_to_pulse': {
    type: 'post_to_pulse',
    description: 'Post a message to Pulse chat',
    execute: postToPulseAction.execute
  },

  'create_onboarding_project': {
    type: 'create_onboarding_project',
    description: 'Create an onboarding project from template',
    execute: createOnboardingProjectAction.execute
  },

  'assign_task': {
    type: 'assign_task',
    description: 'Auto-assign a task based on workload and skills',
    execute: assignTaskAction.execute
  },

  'prepare_context': {
    type: 'prepare_context',
    description: 'Assemble cross-app context for a meeting intelligence profile',
    execute: prepareContextAction.execute
  }
};

/**
 * Validate an agent configuration
 * @throws Error if configuration is invalid
 */
export function validateAgent(agent: Partial<Agent>): boolean {
  if (!agent.trigger_type) {
    throw new Error('trigger_type is required');
  }

  if (!TRIGGERS[agent.trigger_type as TriggerType]) {
    throw new Error(`Unknown trigger_type: ${agent.trigger_type}`);
  }

  if (!Array.isArray(agent.actions)) {
    throw new Error('actions must be an array');
  }

  for (const step of agent.actions) {
    if (!step.type) {
      throw new Error('Each action must have a type');
    }
    if (!ACTIONS[step.type as ActionType]) {
      throw new Error(`Unknown action type: ${step.type}`);
    }
  }

  return true;
}

/**
 * Get list of available trigger types
 */
export function getAvailableTriggers(): { type: TriggerType; description: string }[] {
  return Object.values(TRIGGERS).map(t => ({
    type: t.type,
    description: t.description
  }));
}

/**
 * Get list of available action types
 */
export function getAvailableActions(): { type: ActionType; description: string }[] {
  return Object.values(ACTIONS).map(a => ({
    type: a.type,
    description: a.description
  }));
}
