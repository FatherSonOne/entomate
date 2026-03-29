-- ========================================
-- LOCAL HUB TABLES (Single-DB Mode)
-- For development when HUB_SUPABASE_URL is not set
-- Date: 2026-03-23
-- ========================================
-- Run this ONLY if using a single Supabase instance.
-- If you have a dedicated hub DB, use 001_hub_schema.sql instead.

-- Shared contacts (unified contact records from all apps)
CREATE TABLE IF NOT EXISTS shared_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  company_name TEXT,
  job_title TEXT,
  department TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,
  address JSONB,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  source TEXT DEFAULT 'entomate',
  owner_id UUID,
  organization_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_contacts_email ON shared_contacts(email);
CREATE INDEX IF NOT EXISTS idx_shared_contacts_owner ON shared_contacts(owner_id);

-- Cross-app event bus
CREATE TABLE IF NOT EXISTS cross_app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app TEXT NOT NULL,
  target_app TEXT,
  event_type TEXT NOT NULL,
  event_category TEXT,
  payload JSONB NOT NULL,
  user_id UUID,
  organization_id UUID,
  correlation_id UUID,
  processed_by JSONB DEFAULT '{}',
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_events_unprocessed ON cross_app_events(target_app, created_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_by_type ON cross_app_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON cross_app_events(correlation_id);

-- Enable realtime on events for live subscriptions (skip if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cross_app_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cross_app_events;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shared_contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shared_contacts;
  END IF;
END $$;
