/**
 * Follow-Up Automation Agent Template
 * Automatically creates and schedules follow-ups after meetings
 *
 * Trigger: meeting.completed
 * Actions:
 *   1. Analyze meeting to determine follow-up type
 *   2. Create follow-up tasks in Entomate
 *   3. Create follow-up tasks in CRM
 *   4. Schedule follow-up meeting if needed
 *   5. Post reminder to Pulse
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const FOLLOW_UP_AUTOMATION_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Follow-Up Automation Agent',
  description: 'Automatically creates and schedules follow-up tasks and meetings based on meeting outcomes',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 300,
    mustHaveTranscript: true,
    requireActionItems: true        // Only trigger if action items found
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        extractFollowUps: true,
        extractNextSteps: true,
        extractScheduledMeetings: true,
        extractDeadlines: true,
        prioritizeFollowUps: true
      }
    },
    {
      type: 'assign_task',
      config: {
        strategy: 'by_meeting_owner',
        createInEntomate: true,
        createInCrm: true,
        syncBetweenApps: true,
        setDeadlines: true,
        linkToDeal: true,
        linkToContact: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'follow_up_tasks',
        createTasks: true,
        setReminders: true,
        assignToOwner: true,
        linkToDeal: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'auto',
        messageTemplate: `✅ Follow-ups Created: {{meetingTitle}}

**Follow-up Tasks:** {{taskCount}}
**Next Meeting:** {{nextMeetingDate}}
**Deadlines:** {{deadlines}}

Tasks created in Entomate and CRM. View: {{taskLink}}`,
        mentionOwner: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 1,
    maxCrmTasksPerRun: 5,           // Up to 5 follow-up tasks
    maxTotalActionsPerRun: 10,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const FOLLOW_UP_AUTOMATION_AGENT_META = {
  id: 'follow-up-automation-agent',
  name: 'Follow-Up Automation Agent',
  description: 'Automatically creates and schedules follow-up tasks and meetings after meetings',
  category: 'Sales Automation',
  icon: '✅',
  recommendedFor: ['Sales teams', 'Account managers', 'All teams'],
  triggers: ['meeting.completed'],
  actions: ['Extract follow-ups', 'Create tasks', 'Sync to CRM', 'Post to Pulse'],
  setupTime: '4 minutes'
};

