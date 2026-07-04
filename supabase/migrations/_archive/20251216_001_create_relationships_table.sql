-- Knowledge Graph: Relationships Table
-- Phase 2 Week 5 - Knowledge Graph MVP
-- Run this migration in Supabase SQL Editor

-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- Core Knowledge Graph Table: relationships
-- ============================================
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source entity
  source_type TEXT NOT NULL,
  source_id   TEXT NOT NULL,

  -- Target entity
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,

  -- Relationship metadata
  relationship_type TEXT NOT NULL,

  -- Confidence score (0.0 to 1.0)
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,

  -- Evidence for why this link exists
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Tracking
  source_system TEXT NOT NULL DEFAULT 'entomate',
  created_by TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ============================================
  -- Constraints
  -- ============================================

  -- Confidence must be between 0 and 1
  CONSTRAINT relationships_confidence_range
    CHECK (confidence >= 0.0 AND confidence <= 1.0),

  -- Non-empty fields
  CONSTRAINT relationships_non_empty_source_type
    CHECK (length(trim(source_type)) > 0),
  CONSTRAINT relationships_non_empty_source_id
    CHECK (length(trim(source_id)) > 0),
  CONSTRAINT relationships_non_empty_target_type
    CHECK (length(trim(target_type)) > 0),
  CONSTRAINT relationships_non_empty_target_id
    CHECK (length(trim(target_id)) > 0),
  CONSTRAINT relationships_non_empty_relationship_type
    CHECK (length(trim(relationship_type)) > 0),

  -- Prevent self-links (same entity linking to itself)
  CONSTRAINT relationships_no_self_link
    CHECK (
      NOT (
        source_type = target_type
        AND source_id = target_id
      )
    ),

  -- IDs must be prefixed (e.g., "meeting:abc-123")
  CONSTRAINT relationships_source_id_has_colon
    CHECK (position(':' in source_id) > 1),
  CONSTRAINT relationships_target_id_has_colon
    CHECK (position(':' in target_id) > 1)
);

-- ============================================
-- Unique Constraint (prevents duplicates)
-- ============================================
ALTER TABLE relationships
  ADD CONSTRAINT relationships_unique_edge
  UNIQUE (source_type, source_id, target_type, target_id, relationship_type);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Fast lookups for outgoing links (get all links FROM an entity)
CREATE INDEX IF NOT EXISTS idx_relationships_source
  ON relationships (source_type, source_id);

-- Fast lookups for incoming links (get all links TO an entity)
CREATE INDEX IF NOT EXISTS idx_relationships_target
  ON relationships (target_type, target_id);

-- Filter by relationship type
CREATE INDEX IF NOT EXISTS idx_relationships_type
  ON relationships (relationship_type);

-- Sort by most recent
CREATE INDEX IF NOT EXISTS idx_relationships_created_at
  ON relationships (created_at DESC);

-- Composite indexes for common queries with relationship type filter
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

-- Allow authenticated users to read all relationships
CREATE POLICY "Users can view relationships"
  ON relationships FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert relationships
CREATE POLICY "Users can create relationships"
  ON relationships FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update their own relationships
CREATE POLICY "Users can update relationships"
  ON relationships FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete relationships
CREATE POLICY "Users can delete relationships"
  ON relationships FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE relationships IS 'Knowledge Graph edges - stores relationships between entities';
COMMENT ON COLUMN relationships.source_type IS 'Entity type: meeting, deal, task, project, contact, pulse_message';
COMMENT ON COLUMN relationships.source_id IS 'Prefixed entity ID: e.g., meeting:abc-123';
COMMENT ON COLUMN relationships.relationship_type IS 'Type of relationship: meeting_mentions_deal, action_item_created_task, etc.';
COMMENT ON COLUMN relationships.confidence IS 'Confidence score 0.0-1.0 (1.0 = explicit link, lower = inferred)';
COMMENT ON COLUMN relationships.evidence IS 'JSON evidence explaining why this link exists';
