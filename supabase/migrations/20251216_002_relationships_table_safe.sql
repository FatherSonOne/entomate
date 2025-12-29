-- Knowledge Graph: Relationships Table (Safe Migration)
-- Phase 2 Week 5 - Knowledge Graph MVP
-- This migration safely creates/updates the relationships table

-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- Create table only if it doesn't exist
-- ============================================
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id   TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_system TEXT NOT NULL DEFAULT 'entomate',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Add constraints safely (ignore if exist)
-- ============================================
DO $$
BEGIN
  -- Confidence range check
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationships_confidence_range') THEN
    ALTER TABLE relationships ADD CONSTRAINT relationships_confidence_range
      CHECK (confidence >= 0.0 AND confidence <= 1.0);
  END IF;

  -- Non-empty source_type
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationships_non_empty_source_type') THEN
    ALTER TABLE relationships ADD CONSTRAINT relationships_non_empty_source_type
      CHECK (length(trim(source_type)) > 0);
  END IF;

  -- Non-empty source_id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationships_non_empty_source_id') THEN
    ALTER TABLE relationships ADD CONSTRAINT relationships_non_empty_source_id
      CHECK (length(trim(source_id)) > 0);
  END IF;

  -- Non-empty target_type
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationships_non_empty_target_type') THEN
    ALTER TABLE relationships ADD CONSTRAINT relationships_non_empty_target_type
      CHECK (length(trim(target_type)) > 0);
  END IF;

  -- Non-empty target_id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationships_non_empty_target_id') THEN
    ALTER TABLE relationships ADD CONSTRAINT relationships_non_empty_target_id
      CHECK (length(trim(target_id)) > 0);
  END IF;

  -- Non-empty relationship_type
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationships_non_empty_relationship_type') THEN
    ALTER TABLE relationships ADD CONSTRAINT relationships_non_empty_relationship_type
      CHECK (length(trim(relationship_type)) > 0);
  END IF;

  -- No self-links
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationships_no_self_link') THEN
    ALTER TABLE relationships ADD CONSTRAINT relationships_no_self_link
      CHECK (NOT (source_type = target_type AND source_id = target_id));
  END IF;

  -- Source ID has colon prefix
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationships_source_id_has_colon') THEN
    ALTER TABLE relationships ADD CONSTRAINT relationships_source_id_has_colon
      CHECK (position(':' in source_id) > 1);
  END IF;

  -- Target ID has colon prefix
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationships_target_id_has_colon') THEN
    ALTER TABLE relationships ADD CONSTRAINT relationships_target_id_has_colon
      CHECK (position(':' in target_id) > 1);
  END IF;

  -- Unique edge constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationships_unique_edge') THEN
    ALTER TABLE relationships ADD CONSTRAINT relationships_unique_edge
      UNIQUE (source_type, source_id, target_type, target_id, relationship_type);
  END IF;
END $$;

-- ============================================
-- Create indexes safely
-- ============================================
CREATE INDEX IF NOT EXISTS idx_relationships_source
  ON relationships (source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_relationships_target
  ON relationships (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_relationships_type
  ON relationships (relationship_type);

CREATE INDEX IF NOT EXISTS idx_relationships_created_at
  ON relationships (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relationships_source_type_rel
  ON relationships (source_type, source_id, relationship_type);

CREATE INDEX IF NOT EXISTS idx_relationships_target_type_rel
  ON relationships (target_type, target_id, relationship_type);

-- ============================================
-- Trigger: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_relationships_set_updated_at ON relationships;

CREATE TRIGGER trg_relationships_set_updated_at
BEFORE UPDATE ON relationships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can view relationships" ON relationships;
DROP POLICY IF EXISTS "Users can create relationships" ON relationships;
DROP POLICY IF EXISTS "Users can update relationships" ON relationships;
DROP POLICY IF EXISTS "Users can delete relationships" ON relationships;

CREATE POLICY "Users can view relationships"
  ON relationships FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create relationships"
  ON relationships FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update relationships"
  ON relationships FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete relationships"
  ON relationships FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE relationships IS 'Knowledge Graph edges - stores relationships between entities';
COMMENT ON COLUMN relationships.source_type IS 'Entity type: meeting, deal, task, project, contact, pulse_message';
COMMENT ON COLUMN relationships.source_id IS 'Prefixed entity ID: e.g., meeting:abc-123';
COMMENT ON COLUMN relationships.relationship_type IS 'Type of relationship: meeting_mentions_deal, action_item_created_task, etc.';
COMMENT ON COLUMN relationships.confidence IS 'Confidence score 0.0-1.0 (1.0 = explicit link, lower = inferred)';
COMMENT ON COLUMN relationships.evidence IS 'JSON evidence explaining why this link exists';

-- Done!
SELECT 'Relationships table ready' as status;
