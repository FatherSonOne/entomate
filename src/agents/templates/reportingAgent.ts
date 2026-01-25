/**
 * Reporting Agent Template
 * Generates and distributes reports across the ecosystem
 *
 * Trigger: meeting.completed (weekly/monthly) OR custom schedule
 * Actions:
 *   1. Gather data from Entomate, Pulse, and CRM
 *   2. Generate reports
 *   3. Post summary to Pulse
 *   4. Create report records in CRM
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const REPORTING_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Reporting Agent',
  description: 'Generates and distributes reports by aggregating data from across Entomate, Pulse, and CRM',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 0,
    triggerOnSchedule: true,       // Can be scheduled (weekly/monthly)
    reportType: 'summary'           // summary, detailed, custom
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        gatherMetrics: true,
        aggregateData: true,
        calculateKPIs: true,
        identifyTrends: true,
        formatReport: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'reports',
        messageTemplate: `📊 {{reportType}} Report: {{reportPeriod}}

**Key Metrics:**
{{metrics}}

**Highlights:**
{{highlights}}

**Trends:**
{{trends}}

**Action Items:**
{{actionItems}}

View full report: {{reportLink}}`,
        includeAttachments: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'report',
        createReportRecord: true,
        storeReportData: true,
        linkToRelated: true,
        setReportSchedule: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 1,      // One report per run
    maxCrmTasksPerRun: 0,
    maxTotalActionsPerRun: 5,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const REPORTING_AGENT_META = {
  id: 'reporting-agent',
  name: 'Reporting Agent',
  description: 'Generates and distributes reports by aggregating data from across the ecosystem',
  category: 'Operations',
  icon: '📊',
  recommendedFor: ['Operations', 'Managers', 'Analytics teams'],
  triggers: ['meeting.completed (scheduled)', 'custom_schedule'],
  actions: ['Gather metrics', 'Generate report', 'Post to Pulse', 'Store in CRM'],
  setupTime: '10 minutes'
};

