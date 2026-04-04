-- Goal Progress History Table
-- Tracks progress snapshots over time for timeline/changelog view
-- Date: 2026-04-01

CREATE TABLE IF NOT EXISTS goal_progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  progress NUMERIC(5,2) DEFAULT 0,
  status VARCHAR(20),
  key_results_snapshot JSONB DEFAULT '[]'::jsonb,
  note TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goal_history_goal ON goal_progress_history(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_history_created ON goal_progress_history(created_at DESC);

-- RLS
ALTER TABLE goal_progress_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_history_select" ON goal_progress_history
  FOR SELECT
  USING (
    goal_id IN (
      SELECT id FROM goals WHERE
        goal_type = 'company'
        OR owner_id = auth.uid()
        OR team_id::text IN (SELECT team_id::text FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "goal_history_insert" ON goal_progress_history
  FOR INSERT
  WITH CHECK (
    goal_id IN (
      SELECT id FROM goals WHERE
        owner_id = auth.uid()
        OR team_id::text IN (SELECT team_id::text FROM users WHERE id = auth.uid())
    )
  );
