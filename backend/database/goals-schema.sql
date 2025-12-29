-- Goals & OKRs Table Schema for Entomate
-- Run this in Supabase SQL Editor

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  goal_type VARCHAR(20) NOT NULL CHECK (goal_type IN ('company', 'team', 'individual')),
  parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  owner_id UUID,
  team_id UUID,
  quarter VARCHAR(20), -- e.g., 'Q1-2025'
  start_date DATE,
  target_date DATE,
  status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'abandoned')),
  progress NUMERIC(5,2) DEFAULT 0, -- 0-100 percentage
  key_results JSONB DEFAULT '[]'::jsonb, -- Array of key results
  related_tasks UUID[] DEFAULT '{}', -- Array of related task IDs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_goals_quarter ON goals(quarter);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals(owner_id);

-- Enable Row Level Security
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (adjust based on your auth needs)
CREATE POLICY "Allow all access to goals" ON goals FOR ALL USING (true);

-- Sample data for testing
INSERT INTO goals (title, description, goal_type, quarter, status, progress, key_results) VALUES
('Increase Product Adoption', 'Grow our user base and improve engagement metrics', 'company', 'Q4-2025', 'active', 35, '[{"id": "kr_1", "title": "Reach 10,000 active users", "target": 10000, "current": 3500, "unit": "users"}, {"id": "kr_2", "title": "Improve NPS score to 50+", "target": 50, "current": 42, "unit": "score"}]'),
('Improve Team Velocity', 'Deliver features faster with higher quality', 'team', 'Q4-2025', 'active', 60, '[{"id": "kr_3", "title": "Reduce cycle time to 3 days", "target": 3, "current": 4.5, "unit": "days"}, {"id": "kr_4", "title": "Achieve 95% test coverage", "target": 95, "current": 78, "unit": "%"}]'),
('Complete AI Integration', 'Integrate AI features across the platform', 'individual', 'Q4-2025', 'active', 80, '[{"id": "kr_5", "title": "Launch 5 AI features", "target": 5, "current": 4, "unit": "features"}]')
ON CONFLICT DO NOTHING;
