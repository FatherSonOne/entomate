-- ========================================
-- Migration: Create Ecosystem Bridge Tables
-- Date: 2026-03-26
-- Purpose: Enable cross-app communication between Entomate, Pulse, and Logos Vision
-- ========================================

-- Table: ecosystem_config
-- Stores connection details for each connected app in the ecosystem
CREATE TABLE IF NOT EXISTS ecosystem_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT NOT NULL UNIQUE,                    -- 'pulse', 'logos_vision'
  display_name TEXT NOT NULL,                       -- 'Pulse', 'Logos Vision'
  api_url TEXT NOT NULL,                            -- Base URL for the app's inbound endpoint
  service_token TEXT NOT NULL,                      -- Token Entomate sends TO this app
  inbound_token TEXT NOT NULL,                      -- Token this app sends TO Entomate
  enabled BOOLEAN NOT NULL DEFAULT true,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,      -- Feature flags per app (e.g. {"sync_meetings": true})
  last_heartbeat TIMESTAMPTZ,                       -- Last successful health check
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: ecosystem_events
-- Audit log of all cross-app events (inbound and outbound)
CREATE TABLE IF NOT EXISTS ecosystem_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,                           -- Unique event identifier (for dedup)
  source TEXT NOT NULL,                             -- 'entomate', 'pulse', 'logos_vision'
  target_app TEXT,                                  -- Destination app (null for inbound)
  event_type TEXT NOT NULL,                         -- e.g. 'meeting.processed', 'task.completed'
  entity_type TEXT,                                 -- e.g. 'meeting', 'task', 'contact'
  entity_id TEXT,                                   -- Source entity ID
  direction TEXT NOT NULL DEFAULT 'outbound',       -- 'inbound' or 'outbound'
  status TEXT NOT NULL DEFAULT 'pending',           -- 'pending', 'sent', 'delivered', 'failed'
  payload JSONB,                                    -- Full event payload
  response_data JSONB,                              -- Response from target app
  error_message TEXT,                               -- Error details if failed
  processing_time_ms INTEGER,                       -- Round-trip time
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: ecosystem_entity_map
-- Maps entity IDs across apps (e.g. Entomate task ID <-> Logos Vision task ID)
CREATE TABLE IF NOT EXISTS ecosystem_entity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_entity_type TEXT NOT NULL,                  -- 'meeting', 'action_item', 'project'
  local_entity_id UUID NOT NULL,
  remote_app TEXT NOT NULL,                         -- 'pulse', 'logos_vision'
  remote_entity_type TEXT NOT NULL,                 -- Type in the remote app
  remote_entity_id TEXT NOT NULL,                   -- ID in the remote app (text for flexibility)
  metadata JSONB DEFAULT '{}'::jsonb,               -- Additional mapping context
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(local_entity_type, local_entity_id, remote_app)
);

-- ==================== INDEXES ====================

CREATE INDEX idx_ecosystem_events_source ON ecosystem_events(source);
CREATE INDEX idx_ecosystem_events_event_type ON ecosystem_events(event_type);
CREATE INDEX idx_ecosystem_events_status ON ecosystem_events(status);
CREATE INDEX idx_ecosystem_events_direction ON ecosystem_events(direction);
CREATE INDEX idx_ecosystem_events_created_at ON ecosystem_events(created_at DESC);
CREATE INDEX idx_ecosystem_events_retry ON ecosystem_events(status, next_retry_at)
  WHERE status = 'failed' AND next_retry_at IS NOT NULL;

CREATE INDEX idx_ecosystem_entity_map_local ON ecosystem_entity_map(local_entity_type, local_entity_id);
CREATE INDEX idx_ecosystem_entity_map_remote ON ecosystem_entity_map(remote_app, remote_entity_id);

-- ==================== RLS POLICIES ====================

ALTER TABLE ecosystem_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecosystem_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecosystem_entity_map ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read ecosystem config
CREATE POLICY "Users can view ecosystem config"
  ON ecosystem_config FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can modify ecosystem config
CREATE POLICY "Service role can manage ecosystem config"
  ON ecosystem_config FOR ALL
  USING (auth.role() = 'service_role');

-- Allow authenticated users to read ecosystem events
CREATE POLICY "Users can view ecosystem events"
  ON ecosystem_events FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role can manage events
CREATE POLICY "Service role can manage ecosystem events"
  ON ecosystem_events FOR ALL
  USING (auth.role() = 'service_role');

-- Allow authenticated users to read entity mappings
CREATE POLICY "Users can view entity mappings"
  ON ecosystem_entity_map FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role can manage entity mappings
CREATE POLICY "Service role can manage entity mappings"
  ON ecosystem_entity_map FOR ALL
  USING (auth.role() = 'service_role');

-- ==================== TRIGGERS ====================

-- Auto-update updated_at on ecosystem_config changes
CREATE OR REPLACE FUNCTION update_ecosystem_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ecosystem_config_updated
  BEFORE UPDATE ON ecosystem_config
  FOR EACH ROW
  EXECUTE FUNCTION update_ecosystem_config_timestamp();

-- ==================== SEED: Pre-populate known ecosystem apps ====================
-- Apps are created disabled with placeholder tokens — user only needs to generate
-- real tokens in Settings → Ecosystem Bridge and toggle enabled.

INSERT INTO ecosystem_config (app_name, display_name, api_url, service_token, inbound_token, enabled, features)
VALUES
  (
    'pulse',
    'Pulse',
    'https://ucaeuszgoihoyrvhewxk.supabase.co/functions/v1/ecosystem-inbound',
    'PLACEHOLDER_GENERATE_IN_SETTINGS',
    'PLACEHOLDER_GENERATE_IN_SETTINGS',
    false,
    '{"sync_meetings": true, "notifications": true}'::jsonb
  ),
  (
    'logos_vision',
    'Logos Vision',
    'https://psjgmdnrehcwvppbeqjy.supabase.co/functions/v1/ecosystem-inbound',
    'PLACEHOLDER_GENERATE_IN_SETTINGS',
    'PLACEHOLDER_GENERATE_IN_SETTINGS',
    false,
    '{"sync_meetings": true, "sync_tasks": true, "sync_contacts": true}'::jsonb
  )
ON CONFLICT (app_name) DO NOTHING;
