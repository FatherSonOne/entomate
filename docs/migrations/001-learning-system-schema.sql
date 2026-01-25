-- ========================================
-- Migration: Agent Feedback Loop & Learning System
-- Date: 2026-01-24
-- Description: Create tables for capturing user feedback, detecting patterns, and learning from overrides
-- ========================================

-- Agent overrides (user corrections)
CREATE TABLE IF NOT EXISTS agent_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('assignment', 'priority', 'deadline', 'followup')),
  agent_execution_id UUID,
  original_recommendation JSONB NOT NULL,
  user_choice JSONB NOT NULL,
  feedback_reason TEXT,
  feedback_text TEXT,
  context_snapshot JSONB NOT NULL,
  outcome_success BOOLEAN,
  outcome_metrics JSONB,
  outcome_tracked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for agent_overrides
CREATE INDEX IF NOT EXISTS idx_agent_overrides_user ON agent_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_overrides_type ON agent_overrides(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_overrides_created ON agent_overrides(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_overrides_user_type ON agent_overrides(user_id, agent_type);

-- Learning patterns
CREATE TABLE IF NOT EXISTS learning_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('assignment', 'priority', 'deadline', 'followup')),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('preference', 'constraint', 'boost', 'context')),
  pattern_data JSONB NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'rejected', 'deactivated', 'deprecated')),
  customization JSONB,
  validation_metrics JSONB,
  activated_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  deprecated_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for learning_patterns
CREATE INDEX IF NOT EXISTS idx_learning_patterns_user ON learning_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_type ON learning_patterns(agent_type);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_status ON learning_patterns(status);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_user_status ON learning_patterns(user_id, status);

-- User learning preferences
CREATE TABLE IF NOT EXISTS user_learning_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, preference_key)
);

-- Index for user_learning_preferences
CREATE INDEX IF NOT EXISTS idx_user_learning_preferences_user ON user_learning_preferences(user_id);

-- ========================================
-- Row Level Security (RLS) Policies
-- ========================================

-- Enable RLS
ALTER TABLE agent_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own overrides
DROP POLICY IF EXISTS "Users can manage their own overrides" ON agent_overrides;
CREATE POLICY "Users can manage their own overrides"
  ON agent_overrides FOR ALL
  USING (user_id = auth.uid());

-- RLS Policy: Users can manage their own patterns
DROP POLICY IF EXISTS "Users can manage their own patterns" ON learning_patterns;
CREATE POLICY "Users can manage their own patterns"
  ON learning_patterns FOR ALL
  USING (user_id = auth.uid());

-- RLS Policy: Users can manage their own preferences
DROP POLICY IF EXISTS "Users can manage their own preferences" ON user_learning_preferences;
CREATE POLICY "Users can manage their own preferences"
  ON user_learning_preferences FOR ALL
  USING (user_id = auth.uid());

-- ========================================
-- Helper Functions (Optional)
-- ========================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_learning_preferences
DROP TRIGGER IF EXISTS update_user_learning_preferences_updated_at ON user_learning_preferences;
CREATE TRIGGER update_user_learning_preferences_updated_at
  BEFORE UPDATE ON user_learning_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- Verification Queries
-- ========================================

-- Verify tables created
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('agent_overrides', 'learning_patterns', 'user_learning_preferences');

-- Verify RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('agent_overrides', 'learning_patterns', 'user_learning_preferences');
