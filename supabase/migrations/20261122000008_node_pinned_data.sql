-- ========================================
-- Migration: node_pinned_data (workflow builder test data)
-- Date: 2026-11-22
-- ========================================
--
-- Why: the builder's "Pin data" panel (DataPinningPanel.jsx) saves test
-- output for a node through POST /api/workflows/:id/nodes/:nodeId/pin, and
-- test runs read it back in WorkflowExecutor.getPinnedData. The table never
-- existed, so pinning always failed (feature audit 2026-11-22, F4).
--
-- Tenancy: hangs off workflows (ON DELETE CASCADE); org_id is copied from
-- the parent workflow by the same trigger function webhooks and
-- workflow_schedules use (migration 20261122000002). RLS on, no policies:
-- only the backend (service role) touches it. Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS public.node_pinned_data (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  node_id     text NOT NULL,
  pinned_data jsonb NOT NULL,
  pinned_by   uuid,
  pinned_at   timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT node_pinned_data_workflow_node_key UNIQUE (workflow_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_node_pinned_data_org_id ON public.node_pinned_data (org_id);

DROP TRIGGER IF EXISTS trg_node_pinned_data_defaults ON public.node_pinned_data;
CREATE TRIGGER trg_node_pinned_data_defaults
  BEFORE INSERT OR UPDATE OF workflow_id, org_id ON public.node_pinned_data
  FOR EACH ROW EXECUTE FUNCTION public.workflow_trigger_row_defaults();

ALTER TABLE public.node_pinned_data ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.node_pinned_data FROM anon, authenticated;

COMMIT;
