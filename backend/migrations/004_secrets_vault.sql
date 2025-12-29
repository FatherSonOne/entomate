-- ========================================
-- Migration: 004_secrets_vault
-- Purpose: Secure secrets storage for workflows
-- Date: 2024-12-25
-- ========================================

-- ========================================
-- SECTION 1: SECRETS TABLE
-- Encrypted storage for API keys, credentials, and sensitive data
-- ========================================

CREATE TABLE IF NOT EXISTS secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Secret identification
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Scoping: user, organization, or workflow-specific
  scope VARCHAR(20) NOT NULL DEFAULT 'user',
  -- Values: user, organization, workflow

  -- Environment support
  environment VARCHAR(20) NOT NULL DEFAULT 'production',
  -- Values: development, staging, production

  -- Encrypted value (AES-256-GCM encrypted at application layer)
  -- Format: iv:authTag:encryptedData (all base64 encoded)
  encrypted_value TEXT NOT NULL,

  -- Value metadata (not encrypted)
  value_type VARCHAR(50) DEFAULT 'string',
  -- Values: string, json, certificate, api_key, oauth_token

  -- Encryption metadata
  encryption_version INTEGER DEFAULT 1,
  -- Allows for key rotation in future

  -- Ownership
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,

  -- Usage tracking (for security monitoring)
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,

  -- Expiration (optional, for rotating secrets)
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Soft delete for audit trail
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique name per user per scope per environment
  UNIQUE(user_id, name, scope, environment)
);

-- Indexes for secrets
CREATE INDEX idx_secrets_user ON secrets(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_secrets_org ON secrets(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_secrets_workflow ON secrets(workflow_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_secrets_scope ON secrets(scope) WHERE deleted_at IS NULL;
CREATE INDEX idx_secrets_environment ON secrets(environment) WHERE deleted_at IS NULL;
CREATE INDEX idx_secrets_name ON secrets(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_secrets_expires ON secrets(expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE secrets IS 'Encrypted secrets storage with scoping and audit capabilities';
COMMENT ON COLUMN secrets.encrypted_value IS 'AES-256-GCM encrypted value in format: iv:authTag:encryptedData';
COMMENT ON COLUMN secrets.encryption_version IS 'Version of encryption key for future key rotation';

-- ========================================
-- SECTION 2: SECRETS AUDIT LOG TABLE
-- Track all access to secrets for security auditing
-- ========================================

CREATE TABLE IF NOT EXISTS secrets_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference to secret
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,
  secret_name VARCHAR(255) NOT NULL,

  -- Action performed
  action VARCHAR(20) NOT NULL,
  -- Values: created, read, updated, deleted, accessed, rotated

  -- Who performed the action
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),

  -- How it was accessed
  access_method VARCHAR(50),
  -- Values: api, workflow, manual, system

  -- Context of access
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,

  -- Request metadata (for security investigation)
  ip_address INET,
  user_agent TEXT,

  -- Additional context
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit log
CREATE INDEX idx_secrets_audit_secret ON secrets_audit_log(secret_id);
CREATE INDEX idx_secrets_audit_user ON secrets_audit_log(user_id);
CREATE INDEX idx_secrets_audit_action ON secrets_audit_log(action);
CREATE INDEX idx_secrets_audit_created ON secrets_audit_log(created_at DESC);
CREATE INDEX idx_secrets_audit_workflow ON secrets_audit_log(workflow_id);

-- Partition audit log by month for better performance on large datasets
-- (Optional: Enable if expecting high volume)
-- CREATE INDEX idx_secrets_audit_created_month ON secrets_audit_log(date_trunc('month', created_at));

COMMENT ON TABLE secrets_audit_log IS 'Immutable audit trail for all secret access and modifications';

-- ========================================
-- SECTION 3: SECRET REFERENCES TABLE
-- Track which workflows use which secrets
-- ========================================

CREATE TABLE IF NOT EXISTS secret_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Which secret is referenced
  secret_id UUID NOT NULL REFERENCES secrets(id) ON DELETE CASCADE,

  -- Where it's referenced
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,

  -- Reference expression (e.g., "{{secrets.API_KEY}}")
  reference_expression VARCHAR(255) NOT NULL,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique reference per node
  UNIQUE(secret_id, workflow_id, node_id, reference_expression)
);

CREATE INDEX idx_secret_refs_secret ON secret_references(secret_id);
CREATE INDEX idx_secret_refs_workflow ON secret_references(workflow_id);

COMMENT ON TABLE secret_references IS 'Tracks where secrets are used in workflows';

-- ========================================
-- SECTION 4: ROW LEVEL SECURITY
-- ========================================

-- Enable RLS
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_references ENABLE ROW LEVEL SECURITY;

-- Secrets: Users can only access their own secrets
-- Organization admins can access organization-scoped secrets
CREATE POLICY "users_manage_own_secrets" ON secrets
  FOR ALL USING (
    user_id = auth.uid() OR
    (
      scope = 'organization' AND
      organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
      )
    )
  );

-- Audit log: Users can view audit entries for their secrets
CREATE POLICY "users_view_own_audit" ON secrets_audit_log
  FOR SELECT USING (
    user_id = auth.uid() OR
    secret_id IN (SELECT id FROM secrets WHERE user_id = auth.uid())
  );

-- Secret references: Users can manage references in their workflows
CREATE POLICY "users_manage_secret_refs" ON secret_references
  FOR ALL USING (
    workflow_id IN (
      SELECT id FROM workflows
      WHERE user_id = auth.uid() OR
            team_id IN (SELECT team_id FROM users WHERE id = auth.uid())
    )
  );

-- ========================================
-- SECTION 5: HELPER FUNCTIONS
-- ========================================

-- Function to log secret access
CREATE OR REPLACE FUNCTION log_secret_access(
  p_secret_id UUID,
  p_action VARCHAR(20),
  p_access_method VARCHAR(50) DEFAULT 'api',
  p_workflow_id UUID DEFAULT NULL,
  p_execution_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_secret_name VARCHAR(255);
  v_user_email VARCHAR(255);
BEGIN
  -- Get secret name
  SELECT name INTO v_secret_name FROM secrets WHERE id = p_secret_id;

  -- Get user email
  SELECT email INTO v_user_email FROM users WHERE id = auth.uid();

  -- Insert audit log
  INSERT INTO secrets_audit_log (
    secret_id, secret_name, action, user_id, user_email,
    access_method, workflow_id, workflow_execution_id, metadata
  ) VALUES (
    p_secret_id, v_secret_name, p_action, auth.uid(), v_user_email,
    p_access_method, p_workflow_id, p_execution_id, p_metadata
  ) RETURNING id INTO v_log_id;

  -- Update access stats on secret
  IF p_action = 'read' OR p_action = 'accessed' THEN
    UPDATE secrets
    SET last_accessed_at = NOW(), access_count = access_count + 1
    WHERE id = p_secret_id;
  END IF;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a secret is expired
CREATE OR REPLACE FUNCTION is_secret_expired(p_secret_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT expires_at INTO v_expires_at FROM secrets WHERE id = p_secret_id;

  IF v_expires_at IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to soft delete a secret
CREATE OR REPLACE FUNCTION soft_delete_secret(p_secret_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE secrets
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = p_secret_id AND user_id = auth.uid() AND deleted_at IS NULL;

  IF FOUND THEN
    -- Log the deletion
    PERFORM log_secret_access(p_secret_id, 'deleted', 'api');
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rotate a secret (mark old as expired, create new)
CREATE OR REPLACE FUNCTION rotate_secret(
  p_secret_id UUID,
  p_new_encrypted_value TEXT
)
RETURNS UUID AS $$
DECLARE
  v_old_secret RECORD;
  v_new_secret_id UUID;
BEGIN
  -- Get old secret
  SELECT * INTO v_old_secret
  FROM secrets
  WHERE id = p_secret_id AND user_id = auth.uid() AND deleted_at IS NULL;

  IF v_old_secret IS NULL THEN
    RAISE EXCEPTION 'Secret not found or access denied';
  END IF;

  -- Mark old secret as deleted
  UPDATE secrets
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = p_secret_id;

  -- Create new secret with same name
  INSERT INTO secrets (
    name, description, scope, environment, encrypted_value, value_type,
    encryption_version, user_id, organization_id, workflow_id
  ) VALUES (
    v_old_secret.name,
    v_old_secret.description,
    v_old_secret.scope,
    v_old_secret.environment,
    p_new_encrypted_value,
    v_old_secret.value_type,
    v_old_secret.encryption_version,
    v_old_secret.user_id,
    v_old_secret.organization_id,
    v_old_secret.workflow_id
  ) RETURNING id INTO v_new_secret_id;

  -- Log the rotation
  PERFORM log_secret_access(v_new_secret_id, 'rotated', 'api', NULL, NULL,
    jsonb_build_object('previous_secret_id', p_secret_id));

  RETURN v_new_secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- SECTION 6: TRIGGERS
-- ========================================

-- Trigger to auto-log secret creation
CREATE OR REPLACE FUNCTION log_secret_create()
RETURNS TRIGGER AS $$
BEGIN
  -- Log creation (don't use log_secret_access to avoid recursion)
  INSERT INTO secrets_audit_log (
    secret_id, secret_name, action, user_id, access_method
  ) VALUES (
    NEW.id, NEW.name, 'created', NEW.user_id, 'api'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS secret_create_trigger ON secrets;
CREATE TRIGGER secret_create_trigger
  AFTER INSERT ON secrets
  FOR EACH ROW
  EXECUTE FUNCTION log_secret_create();

-- Trigger to auto-log secret updates
CREATE OR REPLACE FUNCTION log_secret_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if the encrypted value changed (actual secret rotation)
  IF OLD.encrypted_value IS DISTINCT FROM NEW.encrypted_value THEN
    INSERT INTO secrets_audit_log (
      secret_id, secret_name, action, user_id, access_method,
      metadata
    ) VALUES (
      NEW.id, NEW.name, 'updated', auth.uid(), 'api',
      jsonb_build_object('changed_fields', ARRAY['encrypted_value'])
    );
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS secret_update_trigger ON secrets;
CREATE TRIGGER secret_update_trigger
  BEFORE UPDATE ON secrets
  FOR EACH ROW
  EXECUTE FUNCTION log_secret_update();

-- ========================================
-- SECTION 7: INDEXES FOR PERFORMANCE
-- ========================================

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_secrets_user_scope_env
  ON secrets(user_id, scope, environment)
  WHERE deleted_at IS NULL;

-- Full-text search on secret names and descriptions
CREATE INDEX IF NOT EXISTS idx_secrets_search
  ON secrets USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ========================================
-- COMPLETE
-- ========================================
COMMENT ON FUNCTION log_secret_access IS 'Log access to secrets for audit trail';
COMMENT ON FUNCTION is_secret_expired IS 'Check if a secret has expired';
COMMENT ON FUNCTION soft_delete_secret IS 'Soft delete a secret with audit logging';
COMMENT ON FUNCTION rotate_secret IS 'Rotate a secret while maintaining name';
