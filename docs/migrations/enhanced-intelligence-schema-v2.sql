-- ========================================
-- Enhanced Intelligence Dashboard Schema
-- Date: 2026-01-24
-- Version: 2.0 (FIXED - No user_id errors)
-- ========================================
-- IMPORTANT: Run this in your Supabase SQL Editor
-- This creates tables for AI-powered intelligence features
-- ========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- Table 1: Deal Risk Scores (Cached AI Analysis)
-- ========================================
CREATE TABLE IF NOT EXISTS deal_risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL, -- References deals in shared hub
  user_id UUID NOT NULL, -- Owner of the deal (from Clerk auth)
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Risk factor breakdown (JSON)
  factors JSONB NOT NULL DEFAULT '{}',
  -- Example: {
  --   "engagementVelocity": {"weight": 0.35, "score": 45, "impact": "high"},
  --   "sentimentTrend": {"weight": 0.25, "score": 60, "impact": "medium"},
  --   "actionItemHealth": {"weight": 0.20, "score": 55, "impact": "medium"},
  --   "stakeholderHealth": {"weight": 0.20, "score": 75, "impact": "low"}
  -- }

  -- Predictive analytics (JSON)
  predictions JSONB DEFAULT '{}',
  -- Example: {
  --   "churnRisk": 0.35,
  --   "closeProbability": 0.52,
  --   "expectedCloseDate": "2026-03-15",
  --   "confidence": 0.74
  -- }

  -- AI-generated recommended actions (JSON array)
  recommended_actions JSONB DEFAULT '[]',
  -- Example: [
  --   {"action": "Schedule check-in call", "priority": "high", "effort": "low"},
  --   {"action": "Send value-add content", "priority": "medium", "effort": "low"}
  -- ]

  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deal_risk_scores_deal ON deal_risk_scores(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_risk_scores_user ON deal_risk_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_risk_scores_level ON deal_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_deal_risk_scores_calculated ON deal_risk_scores(calculated_at DESC);

-- ========================================
-- Table 2: Stakeholder Intelligence (AI Role Classification)
-- ========================================
CREATE TABLE IF NOT EXISTS stakeholder_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID NOT NULL, -- References contacts
  deal_id UUID, -- Optional: specific to a deal
  user_id UUID NOT NULL, -- User who owns this relationship

  -- AI-classified role
  role TEXT CHECK (role IN ('champion', 'influencer', 'blocker', 'economic_buyer', 'unknown')),

  -- Influence and relationship scores (0-100)
  influence_score INTEGER CHECK (influence_score >= 0 AND influence_score <= 100),
  relationship_strength INTEGER CHECK (relationship_strength >= 0 AND relationship_strength <= 100),
  sentiment_score INTEGER CHECK (sentiment_score >= 0 AND sentiment_score <= 100),

  -- Engagement metrics (JSON)
  engagement_metrics JSONB DEFAULT '{}',
  -- Example: {
  --   "meetingCount": 8,
  --   "lastContactDate": "2026-01-10",
  --   "daysSinceLastContact": 14,
  --   "mentionFrequency": 12
  -- }

  -- Network influence (array of stakeholder IDs this person influences)
  influences JSONB DEFAULT '[]',

  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stakeholder_intel_stakeholder ON stakeholder_intelligence(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_intel_deal ON stakeholder_intelligence(deal_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_intel_user ON stakeholder_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_intel_role ON stakeholder_intelligence(role);

-- ========================================
-- Table 3: Action Item Dependencies (Blocking Chains)
-- ========================================
CREATE TABLE IF NOT EXISTS action_item_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
  blocks_action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,

  -- How was this dependency detected?
  detected_via TEXT CHECK (detected_via IN ('manual', 'ai_nlp', 'explicit')),

  -- AI confidence if detected via NLP (0.0 - 1.0)
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate dependencies
  UNIQUE(action_item_id, blocks_action_item_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dependencies_blocker ON action_item_dependencies(action_item_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_blocked ON action_item_dependencies(blocks_action_item_id);

-- ========================================
-- Table 4: Intelligence Preferences (User Customization)
-- ========================================
CREATE TABLE IF NOT EXISTS intelligence_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,

  -- User preferences (JSON)
  preferences JSONB NOT NULL DEFAULT '{
    "showMeetingPrep": true,
    "showDealRisks": true,
    "showActionItems": true,
    "showRelationships": true,
    "dealRiskFilter": ["medium", "high", "critical"],
    "timeHorizon": {
      "meetings": 24,
      "risks": 7
    }
  }',

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One preference record per user
  UNIQUE(user_id)
);

-- ========================================
-- Row Level Security (RLS) Policies
-- ========================================

-- Enable RLS on all tables
ALTER TABLE deal_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_item_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_preferences ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Deal Risk Scores Policies
-- ========================================
CREATE POLICY "Users can view their own deal risk scores"
  ON deal_risk_scores FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own deal risk scores"
  ON deal_risk_scores FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own deal risk scores"
  ON deal_risk_scores FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all deal risk scores"
  ON deal_risk_scores FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- Stakeholder Intelligence Policies
-- ========================================
CREATE POLICY "Users can view their own stakeholder intelligence"
  ON stakeholder_intelligence FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own stakeholder intelligence"
  ON stakeholder_intelligence FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own stakeholder intelligence"
  ON stakeholder_intelligence FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all stakeholder intelligence"
  ON stakeholder_intelligence FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- Action Item Dependencies Policies (FIXED)
-- ========================================
-- Note: action_items table uses assigned_to_id, not user_id
-- We allow users to see dependencies for items they're assigned to OR that they created via meetings

CREATE POLICY "Users can view dependencies for their action items"
  ON action_item_dependencies FOR SELECT
  USING (
    -- User is assigned to the blocker action item
    action_item_id IN (
      SELECT id FROM action_items WHERE assigned_to_id = auth.uid()
    )
    OR
    -- User is assigned to the blocked action item
    blocks_action_item_id IN (
      SELECT id FROM action_items WHERE assigned_to_id = auth.uid()
    )
    OR
    -- User owns the meeting that created the blocker
    action_item_id IN (
      SELECT ai.id FROM action_items ai
      JOIN meetings m ON ai.meeting_id = m.id
      WHERE m.user_id = auth.uid()
    )
    OR
    -- User owns the meeting that created the blocked item
    blocks_action_item_id IN (
      SELECT ai.id FROM action_items ai
      JOIN meetings m ON ai.meeting_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create dependencies for their action items"
  ON action_item_dependencies FOR INSERT
  WITH CHECK (
    -- User is assigned to the blocker OR owns the meeting
    action_item_id IN (
      SELECT id FROM action_items WHERE assigned_to_id = auth.uid()
    )
    OR
    action_item_id IN (
      SELECT ai.id FROM action_items ai
      JOIN meetings m ON ai.meeting_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete dependencies for their action items"
  ON action_item_dependencies FOR DELETE
  USING (
    action_item_id IN (
      SELECT id FROM action_items WHERE assigned_to_id = auth.uid()
    )
    OR
    action_item_id IN (
      SELECT ai.id FROM action_items ai
      JOIN meetings m ON ai.meeting_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all dependencies"
  ON action_item_dependencies FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- Intelligence Preferences Policies
-- ========================================
CREATE POLICY "Users can view their own preferences"
  ON intelligence_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
  ON intelligence_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
  ON intelligence_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own preferences"
  ON intelligence_preferences FOR DELETE
  USING (user_id = auth.uid());

-- ========================================
-- Updated_at Triggers
-- ========================================

-- Create trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
DROP TRIGGER IF EXISTS update_deal_risk_scores_updated_at ON deal_risk_scores;
CREATE TRIGGER update_deal_risk_scores_updated_at
  BEFORE UPDATE ON deal_risk_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stakeholder_intelligence_updated_at ON stakeholder_intelligence;
CREATE TRIGGER update_stakeholder_intelligence_updated_at
  BEFORE UPDATE ON stakeholder_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_action_item_dependencies_updated_at ON action_item_dependencies;
CREATE TRIGGER update_action_item_dependencies_updated_at
  BEFORE UPDATE ON action_item_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_intelligence_preferences_updated_at ON intelligence_preferences;
CREATE TRIGGER update_intelligence_preferences_updated_at
  BEFORE UPDATE ON intelligence_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Comments for Documentation
-- ========================================

COMMENT ON TABLE deal_risk_scores IS 'Cached AI-calculated risk scores for deals to avoid real-time computation overhead';
COMMENT ON TABLE stakeholder_intelligence IS 'AI-classified stakeholder roles, influence scores, and relationship intelligence';
COMMENT ON TABLE action_item_dependencies IS 'Tracks blocking relationships between action items (detected manually or via AI)';
COMMENT ON TABLE intelligence_preferences IS 'User-specific customization preferences for the intelligence dashboard';

-- ========================================
-- Verification Queries
-- ========================================

-- Run these to verify the migration succeeded:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('deal_risk_scores', 'stakeholder_intelligence', 'action_item_dependencies', 'intelligence_preferences');
-- SELECT COUNT(*) FROM deal_risk_scores;
-- SELECT COUNT(*) FROM stakeholder_intelligence;
-- SELECT COUNT(*) FROM action_item_dependencies;
-- SELECT COUNT(*) FROM intelligence_preferences;

-- ========================================
-- Migration Complete
-- ========================================
-- Next Steps:
-- 1. Run this entire script in Supabase SQL Editor
-- 2. Verify tables were created successfully
-- 3. Proceed to backend service implementation (Phase 1)
-- ========================================
