-- Week 7: Automations & Basic Agents
-- Migration: Create/update tables for automations and AI agents

-- =====================================================
-- AUTOMATIONS TABLE - Add missing columns if table exists
-- =====================================================
DO $$
BEGIN
    -- Create table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'automations') THEN
        CREATE TABLE automations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID,
            team_id TEXT DEFAULT 'default',
            name TEXT NOT NULL,
            description TEXT,
            trigger_type TEXT NOT NULL,
            trigger_config JSONB DEFAULT '{}',
            actions JSONB NOT NULL DEFAULT '[]',
            conditions JSONB DEFAULT '[]',
            enabled BOOLEAN DEFAULT true,
            execution_count INTEGER DEFAULT 0,
            last_executed_at TIMESTAMPTZ,
            created_by UUID,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        -- Add missing columns to existing table
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'automations' AND column_name = 'user_id') THEN
            ALTER TABLE automations ADD COLUMN user_id UUID;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'automations' AND column_name = 'team_id') THEN
            ALTER TABLE automations ADD COLUMN team_id TEXT DEFAULT 'default';
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'automations' AND column_name = 'conditions') THEN
            ALTER TABLE automations ADD COLUMN conditions JSONB DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'automations' AND column_name = 'execution_count') THEN
            ALTER TABLE automations ADD COLUMN execution_count INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'automations' AND column_name = 'last_executed_at') THEN
            ALTER TABLE automations ADD COLUMN last_executed_at TIMESTAMPTZ;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'automations' AND column_name = 'created_by') THEN
            ALTER TABLE automations ADD COLUMN created_by UUID;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'automations' AND column_name = 'updated_at') THEN
            ALTER TABLE automations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        END IF;
    END IF;
END $$;

-- Create indexes (will skip if they exist)
CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id);
CREATE INDEX IF NOT EXISTS idx_automations_trigger ON automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled);

-- =====================================================
-- AUTOMATION LOGS TABLE
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'automation_logs') THEN
        CREATE TABLE automation_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            automation_id UUID REFERENCES automations(id) ON DELETE CASCADE,
            triggered_at TIMESTAMPTZ DEFAULT NOW(),
            trigger_data JSONB,
            actions_executed JSONB DEFAULT '[]',
            success BOOLEAN DEFAULT true,
            error_message TEXT,
            duration_ms INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'automation_logs' AND column_name = 'duration_ms') THEN
            ALTER TABLE automation_logs ADD COLUMN duration_ms INTEGER;
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_logs_automation ON automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_success ON automation_logs(success);

-- =====================================================
-- AI AGENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    team_id TEXT DEFAULT 'default',
    name TEXT NOT NULL,
    description TEXT,
    agent_type TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    triggers JSONB DEFAULT '[]',
    enabled BOOLEAN DEFAULT true,
    execution_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_user ON ai_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_type ON ai_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_ai_agents_enabled ON ai_agents(enabled);

-- =====================================================
-- AGENT EXECUTION LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
    agent_type TEXT NOT NULL,
    trigger_type TEXT,
    input_context JSONB,
    output_suggestion JSONB,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    confidence DECIMAL(3,2),
    feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    feedback_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_execution_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_type ON agent_execution_logs(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_execution_logs(created_at DESC);

-- =====================================================
-- TEAM MEMBERS TABLE (for assignment agent)
-- =====================================================
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    team_id TEXT DEFAULT 'default',
    name TEXT NOT NULL,
    email TEXT,
    role TEXT,
    skills TEXT[] DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(active);

-- =====================================================
-- AUTOMATION TEMPLATES TABLE
-- =====================================================
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO automation_templates (id, name, description, category, icon, trigger_type, actions) VALUES
    ('meeting-to-crm', 'Meeting to CRM Sync', 'When a meeting ends, extract action items and sync to CRM', 'integration', '🔄', 'meeting_ended', '[{"type": "extract_action_items", "config": {}}, {"type": "sync_to_crm", "config": {}}]'),
    ('auto-assign-tasks', 'Auto-Assign Action Items', 'Use AI to automatically assign action items to the best team member', 'ai', '🤖', 'action_item_created', '[{"type": "auto_assign", "config": {}}]'),
    ('smart-prioritization', 'Smart Priority Setting', 'AI analyzes meeting context to set appropriate priorities', 'ai', '📊', 'action_item_created', '[{"type": "auto_prioritize", "config": {}}]'),
    ('deadline-suggestions', 'AI Deadline Suggestions', 'AI suggests realistic due dates based on task complexity', 'ai', '📅', 'action_item_created', '[{"type": "suggest_deadline", "config": {}}]'),
    ('full-ai-processing', 'Full AI Processing', 'Run all AI agents: assign, prioritize, and set deadlines automatically', 'ai', '✨', 'action_item_created', '[{"type": "run_agent", "config": {"agents": ["priority", "deadline", "assignment"], "autoApply": true}}]'),
    ('meeting-recap', 'Auto Meeting Recap', 'Automatically post meeting recap to team chat', 'integration', '📝', 'meeting_processed', '[{"type": "post_to_chat", "config": {}}]')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    actions = EXCLUDED.actions;

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON automations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON automation_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_agents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_execution_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_members TO authenticated;
GRANT SELECT ON automation_templates TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON automations TO anon;
GRANT SELECT, INSERT ON automation_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_agents TO anon;
GRANT SELECT, INSERT ON agent_execution_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_members TO anon;
GRANT SELECT ON automation_templates TO anon;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE automations IS 'User-created automation workflows (Week 7)';
COMMENT ON TABLE automation_logs IS 'Execution history for automations (Week 7)';
COMMENT ON TABLE ai_agents IS 'AI agent configurations (Week 7)';
COMMENT ON TABLE agent_execution_logs IS 'AI agent execution history (Week 7)';
COMMENT ON TABLE team_members IS 'Team members for assignment agent (Week 7)';
COMMENT ON TABLE automation_templates IS 'Pre-built automation templates (Week 7)';
