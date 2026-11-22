-- ========================================
-- Migration: give workflow_executions the columns the engine writes
-- Date: 2026-11-22
--
-- WorkflowExecutor.saveExecution and GET /api/workflows/:id/executions use
-- columns the live table never had (mode, finished_at, duration_ms, ...), so
-- every run failed to save and the run history was always empty. Add them.
-- Additive only: no column is dropped or changed.
-- ========================================

ALTER TABLE public.workflow_executions
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS input_data jsonb,
  ADD COLUMN IF NOT EXISTS output_data jsonb,
  ADD COLUMN IF NOT EXISTS node_executions jsonb,
  ADD COLUMN IF NOT EXISTS current_node_id text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS error_node_id text,
  ADD COLUMN IF NOT EXISTS error_stack text,
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS triggered_by text,
  ADD COLUMN IF NOT EXISTS user_id text;

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_started
  ON public.workflow_executions (workflow_id, started_at DESC);

-- The engine upserts on id, which needs a unique key; the live table had none.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.workflow_executions'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.workflow_executions ADD PRIMARY KEY (id);
  END IF;
END $$;
