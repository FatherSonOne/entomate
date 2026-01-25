/**
 * Project Kickoff Agent Template
 * Automates project kickoff when deals close or projects are created
 *
 * Trigger: deal.stage_changed (to closed-won) OR project.created
 * Actions:
 *   1. Create project from template
 *   2. Assign initial tasks
 *   3. Notify team in Pulse
 *   4. Sync project to CRM
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const PROJECT_KICKOFF_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Project Kickoff Agent',
  description: 'Automates project kickoff when deals close or new projects are created',
  enabled: false,
  trigger_type: 'deal.stage_changed' as TriggerType,
  trigger_config: {
    toStage: 'closed-won',
    fromStage: null,
    createProjectOnClose: true
  },
  actions: [
    {
      type: 'create_onboarding_project',
      config: {
        templateId: 'project-kickoff-standard',
        nameTemplate: '{{customerName}} - {{projectType}}',
        linkToDeal: true,
        copyTasks: true,
        adjustDueDates: true,
        defaultDurationDays: 90
      }
    },
    {
      type: 'assign_task',
      config: {
        strategy: 'by_project_role',
        assignInitialTasks: true,
        setMilestones: true,
        linkToProject: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'projects',
        messageTemplate: `🚀 Project Kickoff: {{projectName}}

**Customer:** {{customerName}}
**Project Type:** {{projectType}}
**Deal Value:** {{dealValue}}
**Timeline:** {{timeline}}

**Initial Tasks:** {{taskCount}}
**Team:** {{teamMembers}}

**Milestones:**
{{milestones}}

Let's make this project a success! View project: {{projectLink}}`,
        mentionTeam: true,
        mentionPM: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'project_kickoff',
        createProjectRecord: true,
        linkToDeal: true,
        linkToCustomer: true,
        syncTasks: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 1,
    maxCrmTasksPerRun: 15,          // Initial project tasks
    maxTotalActionsPerRun: 20,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const PROJECT_KICKOFF_AGENT_META = {
  id: 'project-kickoff-agent',
  name: 'Project Kickoff Agent',
  description: 'Automates project kickoff when deals close or new projects are created',
  category: 'Operations',
  icon: '🚀',
  recommendedFor: ['Project managers', 'Operations', 'Implementation teams'],
  triggers: ['deal.stage_changed (to closed-won)', 'project.created'],
  actions: ['Create project', 'Assign tasks', 'Post to Pulse', 'Sync to CRM'],
  setupTime: '8 minutes'
};

