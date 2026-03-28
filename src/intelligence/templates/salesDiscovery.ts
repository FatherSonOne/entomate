/**
 * Sales Discovery Profile Template
 * Optimized for sales meetings, demos, discovery calls, and deal progression.
 */

import type { ProfileTemplate } from '../types';

export const SALES_DISCOVERY_PROFILE: ProfileTemplate = {
  name: 'Sales Discovery',
  slug: 'sales-discovery',
  description: 'Optimized for sales meetings, demos, discovery calls, and deal progression tracking.',
  icon: '🎯',
  category: 'sales',

  systemPromptTemplate: `You are an expert sales intelligence AI assistant attending a sales meeting about {{deal_name}}.

CONTEXT:
- Deal Stage: {{deal_stage}}
- Known Pain Points: {{pain_points}}
- Competitors: {{competitors}}
- Budget Range: {{budget_range}}
- Decision Timeline: {{decision_timeline}}
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
- Identify and categorize pain points, needs, and buying signals
- Track objections raised and how they were addressed
- Note decision-maker dynamics and influence map
- Capture pricing discussions and budget signals
- Flag competitive mentions and positioning
- Identify clear next steps and commitments
- Pay special attention to: {{focus_areas}}

ANALYSIS STYLE: {{tone}} — {{output_style}}`,

  customFields: [
    { key: 'deal_name', label: 'Deal/Opportunity Name', type: 'text', required: false, placeholder: 'e.g., Acme Corp — Enterprise License' },
    { key: 'deal_stage', label: 'Deal Stage', type: 'select', required: false, options: [
      { value: 'prospecting', label: 'Prospecting' },
      { value: 'discovery', label: 'Discovery' },
      { value: 'demo', label: 'Demo/Presentation' },
      { value: 'proposal', label: 'Proposal Sent' },
      { value: 'negotiation', label: 'Negotiation' },
      { value: 'closing', label: 'Closing' },
    ]},
    { key: 'pain_points', label: 'Known Pain Points', type: 'textarea', required: false, placeholder: 'What challenges has the prospect mentioned?' },
    { key: 'competitors', label: 'Competitor Mentions', type: 'text', required: false, placeholder: 'e.g., Competitor A, Competitor B' },
    { key: 'budget_range', label: 'Budget Range', type: 'text', required: false, placeholder: 'e.g., $10k-$25k/year' },
    { key: 'decision_timeline', label: 'Decision Timeline', type: 'text', required: false, placeholder: 'e.g., Q2 2026' },
  ],

  focusAreas: [
    { key: 'pain_points', label: 'Pain Points & Needs', description: 'Customer challenges and requirements', weight: 0.9, extractionHint: 'Listen for frustrations, challenges, wishes, and unmet needs' },
    { key: 'buying_signals', label: 'Buying Signals', description: 'Positive indicators of purchase intent', weight: 0.8, extractionHint: 'Track urgency language, timeline mentions, budget confirmations, and enthusiasm' },
    { key: 'objections', label: 'Objections & Concerns', description: 'Resistance points and how they were handled', weight: 0.8, extractionHint: 'Note pushback, hesitation, risk concerns, and comparison to alternatives' },
    { key: 'decision_makers', label: 'Decision Makers', description: 'Who influences and makes the buying decision', weight: 0.7, extractionHint: 'Identify who has authority, who influences, and organizational dynamics' },
    { key: 'next_steps', label: 'Next Steps & Commitments', description: 'Agreed follow-ups and action items', weight: 0.9, extractionHint: 'Capture all commitments, follow-up meetings, deliverables promised' },
  ],

  tone: 'balanced',

  outputFormat: {
    summaryStyle: 'executive',
    includeRecommendations: true,
    includeRiskAssessment: true,
    includeSentimentBreakdown: true,
    customSections: [
      { title: 'Deal Progression', prompt: 'Assess how this meeting moved the deal forward or backward' },
      { title: 'Competitive Intelligence', prompt: 'Summarize any competitor mentions and positioning' },
    ]
  },

  contextSources: ['contacts', 'crm_deals', 'past_meetings', 'org_info', 'pulse_history'],
  contextDepth: 'deep',

  suggestWhen: [
    { type: 'keyword', match: ['demo', 'proposal', 'pricing', 'pilot', 'discovery'], confidence: 0.7 },
    { type: 'keyword', match: ['prospect', 'lead', 'opportunity'], confidence: 0.6 },
  ],

  isBuiltin: true,
  isActive: true,
  createdBy: null,
};
