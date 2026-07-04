-- ============================================================
-- MIGRATION: 20260704000007_org_id_not_null.sql
-- SECTION:   S1c — Tenancy enforcement (final flip)
-- PURPOSE:   Make org_id mandatory on the six org-scoped tables. This turns the
--            S1b org-scoped RLS from "correct but latent" into runtime-enforced
--            tenancy: no row can be written without a tenant.
--
-- STATUS:    APPLIED 2026-07-04 (was authored + held one commit; armed once the
--            org_id-stamping backend was committed + pushed — d11d4f3). Precheck
--            confirmed 0 null org_id across all six tables before applying.
--
-- SAFETY:    The backend (service-role) stamps org_id on every live write via
--            utils/orgContext. An un-stamped insert now FAILS CLOSED (rejected)
--            rather than mis-assigning a row to the wrong tenant — the intended
--            safety property. The dormant automation-engine / workflow-node
--            task-creators (automationEngine.trigger has 0 callers) carry
--            TODO(S1c/S8) markers; if S8 wires them, they must stamp org_id
--            first or their inserts will fail closed here.
--
-- ROLLBACK:  ALTER TABLE ... ALTER COLUMN org_id DROP NOT NULL;  (per table)
-- ============================================================

BEGIN;

ALTER TABLE public.meetings      ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.action_items  ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.tasks         ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.workflows     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.relationships ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.goals         ALTER COLUMN org_id SET NOT NULL;

COMMIT;
