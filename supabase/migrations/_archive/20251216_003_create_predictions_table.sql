-- Predictive Analytics: Predictions Table
-- Phase 2 Week 6 - Predictive Analytics MVP
-- Stores deal probability and task ETA predictions

-- ============================================
-- Create predictions table
-- ============================================
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Prediction type: deal_close_probability | task_eta
  prediction_type TEXT NOT NULL,

  -- Entity being predicted: deal | task
  entity_type TEXT NOT NULL,

  -- Entity ID (prefixed format: deal:123, task:abc-456)
  entity_id TEXT NOT NULL,

  -- Structured prediction output (JSON)
  predicted_value JSONB NOT NULL,

  -- Human-readable explanation
  explanation TEXT NOT NULL,

  -- Model version for tracking improvements
  model_version TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Constraints
-- ============================================
DO $$
BEGIN
  -- Non-empty prediction_type
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'predictions_non_empty_prediction_type') THEN
    ALTER TABLE predictions ADD CONSTRAINT predictions_non_empty_prediction_type
      CHECK (length(trim(prediction_type)) > 0);
  END IF;

  -- Non-empty entity_type
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'predictions_non_empty_entity_type') THEN
    ALTER TABLE predictions ADD CONSTRAINT predictions_non_empty_entity_type
      CHECK (length(trim(entity_type)) > 0);
  END IF;

  -- Non-empty entity_id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'predictions_non_empty_entity_id') THEN
    ALTER TABLE predictions ADD CONSTRAINT predictions_non_empty_entity_id
      CHECK (length(trim(entity_id)) > 0);
  END IF;

  -- Entity ID has colon prefix
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'predictions_entity_id_has_colon') THEN
    ALTER TABLE predictions ADD CONSTRAINT predictions_entity_id_has_colon
      CHECK (position(':' in entity_id) > 1);
  END IF;

  -- Valid prediction types
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'predictions_valid_type') THEN
    ALTER TABLE predictions ADD CONSTRAINT predictions_valid_type
      CHECK (prediction_type IN ('deal_close_probability', 'task_eta'));
  END IF;

  -- Valid entity types
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'predictions_valid_entity_type') THEN
    ALTER TABLE predictions ADD CONSTRAINT predictions_valid_entity_type
      CHECK (entity_type IN ('deal', 'task'));
  END IF;
END $$;

-- ============================================
-- Indexes for Performance
-- ============================================

-- Fast lookups by entity
CREATE INDEX IF NOT EXISTS idx_predictions_entity
  ON predictions (entity_type, entity_id);

-- Filter by prediction type
CREATE INDEX IF NOT EXISTS idx_predictions_type
  ON predictions (prediction_type);

-- Get latest predictions
CREATE INDEX IF NOT EXISTS idx_predictions_created_at
  ON predictions (created_at DESC);

-- Composite: get latest prediction for entity + type
CREATE INDEX IF NOT EXISTS idx_predictions_entity_type_latest
  ON predictions (entity_type, entity_id, prediction_type, created_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view predictions" ON predictions;
DROP POLICY IF EXISTS "Users can create predictions" ON predictions;

CREATE POLICY "Users can view predictions"
  ON predictions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create predictions"
  ON predictions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE predictions IS 'Stores predictive analytics results for deals and tasks';
COMMENT ON COLUMN predictions.prediction_type IS 'Type: deal_close_probability or task_eta';
COMMENT ON COLUMN predictions.entity_type IS 'Entity being predicted: deal or task';
COMMENT ON COLUMN predictions.entity_id IS 'Prefixed entity ID: deal:123, task:abc-456';
COMMENT ON COLUMN predictions.predicted_value IS 'JSON with probability, dates, confidence, etc.';
COMMENT ON COLUMN predictions.explanation IS 'Human-readable explanation of prediction factors';
COMMENT ON COLUMN predictions.model_version IS 'Model version for tracking (e.g., baseline_v1)';

-- Done!
SELECT 'Predictions table ready' as status;
