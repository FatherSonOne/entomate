-- ========================================
-- Migration: EAI-07 step 2 — the backend records AI usage with tokens and cost
-- Date: 2026-11-23
-- ========================================
--
-- Why: `org_ai_usage_monthly` has 0 rows in production — no AI question has
-- ever been counted. `increment_ai_usage` only adds to `request_count` and is
-- service-role only since 20261123600000. The backend now sums Gemini's own
-- `usageMetadata` and calls this once per model call.
--
-- 1. record_ai_usage: adds one call's tokens and cost. p_requests is 1 for
--    the first model call of a question and 0 for the agent loop's later
--    rounds, so request_count counts questions. Each call records itself as
--    it ends, so a user who drops the connection mid-answer is still counted.
--    SECURITY INVOKER: only service_role may call it, and service_role
--    already writes the table (it bypasses RLS).
-- 2. estimated_cost numeric(10,4) -> numeric(12,6): a typical question costs
--    about $0.003, and four decimals rounded each one by up to 1.7%. The
--    table is empty and nothing reads the column yet.
-- 3. Free-plan limit: the column default said 50, while create_org_for_user
--    (20261122000017) writes 100 and the frontend TENANT_PLAN_AI_LIMITS says
--    free = 100. Decided: 100. The one org still at 50 is the oldest free org
--    (2026-04-06), made before the RPC set the limit; it moves to 100.
--
-- Safe to run more than once.

BEGIN;

ALTER TABLE public.org_ai_usage_monthly ALTER COLUMN estimated_cost TYPE numeric(12,6);

CREATE OR REPLACE FUNCTION public.record_ai_usage(
  p_org_id uuid,
  p_requests integer,
  p_tokens_input bigint,
  p_tokens_output bigint,
  p_cost numeric
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = 'public'
AS $$
  INSERT INTO public.org_ai_usage_monthly (org_id, month, request_count, tokens_input, tokens_output, estimated_cost)
  VALUES (
    p_org_id,
    date_trunc('month', CURRENT_DATE)::date,
    LEAST(GREATEST(COALESCE(p_requests, 0), 0), 1),
    GREATEST(COALESCE(p_tokens_input, 0), 0),
    GREATEST(COALESCE(p_tokens_output, 0), 0),
    GREATEST(COALESCE(p_cost, 0), 0)
  )
  ON CONFLICT (org_id, month) DO UPDATE SET
    request_count  = COALESCE(org_ai_usage_monthly.request_count, 0)  + EXCLUDED.request_count,
    tokens_input   = COALESCE(org_ai_usage_monthly.tokens_input, 0)   + EXCLUDED.tokens_input,
    tokens_output  = COALESCE(org_ai_usage_monthly.tokens_output, 0)  + EXCLUDED.tokens_output,
    estimated_cost = COALESCE(org_ai_usage_monthly.estimated_cost, 0) + EXCLUDED.estimated_cost;
$$;

REVOKE EXECUTE ON FUNCTION public.record_ai_usage(uuid, integer, bigint, bigint, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(uuid, integer, bigint, bigint, numeric) TO service_role;

ALTER TABLE public.tenant_organizations ALTER COLUMN ai_monthly_limit SET DEFAULT 100;
UPDATE public.tenant_organizations SET ai_monthly_limit = 100 WHERE plan = 'free' AND ai_monthly_limit = 50;

COMMIT;

-- Check (expect auth_exec = false, service_exec = true, cost_type = numeric(12,6), free_at_50 = 0):
-- SELECT has_function_privilege('authenticated', 'public.record_ai_usage(uuid,integer,bigint,bigint,numeric)', 'EXECUTE') AS auth_exec,
--        has_function_privilege('service_role',  'public.record_ai_usage(uuid,integer,bigint,bigint,numeric)', 'EXECUTE') AS service_exec,
--        (SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'public.org_ai_usage_monthly'::regclass AND attname = 'estimated_cost') AS cost_type,
--        (SELECT count(*) FROM public.tenant_organizations WHERE plan = 'free' AND ai_monthly_limit = 50) AS free_at_50;
