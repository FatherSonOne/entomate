/**
 * Deal Risk Monitor Agent Template
 * Monitors deals for risk signals and alerts when action is needed
 *
 * Trigger: task.overdue OR action_item.missed_deadline
 * Actions:
 *   1. Analyze risk factors
 *   2. Post alert to Pulse
 *   3. Update CRM deal notes
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const DEAL_RISK_MONITOR_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Deal Risk Monitor',
  description: 'Monitors deals for overdue tasks and missed deadlines, alerts the team when deals are at risk',
  enabled: false,
  trigger_type: 'task.overdue' as TriggerType,
  trigger_config: {
    overdueByDays: 1,
    priorityFilter: 'high'  // Only trigger on high priority tasks
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        analysisType: 'risk_assessment',
        includeRecommendations: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'sales-alerts',
        messageTemplate: '⚠️ Deal Risk Alert: {{dealName}} has {{overdueCount}} overdue high-priority tasks. Risk factors: {{riskFactors}}',
        mentionOwner: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'deal_note',
        noteTemplate: '[Auto] Risk alert triggered: {{riskSummary}}',
        dedupeKey: 'dealId+date'
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 1,      // Only 1 alert per run
    maxCrmTasksPerRun: 1,           // Only 1 note update per run
    maxTotalActionsPerRun: 5,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const DEAL_RISK_MONITOR_META = {
  id: 'deal-risk-monitor',
  name: 'Deal Risk Monitor',
  description: 'Automatically monitors deals for risk signals like overdue tasks and missed deadlines',
  category: 'Sales',
  icon: '⚠️',
  recommendedFor: ['Sales teams', 'Account managers'],
  triggers: ['task.overdue', 'action_item.missed_deadline'],
  actions: ['Pulse alerts', 'CRM note updates'],
  setupTime: '5 minutes'
};
