-- ========================================
-- SHARED HUB DATABASE SCHEMA
-- Central identity, contacts, and event bus for all apps
-- Date: 2024-12-25
-- ========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- CORE IDENTITY TABLES
-- ========================================

-- Unified user identity (Single Sign-On)
-- This is the master user record across all apps
CREATE TABLE shared_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'UTC',
  locale TEXT DEFAULT 'en',
  metadata JSONB DEFAULT '{}',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Password/auth credentials (for email/password auth)
CREATE TABLE user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES shared_users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_updated_at TIMESTAMPTZ DEFAULT NOW(),
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- OAuth connections (Google, GitHub, etc.)
CREATE TABLE oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES shared_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google', 'github', 'microsoft', 'slack'
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

-- App-specific user connections
-- Links the shared user to their ID in each app's database
CREATE TABLE user_app_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES shared_users(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL, -- 'pulse', 'entomate', 'agentica', 'logos_crm'
  app_user_id UUID, -- User ID in that app's database
  app_role TEXT DEFAULT 'user', -- Role within that app
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}', -- App-specific user settings
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  UNIQUE(user_id, app_name)
);

-- Session management for SSO
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES shared_users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT UNIQUE,
  device_info JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- ORGANIZATIONS / TEAMS
-- ========================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  domain TEXT, -- For domain-based auto-join
  settings JSONB DEFAULT '{}',
  billing_email TEXT,
  subscription_tier TEXT DEFAULT 'free',
  created_by UUID REFERENCES shared_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES shared_users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member'
  invited_by UUID REFERENCES shared_users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- ========================================
-- UNIFIED CONTACTS (Source: Logos CRM)
-- ========================================

CREATE TABLE shared_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES shared_users(id),
  organization_id UUID REFERENCES organizations(id),

  -- Core contact info
  email TEXT,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  mobile TEXT,

  -- Company info
  company_name TEXT,
  job_title TEXT,
  department TEXT,

  -- Social profiles
  linkedin_url TEXT,
  twitter_handle TEXT,
  website TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,

  -- Tracking
  source_app TEXT NOT NULL, -- Which app created this contact
  source_id UUID NOT NULL,  -- ID in source app (Logos CRM)

  -- Enrichment data
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_app, source_id)
);

-- Contact email index for fast lookups
CREATE INDEX idx_shared_contacts_email ON shared_contacts(email);
CREATE INDEX idx_shared_contacts_owner ON shared_contacts(owner_id);
CREATE INDEX idx_shared_contacts_org ON shared_contacts(organization_id);

-- ========================================
-- SHARED COMPANIES
-- ========================================

CREATE TABLE shared_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES shared_users(id),
  organization_id UUID REFERENCES organizations(id),

  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  size TEXT, -- '1-10', '11-50', '51-200', '201-500', '500+'

  website TEXT,
  linkedin_url TEXT,
  logo_url TEXT,

  address_line1 TEXT,
  city TEXT,
  state TEXT,
  country TEXT,

  source_app TEXT NOT NULL,
  source_id UUID NOT NULL,

  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_app, source_id)
);

-- ========================================
-- CROSS-APP EVENT BUS (Real-time)
-- ========================================

CREATE TABLE cross_app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Routing
  source_app TEXT NOT NULL,
  target_app TEXT, -- NULL = broadcast to all apps

  -- Event data
  event_type TEXT NOT NULL,
  event_category TEXT, -- 'contact', 'meeting', 'deal', 'agent', 'workflow'
  payload JSONB NOT NULL,

  -- Context
  user_id UUID REFERENCES shared_users(id),
  organization_id UUID REFERENCES organizations(id),
  correlation_id UUID, -- For tracking related events

  -- Processing status
  processed_by JSONB DEFAULT '{}', -- { "entomate": "2024-01-01T...", "pulse": null }
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes for event processing
CREATE INDEX idx_events_unprocessed ON cross_app_events(target_app, created_at)
  WHERE processed_at IS NULL;
CREATE INDEX idx_events_by_type ON cross_app_events(event_type, created_at);
CREATE INDEX idx_events_by_user ON cross_app_events(user_id, created_at);
CREATE INDEX idx_events_correlation ON cross_app_events(correlation_id);

-- ========================================
-- API KEYS FOR SERVICE-TO-SERVICE
-- ========================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT UNIQUE NOT NULL, -- Store hashed, never plain
  key_prefix TEXT NOT NULL, -- First 8 chars for identification

  name TEXT NOT NULL,
  description TEXT,

  -- Ownership
  user_id UUID REFERENCES shared_users(id),
  organization_id UUID REFERENCES organizations(id),
  app_name TEXT, -- Which app this key is for

  -- Permissions
  scopes TEXT[] DEFAULT '{}', -- 'contacts:read', 'events:write', etc.

  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- AUDIT LOG
-- ========================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES shared_users(id),
  organization_id UUID REFERENCES organizations(id),
  app_name TEXT,

  action TEXT NOT NULL, -- 'user.login', 'contact.created', 'api_key.generated'
  resource_type TEXT,
  resource_id UUID,

  old_values JSONB,
  new_values JSONB,

  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id, created_at);
CREATE INDEX idx_audit_org ON audit_log(organization_id, created_at);
CREATE INDEX idx_audit_action ON audit_log(action, created_at);

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_shared_users_updated_at
  BEFORE UPDATE ON shared_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_shared_contacts_updated_at
  BEFORE UPDATE ON shared_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

ALTER TABLE shared_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_app_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON shared_users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON shared_users
  FOR UPDATE USING (auth.uid() = id);

-- Users can manage their own OAuth connections
CREATE POLICY "Users can manage own OAuth" ON oauth_connections
  FOR ALL USING (auth.uid() = user_id);

-- Users can view their app connections
CREATE POLICY "Users can view own app connections" ON user_app_connections
  FOR SELECT USING (auth.uid() = user_id);

-- Users can manage their own sessions
CREATE POLICY "Users can manage own sessions" ON user_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Organization members can view org
CREATE POLICY "Org members can view org" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Users can view contacts they own or in their org
CREATE POLICY "Users can view own contacts" ON shared_contacts
  FOR SELECT USING (
    owner_id = auth.uid() OR
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- Events visible to source/target app users
CREATE POLICY "Users can view relevant events" ON cross_app_events
  FOR SELECT USING (user_id = auth.uid());

-- Service role bypasses RLS for sync operations
-- (handled by using service key)

-- ========================================
-- REALTIME SUBSCRIPTIONS
-- ========================================

-- Enable realtime for events table
ALTER PUBLICATION supabase_realtime ADD TABLE cross_app_events;
ALTER PUBLICATION supabase_realtime ADD TABLE shared_contacts;

-- ========================================
-- INITIAL DATA
-- ========================================

-- Insert app registry
INSERT INTO user_app_connections (user_id, app_name, app_user_id) VALUES
  ('00000000-0000-0000-0000-000000000000', 'pulse', NULL),
  ('00000000-0000-0000-0000-000000000000', 'entomate', NULL),
  ('00000000-0000-0000-0000-000000000000', 'agentica', NULL),
  ('00000000-0000-0000-0000-000000000000', 'logos_crm', NULL)
ON CONFLICT DO NOTHING;
