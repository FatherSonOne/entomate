/**
 * Task Auto-Assigner Agent Template
 * Automatically assigns tasks based on workload and skills
 *
 * Trigger: Custom (called when task is created without assignee)
 * Actions:
 *   1. Analyze task requirements
 *   2. Find best assignee based on workload/skills
 *   3. Assign task
 *   4. Notify in Pulse
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const TASK_AUTO_ASSIGNER_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Task Auto-Assigner',
  description: 'Automatically assigns unassigned tasks to team members based on workload, skills, and availability',
  enabled: false,
  trigger_type: 'task.overdue' as TriggerType,  // Placeholder - would need custom trigger
  trigger_config: {
    requiresUnassigned: true,
    projectTypes: ['all']
  },
  actions: [
    {
      type: 'assign_task',
      config: {
        strategy: 'balanced_workload',  // Options: balanced_workload, skills_match, round_robin
        considerSkills: true,
        considerWorkload: true,
        maxTasksPerPerson: 15,
        excludeUsers: [],               // User IDs to never assign to
        preferredUsers: []              // User IDs to prefer
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'auto',
        messageTemplate: '📌 Task assigned: "{{taskTitle}}" has been assigned to {{assigneeName}} based on workload balancing.',
        mentionAssignee: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 1,
    maxCrmTasksPerRun: 0,
    maxTotalActionsPerRun: 3,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const TASK_AUTO_ASSIGNER_META = {
  id: 'task-auto-assigner',
  name: 'Task Auto-Assigner',
  description: 'Intelligently assigns tasks to team members based on their current workload and skills',
  category: 'Project Management',
  icon: '📌',
  recommendedFor: ['Project managers', 'Team leads'],
  triggers: ['task.created (unassigned)'],
  actions: ['Assign task', 'Notify in Pulse'],
  setupTime: '5 minutes'
};
