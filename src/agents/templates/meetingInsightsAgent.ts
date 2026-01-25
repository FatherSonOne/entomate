/**
 * Meeting Insights Agent Template
 * Extracts and shares insights from meetings across the ecosystem
 *
 * Trigger: meeting.completed
 * Actions:
 *   1. Extract key insights and takeaways
 *   2. Identify sentiment and engagement
 *   3. Share insights in Pulse
 *   4. Store insights in CRM for future reference
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const MEETING_INSIGHTS_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Meeting Insights Agent',
  description: 'Extracts and shares key insights from meetings across Entomate, Pulse, and CRM',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 300,
    mustHaveTranscript: true,
    extractInsights: true
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        extractInsights: true,
        extractKeyTakeaways: true,
        analyzeSentiment: true,
        measureEngagement: true,
        identifyTopics: true,
        extractQuotes: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'auto',
        messageTemplate: `💡 Meeting Insights: {{meetingTitle}}

**Key Takeaways:**
{{takeaways}}

**Sentiment:** {{sentiment}}
**Engagement:** {{engagement}}

**Topics Discussed:**
{{topics}}

**Notable Quotes:**
{{quotes}}

**Next Steps:**
{{nextSteps}}

View full transcript: {{transcriptLink}}`,
        includeInsights: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'meeting_insights',
        storeInsights: true,
        updateMeetingNotes: true,
        linkToDeal: true,
        linkToContact: true,
        tagWithTopics: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 1,
    maxCrmTasksPerRun: 0,
    maxTotalActionsPerRun: 5,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const MEETING_INSIGHTS_AGENT_META = {
  id: 'meeting-insights-agent',
  name: 'Meeting Insights Agent',
  description: 'Extracts and shares key insights from meetings across the ecosystem',
  category: 'Meetings',
  icon: '💡',
  recommendedFor: ['All teams', 'Sales teams', 'Customer success'],
  triggers: ['meeting.completed'],
  actions: ['Extract insights', 'Post to Pulse', 'Store in CRM'],
  setupTime: '3 minutes'
};

