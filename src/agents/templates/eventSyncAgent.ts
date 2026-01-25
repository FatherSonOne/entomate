/**
 * Event Sync Agent Template
 * Syncs important events across the ecosystem for unified visibility
 *
 * Trigger: meeting.completed OR task.overdue
 * Actions:
 *   1. Create event in shared hub
 *   2. Notify relevant teams in Pulse
 *   3. Link to related deals/contacts in CRM
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const EVENT_SYNC_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Event Sync Agent',
  description: 'Syncs important events (meetings, deadlines, milestones) across Entomate, Pulse, and Logos CRM for ecosystem-wide visibility',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 300,
    syncImportantOnly: true,  // Only sync meetings with action items or linked deals
    mustHaveTranscript: false
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        extractEvents: true,
        categorizeEvent: true,
        linkToDeals: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'event_sync',
        syncToHub: true,
        createEventRecord: true,
        linkToDeal: true,
        linkToContact: true,
        eventCategories: ['meeting', 'deadline', 'milestone', 'follow-up']
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'auto',
        messageTemplate: `📅 Event Synced: {{eventTitle}}

**Type:** {{eventType}}
**Date:** {{eventDate}}
**Related:** {{relatedDeal}} / {{relatedContact}}
**Synced to:** Shared Hub, Logos CRM`,
        onlyIfImportant: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 3,
    maxCrmTasksPerRun: 0,
    maxTotalActionsPerRun: 8,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const EVENT_SYNC_AGENT_META = {
  id: 'event-sync-agent',
  name: 'Event Sync Agent',
  description: 'Syncs important events across all apps for unified calendar and timeline visibility',
  category: 'Cross-App Sync',
  icon: '📅',
  recommendedFor: ['All teams', 'Operations', 'Project managers'],
  triggers: ['meeting.completed', 'task.overdue'],
  actions: ['Extract events', 'Sync to Shared Hub', 'Sync to CRM', 'Post to Pulse'],
  setupTime: '3 minutes'
};

