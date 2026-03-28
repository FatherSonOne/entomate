-- ========================================
-- Migration: MIP Profile Analytics
-- Date: 2026-03-28
-- Purpose: Track profile usage pipeline (suggestion → selection → completion)
--          and aggregate effectiveness metrics for the learning feedback loop
-- ========================================

-- =====================================================
-- PROFILE USAGE ANALYTICS TABLE
-- Tracks suggestion → selection → completion pipeline
-- =====================================================
CREATE TABLE IF NOT EXISTS intelligence_profile_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES intelligence_profiles(id),
    meeting_id UUID,

    -- Suggestion tracking
    was_suggested BOOLEAN DEFAULT false,
    suggestion_confidence REAL,
    suggestion_accepted BOOLEAN,
    suggestion_dismissed BOOLEAN DEFAULT false,

    -- Usage tracking
    was_manually_selected BOOLEAN DEFAULT false,
    custom_fields_filled INTEGER DEFAULT 0,
    custom_fields_total INTEGER DEFAULT 0,
    additional_instructions_provided BOOLEAN DEFAULT false,

    -- Context assembly
    context_assembled BOOLEAN DEFAULT false,
    context_sources_count INTEGER DEFAULT 0,
    context_token_count INTEGER DEFAULT 0,

    -- Outcome metrics
    meeting_completed BOOLEAN DEFAULT false,
    meeting_duration_seconds INTEGER,
    action_items_extracted INTEGER DEFAULT 0,

    -- User feedback
    user_rating INTEGER,
    user_feedback TEXT,
    output_quality_score REAL,

    -- Timestamps
    suggested_at TIMESTAMPTZ,
    selected_at TIMESTAMPTZ,
    context_assembled_at TIMESTAMPTZ,
    meeting_completed_at TIMESTAMPTZ,
    feedback_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PROFILE EFFECTIVENESS SUMMARY
-- Aggregated stats per profile for dashboard display
-- =====================================================
CREATE TABLE IF NOT EXISTS intelligence_profile_effectiveness (
    profile_id UUID PRIMARY KEY REFERENCES intelligence_profiles(id),

    -- Usage counts
    times_suggested INTEGER DEFAULT 0,
    times_accepted INTEGER DEFAULT 0,
    times_dismissed INTEGER DEFAULT 0,
    times_manually_selected INTEGER DEFAULT 0,
    times_completed INTEGER DEFAULT 0,

    -- Rates
    acceptance_rate REAL DEFAULT 0,
    completion_rate REAL DEFAULT 0,

    -- Quality
    avg_user_rating REAL,
    avg_output_quality REAL,
    avg_action_items REAL,

    -- Context
    avg_context_sources REAL,
    avg_context_tokens REAL,

    last_used_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profile_analytics_profile ON intelligence_profile_analytics(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_analytics_meeting ON intelligence_profile_analytics(meeting_id);
CREATE INDEX IF NOT EXISTS idx_profile_analytics_created ON intelligence_profile_analytics(created_at);

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE intelligence_profile_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_profile_effectiveness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analytics"
    ON intelligence_profile_analytics FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert analytics"
    ON intelligence_profile_analytics FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update analytics"
    ON intelligence_profile_analytics FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view effectiveness"
    ON intelligence_profile_effectiveness FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service can manage effectiveness"
    ON intelligence_profile_effectiveness FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE intelligence_profile_analytics IS 'Tracks the full suggestion → selection → completion pipeline for each profile usage';
COMMENT ON TABLE intelligence_profile_effectiveness IS 'Aggregated effectiveness metrics per profile, used by the learning feedback loop';
