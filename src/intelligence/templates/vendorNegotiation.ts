/**
 * Vendor Negotiation Profile Template
 * Focused on vendor meetings, contract negotiations, and procurement discussions.
 */

import type { ProfileTemplate } from '../types';

export const VENDOR_NEGOTIATION_PROFILE: ProfileTemplate = {
  name: 'Vendor Negotiation',
  slug: 'vendor-negotiation',
  description: 'Focused on vendor meetings, contract negotiations, and procurement discussions.',
  icon: '📝',
  category: 'operations',

  systemPromptTemplate: `You are a vendor negotiation intelligence AI assistant attending a meeting with {{vendor_name}}.

CONTEXT:
- Vendor: {{vendor_name}}
- Contract Value: {{contract_value}}
- Key Negotiation Points: {{negotiation_points}}
- Walk-Away Threshold: {{walk_away_point}}
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
- Track all commitments made by both sides
- Note pricing changes, discounts, and financial terms discussed
- Capture specific contract terms and conditions mentioned
- Identify concessions made and received
- Flag any deadline pressures or ultimatums
- Document areas of agreement and remaining disputes
- Pay special attention to: {{focus_areas}}

ANALYSIS STYLE: {{tone}} — {{output_style}}`,

  customFields: [
    { key: 'vendor_name', label: 'Vendor Name', type: 'text', required: false, placeholder: 'e.g., Acme Software Inc.' },
    { key: 'contract_value', label: 'Contract Value', type: 'text', required: false, placeholder: 'e.g., $120,000/year' },
    { key: 'negotiation_points', label: 'Key Negotiation Points', type: 'textarea', required: false, placeholder: 'What are the main items to negotiate?' },
    { key: 'walk_away_point', label: 'Walk-Away Threshold', type: 'text', required: false, placeholder: 'e.g., Maximum $150k, must include SLA' },
  ],

  focusAreas: [
    { key: 'commitments', label: 'Commitments', description: 'Promises and commitments from both sides', weight: 0.9, extractionHint: 'Track every commitment, promise, and agreement made by either party' },
    { key: 'pricing_changes', label: 'Pricing & Terms', description: 'Financial terms and pricing discussions', weight: 0.9, extractionHint: 'Note all pricing mentions, discounts offered, payment terms, and financial conditions' },
    { key: 'terms_discussed', label: 'Contract Terms', description: 'Specific contract clauses and conditions', weight: 0.8, extractionHint: 'Capture SLA terms, warranty conditions, support levels, and legal terms discussed' },
    { key: 'concessions', label: 'Concessions', description: 'What each side gave up or compromised on', weight: 0.8, extractionHint: 'Track concessions made and received, trade-offs proposed, and compromises reached' },
    { key: 'deadlines', label: 'Deadlines & Urgency', description: 'Timeline pressures and deadline discussions', weight: 0.7, extractionHint: 'Note contract deadlines, renewal dates, implementation timelines, and urgency signals' },
  ],

  tone: 'formal',

  outputFormat: {
    summaryStyle: 'executive',
    includeRecommendations: true,
    includeRiskAssessment: true,
    includeSentimentBreakdown: false,
    customSections: [
      { title: 'Negotiation Scorecard', prompt: 'Summarize what was gained vs. conceded in this session' },
      { title: 'Outstanding Terms', prompt: 'List contract terms still under discussion' },
    ]
  },

  contextSources: ['contacts', 'crm_deals', 'past_meetings', 'org_info'],
  contextDepth: 'standard',

  suggestWhen: [
    { type: 'keyword', match: ['vendor', 'contract', 'negotiate', 'renewal', 'SLA', 'terms'], confidence: 0.7 },
  ],

  isBuiltin: true,
  isActive: true,
  createdBy: null,
};
