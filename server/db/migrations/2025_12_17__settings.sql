-- SETTINGS: user + workspace
-- Assumes you already have users + workspaces tables. If not, keep UUIDs and wire later.

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY,
  theme_mode TEXT NOT NULL DEFAULT 'system',     -- system | light | dark
  accent_mode TEXT NOT NULL DEFAULT 'system',    -- system | custom
  accent_color TEXT NOT NULL DEFAULT '#00A86B',  -- hex
  reduce_motion BOOLEAN NOT NULL DEFAULT false,

  notifications_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  meetings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id UUID PRIMARY KEY,
  integrations_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  security_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_controls_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Minimal audit log table for settings + admin actions (Phase 3 requirement)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  actor_user_id UUID,
  action TEXT NOT NULL,                 -- e.g. 'settings.user.update', 'settings.workspace.update', 'integration.test'
  entity_type TEXT,                     -- 'user_settings' | 'workspace_settings' | 'integration'
  entity_id TEXT,                       -- user_id or workspace_id or integration id
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_time ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
