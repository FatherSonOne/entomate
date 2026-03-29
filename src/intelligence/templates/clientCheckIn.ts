/**
 * Client Check-In Profile Template
 * Tailored for client status meetings, QBRs, and relationship management.
 */

import type { ProfileTemplate } from '../types';

export const CLIENT_CHECK_IN_PROFILE: ProfileTemplate = {
  name: 'Client Check-In',
  slug: 'client-check-in',
  description: 'Tailored for client status meetings, QBRs, and ongoing relationship management.',
  icon: '🤝',
  category: 'operations',

  systemPromptTemplate: `You are a client relationship intelligence AI assistant attending a check-in with {{client_name}}.

CONTEXT:
- Known Open Issues: {{open_issues}}
- Renewal Date: {{renewal_date}}
- Health Score: {{health_score}}
{{#if participant_context}}
PARTICIPANTS:
{{participant_context}}
{{/if}}
{{#if past_meeting_context}}
PREVIOUS MEETING NOTES:
{{past_meeting_context}}
{{/if}}
{{#if additional_instructions}}
SPECIAL INSTRUCTIONS: {{additional_instructions}}
{{/if}}

YOUR ROLE:
- Track satisfaction signals (positive and negative)
- Note any upsell or expansion opportunities mentioned
- Identify risk indicators (frustration, competitor mentions, scope creep)
- Monitor open issue resolution progress
- Capture relationship health indicators
- Pay special attention to: {{focus_areas}}

ANALYSIS STYLE: {{tone}} — {{output_style}}`,

  customFields: [
    { key: 'client_name', label: 'Client Name', type: 'text', required: false, placeholder: 'e.g., Acme Corporation' },
    { key: 'open_issues', label: 'Known Open Issues', type: 'textarea', required: false, placeholder: 'Current issues or concerns to track' },
    { key: 'renewal_date', label: 'Renewal/Contract Date', type: 'date', required: false },
    { key: 'health_score', label: 'Current Health Score', type: 'select', required: false, options: [
      { value: 'healthy', label: 'Healthy' },
      { value: 'at_risk', label: 'At Risk' },
      { value: 'critical', label: 'Critical' },
    ]},
  ],

  focusAreas: [
    { key: 'satisfaction_signals', label: 'Satisfaction Signals', description: 'Positive and negative sentiment indicators', weight: 0.9, extractionHint: 'Listen for praise, complaints, frustration, enthusiasm, and loyalty signals' },
    { key: 'upsell_opportunities', label: 'Upsell Opportunities', description: 'Potential for expanding the relationship', weight: 0.7, extractionHint: 'Note mentions of new needs, growing teams, additional use cases, or interest in other products' },
    { key: 'risk_indicators', label: 'Risk Indicators', description: 'Signs of potential churn or dissatisfaction', weight: 0.9, extractionHint: 'Track competitor mentions, budget concerns, reduced usage, unresolved issues, and escalation language' },
    { key: 'open_issues', label: 'Open Issue Status', description: 'Progress on known issues and new issues raised', weight: 0.8, extractionHint: 'Track which issues were discussed, resolved, or escalated' },
  ],

  tone: 'balanced',

  outputFormat: {
    summaryStyle: 'executive',
    includeRecommendations: true,
    includeRiskAssessment: true,
    includeSentimentBreakdown: true,
    customSections: [
      { title: 'Relationship Health Update', prompt: 'Assess the current health of this client relationship based on the meeting' },
      { title: 'Action Items for Account Team', prompt: 'List follow-ups specifically for the account management team' },
    ]
  },

  contextSources: ['contacts', 'crm_deals', 'past_meetings', 'org_info', 'tasks', 'pulse_history'],
  contextDepth: 'standard',

  suggestWhen: [
    { type: 'keyword', match: ['check-in', 'review', 'status update', 'QBR'], confidence: 0.7 },
    { type: 'recurring', match: ['weekly', 'biweekly', 'monthly'], confidence: 0.5 },
  ],

  isBuiltin: true,
  isActive: true,
  createdBy: null,
};
