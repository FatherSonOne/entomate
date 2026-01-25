/**
 * Expansion Opportunity Agent Template
 * Identifies expansion opportunities from customer meetings and engagement
 *
 * Trigger: meeting.completed (customer meetings)
 * Actions:
 *   1. Analyze meeting for expansion signals
 *   2. Check usage and engagement data
 *   3. Create expansion opportunity in CRM
 *   4. Alert sales/CS team of opportunity
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const EXPANSION_OPPORTUNITY_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Expansion Opportunity Agent',
  description: 'Identifies expansion opportunities from customer meetings and engagement signals',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 300,
    mustHaveTranscript: true,
    filterCustomerMeetings: true
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        detectExpansionSignals: true,
        extractBudgetMentions: true,
        extractFeatureRequests: true,
        extractTeamGrowth: true,
        extractUsageGrowth: true,
        assessExpansionProbability: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'expansion_opportunity',
        createExpansionDeal: true,
        linkToCustomer: true,
        estimateValue: true,
        assignToOwner: true,
        setPriority: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'sales-opportunities',
        messageTemplate: `🚀 Expansion Opportunity: {{customerName}}

**Opportunity Type:** {{expansionType}}
**Estimated Value:** {{estimatedValue}}
**Probability:** {{probability}}%
**Signals:**
- {{signal1}}
- {{signal2}}
- {{signal3}}

**Next Steps:** {{nextSteps}}

View in CRM: {{crmLink}}`,
        onlyIfHighValue: true,      // Only post high-value opportunities
        mentionOwner: true,
        mentionManager: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 2,      // Up to 2 opportunities per meeting
    maxCrmTasksPerRun: 0,
    maxTotalActionsPerRun: 5,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const EXPANSION_OPPORTUNITY_AGENT_META = {
  id: 'expansion-opportunity-agent',
  name: 'Expansion Opportunity Agent',
  description: 'Identifies expansion opportunities from customer meetings and engagement signals',
  category: 'Customer Success',
  icon: '🚀',
  recommendedFor: ['Customer success teams', 'Sales teams', 'Account managers'],
  triggers: ['meeting.completed (customer)'],
  actions: ['Detect expansion signals', 'Create expansion deal', 'Post to Pulse'],
  setupTime: '5 minutes'
};

