# Meeting Intelligence Profiles — Feature Plan

## Overview

**Feature Name:** Meeting Intelligence Profiles (MIP)  
**App:** Entomate  
**Author:** Rune (AI assistant) in collaboration with Frankie  
**Date:** 2026-03-28  
**Status:** Ready for Implementation

### What It Is

Meeting Intelligence Profiles transform Entomate's AI bot from a generic meeting processor into a **context-aware, role-specialized intelligence partner** that prepares for meetings, adapts its behavior to the meeting type, and delivers specialized analysis shaped by user-configurable parameters.

### The Core Flow

1. **Meeting Created/Scheduled** → Entomate detects participants, subject, tags
2. **Profile Suggested** → AI auto-suggests a specialization ("This looks like a Grant Proposal meeting")
3. **User Configures** → Accepts/customizes the profile, fills in specialization-specific fields
4. **Context Assembled** → Bot pulls contact data from Logos Vision, conversation history from Pulse, past meeting summaries from Entomate
5. **Meeting Processed** → Transcription + analysis runs through the **specialized lens** (dynamic system prompt)
6. **Output Shaped** → Meeting summary, action items, and insights are all tailored to the specialization

### Why It Matters

- **No meeting tool does this.** Pre-meeting contextual AI specialization pulled from your own CRM and comms data is genuinely differentiated.
- **Ecosystem multiplier.** Logos Vision knows the people, Pulse knows the conversations, Entomate knows the meetings. Together they create an intelligence layer none could alone.
- **It compounds.** Every meeting adds to the bot's contextual memory for that contact/org.

---

## Architecture Overview

### New Directory Structure

```
src/
├── intelligence/                          # NEW — Meeting Intelligence Profiles
│   ├── types.ts                           # Core types for MIP
│   ├── profileRegistry.ts                 # Built-in profile templates
│   ├── profileService.ts                  # CRUD for profiles + meeting-profile assignments
│   ├── contextAssembler.ts                # Pre-meeting context gathering (ecosystem bridge)
│   ├── promptBuilder.ts                   # Dynamic system prompt composition
│   ├── suggestionEngine.ts                # Auto-suggest profiles based on meeting metadata
│   └── templates/                         # Built-in specialization templates
│       ├── grantSpecialist.ts
│       ├── salesDiscovery.ts
│       ├── clientCheckIn.ts
│       ├── boardMeeting.ts
│       ├── internalStandup.ts
│       ├── strategicPlanning.ts
│       ├── vendorNegotiation.ts
│       └── index.ts
├── components/
│   ├── MeetingIntelligencePanel.tsx        # NEW — UI panel for profile selection/config
│   ├── ProfileSelector.tsx                # NEW — Profile picker with suggestions
│   ├── ProfileCustomizer.tsx              # NEW — Custom field form per profile
│   └── ContextPreview.tsx                 # NEW — Shows assembled context before meeting
├── agents/
│   ├── triggers/
│   │   └── meetingUpcoming.ts             # NEW — Fires before a meeting to suggest profile
│   └── actions/
│       └── prepareContext.ts              # NEW — Assembles cross-app context
```

### Database Schema (New Migration)

```sql
-- Migration: Meeting Intelligence Profiles
-- Date: 2026-03-28

-- =====================================================
-- INTELLIGENCE PROFILES TABLE
-- Stores profile templates (built-in + user-created)
-- =====================================================
CREATE TABLE IF NOT EXISTS intelligence_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                              -- "Grant Specialist"
    slug TEXT NOT NULL UNIQUE,                       -- "grant-specialist"
    description TEXT,                                -- Human-readable description
    icon TEXT DEFAULT '🤖',                          -- Emoji for UI
    category TEXT NOT NULL DEFAULT 'general',        -- "meetings", "sales", "operations"
    
    -- Specialization config
    system_prompt_template TEXT NOT NULL,             -- Prompt template with {{variables}}
    custom_fields JSONB NOT NULL DEFAULT '[]',       -- Field definitions for user input
    focus_areas JSONB NOT NULL DEFAULT '[]',         -- What to prioritize in analysis
    tone TEXT NOT NULL DEFAULT 'balanced',           -- "formal", "casual", "balanced"
    output_format JSONB DEFAULT '{}',               -- How to shape the output
    
    -- Context config
    context_sources JSONB NOT NULL DEFAULT '["contacts"]',  -- Which data to pull
    context_depth TEXT NOT NULL DEFAULT 'standard',          -- "minimal", "standard", "deep"
    
    -- Suggestion rules
    suggest_when JSONB DEFAULT '{}',                 -- Auto-suggestion conditions
    
    -- Metadata
    is_builtin BOOLEAN NOT NULL DEFAULT false,       -- Built-in vs user-created
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- MEETING INTELLIGENCE CONFIG TABLE
-- Links a specific meeting to a profile + user inputs
-- =====================================================
CREATE TABLE IF NOT EXISTS meeting_intelligence_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL,                        -- References entomate_meetings.id
    profile_id UUID REFERENCES intelligence_profiles(id),
    
    -- User-provided values for custom fields
    custom_field_values JSONB DEFAULT '{}',
    
    -- Assembled context (cached for the meeting)
    assembled_context JSONB DEFAULT '{}',
    context_assembled_at TIMESTAMPTZ,
    
    -- Final composed system prompt (cached)
    composed_prompt TEXT,
    
    -- Profile overrides for this specific meeting
    tone_override TEXT,                              -- Override profile tone
    focus_override JSONB,                            -- Override focus areas
    additional_instructions TEXT,                    -- Free-text user instructions
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending',          -- "pending", "context_ready", "active", "completed"
    suggestion_dismissed BOOLEAN DEFAULT false,      -- User dismissed the auto-suggestion
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(meeting_id)                               -- One profile config per meeting
);

-- =====================================================
-- CONTEXT CACHE TABLE
-- Caches cross-app context to avoid repeated lookups
-- =====================================================
CREATE TABLE IF NOT EXISTS intelligence_context_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,                       -- "contact", "organization", "deal"
    entity_id TEXT NOT NULL,                         -- ID from source app
    source_app TEXT NOT NULL,                        -- "logos_vision", "pulse", "entomate"
    context_data JSONB NOT NULL,                     -- Cached data
    expires_at TIMESTAMPTZ NOT NULL,                 -- TTL for cache
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(entity_type, entity_id, source_app)
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_intelligence_profiles_slug ON intelligence_profiles(slug);
CREATE INDEX idx_intelligence_profiles_category ON intelligence_profiles(category);
CREATE INDEX idx_intelligence_profiles_active ON intelligence_profiles(is_active);

CREATE INDEX idx_meeting_intelligence_config_meeting ON meeting_intelligence_config(meeting_id);
CREATE INDEX idx_meeting_intelligence_config_profile ON meeting_intelligence_config(profile_id);
CREATE INDEX idx_meeting_intelligence_config_status ON meeting_intelligence_config(status);

CREATE INDEX idx_intelligence_context_cache_entity ON intelligence_context_cache(entity_type, entity_id);
CREATE INDEX idx_intelligence_context_cache_expires ON intelligence_context_cache(expires_at);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE intelligence_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_intelligence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_context_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active profiles"
    ON intelligence_profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage their own profiles"
    ON intelligence_profiles FOR ALL
    USING (auth.role() = 'authenticated' AND (is_builtin = false OR auth.role() = 'service_role'));

CREATE POLICY "Users can manage meeting intelligence config"
    ON meeting_intelligence_config FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Service can manage context cache"
    ON intelligence_context_cache FOR ALL
    USING (auth.role() = 'authenticated');

-- =====================================================
-- TRIGGER: Auto-update timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_intelligence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_intelligence_profiles_updated
    BEFORE UPDATE ON intelligence_profiles
    FOR EACH ROW EXECUTE FUNCTION update_intelligence_timestamp();

CREATE TRIGGER trg_meeting_intelligence_config_updated
    BEFORE UPDATE ON meeting_intelligence_config
    FOR EACH ROW EXECUTE FUNCTION update_intelligence_timestamp();
```

---

## Core Types (`src/intelligence/types.ts`)

```typescript
/**
 * Meeting Intelligence Profiles — Core Types
 */

// ==================== CUSTOM FIELD DEFINITIONS ====================

export type CustomFieldType = 'text' | 'textarea' | 'select' | 'multiselect' | 'date' | 'number' | 'toggle';

export interface CustomFieldDef {
  key: string;                        // "grant_name", "funding_org"
  label: string;                      // "Grant Name"
  type: CustomFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;                  // Tooltip/helper text
  options?: { value: string; label: string }[];  // For select/multiselect
  defaultValue?: any;
}

// ==================== FOCUS AREAS ====================

export interface FocusArea {
  key: string;                        // "action_items", "budget_discussion", "risks"
  label: string;                      // "Action Items"
  description: string;
  weight: number;                     // 0-1, how much to emphasize
  extractionHint: string;             // Hint for Gemini on what to look for
}

// ==================== SUGGESTION RULES ====================

export interface SuggestionRule {
  type: 'keyword' | 'participant' | 'tag' | 'recurring' | 'org_type';
  match: string | string[];           // What to match against
  confidence: number;                 // 0-1, threshold for auto-suggest
}

// ==================== OUTPUT FORMAT ====================

export interface OutputFormatConfig {
  summaryStyle: 'executive' | 'detailed' | 'bullet_points';
  includeRecommendations: boolean;
  includeRiskAssessment: boolean;
  includeSentimentBreakdown: boolean;
  customSections?: { title: string; prompt: string }[];
}

// ==================== INTELLIGENCE PROFILE ====================

export interface IntelligenceProfile {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: 'meetings' | 'sales' | 'operations' | 'grants' | 'hr' | 'custom';
  
  systemPromptTemplate: string;       // Template with {{variable}} placeholders
  customFields: CustomFieldDef[];
  focusAreas: FocusArea[];
  tone: 'formal' | 'casual' | 'balanced';
  outputFormat: OutputFormatConfig;
  
  contextSources: ContextSource[];
  contextDepth: 'minimal' | 'standard' | 'deep';
  
  suggestWhen: SuggestionRule[];
  
  isBuiltin: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== CONTEXT SOURCES ====================

export type ContextSource = 
  | 'contacts'           // Pull participant info from Logos Vision
  | 'pulse_history'      // Recent Pulse conversations involving participants
  | 'crm_deals'          // Active deals linked to participants/org
  | 'past_meetings'      // Previous Entomate meetings with same participants
  | 'org_info'           // Organization details from CRM
  | 'tasks'              // Open tasks related to participants/deals
  | 'notes';             // Notes from CRM/Entomate linked to contacts

// ==================== ASSEMBLED CONTEXT ====================

export interface AssembledContext {
  participants: ParticipantContext[];
  organization?: OrgContext;
  relatedDeals?: DealContext[];
  pastMeetings?: PastMeetingContext[];
  recentConversations?: ConversationContext[];
  openTasks?: TaskContext[];
  assembledAt: string;
  sources: string[];                  // Which sources were actually queried
  tokenEstimate: number;              // Estimated token count for prompt budgeting
}

export interface ParticipantContext {
  name: string;
  email?: string;
  role?: string;
  organization?: string;
  relationship?: string;              // "client", "partner", "team_member"
  lastInteraction?: string;           // ISO date
  meetingCount?: number;
  notes?: string;                     // CRM notes about this contact
  sourceApp: 'logos_vision' | 'pulse' | 'entomate';
}

export interface OrgContext {
  name: string;
  type?: string;                      // "nonprofit", "corporate", "government"
  sector?: string;
  relationship?: string;
  activeDeals?: number;
  totalMeetings?: number;
  keyContacts?: string[];
  notes?: string;
}

export interface DealContext {
  name: string;
  stage: string;
  value?: number;
  lastActivity?: string;
  nextSteps?: string[];
}

export interface PastMeetingContext {
  title: string;
  date: string;
  summary?: string;
  keyDecisions?: string[];
  openActionItems?: string[];
}

export interface ConversationContext {
  channel: string;
  lastMessage: string;
  messageCount: number;
  lastActivity: string;
  topics?: string[];
}

export interface TaskContext {
  title: string;
  status: string;
  assignee?: string;
  dueDate?: string;
  priority: string;
  relatedTo?: string;
}

// ==================== MEETING INTELLIGENCE CONFIG ====================

export interface MeetingIntelligenceConfig {
  id: string;
  meetingId: string;
  profileId: string | null;
  
  customFieldValues: Record<string, any>;
  assembledContext: AssembledContext | null;
  contextAssembledAt: string | null;
  composedPrompt: string | null;
  
  toneOverride: string | null;
  focusOverride: FocusArea[] | null;
  additionalInstructions: string | null;
  
  status: 'pending' | 'context_ready' | 'active' | 'completed';
  suggestionDismissed: boolean;
  
  createdAt: string;
  updatedAt: string;
}

// ==================== PROFILE SUGGESTION ====================

export interface ProfileSuggestion {
  profile: IntelligenceProfile;
  confidence: number;                 // 0-1
  reason: string;                     // "Meeting title contains 'grant'"
  matchedRules: SuggestionRule[];
}
```

---

## Built-in Profile Templates

### 1. Grant Specialist (`templates/grantSpecialist.ts`)

```typescript
export const GRANT_SPECIALIST_PROFILE: Omit<IntelligenceProfile, 'id' | 'createdAt' | 'updatedAt'> = {
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
```

### 2. Sales Discovery

```typescript
{
  name: 'Sales Discovery',
  slug: 'sales-discovery',
  icon: '🎯',
  category: 'sales',
  customFields: [
    { key: 'deal_name', label: 'Deal/Opportunity Name', type: 'text', required: false },
    { key: 'deal_stage', label: 'Deal Stage', type: 'select', required: false, options: [...] },
    { key: 'pain_points', label: 'Known Pain Points', type: 'textarea', required: false },
    { key: 'competitors', label: 'Competitor Mentions', type: 'text', required: false },
    { key: 'budget_range', label: 'Budget Range', type: 'text', required: false },
    { key: 'decision_timeline', label: 'Decision Timeline', type: 'text', required: false },
  ],
  focusAreas: ['pain_points', 'buying_signals', 'objections', 'decision_makers', 'next_steps'],
  suggestWhen: [
    { type: 'keyword', match: ['demo', 'proposal', 'pricing', 'pilot', 'discovery'], confidence: 0.7 },
    { type: 'keyword', match: ['prospect', 'lead', 'opportunity'], confidence: 0.6 },
  ],
}
```

### 3. Client Check-In

```typescript
{
  name: 'Client Check-In',
  slug: 'client-check-in',
  icon: '🤝',
  category: 'operations',
  customFields: [
    { key: 'client_name', label: 'Client Name', type: 'text', required: false },
    { key: 'open_issues', label: 'Known Open Issues', type: 'textarea', required: false },
    { key: 'renewal_date', label: 'Renewal/Contract Date', type: 'date', required: false },
    { key: 'health_score', label: 'Current Health Score', type: 'select', required: false, options: [
      { value: 'healthy', label: '🟢 Healthy' },
      { value: 'at_risk', label: '🟡 At Risk' },
      { value: 'critical', label: '🔴 Critical' },
    ]},
  ],
  focusAreas: ['satisfaction_signals', 'upsell_opportunities', 'risk_indicators', 'open_issues'],
  suggestWhen: [
    { type: 'keyword', match: ['check-in', 'review', 'status update', 'QBR'], confidence: 0.7 },
    { type: 'recurring', match: ['weekly', 'biweekly', 'monthly'], confidence: 0.5 },
  ],
}
```

### 4. Board Meeting

```typescript
{
  name: 'Board Meeting',
  slug: 'board-meeting',
  icon: '🏛️',
  category: 'operations',
  customFields: [
    { key: 'agenda', label: 'Meeting Agenda', type: 'textarea', required: false },
    { key: 'reporting_period', label: 'Reporting Period', type: 'text', required: false },
    { key: 'key_metrics', label: 'Key Metrics to Track', type: 'textarea', required: false },
  ],
  tone: 'formal',
  focusAreas: ['decisions', 'votes', 'financial_updates', 'strategic_direction', 'action_items'],
  suggestWhen: [
    { type: 'keyword', match: ['board', 'directors', 'governance', 'bylaws', 'resolution'], confidence: 0.9 },
  ],
}
```

### 5. Internal Standup

```typescript
{
  name: 'Internal Standup',
  slug: 'internal-standup',
  icon: '⚡',
  category: 'operations',
  customFields: [
    { key: 'sprint_name', label: 'Sprint/Iteration', type: 'text', required: false },
    { key: 'team_name', label: 'Team', type: 'text', required: false },
  ],
  tone: 'casual',
  outputFormat: { summaryStyle: 'bullet_points', includeRecommendations: false, ... },
  focusAreas: ['blockers', 'progress_updates', 'commitments', 'help_needed'],
  suggestWhen: [
    { type: 'keyword', match: ['standup', 'daily', 'scrum', 'sync', 'huddle'], confidence: 0.8 },
    { type: 'recurring', match: ['daily'], confidence: 0.7 },
  ],
}
```

### 6. Strategic Planning

```typescript
{
  name: 'Strategic Planning',
  slug: 'strategic-planning',
  icon: '🗺️',
  category: 'operations',
  customFields: [
    { key: 'planning_horizon', label: 'Planning Horizon', type: 'select', options: ['Q1', 'Q2', 'Annual', '3-Year'] },
    { key: 'strategic_goals', label: 'Current Strategic Goals', type: 'textarea' },
    { key: 'constraints', label: 'Known Constraints', type: 'textarea' },
  ],
  focusAreas: ['goals', 'priorities', 'resource_allocation', 'risks', 'timeline'],
  suggestWhen: [
    { type: 'keyword', match: ['strategy', 'planning', 'roadmap', 'vision', 'OKR'], confidence: 0.8 },
  ],
}
```

### 7. Vendor Negotiation

```typescript
{
  name: 'Vendor Negotiation',
  slug: 'vendor-negotiation',
  icon: '📝',
  category: 'operations',
  customFields: [
    { key: 'vendor_name', label: 'Vendor Name', type: 'text' },
    { key: 'contract_value', label: 'Contract Value', type: 'text' },
    { key: 'negotiation_points', label: 'Key Negotiation Points', type: 'textarea' },
    { key: 'walk_away_point', label: 'Walk-Away Threshold', type: 'text' },
  ],
  focusAreas: ['commitments', 'pricing_changes', 'terms_discussed', 'concessions', 'deadlines'],
  suggestWhen: [
    { type: 'keyword', match: ['vendor', 'contract', 'negotiate', 'renewal', 'SLA', 'terms'], confidence: 0.7 },
  ],
}
```

---

## Key Services

### Context Assembler (`src/intelligence/contextAssembler.ts`)

This is the most architecturally significant piece — it reaches across the ecosystem bridge to gather context.

**How it works:**

1. Receives a meeting's participants list + profile's `contextSources` config
2. For each participant, queries Logos Vision (via `logosVisionClient.ts` or ecosystem bridge API) for contact info, org details, deal data
3. Queries Entomate's own DB for past meetings with those participants
4. Queries Pulse (via ecosystem bridge) for recent conversation threads
5. Assembles everything into an `AssembledContext` object
6. Caches results in `intelligence_context_cache` with a TTL (e.g., 2 hours)
7. Estimates token count so the prompt builder can stay within limits

**Key design decisions:**
- Uses the existing `ecosystem_config` table for connection details
- Falls back gracefully if any source is unavailable (doesn't block the meeting)
- Respects `contextDepth` — "minimal" = just names/roles, "standard" = + recent interactions, "deep" = + full history + notes
- Token budget: keeps total context under 4000 tokens to leave room for the transcript

### Prompt Builder (`src/intelligence/promptBuilder.ts`)

Composes the final system prompt from layers:

```
1. Base layer:        "You are an AI assistant specializing in {{profile.name}}..."
2. Profile template:  profile.systemPromptTemplate with {{variables}} filled
3. Custom fields:     User's filled-in values substituted into template
4. Assembled context: Participant info, past meetings, deal data formatted as context
5. Focus areas:       "Pay special attention to: {{focus_areas}}"
6. Tone directive:    "Respond in a {{tone}} tone"
7. Output format:     "Structure your output as: {{outputFormat}}"
8. User overrides:    Any additional_instructions from the user
```

This composed prompt replaces the hardcoded prompts currently in `geminiService.ts` and `extractActionItems.ts`.

### Suggestion Engine (`src/intelligence/suggestionEngine.ts`)

Runs when a meeting is created/updated:

1. Analyzes meeting title, description, tags, and participant list
2. Matches against all active profiles' `suggestWhen` rules
3. Returns ranked `ProfileSuggestion[]` sorted by confidence
4. Emits suggestions to the UI component

---

## UI Components

### MeetingIntelligencePanel

Displayed on the meeting detail page (integrates into existing `MeetingsView.tsx`):

```
┌─────────────────────────────────────────────┐
│ 🤖 Meeting Intelligence                     │
│                                              │
│ ┌─ Suggested ─────────────────────────────┐ │
│ │ 📋 Grant Specialist (92% match)         │ │
│ │ "Title contains 'grant proposal'"       │ │
│ │ [Accept] [Customize] [Dismiss]          │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ Or choose a profile:                         │
│ [📋 Grant] [🎯 Sales] [🤝 Client] [⚡ ...]  │
│ [+ Create Custom Profile]                    │
│                                              │
│ ─── Custom Fields ──────────────────────── │
│ Grant Name:     [Community Development    ] │
│ Funding Org:    [HUD                      ] │
│ Deadline:       [2026-06-30              ] │
│ Grant Amount:   [$50,000                  ] │
│ Grant Stage:    [Proposal Writing ▼       ] │
│                                              │
│ ─── Context Preview ────────────────────── │
│ 👤 3 participants matched in Logos Vision    │
│ 📧 5 recent Pulse threads found             │
│ 📅 2 previous meetings with this group      │
│ [View Full Context] [Refresh]               │
│                                              │
│ Additional Instructions: (optional)          │
│ [Focus on budget justification section...  ] │
│                                              │
│ [Save & Prepare Context]                     │
└─────────────────────────────────────────────┘
```

### Integration Point

The panel integrates into the existing `MeetingsView.tsx` component. When a meeting is selected or being created:
- Check for existing `meeting_intelligence_config` record
- If none, run suggestion engine and display suggestions
- Show the panel below the meeting details

---

## Integration with Existing Code

### Modified Files

1. **`src/services/geminiService.ts`** — `summarizeMeeting()` and `extractActionItems()` gain an optional `systemPrompt` parameter. If provided, it replaces the hardcoded prompts. If not provided (backward compat), they work exactly as before.

2. **`src/agents/actions/extractActionItems.ts`** — Same pattern: accept optional `MeetingIntelligenceConfig`, use its `composedPrompt` if available.

3. **`src/agents/agentTriggerService.ts`** — Add `fireMeetingUpcomingTrigger()` function. Also modify `fireMeetingCompletedTrigger()` to load the meeting's intelligence config and pass it to the agent actions.

4. **`src/agents/types.ts`** — Add `'meeting.upcoming'` to TriggerType union. Add new action type `'prepare_context'`.

5. **`src/components/MeetingsView.tsx`** — Import and render `MeetingIntelligencePanel` in the meeting detail/creation view.

6. **`src/lib/supabase.ts`** — Add type interfaces for the new tables.

7. **`src/services/meetingService.ts`** — After `createMeeting()`, trigger the suggestion engine. Before processing a meeting's audio, load the intelligence config and pass the composed prompt.

### NOT Modified (Backward Compat)

- All existing agent templates remain unchanged — they just won't use intelligence profiles unless configured
- Existing meetings without a profile continue to process with the default hardcoded prompts
- The ecosystem bridge tables/services are used as-is
- No changes to Pulse or Logos Vision codebases needed (reads only, via existing bridge)

---

## Implementation Phases

### Phase 1: Foundation (Priority — Do This First)
- [ ] Database migration (3 new tables)
- [ ] `src/intelligence/types.ts` — All type definitions
- [ ] `src/intelligence/profileRegistry.ts` — Load/manage profiles
- [ ] `src/intelligence/profileService.ts` — CRUD operations
- [ ] `src/intelligence/templates/` — All 7 built-in profile templates
- [ ] `src/intelligence/promptBuilder.ts` — Dynamic prompt composition
- [ ] Seed migration for built-in profiles
- [ ] Modify `geminiService.ts` to accept optional system prompt override
- [ ] Modify `extractActionItems.ts` action to accept optional prompt override
- **Result:** Profiles exist, can be manually assigned to meetings, processing uses custom prompts

### Phase 2: Context Assembly
- [ ] `src/intelligence/contextAssembler.ts` — Cross-app context gathering
- [ ] `src/agents/actions/prepareContext.ts` — Agent action for context assembly
- [ ] `src/agents/triggers/meetingUpcoming.ts` — New trigger type
- [ ] Update `agentTriggerService.ts` with upcoming trigger
- [ ] Update `agentRegistry.ts` with new trigger + action types
- **Result:** Bot can pull context from Logos Vision + Pulse before meetings

### Phase 3: Smart Suggestions + UI
- [ ] `src/intelligence/suggestionEngine.ts` — Auto-suggest profiles
- [ ] `src/components/MeetingIntelligencePanel.tsx` — Main UI panel
- [ ] `src/components/ProfileSelector.tsx` — Profile picker
- [ ] `src/components/ProfileCustomizer.tsx` — Custom field form
- [ ] `src/components/ContextPreview.tsx` — Show assembled context
- [ ] Integrate panel into `MeetingsView.tsx`
- **Result:** Full UI for selecting, customizing, and previewing intelligence profiles

### Phase 4: Learning & Polish
- [ ] Track which profiles get used/dismissed → improve suggestions
- [ ] "Create Custom Profile" UI flow
- [ ] Profile effectiveness metrics (compare meeting output quality)
- [ ] Export/import profiles
- **Result:** Self-improving system that gets smarter over time

---

## File Reference for Claude Code

Key files Claude needs to understand before executing:

| File | Purpose | Action |
|------|---------|--------|
| `src/agents/types.ts` | Agent type definitions | MODIFY — add new trigger/action types |
| `src/agents/agentRegistry.ts` | Trigger/action registry | MODIFY — register new trigger + action |
| `src/agents/agentRunner.ts` | Agent execution engine | READ ONLY — understand execution flow |
| `src/agents/agentTriggerService.ts` | Trigger firing hooks | MODIFY — add upcoming trigger |
| `src/agents/actions/extractActionItems.ts` | Gemini extraction action | MODIFY — accept prompt override |
| `src/agents/templates/meetingInsightsAgent.ts` | Example agent template | READ ONLY — pattern reference |
| `src/services/geminiService.ts` | Gemini API wrapper | MODIFY — accept system prompt override |
| `src/services/meetingService.ts` | Meeting CRUD | MODIFY — hook in intelligence config |
| `src/services/pulseChatService.ts` | Pulse bridge | READ ONLY — pattern reference |
| `src/components/MeetingsView.tsx` | Meeting UI | MODIFY — integrate intelligence panel |
| `src/lib/supabase.ts` | Supabase client + types | MODIFY — add new table types |
| `src/lib/logosVisionClient.ts` | CRM client | READ ONLY — used by context assembler |
| `supabase/migrations/20260326_001_create_ecosystem_tables.sql` | Ecosystem tables | READ ONLY — pattern reference |
| `supabase/migrations/20251219_002_week7_automations_tables.sql` | Agent tables | READ ONLY — pattern reference |

---

## Technical Notes

- **Tech Stack:** React + TypeScript + Vite + Tailwind CSS + Supabase + Gemini
- **Style:** Use Void × Crimson brand identity (see existing components for patterns)
- **Component patterns:** Follow existing patterns in `src/components/` — functional components, hooks, Tailwind classes
- **Database:** All new tables use the same Supabase patterns: UUIDs, RLS, `created_at`/`updated_at` timestamps
- **Agent patterns:** Follow existing `src/agents/` patterns exactly — trigger handlers, action handlers, registry
- **Ecosystem bridge:** Use existing `ecosystem_config` + `ecosystem_events` tables for cross-app communication
- **Gemini model:** Use `gemini-2.5-flash` (matching existing usage in `geminiService.ts`)
- **Error handling:** Graceful degradation — if any context source fails, continue with what's available
