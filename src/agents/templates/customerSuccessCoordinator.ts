/**
 * Customer Success Coordinator Agent Template
 * Manages customer onboarding when deals move to implementation
 *
 * Trigger: deal.stage_changed (to implementation/onboarding)
 * Actions:
 *   1. Create onboarding project from template
 *   2. Create initial tasks
 *   3. Post kickoff message to Pulse
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const CUSTOMER_SUCCESS_COORDINATOR_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Customer Success Coordinator',
  description: 'Automatically creates onboarding projects and tasks when deals move to implementation stage',
  enabled: false,
  trigger_type: 'deal.stage_changed' as TriggerType,
  trigger_config: {
    toStage: 'implementation',  // Trigger when deal moves to implementation
    fromStage: null             // From any stage
  },
  actions: [
    {
      type: 'create_onboarding_project',
      config: {
        templateId: 'customer-onboarding-standard',
        nameTemplate: '{{customerName}} - Onboarding',
        linkToDeal: true,
        copyTasks: true,
        adjustDueDates: true,       // Adjust task due dates relative to start
        defaultDurationDays: 30     // Standard onboarding duration
      }
    },
    {
      type: 'assign_task',
      config: {
        strategy: 'by_role',
        roleAssignments: {
          'kickoff_call': 'customer_success_manager',
          'technical_setup': 'implementation_engineer',
          'training': 'trainer',
          'default': 'project_owner'
        }
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'customer-success',
        messageTemplate: `🎉 New Customer Onboarding Started!

**Customer:** {{customerName}}
**Deal Value:** {{dealValue}}
**CSM:** {{csmName}}

**Onboarding Timeline:**
- Start Date: {{startDate}}
- Target Go-Live: {{targetGoLive}}

Onboarding project created with {{taskCount}} tasks. Let's make this customer successful! 🚀`,
        mentionOwner: true,
        mentionCSM: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 2,
    maxCrmTasksPerRun: 20,          // Onboarding projects can have many tasks
    maxTotalActionsPerRun: 30,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const CUSTOMER_SUCCESS_COORDINATOR_META = {
  id: 'customer-success-coordinator',
  name: 'Customer Success Coordinator',
  description: 'Automates customer onboarding by creating projects and tasks when deals close',
  category: 'Customer Success',
  icon: '🎉',
  recommendedFor: ['Customer success teams', 'Implementation teams'],
  triggers: ['deal.stage_changed (to implementation)'],
  actions: ['Create onboarding project', 'Assign tasks', 'Post kickoff to Pulse'],
  setupTime: '10 minutes'
};
