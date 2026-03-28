/**
 * Strategic Planning Profile Template
 * Deep-analysis profile for strategy sessions, roadmapping, and long-range planning.
 */

import type { ProfileTemplate } from '../types';

export const STRATEGIC_PLANNING_PROFILE: ProfileTemplate = {
  name: 'Strategic Planning',
  slug: 'strategic-planning',
  description: 'Deep-analysis profile for strategy sessions, roadmapping, and long-range planning.',
  icon: '🗺️',
  category: 'operations',

  systemPromptTemplate: `You are a strategic planning intelligence AI assistant facilitating a strategy session.

CONTEXT:
- Planning Horizon: {{planning_horizon}}
- Current Strategic Goals: {{strategic_goals}}
- Known Constraints: {{constraints}}
{{#if participant_context}}
PARTICIPANTS:
{{participant_context}}
{{/if}}
{{#if past_meeting_context}}
PREVIOUS STRATEGY SESSION NOTES:
{{past_meeting_context}}
{{/if}}
{{#if additional_instructions}}
SPECIAL INSTRUCTIONS: {{additional_instructions}}
{{/if}}

YOUR ROLE:
- Map goals discussed to current strategic priorities
- Identify resource allocation decisions and trade-offs
- Track risks, assumptions, and dependencies
- Capture timeline commitments and milestones
- Note areas of alignment and disagreement among participants
- Document decisions that change strategic direction
- Pay special attention to: {{focus_areas}}

ANALYSIS STYLE: {{tone}} — {{output_style}}`,

  customFields: [
    { key: 'planning_horizon', label: 'Planning Horizon', type: 'select', required: false, options: [
      { value: 'Q1', label: 'Q1' },
      { value: 'Q2', label: 'Q2' },
      { value: 'Q3', label: 'Q3' },
      { value: 'Q4', label: 'Q4' },
      { value: 'annual', label: 'Annual' },
      { value: '3_year', label: '3-Year' },
    ]},
    { key: 'strategic_goals', label: 'Current Strategic Goals', type: 'textarea', required: false, placeholder: 'What are the current top-level strategic goals?' },
    { key: 'constraints', label: 'Known Constraints', type: 'textarea', required: false, placeholder: 'Budget limits, headcount, timeline pressures, etc.' },
  ],

  focusAreas: [
    { key: 'goals', label: 'Goals & Priorities', description: 'Strategic goals discussed and prioritization decisions', weight: 0.9, extractionHint: 'Track goals mentioned, how they were prioritized, and any changes to existing goals' },
    { key: 'priorities', label: 'Priority Shifts', description: 'Changes in organizational priorities', weight: 0.9, extractionHint: 'Note any reprioritization, new priorities added, or items deprioritized' },
    { key: 'resource_allocation', label: 'Resource Allocation', description: 'How resources (people, budget, time) are being allocated', weight: 0.8, extractionHint: 'Track budget allocation discussions, team assignments, and resource trade-offs' },
    { key: 'risks', label: 'Risks & Assumptions', description: 'Identified risks and underlying assumptions', weight: 0.7, extractionHint: 'Capture risks mentioned, assumptions being made, and mitigation strategies' },
    { key: 'timeline', label: 'Timeline & Milestones', description: 'Key dates and milestone commitments', weight: 0.8, extractionHint: 'Note all dates, deadlines, milestones, and phasing discussions' },
  ],

  tone: 'balanced',

  outputFormat: {
    summaryStyle: 'detailed',
    includeRecommendations: true,
    includeRiskAssessment: true,
    includeSentimentBreakdown: false,
    customSections: [
      { title: 'Strategic Decisions Made', prompt: 'List all strategic decisions made during this session' },
      { title: 'Open Questions', prompt: 'List strategic questions that were raised but not resolved' },
    ]
  },

  contextSources: ['contacts', 'past_meetings', 'org_info', 'tasks'],
  contextDepth: 'standard',

  suggestWhen: [
    { type: 'keyword', match: ['strategy', 'planning', 'roadmap', 'vision', 'OKR'], confidence: 0.8 },
  ],

  isBuiltin: true,
  isActive: true,
  createdBy: null,
};
