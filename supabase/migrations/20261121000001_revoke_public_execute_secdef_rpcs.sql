-- ========================================
-- Migration: Revoke anon/PUBLIC EXECUTE on SECURITY DEFINER functions
-- Date: 2026-11-21
-- ========================================
--
-- Why: every SECURITY DEFINER function in `public` is callable by signed-out
-- users. Live ACLs (checked 2026-11-21) all start with `=X/postgres`, which is
-- the PUBLIC grant Postgres adds by default to every new function. The July
-- S1c migration (_archive/20260704000006) only ran `REVOKE ... FROM anon`;
-- anon still inherits EXECUTE through PUBLIC, so that revoke never took
-- effect. The 2026-07-04 baseline then also kept explicit `anon` grants on
-- six helper/trigger functions.
--
-- This runs after the baseline, so a `supabase db reset` replays the fix too.
-- Safe to run more than once.

BEGIN;

-- 1. Org lifecycle RPCs: signed-in users only (they check org role inside).
REVOKE EXECUTE ON FUNCTION public.create_org_for_user(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_org(uuid)                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.hard_delete_org(uuid)                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_org(uuid)                     FROM PUBLIC, anon;

-- 2. RLS helpers: used by `TO authenticated` policies; anon never needs them.
REVOKE EXECUTE ON FUNCTION public.get_my_org_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_org_id()    FROM PUBLIC, anon;

-- 3. AI usage counter: called by the frontend as a signed-in user.
REVOKE EXECUTE ON FUNCTION public.increment_ai_usage(uuid, date) FROM PUBLIC, anon;

-- It also had no membership check, so any signed-in user could inflate any
-- org's usage. Same body, plus a guard. CREATE OR REPLACE keeps the grants.
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_org_id uuid, p_month date DEFAULT NULL::date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_month DATE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND p_org_id NOT IN (SELECT public.get_my_org_ids()) THEN
    RAISE EXCEPTION 'not a member of org %', p_org_id USING ERRCODE = '42501';
  END IF;

  v_month := COALESCE(p_month, date_trunc('month', CURRENT_DATE)::DATE);

  INSERT INTO public.org_ai_usage_monthly (org_id, month, request_count)
  VALUES (p_org_id, v_month, 1)
  ON CONFLICT (org_id, month)
  DO UPDATE SET request_count = org_ai_usage_monthly.request_count + 1;
END;
$$;

-- 4. Trigger functions: triggers fire without an EXECUTE check, so nobody
--    needs to call these directly.
REVOKE EXECUTE ON FUNCTION public.fn_ecosystem_alert_on_failure() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_secret_create()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_secret_update()             FROM PUBLIC, anon, authenticated;

-- These two are SECURITY DEFINER with no fixed search_path (advisor 0011).
ALTER FUNCTION public.log_secret_create() SET search_path = public;
ALTER FUNCTION public.log_secret_update() SET search_path = public;

COMMIT;

-- 5. OPTIONAL (recommended, not run by default): stop new functions from
--    being callable by anon automatically. The baseline keeps Supabase's
--    default `GRANT ALL ON FUNCTIONS TO anon`, so every future function
--    repeats this problem. After this, a function meant for signed-out users
--    needs an explicit GRANT.
--
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- Check (expect anon_exec = false on every row):
-- SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.prosecdef ORDER BY 1;
