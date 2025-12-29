-- ========================================
-- Migration: 004_secrets_vault
-- Purpose: Secure secrets storage for workflows
-- Date: 2024-12-25
-- ========================================

-- ========================================
-- SECTION 1: SECRETS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scope VARCHAR(20) NOT NULL DEFAULT 'user',
  environment VARCHAR(20) NOT NULL DEFAULT 'production',
  encrypted_value TEXT NOT NULL,
  value_type VARCHAR(50) DEFAULT 'string',
  encryption_version INTEGER DEFAULT 1,
  -- No FK constraints - tables may not exist
  user_id UUID NOT NULL,
  organization_id UUID,
  workflow_id UUID,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name, scope, environment)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_secrets_user ON secrets(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_secrets_org ON secrets(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_secrets_workflow ON secrets(workflow_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_secrets_scope ON secrets(scope) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_secrets_name ON secrets(name) WHERE deleted_at IS NULL;

-- ========================================
-- SECTION 2: SECRETS AUDIT LOG TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS secrets_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  secret_id UUID NOT NULL,
  secret_name VARCHAR(255) NOT NULL,
  action VARCHAR(20) NOT NULL,
  user_id UUID,
  user_email VARCHAR(255),
  access_method VARCHAR(50),
  workflow_id UUID,
  workflow_execution_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secrets_audit_secret ON secrets_audit_log(secret_id);
CREATE INDEX IF NOT EXISTS idx_secrets_audit_user ON secrets_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_secrets_audit_action ON secrets_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_secrets_audit_created ON secrets_audit_log(created_at DESC);

-- ========================================
-- SECTION 3: SECRET REFERENCES TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS secret_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  secret_id UUID NOT NULL,
  workflow_id UUID NOT NULL,
  node_id VARCHAR(100) NOT NULL,
  reference_expression VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(secret_id, workflow_id, node_id, reference_expression)
);

CREATE INDEX IF NOT EXISTS idx_secret_refs_secret ON secret_references(secret_id);
CREATE INDEX IF NOT EXISTS idx_secret_refs_workflow ON secret_references(workflow_id);

-- ========================================
-- SECTION 4: ROW LEVEL SECURITY
-- ========================================

ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_references ENABLE ROW LEVEL SECURITY;

-- Simple RLS: users own their secrets, service role has full access
CREATE POLICY "users_own_secrets" ON secrets
  FOR ALL USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "service_secrets" ON secrets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "users_view_audit" ON secrets_audit_log
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "service_audit" ON secrets_audit_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "users_manage_refs" ON secret_references
  FOR ALL USING (secret_id IN (SELECT id FROM secrets WHERE user_id = auth.uid()));

CREATE POLICY "service_refs" ON secret_references
  FOR ALL USING (auth.role() = 'service_role');

-- ========================================
-- SECTION 5: HELPER FUNCTIONS
-- ========================================

CREATE OR REPLACE FUNCTION is_secret_expired(p_secret_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT expires_at INTO v_expires_at FROM secrets WHERE id = p_secret_id;
  IF v_expires_at IS NULL THEN RETURN FALSE; END IF;
  RETURN v_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- SECTION 6: TRIGGERS
-- ========================================

CREATE OR REPLACE FUNCTION log_secret_create()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO secrets_audit_log (secret_id, secret_name, action, user_id, access_method)
  VALUES (NEW.id, NEW.name, 'created', NEW.user_id, 'api');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS secret_create_trigger ON secrets;
CREATE TRIGGER secret_create_trigger
  AFTER INSERT ON secrets
  FOR EACH ROW EXECUTE FUNCTION log_secret_create();

CREATE OR REPLACE FUNCTION log_secret_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.encrypted_value IS DISTINCT FROM NEW.encrypted_value THEN
    INSERT INTO secrets_audit_log (secret_id, secret_name, action, user_id, access_method)
    VALUES (NEW.id, NEW.name, 'updated', auth.uid(), 'api');
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS secret_update_trigger ON secrets;
CREATE TRIGGER secret_update_trigger
  BEFORE UPDATE ON secrets
  FOR EACH ROW EXECUTE FUNCTION log_secret_update();

-- ========================================
-- SECTION 7: GRANTS
-- ========================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON secrets TO authenticated;
GRANT ALL ON secrets_audit_log TO authenticated;
GRANT ALL ON secret_references TO authenticated;
GRANT EXECUTE ON FUNCTION is_secret_expired TO authenticated;
