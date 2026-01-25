/**
 * Renewal Alert Agent Template
 * Monitors renewal dates and creates proactive renewal tasks
 *
 * Trigger: task.overdue (renewal-related) OR custom renewal date trigger
 * Actions:
 *   1. Check renewal dates from CRM
 *   2. Create renewal preparation tasks
 *   3. Alert CSM team of upcoming renewals
 *   4. Sync renewal tasks to CRM
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const RENEWAL_ALERT_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Renewal Alert Agent',
  description: 'Monitors customer renewal dates and creates proactive renewal preparation tasks',
  enabled: false,
  trigger_type: 'task.overdue' as TriggerType,
  trigger_config: {
    overdueByDays: 0,               // Trigger on renewal date
    priorityFilter: 'all',
    filterRenewalTasks: true         // Only renewal-related tasks
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        checkRenewalDates: true,
        calculateDaysUntilRenewal: true,
        assessRenewalRisk: true,
        suggestRenewalStrategy: true
      }
    },
    {
      type: 'assign_task',
      config: {
        strategy: 'by_customer_owner',
        createRenewalTasks: true,
        setDeadlines: true,
        prioritizeByRisk: true,
        linkToCustomer: true,
        linkToDeal: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'renewal_preparation',
        createTasks: true,
        updateRenewalDate: true,
        createRenewalDeal: true,
        setReminders: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'customer-success',
        messageTemplate: `🔄 Renewal Alert: {{customerName}}

**Renewal Date:** {{renewalDate}}
**Days Until Renewal:** {{daysUntil}}
**Renewal Risk:** {{renewalRisk}}
**Contract Value:** {{contractValue}}

**Renewal Tasks Created:**
{{renewalTasks}}

View in CRM: {{crmLink}}`,
        mentionCSM: true,
        mentionManager: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 5,      // Up to 5 renewals
    maxCrmTasksPerRun: 10,          // Up to 10 renewal tasks
    maxTotalActionsPerRun: 20,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const RENEWAL_ALERT_AGENT_META = {
  id: 'renewal-alert-agent',
  name: 'Renewal Alert Agent',
  description: 'Monitors renewal dates and creates proactive renewal preparation tasks',
  category: 'Customer Success',
  icon: '🔄',
  recommendedFor: ['Customer success teams', 'CS managers', 'Account managers'],
  triggers: ['task.overdue (renewal)', 'renewal_date_approaching'],
  actions: ['Check renewals', 'Create renewal tasks', 'Sync to CRM', 'Post alerts'],
  setupTime: '5 minutes'
};

