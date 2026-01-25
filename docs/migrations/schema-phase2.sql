-- ========================================
-- ENTOMATE PHASE 2 DATABASE SCHEMA
-- AI Agents, Goals, Analytics
-- ========================================

-- ========================================
-- AI AGENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  agent_type VARCHAR(50) NOT NULL DEFAULT 'custom', -- predefined, custom
  icon VARCHAR(50) DEFAULT 'bot',

  -- Trigger configuration
  triggers JSONB NOT NULL DEFAULT '[]',
  -- Example: [{ "type": "deal_created", "conditions": [{"field": "deal_value", "operator": "gt", "value": 50000}] }]

  -- Actions to execute
  actions JSONB NOT NULL DEFAULT '[]',
  -- Example: [{ "type": "create_project", "config": {} }, { "type": "post_to_chat", "config": {} }]

  -- Agent memory/learning
  memory JSONB DEFAULT '{}',
  -- Stores past decisions for learning

  -- Configuration
  config JSONB DEFAULT '{}',
  -- Agent-specific settings

  -- Status
  enabled BOOLEAN DEFAULT true,
  execution_count INT DEFAULT 0,
  success_rate FLOAT DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,

  -- Ownership
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- AGENT EXECUTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,

  -- Trigger info
  trigger_event JSONB NOT NULL,
  trigger_type VARCHAR(100),

  -- Decision process
  context_gathered JSONB DEFAULT '{}',
  decisions JSONB DEFAULT '[]',

  -- Execution
  actions_executed JSONB DEFAULT '[]',

  -- Results
  success BOOLEAN,
  error_message TEXT,
  duration_ms INT,

  -- Feedback for learning
  feedback_rating INT, -- 1-5 scale
  feedback_notes TEXT,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- GOALS TABLE (OKRs)
-- ========================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic info
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Hierarchy
  goal_type VARCHAR(50) NOT NULL, -- company, team, individual
  parent_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,

  -- Ownership
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- Time frame
  quarter VARCHAR(10), -- Q1-2025, Q2-2025, etc.
  start_date DATE,
  target_date DATE,

  -- Status & Progress
  status VARCHAR(20) DEFAULT 'planning', -- planning, active, completed, abandoned
  progress FLOAT DEFAULT 0, -- 0-100

  -- Key Results
  key_results JSONB DEFAULT '[]',
  -- Example: [{ "id": "uuid", "title": "Increase revenue", "target": 100000, "current": 75000, "unit": "$" }]

  -- Linked items
  related_tasks UUID[] DEFAULT '{}',
  related_projects UUID[] DEFAULT '{}',
  related_meetings UUID[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- METRICS TABLE (Analytics)
-- ========================================
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Metric info
  metric_type VARCHAR(100) NOT NULL,
  -- Types: task_completed, meeting_processed, action_items_extracted,
  --        automation_executed, agent_executed, goal_progress, etc.

  -- Value
  value FLOAT NOT NULL,
  unit VARCHAR(50), -- count, minutes, percent, dollars, etc.

  -- Context
  source_type VARCHAR(50), -- meeting, task, project, agent, automation
  source_id UUID,

  -- Dimensions for analysis
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Time
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE
);

-- ========================================
-- SAVED SEARCHES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Search info
  name VARCHAR(255) NOT NULL,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}',

  -- Usage
  use_count INT DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Ownership
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_shared BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- DOCUMENT TEMPLATES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Template info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL, -- meeting_recap, weekly_digest, project_brief, etc.

  -- Content
  template_content TEXT NOT NULL,
  -- Uses {{variable}} syntax for interpolation

  -- Styling
  styles JSONB DEFAULT '{}',

  -- Usage
  use_count INT DEFAULT 0,

  -- Ownership
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- GENERATED DOCUMENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Document info
  title VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL,

  -- Content
  content TEXT,
  format VARCHAR(20) DEFAULT 'markdown', -- markdown, html, pdf
  file_url VARCHAR(512),

  -- Source
  template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
  source_type VARCHAR(50), -- meeting, project, team
  source_id UUID,

  -- Ownership
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- INDEXES FOR PHASE 2
-- ========================================

-- AI Agents indexes
CREATE INDEX IF NOT EXISTS idx_ai_agents_enabled ON ai_agents(enabled);
CREATE INDEX IF NOT EXISTS idx_ai_agents_type ON ai_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agents_team ON ai_agents(team_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_created_by ON ai_agents(created_by);

-- Agent executions indexes
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent ON agent_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_created ON agent_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_executions_success ON agent_executions(success);

-- Goals indexes
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals(owner_id);
CREATE INDEX IF NOT EXISTS idx_goals_team ON goals(team_id);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_quarter ON goals(quarter);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_user ON metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_team ON metrics(team_id);
CREATE INDEX IF NOT EXISTS idx_metrics_source ON metrics(source_type, source_id);

-- Saved searches indexes
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_shared ON saved_searches(is_shared);

-- Document templates indexes
CREATE INDEX IF NOT EXISTS idx_doc_templates_type ON document_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_doc_templates_team ON document_templates(team_id);

-- Generated documents indexes
CREATE INDEX IF NOT EXISTS idx_gen_docs_type ON generated_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_gen_docs_source ON generated_documents(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_gen_docs_created ON generated_documents(created_at DESC);

-- ========================================
-- TABLE COMMENTS
-- ========================================
COMMENT ON TABLE ai_agents IS 'Custom AI agents that automate complex workflows';
COMMENT ON TABLE agent_executions IS 'Execution history and learning data for AI agents';
COMMENT ON TABLE goals IS 'OKRs and goal tracking system';
COMMENT ON TABLE metrics IS 'Analytics and performance metrics';
COMMENT ON TABLE saved_searches IS 'User-saved search queries';
COMMENT ON TABLE document_templates IS 'Templates for auto-generated documents';
COMMENT ON TABLE generated_documents IS 'AI-generated documents and reports';
