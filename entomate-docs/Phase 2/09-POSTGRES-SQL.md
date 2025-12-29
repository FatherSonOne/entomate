Below is exact Postgres SQL to create the relationships table, the required indexes, and the dedupe unique constraint (plus a couple of safe extras like updated_at and basic checks).

sql
-- Recommended: enable gen_random_uuid() for UUID defaults
-- (requires pgcrypto extension)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core Knowledge Graph table
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source_type TEXT NOT NULL,
  source_id   TEXT NOT NULL,

  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,

  relationship_type TEXT NOT NULL,

  -- Optional but recommended
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  evidence   JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Guardrails (keep data clean)
  CONSTRAINT relationships_confidence_range
    CHECK (confidence >= 0.0 AND confidence <= 1.0),

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

  -- Prevent self-links that usually indicate a bug
  CONSTRAINT relationships_no_self_link
    CHECK (
      NOT (
        source_type = target_type
        AND source_id = target_id
        AND relationship_type IS NOT NULL
      )
    )
);

-- Unique constraint for dedupe (the "no duplicates" rule)
-- This is what makes ON CONFLICT (...) work in the Node.js upsert.
ALTER TABLE relationships
  ADD CONSTRAINT relationships_unique_edge
  UNIQUE (source_type, source_id, target_type, target_id, relationship_type);

-- Fast lookups for the two common query patterns:
-- 1) get outgoing links for an entity
CREATE INDEX IF NOT EXISTS idx_relationships_source
  ON relationships (source_type, source_id);

-- 2) get incoming links for an entity
CREATE INDEX IF NOT EXISTS idx_relationships_target
  ON relationships (target_type, target_id);

-- Helpful when filtering or counting by relationship type
CREATE INDEX IF NOT EXISTS idx_relationships_type
  ON relationships (relationship_type);

-- Useful if you show "most recent links" in UI
CREATE INDEX IF NOT EXISTS idx_relationships_created_at
  ON relationships (created_at DESC);

-- Optional: automatically keep updated_at current
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

If the IDs in your system are always UUIDs (not CRM string IDs), say so and a UUID-typed version of source_id / target_id can be provided.