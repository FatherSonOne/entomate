-- Relationships Table Optimizations
-- Phase 2 - Optional Enhancements from File 12
-- Adds: rule_version, soft delete, relationship audit log

-- ============================================
-- 1. Rule Versioning Column
-- Track which version of rules created the link
-- ============================================
ALTER TABLE relationships
  ADD COLUMN IF NOT EXISTS rule_version TEXT NOT NULL DEFAULT 'v1';

COMMENT ON COLUMN relationships.rule_version IS 'Version of rules that created this link (e.g., v1, v2)';

-- ============================================
-- 2. Soft Delete Support
-- Hide wrong links without losing history
-- ============================================
ALTER TABLE relationships
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE relationships
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE relationships
  ADD COLUMN IF NOT EXISTS deleted_by TEXT;

COMMENT ON COLUMN relationships.is_deleted IS 'Soft delete flag - true means hidden but not removed';
COMMENT ON COLUMN relationships.deleted_at IS 'When the relationship was soft-deleted';
COMMENT ON COLUMN relationships.deleted_by IS 'Who deleted this: user:<id> or agent:<id> or system';

-- Partial indexes for active (non-deleted) relationships
-- These replace the original indexes for most queries
CREATE INDEX IF NOT EXISTS idx_relationships_active_source
  ON relationships (source_type, source_id)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_relationships_active_target
  ON relationships (target_type, target_id)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_relationships_active_type
  ON relationships (relationship_type)
  WHERE is_deleted = FALSE;

-- ============================================
-- 3. Relationship Audit Log Table
-- Track created/updated/deleted events for debugging
-- ============================================
CREATE TABLE IF NOT EXISTS relationship_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The relationship this event is about
  relationship_id UUID NOT NULL,

  -- Event type: created, updated, deleted, restored
  event_type TEXT NOT NULL,

  -- Who triggered this event
  actor TEXT, -- user:<id>, agent:<id>, system, job:<name>

  -- What changed (for updates)
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- When it happened
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationship_events_valid_type') THEN
    ALTER TABLE relationship_events ADD CONSTRAINT relationship_events_valid_type
      CHECK (event_type IN ('created', 'updated', 'deleted', 'restored'));
  END IF;
END $$;

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_relationship_events_relationship
  ON relationship_events (relationship_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relationship_events_type
  ON relationship_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relationship_events_created_at
  ON relationship_events (created_at DESC);

-- ============================================
-- Row Level Security for audit log
-- ============================================
ALTER TABLE relationship_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relationship events" ON relationship_events;
DROP POLICY IF EXISTS "Users can create relationship events" ON relationship_events;

CREATE POLICY "Users can view relationship events"
  ON relationship_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create relationship events"
  ON relationship_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- Trigger: Auto-log relationship changes
-- ============================================
CREATE OR REPLACE FUNCTION log_relationship_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO relationship_events (relationship_id, event_type, actor, event_payload)
    VALUES (
      NEW.id,
      'created',
      NEW.created_by,
      jsonb_build_object(
        'source_type', NEW.source_type,
        'source_id', NEW.source_id,
        'target_type', NEW.target_type,
        'target_id', NEW.target_id,
        'relationship_type', NEW.relationship_type
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log soft delete as 'deleted' event
    IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
      INSERT INTO relationship_events (relationship_id, event_type, actor, event_payload)
      VALUES (
        NEW.id,
        'deleted',
        NEW.deleted_by,
        jsonb_build_object('reason', 'soft_delete')
      );
    -- Log restore as 'restored' event
    ELSIF OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE THEN
      INSERT INTO relationship_events (relationship_id, event_type, actor, event_payload)
      VALUES (
        NEW.id,
        'restored',
        NULL,
        jsonb_build_object('reason', 'restored')
      );
    -- Log other updates
    ELSE
      INSERT INTO relationship_events (relationship_id, event_type, actor, event_payload)
      VALUES (
        NEW.id,
        'updated',
        NULL,
        jsonb_build_object(
          'old_confidence', OLD.confidence,
          'new_confidence', NEW.confidence,
          'evidence_changed', OLD.evidence IS DISTINCT FROM NEW.evidence
        )
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_relationship_event ON relationships;

CREATE TRIGGER trg_log_relationship_event
AFTER INSERT OR UPDATE ON relationships
FOR EACH ROW
EXECUTE FUNCTION log_relationship_event();

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE relationship_events IS 'Audit log for relationship changes - tracks created/updated/deleted events';
COMMENT ON COLUMN relationship_events.event_type IS 'Type of event: created, updated, deleted, restored';
COMMENT ON COLUMN relationship_events.actor IS 'Who triggered this: user:<id>, agent:<id>, system, job:<name>';
COMMENT ON COLUMN relationship_events.event_payload IS 'JSON details about what changed';

-- ============================================
-- Helper function: Soft delete a relationship
-- ============================================
CREATE OR REPLACE FUNCTION soft_delete_relationship(
  p_relationship_id UUID,
  p_deleted_by TEXT DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE relationships
  SET
    is_deleted = TRUE,
    deleted_at = NOW(),
    deleted_by = p_deleted_by
  WHERE id = p_relationship_id
    AND is_deleted = FALSE;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Helper function: Restore a soft-deleted relationship
-- ============================================
CREATE OR REPLACE FUNCTION restore_relationship(p_relationship_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  affected INT;
BEGIN
  UPDATE relationships
  SET
    is_deleted = FALSE,
    deleted_at = NULL,
    deleted_by = NULL
  WHERE id = p_relationship_id
    AND is_deleted = TRUE;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Helper function: Hard delete old soft-deleted relationships
-- (Run periodically to clean up, e.g., monthly)
-- ============================================
CREATE OR REPLACE FUNCTION purge_deleted_relationships(p_older_than_days INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM relationships
  WHERE is_deleted = TRUE
    AND deleted_at < NOW() - (p_older_than_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Done!
SELECT 'Relationships optimizations applied' as status;
