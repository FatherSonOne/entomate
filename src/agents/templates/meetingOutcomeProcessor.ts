/**
 * Meeting Outcome Processor Agent Template
 * Processes completed meetings to extract insights and sync to systems
 *
 * Trigger: meeting.completed
 * Actions:
 *   1. Extract action items and decisions
 *   2. Create tasks from action items
 *   3. Link meeting to CRM deal
 *   4. Post summary to Pulse
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const MEETING_OUTCOME_PROCESSOR_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Meeting Outcome Processor',
  description: 'Automatically extracts action items, decisions, and key points from meetings, then syncs to tasks and CRM',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 300,        // At least 5 minutes
    mustHaveTranscript: true    // Require transcript for processing
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        model: 'gemini',
        extractDecisions: true,
        extractKeyPoints: true,
        extractSentiment: true,
        extractNextSteps: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'meeting_summary',
        linkToDeal: true,
        createTasks: true,
        dedupeKey: 'meetingId+taskTitle'
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'auto',  // Auto-detect based on deal/project
        messageTemplate: `📋 Meeting Summary: {{meetingTitle}}

**Participants:** {{participants}}
**Duration:** {{duration}}

**Key Decisions:**
{{decisions}}

**Action Items:**
{{actionItems}}

**Next Steps:**
{{nextSteps}}`,
        includeLink: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 2,      // Summary + optional follow-up
    maxCrmTasksPerRun: 10,          // Up to 10 action items
    maxTotalActionsPerRun: 15,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const MEETING_OUTCOME_PROCESSOR_META = {
  id: 'meeting-outcome-processor',
  name: 'Meeting Outcome Processor',
  description: 'Automatically processes meeting transcripts to extract action items, decisions, and summaries',
  category: 'Meetings',
  icon: '📋',
  recommendedFor: ['All teams', 'Project managers', 'Sales teams'],
  triggers: ['meeting.completed'],
  actions: ['Extract action items', 'Create CRM tasks', 'Post to Pulse'],
  setupTime: '3 minutes'
};
