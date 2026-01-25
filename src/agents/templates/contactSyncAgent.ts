/**
 * Contact Sync Agent Template
 * Automatically syncs contacts across Entomate, Pulse, and Logos CRM
 *
 * Trigger: meeting.completed (when new contacts detected)
 * Actions:
 *   1. Extract contacts from meeting participants
 *   2. Sync to shared hub for cross-app visibility
 *   3. Create/update in Logos CRM
 *   4. Notify team in Pulse about new contacts
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const CONTACT_SYNC_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Contact Sync Agent',
  description: 'Automatically syncs contacts discovered in meetings across Entomate, Pulse, and Logos CRM for unified contact management',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 60,        // Any meeting with participants
    mustHaveTranscript: false // Works even without transcript
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        extractContacts: true,
        enrichWithLinkedIn: true,
        dedupeByEmail: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'contact_sync',
        syncToHub: true,        // Sync to shared hub for cross-app access
        createInCrm: true,
        updateExisting: true,
        dedupeKey: 'email',
        enrichData: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'auto',
        messageTemplate: `👤 New Contact Synced: {{contactName}}

**Email:** {{contactEmail}}
**Company:** {{companyName}}
**Source:** Meeting - {{meetingTitle}}
**Synced to:** Logos CRM, Shared Hub

View in CRM: {{crmLink}}`,
        onlyIfNew: true        // Only post if contact is newly created
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 5,      // Up to 5 new contacts per meeting
    maxCrmTasksPerRun: 0,           // No tasks created
    maxTotalActionsPerRun: 10,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const CONTACT_SYNC_AGENT_META = {
  id: 'contact-sync-agent',
  name: 'Contact Sync Agent',
  description: 'Automatically syncs contacts from meetings across all connected apps (Entomate, Pulse, Logos CRM)',
  category: 'Cross-App Sync',
  icon: '👤',
  recommendedFor: ['Sales teams', 'All teams', 'CRM administrators'],
  triggers: ['meeting.completed'],
  actions: ['Extract contacts', 'Sync to CRM', 'Sync to Shared Hub', 'Post to Pulse'],
  setupTime: '2 minutes'
};

