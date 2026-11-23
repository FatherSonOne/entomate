-- ========================================
-- Migration: ento_ai_action_log (EAI-05)
-- Date: 2026-11-22
-- ========================================
-- Why: Entomate AI gets write verbs (create a task, complete an action item,
-- log a meeting note ...). The agent never writes business data inside its
-- tool loop. It records a 'proposed' row here; the user presses Confirm in the
-- panel; the backend then executes the verb under the caller's user-JWT client
-- (D2, D6) and stamps the row 'executed' with what it needs to undo it.
-- This table is both the confirm queue and the audit trail of agent writes.
-- Same shape as Logos Vision's agent_action_log (+ undone status, + plan
-- columns, which EAI-06 uses for multi-step plans).
--
-- Writer and reader: backend/services/entoAi/actionLog.js, user client only.
-- No DELETE grant: the trail is kept.
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ento_ai_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- tenant_organizations, NOT organizations: org_id comes from org_members.
  org_id uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  risk_class text NOT NULL DEFAULT 'write' CHECK (risk_class IN ('safe', 'write', 'sensitive')),
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'confirmed', 'executed', 'rejected', 'failed', 'undone')),
  summary text,                                         -- "what the agent wants to do", shown on the card
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  result jsonb,                                         -- what the execute or undo returned
  undo jsonb,                                           -- what the inverse needs (ids, previous values)
  -- EAI-06 plans: rows sharing plan_id are one plan. NULL = a single proposal.
  plan_id uuid,
  step_order integer,
  arg_bindings jsonb,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,                              -- confirmed, rejected or failed
  executed_at timestamptz,
  undone_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ento_ai_action_log_user_proposed
  ON public.ento_ai_action_log (user_id, proposed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ento_ai_action_log_plan
  ON public.ento_ai_action_log (plan_id, step_order) WHERE plan_id IS NOT NULL;

-- The lifecycle, enforced here so no client (the backend or a direct PostgREST
-- call) can skip a step:
--   proposed  → confirmed | rejected
--   confirmed → executed  | failed
--   executed  → undone    (or stays executed when an undo is refused)
-- rejected, failed and undone are final. Identity columns never change, and
-- the payload can be edited only while the row is still proposed.
CREATE OR REPLACE FUNCTION public.ento_ai_action_log_guard()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'proposed' OR NEW.result IS NOT NULL OR NEW.undo IS NOT NULL
       OR NEW.resolved_at IS NOT NULL OR NEW.executed_at IS NOT NULL OR NEW.undone_at IS NOT NULL THEN
      RAISE EXCEPTION 'ento_ai_action_log: a new row must be a bare proposal' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id <> OLD.id OR NEW.org_id <> OLD.org_id OR NEW.user_id <> OLD.user_id
     OR NEW.tool_name <> OLD.tool_name OR NEW.risk_class <> OLD.risk_class
     OR NEW.proposed_at <> OLD.proposed_at
     OR NEW.plan_id IS DISTINCT FROM OLD.plan_id OR NEW.step_order IS DISTINCT FROM OLD.step_order THEN
    RAISE EXCEPTION 'ento_ai_action_log: identity columns cannot change' USING ERRCODE = '22023';
  END IF;

  IF OLD.status IN ('rejected', 'failed', 'undone') THEN
    RAISE EXCEPTION 'ento_ai_action_log: a % action is final', OLD.status USING ERRCODE = '22023';
  END IF;

  IF OLD.status <> 'proposed' AND (NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.summary IS DISTINCT FROM OLD.summary OR NEW.arg_bindings IS DISTINCT FROM OLD.arg_bindings) THEN
    RAISE EXCEPTION 'ento_ai_action_log: only a proposed action can be edited' USING ERRCODE = '22023';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'proposed'  AND NEW.status IN ('confirmed', 'rejected'))
    OR (OLD.status = 'confirmed' AND NEW.status IN ('executed', 'failed'))
    OR (OLD.status = 'executed'  AND NEW.status = 'undone')
  ) THEN
    RAISE EXCEPTION 'ento_ai_action_log: % -> % is not allowed', OLD.status, NEW.status USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ento_ai_action_log_guard ON public.ento_ai_action_log;
CREATE TRIGGER trg_ento_ai_action_log_guard
  BEFORE INSERT OR UPDATE ON public.ento_ai_action_log
  FOR EACH ROW EXECUTE FUNCTION public.ento_ai_action_log_guard();

ALTER TABLE public.ento_ai_action_log ENABLE ROW LEVEL SECURITY;

-- Owner AND member, ANDed (as ento_ai_threads): a user sees and resolves only
-- their own proposals, only in an org they still belong to, and cannot stamp
-- a foreign org_id on a row. A teammate never confirms someone else's proposal.
DROP POLICY IF EXISTS "ento_ai_action_log_select" ON public.ento_ai_action_log;
CREATE POLICY "ento_ai_action_log_select" ON public.ento_ai_action_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND org_id IN (SELECT public.get_my_org_ids()));

DROP POLICY IF EXISTS "ento_ai_action_log_insert" ON public.ento_ai_action_log;
CREATE POLICY "ento_ai_action_log_insert" ON public.ento_ai_action_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND org_id IN (SELECT public.get_my_org_ids()));

DROP POLICY IF EXISTS "ento_ai_action_log_update" ON public.ento_ai_action_log;
CREATE POLICY "ento_ai_action_log_update" ON public.ento_ai_action_log
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND org_id IN (SELECT public.get_my_org_ids()))
  WITH CHECK (user_id = auth.uid() AND org_id IN (SELECT public.get_my_org_ids()));

REVOKE ALL ON public.ento_ai_action_log FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ento_ai_action_log TO authenticated;
GRANT ALL ON public.ento_ai_action_log TO service_role;

REVOKE ALL ON FUNCTION public.ento_ai_action_log_guard() FROM PUBLIC, anon, authenticated;

COMMIT;
