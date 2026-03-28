/**
 * Board Meeting Profile Template
 * Structured for board meetings, governance discussions, and formal decision-making.
 */

import type { ProfileTemplate } from '../types';

export const BOARD_MEETING_PROFILE: ProfileTemplate = {
  name: 'Board Meeting',
  slug: 'board-meeting',
  description: 'Structured for board meetings, governance discussions, and formal decision-making sessions.',
  icon: '🏛️',
  category: 'operations',

  systemPromptTemplate: `You are a board meeting intelligence AI assistant documenting a formal board meeting.

CONTEXT:
- Agenda: {{agenda}}
- Reporting Period: {{reporting_period}}
- Key Metrics to Track: {{key_metrics}}
{{#if participant_context}}
BOARD MEMBERS & ATTENDEES:
{{participant_context}}
{{/if}}
{{#if past_meeting_context}}
PREVIOUS BOARD MEETING NOTES:
{{past_meeting_context}}
{{/if}}
{{#if additional_instructions}}
SPECIAL INSTRUCTIONS: {{additional_instructions}}
{{/if}}

YOUR ROLE:
- Record all formal decisions and votes with precision
- Track motions made, seconded, and vote outcomes
- Note financial updates and metric discussions
- Capture strategic direction changes and policy decisions
- Identify governance and compliance items
- Document action items with clear owners and deadlines
- Pay special attention to: {{focus_areas}}

ANALYSIS STYLE: {{tone}} — {{output_style}}`,

  customFields: [
    { key: 'agenda', label: 'Meeting Agenda', type: 'textarea', required: false, placeholder: 'Paste or summarize the board meeting agenda' },
    { key: 'reporting_period', label: 'Reporting Period', type: 'text', required: false, placeholder: 'e.g., Q1 2026' },
    { key: 'key_metrics', label: 'Key Metrics to Track', type: 'textarea', required: false, placeholder: 'e.g., Revenue, membership growth, program outcomes' },
  ],

  focusAreas: [
    { key: 'decisions', label: 'Decisions & Votes', description: 'Formal decisions, motions, and vote outcomes', weight: 1.0, extractionHint: 'Track all motions, seconds, votes (for/against/abstain), and resolutions passed' },
    { key: 'financial_updates', label: 'Financial Updates', description: 'Budget reports, financial statements, and fiscal discussions', weight: 0.9, extractionHint: 'Note all financial figures, budget variances, and fiscal decisions' },
    { key: 'strategic_direction', label: 'Strategic Direction', description: 'Long-term strategy and organizational direction', weight: 0.8, extractionHint: 'Capture strategic priorities, vision changes, and long-term planning discussions' },
    { key: 'governance', label: 'Governance & Compliance', description: 'Bylaws, policies, and regulatory compliance', weight: 0.7, extractionHint: 'Note any governance changes, policy updates, or compliance requirements' },
    { key: 'action_items', label: 'Action Items', description: 'Tasks assigned with owners and deadlines', weight: 0.9, extractionHint: 'Capture every action item with who is responsible and when it is due' },
  ],

  tone: 'formal',

  outputFormat: {
    summaryStyle: 'detailed',
    includeRecommendations: false,
    includeRiskAssessment: false,
    includeSentimentBreakdown: false,
    customSections: [
      { title: 'Motions & Resolutions', prompt: 'List all motions made, their outcomes, and vote tallies' },
      { title: 'Financial Summary', prompt: 'Summarize financial discussions and any budget decisions' },
      { title: 'Board Directives', prompt: 'List all directives or instructions given by the board' },
    ]
  },

  contextSources: ['contacts', 'past_meetings', 'org_info'],
  contextDepth: 'standard',

  suggestWhen: [
    { type: 'keyword', match: ['board', 'directors', 'governance', 'bylaws', 'resolution'], confidence: 0.9 },
  ],

  isBuiltin: true,
  isActive: true,
  createdBy: null,
};
