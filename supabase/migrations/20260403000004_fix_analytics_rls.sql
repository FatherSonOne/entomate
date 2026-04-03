-- ========================================
-- Migration: Fix Analytics RLS Policies
-- Date: 2026-04-03
-- Purpose: Add user_id columns and tighten RLS on predictions
--          and intelligence_profile_analytics tables
-- ========================================

-- =====================================================
-- 1. ADD user_id TO predictions
-- =====================================================
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS user_id UUID;

-- Index for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);

-- =====================================================
-- 2. ADD user_id TO intelligence_profile_analytics
-- =====================================================
ALTER TABLE intelligence_profile_analytics ADD COLUMN IF NOT EXISTS user_id UUID;

-- Index for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_profile_analytics_user ON intelligence_profile_analytics(user_id);

-- =====================================================
-- 3. DROP old permissive policies on predictions
-- =====================================================
DROP POLICY IF EXISTS "Users can view predictions" ON predictions;
DROP POLICY IF EXISTS "Users can create predictions" ON predictions;

-- =====================================================
-- 4. CREATE user-scoped policies on predictions
--    Temporary OR user_id IS NULL fallback for existing data
-- =====================================================
CREATE POLICY "Users can view their own predictions"
  ON predictions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can create their own predictions"
  ON predictions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage all predictions"
  ON predictions FOR ALL
  TO service_role
  USING (true);

-- =====================================================
-- 5. DROP old permissive policies on intelligence_profile_analytics
-- =====================================================
DROP POLICY IF EXISTS "Users can view analytics" ON intelligence_profile_analytics;
DROP POLICY IF EXISTS "Users can insert analytics" ON intelligence_profile_analytics;
DROP POLICY IF EXISTS "Users can update analytics" ON intelligence_profile_analytics;

-- =====================================================
-- 6. CREATE user-scoped policies on intelligence_profile_analytics
--    Temporary OR user_id IS NULL fallback for existing data
-- =====================================================
CREATE POLICY "Users can view their own profile analytics"
  ON intelligence_profile_analytics FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert their own profile analytics"
  ON intelligence_profile_analytics FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile analytics"
  ON intelligence_profile_analytics FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Service role can manage all profile analytics"
  ON intelligence_profile_analytics FOR ALL
  TO service_role
  USING (true);

-- =====================================================
-- 7. UPDATE intelligence_profile_effectiveness RLS
--    (already has permissive policies from original migration)
-- =====================================================
DROP POLICY IF EXISTS "Users can view effectiveness" ON intelligence_profile_effectiveness;
DROP POLICY IF EXISTS "Service can manage effectiveness" ON intelligence_profile_effectiveness;

CREATE POLICY "Authenticated users can view effectiveness"
  ON intelligence_profile_effectiveness FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage effectiveness"
  ON intelligence_profile_effectiveness FOR ALL
  TO service_role
  USING (true);

-- Done!
SELECT 'Analytics RLS policies tightened' as status;
