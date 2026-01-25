-- ========================================
-- AI Explainability Layer - Database Migration
-- Date: 2026-01-24
-- Description: Add agent_explanations table for storing AI decision explanations
-- ========================================

-- Create agent_explanations table
CREATE TABLE IF NOT EXISTS agent_explanations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_execution_id UUID NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('assignment', 'priority', 'deadline', 'followup')),
  recommendation JSONB NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  factors JSONB NOT NULL,
  alternatives JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_execution_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_explanations_execution ON agent_explanations(agent_execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_explanations_type ON agent_explanations(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_explanations_created ON agent_explanations(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_explanations_confidence ON agent_explanations(confidence);

-- Create index for JSONB queries on factors
CREATE INDEX IF NOT EXISTS idx_agent_explanations_factors ON agent_explanations USING GIN (factors);

-- Enable Row Level Security
ALTER TABLE agent_explanations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view explanations for their own agent executions
CREATE POLICY "Users can view explanations for their agent executions"
  ON agent_explanations FOR SELECT
  USING (
    agent_execution_id IN (
      SELECT ae.id
      FROM agent_executions ae
      JOIN ai_agents a ON ae.agent_id = a.id
      WHERE a.created_by = auth.uid()
    )
  );

-- RLS Policy: Service role can insert explanations
CREATE POLICY "Service can insert explanations"
  ON agent_explanations FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Service role can update explanations
CREATE POLICY "Service can update explanations"
  ON agent_explanations FOR UPDATE
  USING (true);

-- Add comment to table
COMMENT ON TABLE agent_explanations IS 'Stores transparent explanations for AI agent decisions including factors, scores, and alternatives';

-- Add comments to columns
COMMENT ON COLUMN agent_explanations.agent_execution_id IS 'Reference to the agent execution this explanation belongs to';
COMMENT ON COLUMN agent_explanations.agent_type IS 'Type of agent: assignment, priority, deadline, or followup';
COMMENT ON COLUMN agent_explanations.recommendation IS 'The recommended option/decision';
COMMENT ON COLUMN agent_explanations.confidence IS 'Confidence score from 0-100';
COMMENT ON COLUMN agent_explanations.factors IS 'Array of decision factors with weights, scores, and details';
COMMENT ON COLUMN agent_explanations.alternatives IS 'Array of alternative options that were considered';
COMMENT ON COLUMN agent_explanations.metadata IS 'Additional metadata about the explanation generation';

-- ========================================
-- Sample Data Structure (for reference)
-- ========================================

/*
Example factors JSONB structure:
[
  {
    "name": "Skill Match",
    "weight": 0.40,
    "score": 90,
    "impact": "strong",
    "details": [
      "Matched 4/5 required skills",
      "API integration: 5 years experience"
    ],
    "naturalLanguage": "Has API integration experience"
  },
  {
    "name": "Current Workload",
    "weight": 0.30,
    "score": 85,
    "impact": "strong",
    "details": [
      "Active tasks: 3 vs team avg: 5",
      "Estimated capacity: 15 hours this week"
    ],
    "naturalLanguage": "3 tasks vs team avg 5"
  }
]

Example alternatives JSONB structure:
[
  {
    "option": {
      "id": "user-2",
      "name": "Jane Smith"
    },
    "score": 72,
    "whyLower": "Current Workload: Higher workload (7 active tasks)",
    "factors": [...]
  }
]
*/

-- ========================================
-- Verification Queries
-- ========================================

-- Verify table was created
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'agent_explanations'
) AS table_exists;

-- Verify RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'agent_explanations';

-- Verify policies
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'agent_explanations';

-- ========================================
-- Rollback Script (if needed)
-- ========================================

/*
-- To rollback this migration:

DROP POLICY IF EXISTS "Users can view explanations for their agent executions" ON agent_explanations;
DROP POLICY IF EXISTS "Service can insert explanations" ON agent_explanations;
DROP POLICY IF EXISTS "Service can update explanations" ON agent_explanations;

DROP INDEX IF EXISTS idx_agent_explanations_execution;
DROP INDEX IF EXISTS idx_agent_explanations_type;
DROP INDEX IF EXISTS idx_agent_explanations_created;
DROP INDEX IF EXISTS idx_agent_explanations_confidence;
DROP INDEX IF EXISTS idx_agent_explanations_factors;

DROP TABLE IF EXISTS agent_explanations;
*/
