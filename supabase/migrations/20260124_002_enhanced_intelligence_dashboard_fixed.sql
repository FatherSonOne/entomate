-- ========================================
-- Enhanced Intelligence Dashboard Schema (FIXED v3)
-- Date: 2026-01-24
-- Migration: 20260124_002
-- ========================================
-- FIXES: Removed references to non-existent user_id columns
-- meetings table has 'created_by' (VARCHAR), not 'user_id'
-- ========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- Table 1: Deal Risk Scores (Cached AI Analysis)
-- ========================================
CREATE TABLE IF NOT EXISTS deal_risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL,
  user_id UUID NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  factors JSONB NOT NULL DEFAULT '{}',
  predictions JSONB DEFAULT '{}',
  recommended_actions JSONB DEFAULT '[]',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_risk_scores_deal ON deal_risk_scores(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_risk_scores_user ON deal_risk_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_risk_scores_level ON deal_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_deal_risk_scores_calculated ON deal_risk_scores(calculated_at DESC);

-- ========================================
-- Table 2: Stakeholder Intelligence
-- ========================================
CREATE TABLE IF NOT EXISTS stakeholder_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID NOT NULL,
  deal_id UUID,
  user_id UUID NOT NULL,
  role TEXT CHECK (role IN ('champion', 'influencer', 'blocker', 'economic_buyer', 'unknown')),
  influence_score INTEGER CHECK (influence_score >= 0 AND influence_score <= 100),
  relationship_strength INTEGER CHECK (relationship_strength >= 0 AND relationship_strength <= 100),
  sentiment_score INTEGER CHECK (sentiment_score >= 0 AND sentiment_score <= 100),
  engagement_metrics JSONB DEFAULT '{}',
  influences JSONB DEFAULT '[]',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stakeholder_intel_stakeholder ON stakeholder_intelligence(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_intel_deal ON stakeholder_intelligence(deal_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_intel_user ON stakeholder_intelligence(user_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_intel_role ON stakeholder_intelligence(role);

-- ========================================
-- Table 3: Action Item Dependencies
-- ========================================
CREATE TABLE IF NOT EXISTS action_item_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
  blocks_action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
  detected_via TEXT CHECK (detected_via IN ('manual', 'ai_nlp', 'explicit')),
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(action_item_id, blocks_action_item_id)
);

CREATE INDEX IF NOT EXISTS idx_dependencies_blocker ON action_item_dependencies(action_item_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_blocked ON action_item_dependencies(blocks_action_item_id);

-- ========================================
-- Table 4: Intelligence Preferences
-- ========================================
CREATE TABLE IF NOT EXISTS intelligence_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
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
  UNIQUE(user_id)
);

-- ========================================
-- Enable RLS
-- ========================================
ALTER TABLE deal_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_item_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_preferences ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS Policies: Deal Risk Scores
-- ========================================
DROP POLICY IF EXISTS "Users can view their own deal risk scores" ON deal_risk_scores;
CREATE POLICY "Users can view their own deal risk scores"
  ON deal_risk_scores FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own deal risk scores" ON deal_risk_scores;
CREATE POLICY "Users can insert their own deal risk scores"
  ON deal_risk_scores FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own deal risk scores" ON deal_risk_scores;
CREATE POLICY "Users can update their own deal risk scores"
  ON deal_risk_scores FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all deal risk scores" ON deal_risk_scores;
CREATE POLICY "Service role can manage all deal risk scores"
  ON deal_risk_scores FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- RLS Policies: Stakeholder Intelligence
-- ========================================
DROP POLICY IF EXISTS "Users can view their own stakeholder intelligence" ON stakeholder_intelligence;
CREATE POLICY "Users can view their own stakeholder intelligence"
  ON stakeholder_intelligence FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own stakeholder intelligence" ON stakeholder_intelligence;
CREATE POLICY "Users can insert their own stakeholder intelligence"
  ON stakeholder_intelligence FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own stakeholder intelligence" ON stakeholder_intelligence;
CREATE POLICY "Users can update their own stakeholder intelligence"
  ON stakeholder_intelligence FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all stakeholder intelligence" ON stakeholder_intelligence;
CREATE POLICY "Service role can manage all stakeholder intelligence"
  ON stakeholder_intelligence FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- RLS Policies: Action Item Dependencies (SIMPLIFIED)
-- ========================================
-- Note: meetings table doesn't have user_id, only created_by (VARCHAR)
-- We'll keep policies simple - users can see dependencies for items they're assigned to

DROP POLICY IF EXISTS "Users can view dependencies for their action items" ON action_item_dependencies;
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
  );

DROP POLICY IF EXISTS "Users can create dependencies for their action items" ON action_item_dependencies;
CREATE POLICY "Users can create dependencies for their action items"
  ON action_item_dependencies FOR INSERT
  WITH CHECK (
    -- User is assigned to the blocker
    action_item_id IN (
      SELECT id FROM action_items WHERE assigned_to_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update dependencies for their action items" ON action_item_dependencies;
CREATE POLICY "Users can update dependencies for their action items"
  ON action_item_dependencies FOR UPDATE
  USING (
    action_item_id IN (
      SELECT id FROM action_items WHERE assigned_to_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete dependencies for their action items" ON action_item_dependencies;
CREATE POLICY "Users can delete dependencies for their action items"
  ON action_item_dependencies FOR DELETE
  USING (
    action_item_id IN (
      SELECT id FROM action_items WHERE assigned_to_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role can manage all dependencies" ON action_item_dependencies;
CREATE POLICY "Service role can manage all dependencies"
  ON action_item_dependencies FOR ALL
  USING (auth.role() = 'service_role');

-- ========================================
-- RLS Policies: Intelligence Preferences
-- ========================================
DROP POLICY IF EXISTS "Users can view their own preferences" ON intelligence_preferences;
CREATE POLICY "Users can view their own preferences"
  ON intelligence_preferences FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own preferences" ON intelligence_preferences;
CREATE POLICY "Users can insert their own preferences"
  ON intelligence_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own preferences" ON intelligence_preferences;
CREATE POLICY "Users can update their own preferences"
  ON intelligence_preferences FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own preferences" ON intelligence_preferences;
CREATE POLICY "Users can delete their own preferences"
  ON intelligence_preferences FOR DELETE
  USING (user_id = auth.uid());

-- ========================================
-- Triggers
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
-- Comments
-- ========================================
COMMENT ON TABLE deal_risk_scores IS 'Cached AI-calculated risk scores for deals';
COMMENT ON TABLE stakeholder_intelligence IS 'AI-classified stakeholder roles and relationship intelligence';
COMMENT ON TABLE action_item_dependencies IS 'Blocking relationships between action items';
COMMENT ON TABLE intelligence_preferences IS 'User customization preferences for intelligence dashboard';

-- ========================================
-- Verification
-- ========================================
-- Quick check that all tables were created
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'deal_risk_scores',
      'stakeholder_intelligence',
      'action_item_dependencies',
      'intelligence_preferences'
    );

  IF table_count = 4 THEN
    RAISE NOTICE '✅ SUCCESS: All 4 intelligence tables created successfully';
  ELSE
    RAISE WARNING '⚠️ WARNING: Only % of 4 tables were created', table_count;
  END IF;
END $$;
