/**
 * Grant Specialist Profile Template
 * Specialized for grant proposal discussions, funding strategy, and compliance reviews.
 */

import type { ProfileTemplate } from '../types';

export const GRANT_SPECIALIST_PROFILE: ProfileTemplate = {
  name: 'Grant Specialist',
  slug: 'grant-specialist',
  description: 'Specialized for grant proposal discussions, funding strategy meetings, and grant reporting reviews.',
  icon: '📋',
  category: 'grants',

  systemPromptTemplate: `You are an expert grant specialist AI assistant attending a meeting about {{grant_name}}.

CONTEXT:
- Organization: {{org_name}}
- Funding Source: {{funding_org}}
- Grant Deadline: {{deadline}}
- Grant Amount: {{grant_amount}}
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
- Track all commitments, deliverables, and timeline discussions
- Flag any compliance or reporting requirements mentioned
- Identify budget implications and resource needs
- Note any changes to grant scope or timeline
- Capture key relationships between stakeholders
- Pay special attention to: {{focus_areas}}

ANALYSIS STYLE: {{tone}} — {{output_style}}`,

  customFields: [
    { key: 'grant_name', label: 'Grant Name', type: 'text', required: true, placeholder: 'e.g., Community Development Block Grant' },
    { key: 'funding_org', label: 'Funding Organization', type: 'text', required: false, placeholder: 'e.g., HUD, Ford Foundation' },
    { key: 'deadline', label: 'Grant Deadline', type: 'date', required: false },
    { key: 'grant_amount', label: 'Grant Amount', type: 'text', required: false, placeholder: 'e.g., $50,000' },
    { key: 'grant_stage', label: 'Grant Stage', type: 'select', required: false, options: [
      { value: 'research', label: 'Research & Identification' },
      { value: 'writing', label: 'Proposal Writing' },
      { value: 'submitted', label: 'Submitted — Awaiting Response' },
      { value: 'awarded', label: 'Awarded — Implementation' },
      { value: 'reporting', label: 'Reporting & Compliance' },
    ]},
  ],

  focusAreas: [
    { key: 'deliverables', label: 'Deliverables & Milestones', description: 'Track specific deliverables and timeline commitments', weight: 0.9, extractionHint: 'Look for mentions of deliverables, milestones, completion dates, and progress updates' },
    { key: 'budget', label: 'Budget & Financials', description: 'Budget allocations, expenses, and financial concerns', weight: 0.8, extractionHint: 'Track all dollar amounts, budget line items, cost overruns, and financial decisions' },
    { key: 'compliance', label: 'Compliance & Reporting', description: 'Compliance requirements and reporting deadlines', weight: 0.8, extractionHint: 'Note any mentions of reporting requirements, compliance issues, audits, or documentation needs' },
    { key: 'stakeholders', label: 'Stakeholder Relationships', description: 'Key stakeholder relationships and roles', weight: 0.6, extractionHint: 'Track who is responsible for what, relationship dynamics, and communication plans' },
  ],

  tone: 'formal',

  outputFormat: {
    summaryStyle: 'executive',
    includeRecommendations: true,
    includeRiskAssessment: true,
    includeSentimentBreakdown: false,
    customSections: [
      { title: 'Grant Status Update', prompt: 'Summarize the current status of the grant based on this meeting' },
      { title: 'Compliance Items', prompt: 'List any compliance or reporting items mentioned' },
      { title: 'Budget Impact', prompt: 'Summarize any budget discussions or financial implications' },
    ]
  },

  contextSources: ['contacts', 'crm_deals', 'past_meetings', 'org_info', 'tasks'],
  contextDepth: 'deep',

  suggestWhen: [
    { type: 'keyword', match: ['grant', 'funding', 'proposal', 'funder', 'foundation', 'endowment'], confidence: 0.8 },
    { type: 'keyword', match: ['compliance', 'reporting', 'deliverable'], confidence: 0.6 },
    { type: 'org_type', match: ['nonprofit', 'foundation', 'government'], confidence: 0.5 },
  ],

  isBuiltin: true,
  isActive: true,
  createdBy: null,
};
