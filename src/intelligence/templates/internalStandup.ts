/**
 * Internal Standup Profile Template
 * Lightweight profile for daily standups, team syncs, and quick huddles.
 */

import type { ProfileTemplate } from '../types';

export const INTERNAL_STANDUP_PROFILE: ProfileTemplate = {
  name: 'Internal Standup',
  slug: 'internal-standup',
  description: 'Lightweight profile for daily standups, team syncs, and quick huddles.',
  icon: '⚡',
  category: 'operations',

  systemPromptTemplate: `You are a team standup assistant capturing key updates from a {{team_name}} sync.

CONTEXT:
- Sprint/Iteration: {{sprint_name}}
- Team: {{team_name}}
{{#if participant_context}}
TEAM MEMBERS:
{{participant_context}}
{{/if}}
{{#if additional_instructions}}
SPECIAL INSTRUCTIONS: {{additional_instructions}}
{{/if}}

YOUR ROLE:
- Capture what each person completed, is working on, and is blocked by
- Identify blockers that need immediate attention
- Note cross-team dependencies mentioned
- Track commitments and deadlines for the sprint
- Keep the summary concise and actionable
- Pay special attention to: {{focus_areas}}

ANALYSIS STYLE: {{tone}} — {{output_style}}`,

  customFields: [
    { key: 'sprint_name', label: 'Sprint/Iteration', type: 'text', required: false, placeholder: 'e.g., Sprint 14' },
    { key: 'team_name', label: 'Team', type: 'text', required: false, placeholder: 'e.g., Engineering, Product' },
  ],

  focusAreas: [
    { key: 'blockers', label: 'Blockers', description: 'Issues preventing progress', weight: 1.0, extractionHint: 'Identify anything described as blocking, stuck, waiting on, or preventing progress' },
    { key: 'progress_updates', label: 'Progress Updates', description: 'What was completed and what is in progress', weight: 0.8, extractionHint: 'Track completed items, in-progress work, and percentage updates' },
    { key: 'commitments', label: 'Commitments', description: 'What people committed to doing next', weight: 0.9, extractionHint: 'Capture promises, plans for today/this week, and delivery commitments' },
    { key: 'help_needed', label: 'Help Needed', description: 'Requests for assistance or collaboration', weight: 0.7, extractionHint: 'Note any requests for help, pairing, reviews, or input from others' },
  ],

  tone: 'casual',

  outputFormat: {
    summaryStyle: 'bullet_points',
    includeRecommendations: false,
    includeRiskAssessment: false,
    includeSentimentBreakdown: false,
  },

  contextSources: ['contacts', 'tasks'],
  contextDepth: 'minimal',

  suggestWhen: [
    { type: 'keyword', match: ['standup', 'daily', 'scrum', 'sync', 'huddle'], confidence: 0.8 },
    { type: 'recurring', match: ['daily'], confidence: 0.7 },
  ],

  isBuiltin: true,
  isActive: true,
  createdBy: null,
};
