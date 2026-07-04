-- ========================================
-- Migration: Meeting Intelligence Profiles
-- Date: 2026-03-28
-- Purpose: Enable AI specialization profiles for meetings — profiles define
--          how Gemini processes each meeting through a specialized lens
-- ========================================

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
    category TEXT NOT NULL DEFAULT 'general',        -- "meetings", "sales", "operations", "grants"

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
CREATE INDEX IF NOT EXISTS idx_intelligence_profiles_slug ON intelligence_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_intelligence_profiles_category ON intelligence_profiles(category);
CREATE INDEX IF NOT EXISTS idx_intelligence_profiles_active ON intelligence_profiles(is_active);

CREATE INDEX IF NOT EXISTS idx_meeting_intelligence_config_meeting ON meeting_intelligence_config(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_intelligence_config_profile ON meeting_intelligence_config(profile_id);
CREATE INDEX IF NOT EXISTS idx_meeting_intelligence_config_status ON meeting_intelligence_config(status);

CREATE INDEX IF NOT EXISTS idx_intelligence_context_cache_entity ON intelligence_context_cache(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_context_cache_expires ON intelligence_context_cache(expires_at);

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE intelligence_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_intelligence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_context_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active profiles"
    ON intelligence_profiles FOR SELECT
    USING (auth.role() = 'authenticated');

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

-- =====================================================
-- SEED: Built-in Intelligence Profiles
-- =====================================================

INSERT INTO intelligence_profiles (name, slug, description, icon, category, system_prompt_template, custom_fields, focus_areas, tone, output_format, context_sources, context_depth, suggest_when, is_builtin, is_active)
VALUES

-- 1. Grant Specialist
(
    'Grant Specialist',
    'grant-specialist',
    'Specialized for grant proposal discussions, funding strategy meetings, and grant reporting reviews.',
    '📋',
    'grants',
    E'You are an expert grant specialist AI assistant attending a meeting about {{grant_name}}.\n\nCONTEXT:\n- Organization: {{org_name}}\n- Funding Source: {{funding_org}}\n- Grant Deadline: {{deadline}}\n- Grant Amount: {{grant_amount}}\n{{#if participant_context}}\nPARTICIPANTS:\n{{participant_context}}\n{{/if}}\n{{#if past_meeting_context}}\nPREVIOUS MEETING NOTES:\n{{past_meeting_context}}\n{{/if}}\n{{#if additional_instructions}}\nSPECIAL INSTRUCTIONS: {{additional_instructions}}\n{{/if}}\n\nYOUR ROLE:\n- Track all commitments, deliverables, and timeline discussions\n- Flag any compliance or reporting requirements mentioned\n- Identify budget implications and resource needs\n- Note any changes to grant scope or timeline\n- Capture key relationships between stakeholders\n- Pay special attention to: {{focus_areas}}\n\nANALYSIS STYLE: {{tone}} — {{output_style}}',
    '[{"key":"grant_name","label":"Grant Name","type":"text","required":true,"placeholder":"e.g., Community Development Block Grant"},{"key":"funding_org","label":"Funding Organization","type":"text","required":false,"placeholder":"e.g., HUD, Ford Foundation"},{"key":"deadline","label":"Grant Deadline","type":"date","required":false},{"key":"grant_amount","label":"Grant Amount","type":"text","required":false,"placeholder":"e.g., $50,000"},{"key":"grant_stage","label":"Grant Stage","type":"select","required":false,"options":[{"value":"research","label":"Research & Identification"},{"value":"writing","label":"Proposal Writing"},{"value":"submitted","label":"Submitted — Awaiting Response"},{"value":"awarded","label":"Awarded — Implementation"},{"value":"reporting","label":"Reporting & Compliance"}]}]'::jsonb,
    '[{"key":"deliverables","label":"Deliverables & Milestones","description":"Track specific deliverables and timeline commitments","weight":0.9,"extractionHint":"Look for mentions of deliverables, milestones, completion dates, and progress updates"},{"key":"budget","label":"Budget & Financials","description":"Budget allocations, expenses, and financial concerns","weight":0.8,"extractionHint":"Track all dollar amounts, budget line items, cost overruns, and financial decisions"},{"key":"compliance","label":"Compliance & Reporting","description":"Compliance requirements and reporting deadlines","weight":0.8,"extractionHint":"Note any mentions of reporting requirements, compliance issues, audits, or documentation needs"},{"key":"stakeholders","label":"Stakeholder Relationships","description":"Key stakeholder relationships and roles","weight":0.6,"extractionHint":"Track who is responsible for what, relationship dynamics, and communication plans"}]'::jsonb,
    'formal',
    '{"summaryStyle":"executive","includeRecommendations":true,"includeRiskAssessment":true,"includeSentimentBreakdown":false,"customSections":[{"title":"Grant Status Update","prompt":"Summarize the current status of the grant based on this meeting"},{"title":"Compliance Items","prompt":"List any compliance or reporting items mentioned"},{"title":"Budget Impact","prompt":"Summarize any budget discussions or financial implications"}]}'::jsonb,
    '["contacts","crm_deals","past_meetings","org_info","tasks"]'::jsonb,
    'deep',
    '[{"type":"keyword","match":["grant","funding","proposal","funder","foundation","endowment"],"confidence":0.8},{"type":"keyword","match":["compliance","reporting","deliverable"],"confidence":0.6},{"type":"org_type","match":["nonprofit","foundation","government"],"confidence":0.5}]'::jsonb,
    true,
    true
),

-- 2. Sales Discovery
(
    'Sales Discovery',
    'sales-discovery',
    'Optimized for sales meetings, demos, discovery calls, and deal progression tracking.',
    '🎯',
    'sales',
    E'You are an expert sales intelligence AI assistant attending a sales meeting about {{deal_name}}.\n\nCONTEXT:\n- Deal Stage: {{deal_stage}}\n- Known Pain Points: {{pain_points}}\n- Competitors: {{competitors}}\n- Budget Range: {{budget_range}}\n- Decision Timeline: {{decision_timeline}}\n{{#if participant_context}}\nPARTICIPANTS:\n{{participant_context}}\n{{/if}}\n{{#if past_meeting_context}}\nPREVIOUS MEETING NOTES:\n{{past_meeting_context}}\n{{/if}}\n{{#if additional_instructions}}\nSPECIAL INSTRUCTIONS: {{additional_instructions}}\n{{/if}}\n\nYOUR ROLE:\n- Identify and categorize pain points, needs, and buying signals\n- Track objections raised and how they were addressed\n- Note decision-maker dynamics and influence map\n- Capture pricing discussions and budget signals\n- Flag competitive mentions and positioning\n- Identify clear next steps and commitments\n- Pay special attention to: {{focus_areas}}\n\nANALYSIS STYLE: {{tone}} — {{output_style}}',
    '[{"key":"deal_name","label":"Deal/Opportunity Name","type":"text","required":false,"placeholder":"e.g., Acme Corp — Enterprise License"},{"key":"deal_stage","label":"Deal Stage","type":"select","required":false,"options":[{"value":"prospecting","label":"Prospecting"},{"value":"discovery","label":"Discovery"},{"value":"demo","label":"Demo/Presentation"},{"value":"proposal","label":"Proposal Sent"},{"value":"negotiation","label":"Negotiation"},{"value":"closing","label":"Closing"}]},{"key":"pain_points","label":"Known Pain Points","type":"textarea","required":false,"placeholder":"What challenges has the prospect mentioned?"},{"key":"competitors","label":"Competitor Mentions","type":"text","required":false,"placeholder":"e.g., Competitor A, Competitor B"},{"key":"budget_range","label":"Budget Range","type":"text","required":false,"placeholder":"e.g., $10k-$25k/year"},{"key":"decision_timeline","label":"Decision Timeline","type":"text","required":false,"placeholder":"e.g., Q2 2026"}]'::jsonb,
    '[{"key":"pain_points","label":"Pain Points & Needs","description":"Customer challenges and requirements","weight":0.9,"extractionHint":"Listen for frustrations, challenges, wishes, and unmet needs"},{"key":"buying_signals","label":"Buying Signals","description":"Positive indicators of purchase intent","weight":0.8,"extractionHint":"Track urgency language, timeline mentions, budget confirmations, and enthusiasm"},{"key":"objections","label":"Objections & Concerns","description":"Resistance points and how they were handled","weight":0.8,"extractionHint":"Note pushback, hesitation, risk concerns, and comparison to alternatives"},{"key":"decision_makers","label":"Decision Makers","description":"Who influences and makes the buying decision","weight":0.7,"extractionHint":"Identify who has authority, who influences, and organizational dynamics"},{"key":"next_steps","label":"Next Steps & Commitments","description":"Agreed follow-ups and action items","weight":0.9,"extractionHint":"Capture all commitments, follow-up meetings, deliverables promised"}]'::jsonb,
    'balanced',
    '{"summaryStyle":"executive","includeRecommendations":true,"includeRiskAssessment":true,"includeSentimentBreakdown":true,"customSections":[{"title":"Deal Progression","prompt":"Assess how this meeting moved the deal forward or backward"},{"title":"Competitive Intelligence","prompt":"Summarize any competitor mentions and positioning"}]}'::jsonb,
    '["contacts","crm_deals","past_meetings","org_info","pulse_history"]'::jsonb,
    'deep',
    '[{"type":"keyword","match":["demo","proposal","pricing","pilot","discovery"],"confidence":0.7},{"type":"keyword","match":["prospect","lead","opportunity"],"confidence":0.6}]'::jsonb,
    true,
    true
),

-- 3. Client Check-In
(
    'Client Check-In',
    'client-check-in',
    'Tailored for client status meetings, QBRs, and ongoing relationship management.',
    '🤝',
    'operations',
    E'You are a client relationship intelligence AI assistant attending a check-in with {{client_name}}.\n\nCONTEXT:\n- Known Open Issues: {{open_issues}}\n- Renewal Date: {{renewal_date}}\n- Health Score: {{health_score}}\n{{#if participant_context}}\nPARTICIPANTS:\n{{participant_context}}\n{{/if}}\n{{#if past_meeting_context}}\nPREVIOUS MEETING NOTES:\n{{past_meeting_context}}\n{{/if}}\n{{#if additional_instructions}}\nSPECIAL INSTRUCTIONS: {{additional_instructions}}\n{{/if}}\n\nYOUR ROLE:\n- Track satisfaction signals (positive and negative)\n- Note any upsell or expansion opportunities mentioned\n- Identify risk indicators (frustration, competitor mentions, scope creep)\n- Monitor open issue resolution progress\n- Capture relationship health indicators\n- Pay special attention to: {{focus_areas}}\n\nANALYSIS STYLE: {{tone}} — {{output_style}}',
    '[{"key":"client_name","label":"Client Name","type":"text","required":false,"placeholder":"e.g., Acme Corporation"},{"key":"open_issues","label":"Known Open Issues","type":"textarea","required":false,"placeholder":"Current issues or concerns to track"},{"key":"renewal_date","label":"Renewal/Contract Date","type":"date","required":false},{"key":"health_score","label":"Current Health Score","type":"select","required":false,"options":[{"value":"healthy","label":"🟢 Healthy"},{"value":"at_risk","label":"🟡 At Risk"},{"value":"critical","label":"🔴 Critical"}]}]'::jsonb,
    '[{"key":"satisfaction_signals","label":"Satisfaction Signals","description":"Positive and negative sentiment indicators","weight":0.9,"extractionHint":"Listen for praise, complaints, frustration, enthusiasm, and loyalty signals"},{"key":"upsell_opportunities","label":"Upsell Opportunities","description":"Potential for expanding the relationship","weight":0.7,"extractionHint":"Note mentions of new needs, growing teams, additional use cases, or interest in other products"},{"key":"risk_indicators","label":"Risk Indicators","description":"Signs of potential churn or dissatisfaction","weight":0.9,"extractionHint":"Track competitor mentions, budget concerns, reduced usage, unresolved issues, and escalation language"},{"key":"open_issues","label":"Open Issue Status","description":"Progress on known issues and new issues raised","weight":0.8,"extractionHint":"Track which issues were discussed, resolved, or escalated"}]'::jsonb,
    'balanced',
    '{"summaryStyle":"executive","includeRecommendations":true,"includeRiskAssessment":true,"includeSentimentBreakdown":true,"customSections":[{"title":"Relationship Health Update","prompt":"Assess the current health of this client relationship based on the meeting"},{"title":"Action Items for Account Team","prompt":"List follow-ups specifically for the account management team"}]}'::jsonb,
    '["contacts","crm_deals","past_meetings","org_info","tasks","pulse_history"]'::jsonb,
    'standard',
    '[{"type":"keyword","match":["check-in","review","status update","QBR"],"confidence":0.7},{"type":"recurring","match":["weekly","biweekly","monthly"],"confidence":0.5}]'::jsonb,
    true,
    true
),

-- 4. Board Meeting
(
    'Board Meeting',
    'board-meeting',
    'Structured for board meetings, governance discussions, and formal decision-making sessions.',
    '🏛️',
    'operations',
    E'You are a board meeting intelligence AI assistant documenting a formal board meeting.\n\nCONTEXT:\n- Agenda: {{agenda}}\n- Reporting Period: {{reporting_period}}\n- Key Metrics to Track: {{key_metrics}}\n{{#if participant_context}}\nBOARD MEMBERS & ATTENDEES:\n{{participant_context}}\n{{/if}}\n{{#if past_meeting_context}}\nPREVIOUS BOARD MEETING NOTES:\n{{past_meeting_context}}\n{{/if}}\n{{#if additional_instructions}}\nSPECIAL INSTRUCTIONS: {{additional_instructions}}\n{{/if}}\n\nYOUR ROLE:\n- Record all formal decisions and votes with precision\n- Track motions made, seconded, and vote outcomes\n- Note financial updates and metric discussions\n- Capture strategic direction changes and policy decisions\n- Identify governance and compliance items\n- Document action items with clear owners and deadlines\n- Pay special attention to: {{focus_areas}}\n\nANALYSIS STYLE: {{tone}} — {{output_style}}',
    '[{"key":"agenda","label":"Meeting Agenda","type":"textarea","required":false,"placeholder":"Paste or summarize the board meeting agenda"},{"key":"reporting_period","label":"Reporting Period","type":"text","required":false,"placeholder":"e.g., Q1 2026"},{"key":"key_metrics","label":"Key Metrics to Track","type":"textarea","required":false,"placeholder":"e.g., Revenue, membership growth, program outcomes"}]'::jsonb,
    '[{"key":"decisions","label":"Decisions & Votes","description":"Formal decisions, motions, and vote outcomes","weight":1.0,"extractionHint":"Track all motions, seconds, votes (for/against/abstain), and resolutions passed"},{"key":"financial_updates","label":"Financial Updates","description":"Budget reports, financial statements, and fiscal discussions","weight":0.9,"extractionHint":"Note all financial figures, budget variances, and fiscal decisions"},{"key":"strategic_direction","label":"Strategic Direction","description":"Long-term strategy and organizational direction","weight":0.8,"extractionHint":"Capture strategic priorities, vision changes, and long-term planning discussions"},{"key":"governance","label":"Governance & Compliance","description":"Bylaws, policies, and regulatory compliance","weight":0.7,"extractionHint":"Note any governance changes, policy updates, or compliance requirements"},{"key":"action_items","label":"Action Items","description":"Tasks assigned with owners and deadlines","weight":0.9,"extractionHint":"Capture every action item with who is responsible and when it is due"}]'::jsonb,
    'formal',
    '{"summaryStyle":"detailed","includeRecommendations":false,"includeRiskAssessment":false,"includeSentimentBreakdown":false,"customSections":[{"title":"Motions & Resolutions","prompt":"List all motions made, their outcomes, and vote tallies"},{"title":"Financial Summary","prompt":"Summarize financial discussions and any budget decisions"},{"title":"Board Directives","prompt":"List all directives or instructions given by the board"}]}'::jsonb,
    '["contacts","past_meetings","org_info"]'::jsonb,
    'standard',
    '[{"type":"keyword","match":["board","directors","governance","bylaws","resolution"],"confidence":0.9}]'::jsonb,
    true,
    true
),

-- 5. Internal Standup
(
    'Internal Standup',
    'internal-standup',
    'Lightweight profile for daily standups, team syncs, and quick huddles.',
    '⚡',
    'operations',
    E'You are a team standup assistant capturing key updates from a {{team_name}} sync.\n\nCONTEXT:\n- Sprint/Iteration: {{sprint_name}}\n- Team: {{team_name}}\n{{#if participant_context}}\nTEAM MEMBERS:\n{{participant_context}}\n{{/if}}\n{{#if additional_instructions}}\nSPECIAL INSTRUCTIONS: {{additional_instructions}}\n{{/if}}\n\nYOUR ROLE:\n- Capture what each person completed, is working on, and is blocked by\n- Identify blockers that need immediate attention\n- Note cross-team dependencies mentioned\n- Track commitments and deadlines for the sprint\n- Keep the summary concise and actionable\n- Pay special attention to: {{focus_areas}}\n\nANALYSIS STYLE: {{tone}} — {{output_style}}',
    '[{"key":"sprint_name","label":"Sprint/Iteration","type":"text","required":false,"placeholder":"e.g., Sprint 14"},{"key":"team_name","label":"Team","type":"text","required":false,"placeholder":"e.g., Engineering, Product"}]'::jsonb,
    '[{"key":"blockers","label":"Blockers","description":"Issues preventing progress","weight":1.0,"extractionHint":"Identify anything described as blocking, stuck, waiting on, or preventing progress"},{"key":"progress_updates","label":"Progress Updates","description":"What was completed and what is in progress","weight":0.8,"extractionHint":"Track completed items, in-progress work, and percentage updates"},{"key":"commitments","label":"Commitments","description":"What people committed to doing next","weight":0.9,"extractionHint":"Capture promises, plans for today/this week, and delivery commitments"},{"key":"help_needed","label":"Help Needed","description":"Requests for assistance or collaboration","weight":0.7,"extractionHint":"Note any requests for help, pairing, reviews, or input from others"}]'::jsonb,
    'casual',
    '{"summaryStyle":"bullet_points","includeRecommendations":false,"includeRiskAssessment":false,"includeSentimentBreakdown":false}'::jsonb,
    '["contacts","tasks"]'::jsonb,
    'minimal',
    '[{"type":"keyword","match":["standup","daily","scrum","sync","huddle"],"confidence":0.8},{"type":"recurring","match":["daily"],"confidence":0.7}]'::jsonb,
    true,
    true
),

-- 6. Strategic Planning
(
    'Strategic Planning',
    'strategic-planning',
    'Deep-analysis profile for strategy sessions, roadmapping, and long-range planning.',
    '🗺️',
    'operations',
    E'You are a strategic planning intelligence AI assistant facilitating a strategy session.\n\nCONTEXT:\n- Planning Horizon: {{planning_horizon}}\n- Current Strategic Goals: {{strategic_goals}}\n- Known Constraints: {{constraints}}\n{{#if participant_context}}\nPARTICIPANTS:\n{{participant_context}}\n{{/if}}\n{{#if past_meeting_context}}\nPREVIOUS STRATEGY SESSION NOTES:\n{{past_meeting_context}}\n{{/if}}\n{{#if additional_instructions}}\nSPECIAL INSTRUCTIONS: {{additional_instructions}}\n{{/if}}\n\nYOUR ROLE:\n- Map goals discussed to current strategic priorities\n- Identify resource allocation decisions and trade-offs\n- Track risks, assumptions, and dependencies\n- Capture timeline commitments and milestones\n- Note areas of alignment and disagreement among participants\n- Document decisions that change strategic direction\n- Pay special attention to: {{focus_areas}}\n\nANALYSIS STYLE: {{tone}} — {{output_style}}',
    '[{"key":"planning_horizon","label":"Planning Horizon","type":"select","required":false,"options":[{"value":"Q1","label":"Q1"},{"value":"Q2","label":"Q2"},{"value":"Q3","label":"Q3"},{"value":"Q4","label":"Q4"},{"value":"annual","label":"Annual"},{"value":"3_year","label":"3-Year"}]},{"key":"strategic_goals","label":"Current Strategic Goals","type":"textarea","required":false,"placeholder":"What are the current top-level strategic goals?"},{"key":"constraints","label":"Known Constraints","type":"textarea","required":false,"placeholder":"Budget limits, headcount, timeline pressures, etc."}]'::jsonb,
    '[{"key":"goals","label":"Goals & Priorities","description":"Strategic goals discussed and prioritization decisions","weight":0.9,"extractionHint":"Track goals mentioned, how they were prioritized, and any changes to existing goals"},{"key":"priorities","label":"Priority Shifts","description":"Changes in organizational priorities","weight":0.9,"extractionHint":"Note any reprioritization, new priorities added, or items deprioritized"},{"key":"resource_allocation","label":"Resource Allocation","description":"How resources (people, budget, time) are being allocated","weight":0.8,"extractionHint":"Track budget allocation discussions, team assignments, and resource trade-offs"},{"key":"risks","label":"Risks & Assumptions","description":"Identified risks and underlying assumptions","weight":0.7,"extractionHint":"Capture risks mentioned, assumptions being made, and mitigation strategies"},{"key":"timeline","label":"Timeline & Milestones","description":"Key dates and milestone commitments","weight":0.8,"extractionHint":"Note all dates, deadlines, milestones, and phasing discussions"}]'::jsonb,
    'balanced',
    '{"summaryStyle":"detailed","includeRecommendations":true,"includeRiskAssessment":true,"includeSentimentBreakdown":false,"customSections":[{"title":"Strategic Decisions Made","prompt":"List all strategic decisions made during this session"},{"title":"Open Questions","prompt":"List strategic questions that were raised but not resolved"}]}'::jsonb,
    '["contacts","past_meetings","org_info","tasks"]'::jsonb,
    'standard',
    '[{"type":"keyword","match":["strategy","planning","roadmap","vision","OKR"],"confidence":0.8}]'::jsonb,
    true,
    true
),

-- 7. Vendor Negotiation
(
    'Vendor Negotiation',
    'vendor-negotiation',
    'Focused on vendor meetings, contract negotiations, and procurement discussions.',
    '📝',
    'operations',
    E'You are a vendor negotiation intelligence AI assistant attending a meeting with {{vendor_name}}.\n\nCONTEXT:\n- Vendor: {{vendor_name}}\n- Contract Value: {{contract_value}}\n- Key Negotiation Points: {{negotiation_points}}\n- Walk-Away Threshold: {{walk_away_point}}\n{{#if participant_context}}\nPARTICIPANTS:\n{{participant_context}}\n{{/if}}\n{{#if past_meeting_context}}\nPREVIOUS MEETING NOTES:\n{{past_meeting_context}}\n{{/if}}\n{{#if additional_instructions}}\nSPECIAL INSTRUCTIONS: {{additional_instructions}}\n{{/if}}\n\nYOUR ROLE:\n- Track all commitments made by both sides\n- Note pricing changes, discounts, and financial terms discussed\n- Capture specific contract terms and conditions mentioned\n- Identify concessions made and received\n- Flag any deadline pressures or ultimatums\n- Document areas of agreement and remaining disputes\n- Pay special attention to: {{focus_areas}}\n\nANALYSIS STYLE: {{tone}} — {{output_style}}',
    '[{"key":"vendor_name","label":"Vendor Name","type":"text","required":false,"placeholder":"e.g., Acme Software Inc."},{"key":"contract_value","label":"Contract Value","type":"text","required":false,"placeholder":"e.g., $120,000/year"},{"key":"negotiation_points","label":"Key Negotiation Points","type":"textarea","required":false,"placeholder":"What are the main items to negotiate?"},{"key":"walk_away_point","label":"Walk-Away Threshold","type":"text","required":false,"placeholder":"e.g., Maximum $150k, must include SLA"}]'::jsonb,
    '[{"key":"commitments","label":"Commitments","description":"Promises and commitments from both sides","weight":0.9,"extractionHint":"Track every commitment, promise, and agreement made by either party"},{"key":"pricing_changes","label":"Pricing & Terms","description":"Financial terms and pricing discussions","weight":0.9,"extractionHint":"Note all pricing mentions, discounts offered, payment terms, and financial conditions"},{"key":"terms_discussed","label":"Contract Terms","description":"Specific contract clauses and conditions","weight":0.8,"extractionHint":"Capture SLA terms, warranty conditions, support levels, and legal terms discussed"},{"key":"concessions","label":"Concessions","description":"What each side gave up or compromised on","weight":0.8,"extractionHint":"Track concessions made and received, trade-offs proposed, and compromises reached"},{"key":"deadlines","label":"Deadlines & Urgency","description":"Timeline pressures and deadline discussions","weight":0.7,"extractionHint":"Note contract deadlines, renewal dates, implementation timelines, and urgency signals"}]'::jsonb,
    'formal',
    '{"summaryStyle":"executive","includeRecommendations":true,"includeRiskAssessment":true,"includeSentimentBreakdown":false,"customSections":[{"title":"Negotiation Scorecard","prompt":"Summarize what was gained vs. conceded in this session"},{"title":"Outstanding Terms","prompt":"List contract terms still under discussion"}]}'::jsonb,
    '["contacts","crm_deals","past_meetings","org_info"]'::jsonb,
    'standard',
    '[{"type":"keyword","match":["vendor","contract","negotiate","renewal","SLA","terms"],"confidence":0.7}]'::jsonb,
    true,
    true
)

ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE intelligence_profiles IS 'AI specialization profiles that define how Gemini processes meetings';
COMMENT ON TABLE meeting_intelligence_config IS 'Links a specific meeting to a profile with user-provided context';
COMMENT ON TABLE intelligence_context_cache IS 'Caches cross-app context lookups to avoid repeated API calls';
