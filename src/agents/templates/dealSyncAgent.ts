/**
 * Deal Sync Agent Template
 * Keeps deals synchronized across Entomate, Logos CRM, and Pulse
 *
 * Trigger: deal.stage_changed
 * Actions:
 *   1. Sync deal updates to Logos CRM
 *   2. Post deal updates to Pulse channels
 *   3. Update shared hub for cross-app visibility
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const DEAL_SYNC_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Deal Sync Agent',
  description: 'Automatically syncs deal updates across Entomate, Logos CRM, and Pulse to keep all teams informed',
  enabled: false,
  trigger_type: 'deal.stage_changed' as TriggerType,
  trigger_config: {
    fromStage: null,           // Any stage change
    toStage: null,
    syncOnValueChange: true,   // Also sync on value updates
    syncOnOwnerChange: true    // Also sync on owner changes
  },
  actions: [
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'deal_sync',
        syncToHub: true,
        updateFields: ['stage', 'value', 'owner', 'closeDate', 'probability'],
        createActivityLog: true,
        notifyOwner: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'sales-updates',
        messageTemplate: `💰 Deal Update: {{dealName}}

**Stage:** {{fromStage}} → {{toStage}}
**Value:** {{dealValue}}
**Owner:** {{ownerName}}
**Probability:** {{probability}}%

View in CRM: {{crmLink}}`,
        mentionOwner: true,
        onlyOnStageChange: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 1,      // One update per deal change
    maxCrmTasksPerRun: 0,
    maxTotalActionsPerRun: 5,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const DEAL_SYNC_AGENT_META = {
  id: 'deal-sync-agent',
  name: 'Deal Sync Agent',
  description: 'Keeps deals synchronized across Entomate, Logos CRM, and Pulse with automatic updates',
  category: 'Cross-App Sync',
  icon: '💰',
  recommendedFor: ['Sales teams', 'Sales managers', 'Revenue operations'],
  triggers: ['deal.stage_changed'],
  actions: ['Sync to CRM', 'Sync to Shared Hub', 'Post to Pulse'],
  setupTime: '3 minutes'
};

