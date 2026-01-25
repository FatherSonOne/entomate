/**
 * Cross-App Notification Agent Template
 * Sends notifications across the ecosystem when important events occur
 *
 * Trigger: meeting.completed OR deal.stage_changed OR task.overdue
 * Actions:
 *   1. Determine notification recipients across apps
 *   2. Post to relevant Pulse channels
 *   3. Create notifications in CRM
 *   4. Send email notifications if critical
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const CROSS_APP_NOTIFICATION_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Cross-App Notification Agent',
  description: 'Sends notifications across Entomate, Pulse, and CRM when important events occur',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 300,
    notifyOnImportantOnly: true,    // Only notify on important events
    filterByEventType: true
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        determineNotificationType: true,
        identifyRecipients: true,
        assessUrgency: true,
        extractNotificationContent: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'auto',
        messageTemplate: `🔔 {{notificationType}}: {{eventTitle}}

{{notificationContent}}

**Related:** {{relatedItems}}
**Action Required:** {{actionRequired}}

View: {{link}}`,
        mentionRecipients: true,
        onlyIfImportant: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'notification',
        createNotification: true,
        updateActivityFeed: true,
        setReminders: true,
        linkToRelated: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 3,      // Up to 3 notifications per event
    maxCrmTasksPerRun: 0,
    maxTotalActionsPerRun: 6,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const CROSS_APP_NOTIFICATION_AGENT_META = {
  id: 'cross-app-notification-agent',
  name: 'Cross-App Notification Agent',
  description: 'Sends notifications across Entomate, Pulse, and CRM for important events',
  category: 'Communication',
  icon: '🔔',
  recommendedFor: ['All teams', 'Operations', 'Administrators'],
  triggers: ['meeting.completed', 'deal.stage_changed', 'task.overdue'],
  actions: ['Determine recipients', 'Post to Pulse', 'Create CRM notifications'],
  setupTime: '3 minutes'
};

