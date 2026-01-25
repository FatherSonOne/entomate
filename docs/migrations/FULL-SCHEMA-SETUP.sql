-- ============================================================
-- ENTOMATE FULL DATABASE SCHEMA SETUP
-- ============================================================
-- Run this in Supabase SQL Editor to create all required tables
--
-- This file combines all migrations into a single setup script.
-- Safe to run multiple times (uses CREATE IF NOT EXISTS)
--
-- Created: 2024-12-26
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- ============================================================
-- CORE TABLES
-- ============================================================

-- TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url VARCHAR(512),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  avatar_url VARCHAR(512),
  role VARCHAR(50) DEFAULT 'member',
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  team_ids UUID[] DEFAULT '{}',
  tags JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MEETINGS TABLE
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  transcript TEXT,
  summary TEXT,
  audio_file_url VARCHAR(512),
  key_points JSONB DEFAULT '[]',
  decisions JSONB DEFAULT '[]',
  topics JSONB DEFAULT '[]',
  sentiment_label VARCHAR(20),
  sentiment_score FLOAT,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INT,
  attendees JSONB DEFAULT '[]',
  created_by VARCHAR(255) NOT NULL DEFAULT 'system',
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  crm_deal_id VARCHAR(256),
  chat_posted BOOLEAN DEFAULT FALSE,
  posted_to_channels JSONB DEFAULT '[]',
  transcript_embedding JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ACTION ITEMS TABLE
CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  task_description TEXT NOT NULL,
  context TEXT,
  assigned_to_email VARCHAR(255),
  assigned_to_name VARCHAR(255),
  assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'open',
  crm_sync_status VARCHAR(20) DEFAULT 'pending',
  crm_task_id VARCHAR(256),
  last_sync_attempt TIMESTAMP WITH TIME ZONE,
  last_sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'open',
  priority VARCHAR(20) DEFAULT 'medium',
  due_date DATE,
  start_date DATE,
  crm_task_id VARCHAR(256),
  tags JSONB DEFAULT '[]',
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- AUTOMATIONS & WORKFLOWS
-- ============================================================

-- AUTOMATIONS TABLE
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(100) NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]',
  conditions JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT TRUE,
  execution_count INT DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255) NOT NULL DEFAULT 'system',
  team_id VARCHAR(255) DEFAULT 'default',
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AUTOMATION LOGS TABLE
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID REFERENCES automations(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  trigger_data JSONB DEFAULT '{}',
  actions_executed JSONB DEFAULT '[]',
  success BOOLEAN,
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WORKFLOWS TABLE (v2 - Node-based)
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  connections JSONB NOT NULL DEFAULT '[]',
  variables JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT FALSE,
  version INT DEFAULT 1,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  execution_count INT DEFAULT 0,
  created_by VARCHAR(255) DEFAULT 'system',
  team_id VARCHAR(255) DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WORKFLOW VERSIONS TABLE
CREATE TABLE IF NOT EXISTS workflow_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  version INT NOT NULL,
  nodes JSONB NOT NULL,
  connections JSONB NOT NULL,
  variables JSONB DEFAULT '{}',
  change_description TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WORKFLOW EXECUTIONS TABLE
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  version INT,
  status VARCHAR(50) DEFAULT 'pending',
  mode VARCHAR(50) DEFAULT 'production',
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  node_outputs JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE,
  duration_ms INT,
  triggered_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- AI AGENTS
-- ============================================================

-- AI AGENTS TABLE
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  team_id TEXT DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,
  agent_type TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  triggers JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT TRUE,
  execution_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AGENT EXECUTION LOGS TABLE
CREATE TABLE IF NOT EXISTS agent_execution_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  trigger_type TEXT,
  input_context JSONB,
  output_suggestion JSONB,
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  confidence DECIMAL(3,2),
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TEAM MEMBERS TABLE (for assignment agent)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  team_id TEXT DEFAULT 'default',
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  skills TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INTEGRATION & SYNC
-- ============================================================

-- INTEGRATION LOGS TABLE
CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type VARCHAR(50),
  source_id UUID,
  destination_type VARCHAR(50),
  destination_id VARCHAR(256),
  status VARCHAR(20),
  error_message TEXT,
  retry_count INT DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SECRETS VAULT (for API keys, encrypted)
CREATE TABLE IF NOT EXISTS secrets_vault (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id VARCHAR(255) DEFAULT 'default',
  key_name VARCHAR(255) NOT NULL,
  encrypted_value TEXT NOT NULL,
  description TEXT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, key_name)
);

-- ============================================================
-- SEARCH & ANALYTICS
-- ============================================================

-- SEARCH HISTORY
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  team_id VARCHAR(255) DEFAULT 'default',
  query TEXT NOT NULL,
  search_type VARCHAR(50) DEFAULT 'text',
  filters JSONB DEFAULT '{}',
  result_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SAVED SEARCHES
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  team_id VARCHAR(255) DEFAULT 'default',
  name VARCHAR(255) NOT NULL,
  query TEXT NOT NULL,
  search_type VARCHAR(50) DEFAULT 'text',
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SEARCH CONVERSATIONS
CREATE TABLE IF NOT EXISTS search_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  team_id VARCHAR(255) DEFAULT 'default',
  title TEXT,
  messages JSONB DEFAULT '[]',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- GOALS & OKRs
-- ============================================================

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  goal_type VARCHAR(50) DEFAULT 'objective',
  parent_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id VARCHAR(255) DEFAULT 'default',
  status VARCHAR(50) DEFAULT 'on_track',
  progress DECIMAL(5,2) DEFAULT 0,
  target_value DECIMAL(12,2),
  current_value DECIMAL(12,2),
  unit VARCHAR(50),
  start_date DATE,
  end_date DATE,
  quarter VARCHAR(10),
  year INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TEMPLATES
-- ============================================================

-- AUTOMATION TEMPLATES
CREATE TABLE IF NOT EXISTS automation_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  icon TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]',
  popular_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Meetings indexes
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_crm_deal_id ON meetings(crm_deal_id);
CREATE INDEX IF NOT EXISTS idx_meetings_sentiment ON meetings(sentiment_label);

-- Action items indexes
CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_assigned_to ON action_items(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_action_items_crm_sync ON action_items(crm_sync_status);
CREATE INDEX IF NOT EXISTS idx_action_items_due_date ON action_items(due_date);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_crm_deal_id ON projects(crm_deal_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

-- Automations indexes
CREATE INDEX IF NOT EXISTS idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled);
CREATE INDEX IF NOT EXISTS idx_automations_team ON automations(team_id);
CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id);

-- Workflows indexes
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(active);
CREATE INDEX IF NOT EXISTS idx_workflows_team ON workflows(team_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

-- Automation/Agent logs indexes
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_execution_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_type ON agent_execution_logs(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_execution_logs(created_at DESC);

-- AI Agents indexes
CREATE INDEX IF NOT EXISTS idx_ai_agents_user ON ai_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_type ON ai_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agents_enabled ON ai_agents(enabled);

-- Team members indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(active);

-- Integration logs indexes
CREATE INDEX IF NOT EXISTS idx_integration_logs_source ON integration_logs(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON integration_logs(status);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at DESC);

-- Search indexes
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);

-- Goals indexes
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals(owner_id);
CREATE INDEX IF NOT EXISTS idx_goals_team ON goals(team_id);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_id);
CREATE INDEX IF NOT EXISTS idx_goals_quarter ON goals(quarter, year);

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_meetings_transcript_trgm ON meetings USING gin(transcript gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_meetings_summary_trgm ON meetings USING gin(summary gin_trgm_ops);

-- ============================================================
-- DEFAULT DATA
-- ============================================================

-- Insert default automation templates
INSERT INTO automation_templates (id, name, description, category, icon, trigger_type, actions) VALUES
  ('meeting-to-crm', 'Meeting to CRM Sync', 'When a meeting ends, extract action items and sync to CRM', 'integration', '🔄', 'meeting_ended', '[{"type": "extract_action_items"}, {"type": "sync_to_crm"}]'),
  ('auto-assign-tasks', 'Auto-Assign Action Items', 'Use AI to automatically assign action items to the best team member', 'ai', '🤖', 'action_item_created', '[{"type": "auto_assign"}]'),
  ('smart-prioritization', 'Smart Priority Setting', 'AI analyzes meeting context to set appropriate priorities', 'ai', '📊', 'action_item_created', '[{"type": "auto_prioritize"}]'),
  ('deadline-suggestions', 'AI Deadline Suggestions', 'AI suggests realistic due dates based on task complexity', 'ai', '📅', 'action_item_created', '[{"type": "suggest_deadline"}]'),
  ('full-ai-processing', 'Full AI Processing', 'Run all AI agents: assign, prioritize, and set deadlines automatically', 'ai', '✨', 'action_item_created', '[{"type": "run_agent", "config": {"agents": ["priority", "deadline", "assignment"], "autoApply": true}}]'),
  ('meeting-recap', 'Auto Meeting Recap', 'Automatically post meeting recap to team chat', 'integration', '📝', 'meeting_processed', '[{"type": "post_to_chat"}]')
ON CONFLICT (id) DO NOTHING;

-- Insert a default team
INSERT INTO teams (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Team', 'Default team for new users')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Optional
-- ============================================================
-- Uncomment to enable RLS policies

-- ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GRANTS FOR PUBLIC ACCESS (development mode)
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================
-- VERIFY SETUP
-- ============================================================

-- Run this to verify all tables were created:
SELECT
  table_name,
  CASE
    WHEN table_name IN ('meetings', 'projects', 'automations', 'workflows', 'action_items', 'tasks')
    THEN '✅ Core Table'
    ELSE '📦 Supporting Table'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
