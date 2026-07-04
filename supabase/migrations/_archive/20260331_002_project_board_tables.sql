-- ============================================================
-- Project Board Tables: projects + tasks
-- Phase 1 Critical Fix — formal migration for core PM tables
-- Idempotent: safe to run on existing databases
-- ============================================================

-- PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'planning',
  crm_deal_id VARCHAR(256),
  deal_value DECIMAL(12, 2),
  start_date DATE,
  end_date DATE,
  owner_id UUID,
  team_ids UUID[] DEFAULT '{}',
  tags JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill columns if projects table already existed with fewer columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'crm_deal_id') THEN
    ALTER TABLE projects ADD COLUMN crm_deal_id VARCHAR(256);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'deal_value') THEN
    ALTER TABLE projects ADD COLUMN deal_value DECIMAL(12, 2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'start_date') THEN
    ALTER TABLE projects ADD COLUMN start_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'end_date') THEN
    ALTER TABLE projects ADD COLUMN end_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'owner_id') THEN
    ALTER TABLE projects ADD COLUMN owner_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'team_ids') THEN
    ALTER TABLE projects ADD COLUMN team_ids UUID[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'tags') THEN
    ALTER TABLE projects ADD COLUMN tags JSONB DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'settings') THEN
    ALTER TABLE projects ADD COLUMN settings JSONB DEFAULT '{}';
  END IF;
END $$;

COMMENT ON TABLE projects IS 'Project portfolio — links to tasks, meetings, and CRM deals';

-- TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open',
  priority VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill columns if tasks table already existed with fewer columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'project_id') THEN
    ALTER TABLE tasks ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'parent_task_id') THEN
    ALTER TABLE tasks ADD COLUMN parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'assigned_to') THEN
    ALTER TABLE tasks ADD COLUMN assigned_to UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'due_date') THEN
    ALTER TABLE tasks ADD COLUMN due_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'start_date') THEN
    ALTER TABLE tasks ADD COLUMN start_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'crm_task_id') THEN
    ALTER TABLE tasks ADD COLUMN crm_task_id VARCHAR(256);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'tags') THEN
    ALTER TABLE tasks ADD COLUMN tags JSONB DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'custom_fields') THEN
    ALTER TABLE tasks ADD COLUMN custom_fields JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'completed_at') THEN
    ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON TABLE tasks IS 'Task items within projects — supports subtasks via parent_task_id';

-- ============================================================
-- CONSTRAINTS (add only if missing)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_status_check') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_status_check
      CHECK (status IN ('planning', 'active', 'completed', 'archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_check') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
      CHECK (status IN ('open', 'in_progress', 'review', 'done', 'blocked'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_priority_check') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
      CHECK (priority IN ('low', 'medium', 'high'));
  END IF;
END $$;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects (owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status   ON projects (status);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id  ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON tasks (due_date) WHERE due_date IS NOT NULL;

-- ============================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_projects_updated_at') THEN
    CREATE TRIGGER trg_projects_updated_at
      BEFORE UPDATE ON projects
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tasks_updated_at') THEN
    CREATE TRIGGER trg_tasks_updated_at
      BEFORE UPDATE ON tasks
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks    ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts (safe — recreated below)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own projects" ON projects;
  DROP POLICY IF EXISTS "Users can create projects" ON projects;
  DROP POLICY IF EXISTS "Users can update own projects" ON projects;
  DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
  DROP POLICY IF EXISTS "Service role full access to projects" ON projects;
  DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can update tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can delete tasks" ON tasks;
  DROP POLICY IF EXISTS "Service role full access to tasks" ON tasks;
END $$;

-- NOTE: All comparisons use ::text casts because existing columns may be
-- VARCHAR (from earlier schema) while auth.uid() returns UUID.

-- Projects: owner or team member can read
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (
    auth.uid()::text = owner_id::text
    OR auth.uid()::text = ANY(team_ids::text[])
  );

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid()::text = owner_id::text);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid()::text = owner_id::text);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid()::text = owner_id::text);

-- Tasks: project owner, team member, or assignee can access
CREATE POLICY "Users can view tasks"
  ON tasks FOR SELECT
  USING (
    auth.uid()::text = assigned_to::text
    OR project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id::text = tasks.project_id::text
        AND (projects.owner_id::text = auth.uid()::text OR auth.uid()::text = ANY(projects.team_ids::text[]))
    )
  );

CREATE POLICY "Users can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id::text = tasks.project_id::text
        AND (projects.owner_id::text = auth.uid()::text OR auth.uid()::text = ANY(projects.team_ids::text[]))
    )
  );

CREATE POLICY "Users can update tasks"
  ON tasks FOR UPDATE
  USING (
    auth.uid()::text = assigned_to::text
    OR project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id::text = tasks.project_id::text
        AND (projects.owner_id::text = auth.uid()::text OR auth.uid()::text = ANY(projects.team_ids::text[]))
    )
  );

CREATE POLICY "Users can delete tasks"
  ON tasks FOR DELETE
  USING (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id::text = tasks.project_id::text
        AND projects.owner_id::text = auth.uid()::text
    )
  );

-- Service role bypass for backend API
CREATE POLICY "Service role full access to projects"
  ON projects FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to tasks"
  ON tasks FOR ALL
  USING (auth.role() = 'service_role');
