/**
 * Lead Enrichment Agent Template
 * Automatically enriches leads with data from cross-app ecosystem
 *
 * Trigger: meeting.completed (with new leads)
 * Actions:
 *   1. Extract lead information from meeting
 *   2. Enrich with data from shared hub
 *   3. Update CRM with enriched data
 *   4. Notify sales team of high-value leads
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const LEAD_ENRICHMENT_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Lead Enrichment Agent',
  description: 'Automatically enriches leads discovered in meetings with data from across the ecosystem and updates CRM',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 180,
    mustHaveTranscript: true,
    enrichNewLeadsOnly: true
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        extractLeads: true,
        extractCompanyInfo: true,
        extractBudgetSignals: true,
        extractTimelineSignals: true,
        extractDecisionMakers: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'lead_enrichment',
        enrichFromHub: true,        // Pull existing data from shared hub
        enrichFromCrm: true,        // Pull existing CRM data
        updateFields: ['company', 'industry', 'size', 'budget', 'timeline', 'decisionMakers'],
        createLeadIfNew: true,
        scoreLead: true,             // Auto-score based on signals
        assignToOwner: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'sales-leads',
        messageTemplate: `🎯 New Lead Enriched: {{leadName}}

**Company:** {{companyName}}
**Industry:** {{industry}}
**Budget Signal:** {{budgetSignal}}
**Timeline:** {{timeline}}
**Lead Score:** {{leadScore}}/100
**Source:** {{meetingTitle}}

View in CRM: {{crmLink}}`,
        onlyIfHighValue: true,      // Only post if lead score > threshold
        mentionOwner: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 3,      // Up to 3 high-value leads
    maxCrmTasksPerRun: 0,
    maxTotalActionsPerRun: 10,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const LEAD_ENRICHMENT_AGENT_META = {
  id: 'lead-enrichment-agent',
  name: 'Lead Enrichment Agent',
  description: 'Automatically enriches leads with data from across the ecosystem and updates CRM',
  category: 'Sales Automation',
  icon: '🎯',
  recommendedFor: ['Sales teams', 'Business development', 'SDR teams'],
  triggers: ['meeting.completed'],
  actions: ['Extract leads', 'Enrich from ecosystem', 'Update CRM', 'Post to Pulse'],
  setupTime: '5 minutes'
};

