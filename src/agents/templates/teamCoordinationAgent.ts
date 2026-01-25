/**
 * Team Coordination Agent Template
 * Coordinates team activities across Entomate, Pulse, and CRM
 *
 * Trigger: meeting.completed OR task.overdue
 * Actions:
 *   1. Identify team coordination needs
 *   2. Post updates to relevant Pulse channels
 *   3. Sync task assignments across apps
 *   4. Notify team members of dependencies
 */

import type { Agent, TriggerType, ActionStep, AgentGuardrails } from '../types';

export const TEAM_COORDINATION_AGENT_TEMPLATE: Omit<Agent, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Team Coordination Agent',
  description: 'Coordinates team activities across Entomate, Pulse, and CRM to keep everyone aligned',
  enabled: false,
  trigger_type: 'meeting.completed' as TriggerType,
  trigger_config: {
    minDurationSec: 300,
    mustHaveTranscript: true,
    requireMultipleParticipants: true  // Only for team meetings
  },
  actions: [
    {
      type: 'extract_action_items',
      config: {
        extractTeamAssignments: true,
        identifyDependencies: true,
        extractDeadlines: true,
        extractBlockers: true,
        identifyCrossTeamNeeds: true
      }
    },
    {
      type: 'assign_task',
      config: {
        strategy: 'by_team_role',
        createInEntomate: true,
        createInCrm: true,
        syncAssignments: true,
        setDependencies: true,
        notifyAssignees: true
      }
    },
    {
      type: 'post_to_pulse',
      config: {
        channel: 'auto',
        messageTemplate: `👥 Team Coordination Update: {{meetingTitle}}

**Team:** {{teamName}}
**Assignments:**
{{assignments}}

**Dependencies:**
{{dependencies}}

**Deadlines:**
{{deadlines}}

**Blockers:**
{{blockers}}

View tasks: {{taskLink}}`,
        mentionAssignees: true,
        mentionBlockers: true
      }
    },
    {
      type: 'sync_to_crm',
      config: {
        updateType: 'team_coordination',
        syncTaskAssignments: true,
        updateTeamNotes: true,
        linkToDeal: true,
        linkToProject: true
      }
    }
  ] as ActionStep[],
  guardrails: {
    maxPulseMessagesPerRun: 2,
    maxCrmTasksPerRun: 10,          // Up to 10 team assignments
    maxTotalActionsPerRun: 15,
    dryRunDefault: true
  } as AgentGuardrails,
  created_by: 'system'
};

/**
 * Template metadata for UI display
 */
export const TEAM_COORDINATION_AGENT_META = {
  id: 'team-coordination-agent',
  name: 'Team Coordination Agent',
  description: 'Coordinates team activities across Entomate, Pulse, and CRM to keep everyone aligned',
  category: 'Communication',
  icon: '👥',
  recommendedFor: ['All teams', 'Project managers', 'Team leads'],
  triggers: ['meeting.completed', 'task.overdue'],
  actions: ['Extract assignments', 'Sync tasks', 'Post to Pulse', 'Notify team'],
  setupTime: '4 minutes'
};

