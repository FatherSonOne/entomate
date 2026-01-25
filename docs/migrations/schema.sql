-- ========================================
-- ENTOMATE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector for semantic search (optional)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ========================================
-- DROP EXISTING TABLES (if starting fresh)
-- Uncomment the following block to reset the database
-- ========================================
/*
DROP TABLE IF EXISTS integration_logs CASCADE;
DROP TABLE IF EXISTS automation_logs CASCADE;
DROP TABLE IF EXISTS automations CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS action_items CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
*/

-- ========================================
-- TEAMS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url VARCHAR(512),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- USERS TABLE
-- ========================================
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

-- ========================================
-- PROJECTS TABLE
-- ========================================
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

-- ========================================
-- MEETINGS TABLE
-- ========================================
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
  created_by VARCHAR(255) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  crm_deal_id VARCHAR(256),
  chat_posted BOOLEAN DEFAULT FALSE,
  posted_to_channels JSONB DEFAULT '[]',
  transcript_embedding JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- ACTION ITEMS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
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

-- ========================================
-- TASKS TABLE
-- ========================================
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

-- ========================================
-- AUTOMATIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(100) NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN DEFAULT TRUE,
  execution_count INT DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255) NOT NULL,
  team_id VARCHAR(255) DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- AUTOMATION LOGS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  trigger_data JSONB DEFAULT '{}',
  actions_executed JSONB DEFAULT '[]',
  success BOOLEAN,
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- INTEGRATION LOGS TABLE
-- ========================================
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

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Drop existing indexes first (safe to run if they don't exist)
DROP INDEX IF EXISTS idx_meetings_created_at;
DROP INDEX IF EXISTS idx_meetings_created_by;
DROP INDEX IF EXISTS idx_meetings_project_id;
DROP INDEX IF EXISTS idx_meetings_crm_deal_id;
DROP INDEX IF EXISTS idx_meetings_sentiment;
DROP INDEX IF EXISTS idx_action_items_meeting;
DROP INDEX IF EXISTS idx_action_items_status;
DROP INDEX IF EXISTS idx_action_items_assigned_to;
DROP INDEX IF EXISTS idx_action_items_crm_sync;
DROP INDEX IF EXISTS idx_action_items_due_date;
DROP INDEX IF EXISTS idx_projects_owner_id;
DROP INDEX IF EXISTS idx_projects_crm_deal_id;
DROP INDEX IF EXISTS idx_projects_status;
DROP INDEX IF EXISTS idx_tasks_project_id;
DROP INDEX IF EXISTS idx_tasks_assigned_to;
DROP INDEX IF EXISTS idx_tasks_status;
DROP INDEX IF EXISTS idx_tasks_due_date;
DROP INDEX IF EXISTS idx_tasks_parent;
DROP INDEX IF EXISTS idx_automations_trigger_type;
DROP INDEX IF EXISTS idx_automations_enabled;
DROP INDEX IF EXISTS idx_automations_team;
DROP INDEX IF EXISTS idx_automation_logs_automation;
DROP INDEX IF EXISTS idx_automation_logs_created;
DROP INDEX IF EXISTS idx_integration_logs_source;
DROP INDEX IF EXISTS idx_integration_logs_status;
DROP INDEX IF EXISTS idx_integration_logs_created;

-- Meetings indexes
CREATE INDEX idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX idx_meetings_created_by ON meetings(created_by);
CREATE INDEX idx_meetings_project_id ON meetings(project_id);
CREATE INDEX idx_meetings_crm_deal_id ON meetings(crm_deal_id);
CREATE INDEX idx_meetings_sentiment ON meetings(sentiment_label);

-- Action items indexes
CREATE INDEX idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_assigned_to ON action_items(assigned_to_id);
CREATE INDEX idx_action_items_crm_sync ON action_items(crm_sync_status);
CREATE INDEX idx_action_items_due_date ON action_items(due_date);

-- Projects indexes
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_crm_deal_id ON projects(crm_deal_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Tasks indexes
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);

-- Automations indexes
CREATE INDEX idx_automations_trigger_type ON automations(trigger_type);
CREATE INDEX idx_automations_enabled ON automations(enabled);
CREATE INDEX idx_automations_team ON automations(team_id);

-- Automation logs indexes
CREATE INDEX idx_automation_logs_automation ON automation_logs(automation_id);
CREATE INDEX idx_automation_logs_created ON automation_logs(created_at DESC);

-- Integration logs indexes
CREATE INDEX idx_integration_logs_source ON integration_logs(source_type, source_id);
CREATE INDEX idx_integration_logs_status ON integration_logs(status);
CREATE INDEX idx_integration_logs_created ON integration_logs(created_at DESC);

-- ========================================
-- TABLE COMMENTS
-- ========================================
COMMENT ON TABLE meetings IS 'Stores meeting recordings, transcripts, and AI analysis';
COMMENT ON TABLE action_items IS 'Action items extracted from meetings';
COMMENT ON TABLE projects IS 'Projects linked to CRM deals';
COMMENT ON TABLE tasks IS 'Tasks within projects';
COMMENT ON TABLE automations IS 'Automation workflows';
COMMENT ON TABLE automation_logs IS 'Execution logs for automations';
COMMENT ON TABLE integration_logs IS 'Sync logs for external integrations';
