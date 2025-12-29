-- ========================================
-- Migration: 001_workflow_v2_infrastructure
-- Purpose: Enhanced workflow automation with N8N-style features
-- Date: 2024-12-24
-- ========================================

-- ========================================
-- SECTION 1: WORKFLOWS V2 TABLE
-- Node-based workflow definitions
-- ========================================

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Node-based structure (N8N-style)
  nodes JSONB NOT NULL DEFAULT '[]',
  connections JSONB NOT NULL DEFAULT '[]',

  -- Workflow settings
  settings JSONB DEFAULT '{
    "saveFailedExecutions": true,
    "saveSuccessfulExecutions": true,
    "errorWorkflowId": null,
    "timezone": "UTC",
    "retryOnFailure": {
      "enabled": true,
      "maxRetries": 3,
      "backoffMs": [1000, 5000, 15000]
    }
  }',

  -- Versioning
  version INTEGER DEFAULT 1,

  -- Template support
  is_template BOOLEAN DEFAULT false,
  template_id UUID REFERENCES workflows(id) ON DELETE SET NULL,

  -- Status and stats
  active BOOLEAN DEFAULT false,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,

  -- Ownership
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for workflows
CREATE INDEX idx_workflows_user ON workflows(user_id);
CREATE INDEX idx_workflows_team ON workflows(team_id);
CREATE INDEX idx_workflows_active ON workflows(active);
CREATE INDEX idx_workflows_template ON workflows(is_template);

COMMENT ON TABLE workflows IS 'Node-based workflow definitions with visual canvas support';
COMMENT ON COLUMN workflows.nodes IS 'Array of node objects with id, type, position, config';
COMMENT ON COLUMN workflows.connections IS 'Array of connection objects linking nodes';

-- ========================================
-- SECTION 2: WORKFLOW VERSIONS TABLE
-- Track changes for rollback capability
-- ========================================

CREATE TABLE IF NOT EXISTS workflow_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Snapshot of workflow at this version
  name VARCHAR(255) NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL,
  connections JSONB NOT NULL,
  settings JSONB,

  -- Metadata
  change_summary TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique version per workflow
  UNIQUE(workflow_id, version_number)
);

CREATE INDEX idx_workflow_versions_workflow ON workflow_versions(workflow_id);
CREATE INDEX idx_workflow_versions_created ON workflow_versions(created_at DESC);

COMMENT ON TABLE workflow_versions IS 'Version history for workflow rollback';

-- ========================================
-- SECTION 3: WORKFLOW EXECUTIONS TABLE
-- Track each run of a workflow
-- ========================================

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  -- Execution status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Values: pending, running, completed, failed, cancelled, waiting

  -- Execution mode
  mode VARCHAR(20) NOT NULL DEFAULT 'production',
  -- Values: production, test, manual, retry

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finished_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  -- Input and output data
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',

  -- Node execution tracking
  node_executions JSONB DEFAULT '[]',
  -- Array of { nodeId, status, startedAt, finishedAt, input, output, error }

  -- Current state (for long-running/waiting workflows)
  current_node_id VARCHAR(100),
  waiting_for JSONB,

  -- Error information
  error_message TEXT,
  error_node_id VARCHAR(100),
  error_stack TEXT,

  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  parent_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,

  -- Caller info (for sub-workflows)
  called_by_workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  called_by_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,

  -- Who triggered it
  triggered_by VARCHAR(50),
  -- Values: webhook, schedule, manual, sub_workflow, error_handler

  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started ON workflow_executions(started_at DESC);
CREATE INDEX idx_workflow_executions_parent ON workflow_executions(parent_execution_id);

COMMENT ON TABLE workflow_executions IS 'Execution history and state for workflows';

-- ========================================
-- SECTION 4: WEBHOOKS TABLE
-- Inbound webhook endpoints
-- ========================================

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,

  -- Webhook configuration
  path VARCHAR(255) NOT NULL,
  method VARCHAR(10) DEFAULT 'POST',
  -- Values: GET, POST, PUT, PATCH, DELETE

  -- Authentication
  authentication JSONB DEFAULT '{"type": "none"}',
  -- Types: none, header, basic, jwt, api_key

  -- Response configuration
  response_mode VARCHAR(20) DEFAULT 'immediate',
  -- Values: immediate (returns executionId), last_node (waits for workflow), custom
  response_data JSONB,

  -- Status
  enabled BOOLEAN DEFAULT true,

  -- Stats
  trigger_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique path
  UNIQUE(path)
);

CREATE INDEX idx_webhooks_workflow ON webhooks(workflow_id);
CREATE INDEX idx_webhooks_path ON webhooks(path);
CREATE INDEX idx_webhooks_enabled ON webhooks(enabled);

COMMENT ON TABLE webhooks IS 'Inbound webhook endpoints for triggering workflows';

-- ========================================
-- SECTION 5: CREDENTIALS TABLE
-- Secure storage for API keys and secrets
-- ========================================

CREATE TABLE IF NOT EXISTS credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Credential info
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  -- Types: slack, openai, http_basic, http_bearer, api_key, oauth2, custom

  -- Encrypted data (encryption at application level)
  data JSONB NOT NULL,

  -- Ownership
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  -- Sharing
  shared_with_team BOOLEAN DEFAULT false,

  -- Usage tracking
  last_used_at TIMESTAMP WITH TIME ZONE,
  use_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_credentials_user ON credentials(user_id);
CREATE INDEX idx_credentials_team ON credentials(team_id);
CREATE INDEX idx_credentials_type ON credentials(type);

COMMENT ON TABLE credentials IS 'Encrypted credential storage for workflow integrations';

-- ========================================
-- SECTION 6: NODE PINNED DATA TABLE
-- Development feature: pin node outputs
-- ========================================

CREATE TABLE IF NOT EXISTS node_pinned_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,

  -- Pinned output data
  pinned_data JSONB NOT NULL,

  -- Metadata
  pinned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Only one pinned data per node per workflow
  UNIQUE(workflow_id, node_id)
);

CREATE INDEX idx_node_pinned_workflow ON node_pinned_data(workflow_id);

COMMENT ON TABLE node_pinned_data IS 'Pinned node data for development/testing';

-- ========================================
-- SECTION 7: SCHEDULED WORKFLOWS TABLE
-- Cron-based scheduling
-- ========================================

CREATE TABLE IF NOT EXISTS workflow_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,

  -- Schedule configuration
  cron_expression VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',

  -- Status
  enabled BOOLEAN DEFAULT true,

  -- Tracking
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER DEFAULT 0,

  -- Error tracking
  last_error TEXT,
  consecutive_failures INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflow_schedules_workflow ON workflow_schedules(workflow_id);
CREATE INDEX idx_workflow_schedules_enabled ON workflow_schedules(enabled);
CREATE INDEX idx_workflow_schedules_next_run ON workflow_schedules(next_run_at);

COMMENT ON TABLE workflow_schedules IS 'Cron schedules for scheduled workflow triggers';

-- ========================================
-- SECTION 8: ERROR WORKFLOWS TABLE
-- Link workflows to their error handlers
-- ========================================

CREATE TABLE IF NOT EXISTS error_workflow_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  error_workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

  -- Don't allow circular references
  CHECK (workflow_id != error_workflow_id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One error handler per workflow
  UNIQUE(workflow_id)
);

CREATE INDEX idx_error_workflow_links_workflow ON error_workflow_links(workflow_id);
CREATE INDEX idx_error_workflow_links_error ON error_workflow_links(error_workflow_id);

COMMENT ON TABLE error_workflow_links IS 'Links workflows to their error handler workflows';

-- ========================================
-- SECTION 9: RLS POLICIES
-- Row Level Security for multi-tenancy
-- ========================================

-- Enable RLS on all new tables
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_pinned_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_workflow_links ENABLE ROW LEVEL SECURITY;

-- Workflows: Users can manage their own workflows or team workflows
CREATE POLICY "Users manage own workflows" ON workflows
  FOR ALL USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM users WHERE id = auth.uid())
  );

-- Workflow versions: Same as workflows
CREATE POLICY "Users view workflow versions" ON workflow_versions
  FOR ALL USING (
    workflow_id IN (SELECT id FROM workflows WHERE user_id = auth.uid() OR
                    team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  );

-- Executions: Users can view executions of their workflows
CREATE POLICY "Users view own executions" ON workflow_executions
  FOR ALL USING (
    workflow_id IN (SELECT id FROM workflows WHERE user_id = auth.uid() OR
                    team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  );

-- Webhooks: Users can manage webhooks for their workflows
CREATE POLICY "Users manage own webhooks" ON webhooks
  FOR ALL USING (
    workflow_id IN (SELECT id FROM workflows WHERE user_id = auth.uid() OR
                    team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  );

-- Credentials: Users can manage their own credentials or team-shared ones
CREATE POLICY "Users manage own credentials" ON credentials
  FOR ALL USING (
    user_id = auth.uid() OR
    (shared_with_team = true AND team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  );

-- Pinned data: Users can manage pinned data for their workflows
CREATE POLICY "Users manage pinned data" ON node_pinned_data
  FOR ALL USING (
    workflow_id IN (SELECT id FROM workflows WHERE user_id = auth.uid())
  );

-- Schedules: Users can manage schedules for their workflows
CREATE POLICY "Users manage own schedules" ON workflow_schedules
  FOR ALL USING (
    workflow_id IN (SELECT id FROM workflows WHERE user_id = auth.uid() OR
                    team_id IN (SELECT team_id FROM users WHERE id = auth.uid()))
  );

-- Error workflow links: Users can manage error handlers for their workflows
CREATE POLICY "Users manage error handlers" ON error_workflow_links
  FOR ALL USING (
    workflow_id IN (SELECT id FROM workflows WHERE user_id = auth.uid())
  );

-- ========================================
-- SECTION 10: HELPER FUNCTIONS
-- ========================================

-- Function to auto-save workflow versions on update
CREATE OR REPLACE FUNCTION save_workflow_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only save version if nodes or connections changed
  IF OLD.nodes IS DISTINCT FROM NEW.nodes OR OLD.connections IS DISTINCT FROM NEW.connections THEN
    INSERT INTO workflow_versions (
      workflow_id, version_number, name, description,
      nodes, connections, settings, created_by, change_summary
    )
    VALUES (
      OLD.id,
      OLD.version,
      OLD.name,
      OLD.description,
      OLD.nodes,
      OLD.connections,
      OLD.settings,
      auth.uid(),
      NEW.settings->>'change_summary'
    );

    -- Increment version number
    NEW.version := OLD.version + 1;
    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-version workflows
DROP TRIGGER IF EXISTS workflow_version_trigger ON workflows;
CREATE TRIGGER workflow_version_trigger
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION save_workflow_version();

-- Function to calculate next cron run time
CREATE OR REPLACE FUNCTION update_next_run_time()
RETURNS TRIGGER AS $$
BEGIN
  -- This will be calculated by the application layer
  -- Just update the timestamp here
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS schedule_update_trigger ON workflow_schedules;
CREATE TRIGGER schedule_update_trigger
  BEFORE UPDATE ON workflow_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_next_run_time();

-- ========================================
-- SECTION 11: MIGRATION HELPER
-- Convert old automations to new workflows
-- ========================================

-- This function will be called by the application to migrate
-- existing automations to the new workflow format
CREATE OR REPLACE FUNCTION migrate_automation_to_workflow(automation_id UUID)
RETURNS UUID AS $$
DECLARE
  automation_record RECORD;
  new_workflow_id UUID;
  trigger_node JSONB;
  action_nodes JSONB;
  all_nodes JSONB;
  all_connections JSONB;
  i INTEGER;
  prev_node_id TEXT;
  curr_node_id TEXT;
BEGIN
  -- Get the automation
  SELECT * INTO automation_record FROM automations WHERE id = automation_id;

  IF automation_record IS NULL THEN
    RAISE EXCEPTION 'Automation not found: %', automation_id;
  END IF;

  -- Create trigger node
  trigger_node := jsonb_build_object(
    'id', 'trigger_' || gen_random_uuid()::text,
    'type', 'trigger',
    'subtype', automation_record.trigger_type,
    'position', jsonb_build_object('x', 100, 'y', 100),
    'config', automation_record.trigger_config
  );

  -- Create action nodes
  action_nodes := '[]'::jsonb;
  all_connections := '[]'::jsonb;
  prev_node_id := trigger_node->>'id';

  FOR i IN 0..jsonb_array_length(automation_record.actions) - 1 LOOP
    curr_node_id := 'action_' || gen_random_uuid()::text;

    action_nodes := action_nodes || jsonb_build_object(
      'id', curr_node_id,
      'type', 'action',
      'subtype', automation_record.actions->i->>'type',
      'position', jsonb_build_object('x', 100, 'y', 200 + (i * 120)),
      'config', automation_record.actions->i->'config'
    );

    all_connections := all_connections || jsonb_build_object(
      'id', 'conn_' || gen_random_uuid()::text,
      'sourceNodeId', prev_node_id,
      'sourceOutput', 'main',
      'targetNodeId', curr_node_id,
      'targetInput', 'main'
    );

    prev_node_id := curr_node_id;
  END LOOP;

  all_nodes := jsonb_build_array(trigger_node) || action_nodes;

  -- Create the workflow
  INSERT INTO workflows (
    name, description, nodes, connections, active, user_id
  ) VALUES (
    automation_record.name,
    automation_record.description,
    all_nodes,
    all_connections,
    automation_record.enabled,
    (SELECT id FROM users WHERE email = automation_record.created_by LIMIT 1)
  ) RETURNING id INTO new_workflow_id;

  -- Mark original automation as migrated
  UPDATE automations
  SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('migrated_to', new_workflow_id)
  WHERE id = automation_id;

  RETURN new_workflow_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMPLETE
-- ========================================
COMMENT ON FUNCTION migrate_automation_to_workflow IS 'Migrate legacy automation to new workflow format';
