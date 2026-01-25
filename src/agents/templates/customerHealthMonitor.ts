/**
 * Customer Health Monitor Agent Template
 * Monitors customer health signals across the ecosystem
 *
 * Trigger: meeting.completed (customer meetings) OR task.overdue (customer tasks)
 * Actions:
 *   1. Analyze customer health from meeting signals
 *   2. Check engagement across apps (meetings, tasks, Pulse activity)
 *   3. Update health score in CRM
 *   4. Alert team of at-risk customers
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const CUSTOMER_HEALTH_MONITOR_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Customer Health Monitor',
  description: 'Monitors customer health signals from meetings, tasks, and engagement across the ecosystem',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 300,
    mustHaveTranscript: true,
    filterCustomerMeetings: true    // Only customer-facing meetings
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        analyzeCustomerHealth: true,
        extractSentiment: true,
        extractRiskSignals: true,
        extractEngagementSignals: true,
        checkCrossAppEngagement: true  // Check Pulse, CRM activity
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'customer_health',
        updateHealthScore: true,
        updateRiskFlags: true,
        createHealthNote: true,
        alertOnRisk: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'customer-success',
        messageTemplate: `💚 Customer Health Update: {{customerName}}

**Health Score:** {{healthScore}}/100
**Trend:** {{healthTrend}}
**Risk Signals:** {{riskSignals}}
**Engagement:** {{engagementLevel}}

{{#if atRisk}}⚠️ Customer at risk - immediate attention needed{{/if}}

View in CRM: {{crmLink}}`,
        onlyIfAtRisk: false,        // Post all updates, but highlight risks
        mentionCSM: true,
        mentionManager: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 2,
    maxCrmTasksPerRun: 0,
    maxTotalActionsPerRun: 6,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const CUSTOMER_HEALTH_MONITOR_META = {
  id: 'customer-health-monitor',
  name: 'Customer Health Monitor',
  description: 'Monitors customer health signals from meetings and engagement across the ecosystem',
  category: 'Customer Success',
  icon: '💚',
  recommendedFor: ['Customer success teams', 'Account managers', 'CS managers'],
  triggers: ['meeting.completed (customer)', 'task.overdue (customer)'],
  actions: ['Analyze health', 'Update CRM health score', 'Post alerts'],
  setupTime: '5 minutes'
};

