-- ========================================
-- Migration: EAI-07 step 1 — the AI usage counter is backend-only
-- Date: 2026-11-23
-- ========================================
--
-- Why: 20261121000001 already added a membership guard, so a signed-in user
-- can no longer bump ANOTHER org's counter (measured on production
-- 2026-11-23: the guard predicate is true for a non-member, false for a
-- member). But any member can still call this RPC for their OWN org as often
-- as they like. Once EAI-07 enforces `ai_monthly_limit` against
-- `request_count`, one member could use up the whole org's monthly quota.
--
-- EAI-07 counts usage on the backend only (service role), where the token
-- counts come from Gemini's own response. No frontend or backend code calls
-- this RPC (grep 2026-11-23), so nothing breaks. service_role keeps EXECUTE.
-- `org_ai_usage_monthly` has RLS on and a SELECT policy only, so members
-- cannot write the counter directly either.
--
-- Safe to run more than once.

REVOKE EXECUTE ON FUNCTION public.increment_ai_usage(uuid, date) FROM PUBLIC, anon, authenticated;

-- Check (expect auth_exec = false, service_exec = true):
-- SELECT has_function_privilege('authenticated', 'public.increment_ai_usage(uuid, date)', 'EXECUTE') AS auth_exec,
--        has_function_privilege('service_role',  'public.increment_ai_usage(uuid, date)', 'EXECUTE') AS service_exec;
