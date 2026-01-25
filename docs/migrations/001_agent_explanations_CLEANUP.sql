-- ========================================
-- AI Explainability Layer - CLEANUP SCRIPT
-- Run this first if you had errors during the initial migration
-- ========================================

-- Drop policies if they exist (may have partial creation)
DROP POLICY IF EXISTS "Users can view explanations for their agent executions" ON agent_explanations;
DROP POLICY IF EXISTS "Service can insert explanations" ON agent_explanations;
DROP POLICY IF EXISTS "Service can update explanations" ON agent_explanations;

-- Drop indexes if they exist
DROP INDEX IF EXISTS idx_agent_explanations_execution;
DROP INDEX IF EXISTS idx_agent_explanations_type;
DROP INDEX IF EXISTS idx_agent_explanations_created;
DROP INDEX IF EXISTS idx_agent_explanations_confidence;
DROP INDEX IF EXISTS idx_agent_explanations_factors;

-- Drop table if it exists
DROP TABLE IF EXISTS agent_explanations;

-- Verify cleanup
SELECT 'Cleanup complete - ready for fresh migration' AS status;
