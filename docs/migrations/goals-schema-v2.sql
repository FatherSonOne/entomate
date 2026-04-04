-- Goals Schema V2 Migration
-- Fixes: missing calendar_event_id column, open RLS policy, missing updated_at trigger
-- Date: 2026-04-01

-- 1. Add missing calendar_event_id column
ALTER TABLE goals ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

-- 2. Create updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to goals table
DROP TRIGGER IF EXISTS goals_updated_at ON goals;
CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Replace wide-open RLS policy with proper ownership checks
-- Drop the old permissive policy
DROP POLICY IF EXISTS "Allow all access to goals" ON goals;

-- Users can read goals they own, goals in their team, or company-level goals
CREATE POLICY "goals_select_policy" ON goals
  FOR SELECT
  USING (
    goal_type = 'company'
    OR owner_id = auth.uid()
    OR team_id::text IN (
      SELECT team_id::text FROM users WHERE id = auth.uid()
    )
  );

-- Users can insert goals they own
CREATE POLICY "goals_insert_policy" ON goals
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    OR owner_id IS NULL
  );

-- Users can update goals they own or team goals they belong to
CREATE POLICY "goals_update_policy" ON goals
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR team_id::text IN (
      SELECT team_id::text FROM users WHERE id = auth.uid()
    )
  );

-- Users can delete only goals they own
CREATE POLICY "goals_delete_policy" ON goals
  FOR DELETE
  USING (
    owner_id = auth.uid()
  );

-- Index for calendar_event_id lookups
CREATE INDEX IF NOT EXISTS idx_goals_calendar_event ON goals(calendar_event_id) WHERE calendar_event_id IS NOT NULL;
