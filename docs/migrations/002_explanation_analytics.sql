-- ========================================
-- Explanation Analytics - Database Migration
-- Date: 2026-01-24
-- Description: Track user engagement and explanation metrics
-- ========================================

-- Create explanation_analytics table
CREATE TABLE IF NOT EXISTS explanation_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'expansion', 'alternative_selected', 'acceptance', 'override')),
  execution_id UUID REFERENCES agent_executions(id) ON DELETE CASCADE,
  user_id TEXT, -- Can be Clerk ID or UUID
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_explanation_analytics_execution ON explanation_analytics(execution_id);
CREATE INDEX IF NOT EXISTS idx_explanation_analytics_user ON explanation_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_explanation_analytics_event_type ON explanation_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_explanation_analytics_created ON explanation_analytics(created_at DESC);

-- Enable Row Level Security
ALTER TABLE explanation_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own analytics
CREATE POLICY "Users can view their own analytics"
  ON explanation_analytics FOR SELECT
  USING (user_id = auth.uid()::text OR user_id IN (
    SELECT id::text FROM users WHERE auth_id = auth.uid()::text
  ));

-- RLS Policy: Service role can insert analytics
CREATE POLICY "Service can insert analytics"
  ON explanation_analytics FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Service role can read all analytics (for reporting)
CREATE POLICY "Service can read all analytics"
  ON explanation_analytics FOR SELECT
  USING (true);

-- Add comments
COMMENT ON TABLE explanation_analytics IS 'Tracks user engagement with AI explanations for metrics and analytics';
COMMENT ON COLUMN explanation_analytics.event_type IS 'Type of event: view, expansion, alternative_selected, acceptance, override';
COMMENT ON COLUMN explanation_analytics.execution_id IS 'Reference to the agent execution';
COMMENT ON COLUMN explanation_analytics.user_id IS 'User who performed the action';
COMMENT ON COLUMN explanation_analytics.metadata IS 'Additional event data (e.g., which alternative was selected)';

-- Verification query
SELECT 'Analytics table created successfully' AS status;
