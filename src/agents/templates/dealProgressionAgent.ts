/**
 * Deal Progression Agent Template
 * Monitors and helps progress deals through the sales pipeline
 *
 * Trigger: deal.stage_changed OR task.overdue (deal-related)
 * Actions:
 *   1. Analyze deal health and progression blockers
 *   2. Suggest next steps based on stage
 *   3. Create tasks to unblock deals
 *   4. Alert sales manager of stalled deals
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const DEAL_PROGRESSION_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Deal Progression Agent',
  description: 'Monitors deal progression, identifies blockers, and creates tasks to move deals forward',
  enabled: false,
  trigger_type: 'deal.stage_changed' as TriggerType,
  trigger_config: {
    fromStage: null,
    toStage: null,
    monitorStalledDeals: true,      // Also trigger on stalled deals
    monitorOverdueTasks: true       // Trigger on overdue deal-related tasks
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        analyzeDealHealth: true,
        identifyBlockers: true,
        suggestNextSteps: true,
        checkStageRequirements: true
      }
    },
    {
      type: 'assign_task',
      config: {
        strategy: 'by_deal_owner',
        createProgressionTasks: true,
        prioritizeByDealValue: true,
        setDeadlines: true,
        linkToDeal: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'deal_progression',
        createTasks: true,
        updateDealNotes: true,
        alertOnStalled: true,
        suggestStageTransition: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'sales-alerts',
        messageTemplate: `📈 Deal Progression: {{dealName}}

**Stage:** {{currentStage}}
**Health:** {{dealHealth}}
**Blockers:** {{blockers}}
**Suggested Next Steps:** {{nextSteps}}

{{#if stalled}}⚠️ Deal appears stalled - review needed{{/if}}

View in CRM: {{crmLink}}`,
        onlyIfStalled: false,
        mentionOwner: true,
        mentionManager: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 2,
    maxCrmTasksPerRun: 3,           // Up to 3 progression tasks per deal
    maxTotalActionsPerRun: 8,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const DEAL_PROGRESSION_AGENT_META = {
  id: 'deal-progression-agent',
  name: 'Deal Progression Agent',
  description: 'Monitors deal progression and creates tasks to move deals forward through the pipeline',
  category: 'Sales Automation',
  icon: '📈',
  recommendedFor: ['Sales teams', 'Sales managers', 'Revenue operations'],
  triggers: ['deal.stage_changed', 'task.overdue (deal-related)'],
  actions: ['Analyze deal health', 'Create progression tasks', 'Update CRM', 'Post alerts'],
  setupTime: '5 minutes'
};

