-- ========================================
-- Migration: webhooks + workflow_schedules (workflow trigger tables)
-- Date: 2026-11-22
-- ========================================
--
-- Why: routes/webhooks.js (POST /hooks/:id), routes/workflows.js and
-- services/workflow/WorkflowScheduler.js read and write these two tables,
-- but neither exists in production, so webhook and schedule triggers have
-- never worked. Columns match what the code uses.
--
-- Tenancy: both hang off workflows (ON DELETE CASCADE). org_id is copied
-- from the parent workflow by a trigger, so the backend cannot forget it
-- and it stays right if a workflow ever moves org. This keeps working if
-- Workflows, Automations and Agents merge into one module, as long as the
-- merged module keeps a workflows row per automation.
--
-- RLS on with no policies: only the backend (service role) touches these.
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS public.webhooks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  workflow_id       uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  node_id           text NOT NULL,
  path              text NOT NULL,
  method            text NOT NULL DEFAULT 'POST'
                    CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','ANY')),
  authentication    jsonb NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  response_mode     text NOT NULL DEFAULT 'immediate'
                    CHECK (response_mode IN ('immediate','last_node','custom')),
  response_data     jsonb,
  enabled           boolean NOT NULL DEFAULT false,
  trigger_count     integer NOT NULL DEFAULT 0,
  last_triggered_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhooks_path_key UNIQUE (path),
  CONSTRAINT webhooks_workflow_node_key UNIQUE (workflow_id, node_id)
);

CREATE TABLE IF NOT EXISTS public.workflow_schedules (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  workflow_id          uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  node_id              text NOT NULL,
  cron_expression      text NOT NULL,
  timezone             text NOT NULL DEFAULT 'UTC',
  enabled              boolean NOT NULL DEFAULT false,
  next_run_at          timestamptz,
  last_run_at          timestamptz,
  run_count            integer NOT NULL DEFAULT 0,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_error           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_schedules_workflow_node_key UNIQUE (workflow_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_webhooks_org_id               ON public.webhooks (org_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_workflow_id          ON public.webhooks (workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_org_id     ON public.workflow_schedules (org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workflow_id ON public.workflow_schedules (workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_enabled    ON public.workflow_schedules (enabled) WHERE enabled;

-- org_id always follows the parent workflow; updated_at kept current.
CREATE OR REPLACE FUNCTION public.workflow_trigger_row_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  SELECT w.org_id INTO NEW.org_id FROM public.workflows w WHERE w.id = NEW.workflow_id;
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'workflow % not found', NEW.workflow_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.workflow_trigger_row_defaults() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_webhooks_defaults ON public.webhooks;
CREATE TRIGGER trg_webhooks_defaults
  BEFORE INSERT OR UPDATE OF workflow_id, org_id ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.workflow_trigger_row_defaults();

DROP TRIGGER IF EXISTS trg_workflow_schedules_defaults ON public.workflow_schedules;
CREATE TRIGGER trg_workflow_schedules_defaults
  BEFORE INSERT OR UPDATE OF workflow_id, org_id ON public.workflow_schedules
  FOR EACH ROW EXECUTE FUNCTION public.workflow_trigger_row_defaults();

ALTER TABLE public.webhooks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_schedules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhooks, public.workflow_schedules FROM anon, authenticated;

COMMIT;

-- Check (expect 2 rows, rls true):
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('webhooks','workflow_schedules') AND relnamespace = 'public'::regnamespace;
