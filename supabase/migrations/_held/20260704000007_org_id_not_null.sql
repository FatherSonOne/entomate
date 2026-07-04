-- ============================================================
-- MIGRATION: 20260704000007_org_id_not_null.sql   ***HELD — DO NOT APPLY YET***
-- SECTION:   S1c — Tenancy enforcement (final flip)
--
-- STATUS:    HELD in supabase/migrations/_held/ so the Supabase CLI does NOT
--            pick it up (it only reads *.sql in the migrations root, not
--            subfolders). Move it up one level to apply it — but only AFTER the
--            deploy gate below is satisfied.
--
-- PURPOSE:   Make org_id mandatory on the six org-scoped tables. This is what
--            turns the S1b org-scoped RLS from "correct but latent" into
--            runtime-enforced tenancy: no row can be written without a tenant.
--
-- ┌─ DEPLOY GATE (all must be true before moving this into the migrations root) ─┐
-- │ 1. The S1c backend (org_id stamping via utils/orgContext) is DEPLOYED to    │
-- │    Render and serving traffic. Until then the live backend writes NULL      │
-- │    org_id and this NOT NULL flip would break meeting capture + creates.     │
-- │ 2. A soak check confirms new rows carry org_id, e.g. over a recent window:  │
-- │      SELECT count(*) FILTER (WHERE org_id IS NULL) AS nulls, count(*)        │
-- │      FROM public.meetings WHERE created_at > now() - interval '1 day';       │
-- │    Repeat per table. Expect nulls = 0 before proceeding.                    │
-- │ 3. The dormant automation-engine / workflow-node task-creators remain       │
-- │    dormant (automationEngine.trigger has no callers). If S8 wires them,     │
-- │    they must stamp org_id first (they carry TODO(S1c/S8) markers). After    │
-- │    this flip an un-stamped insert there fails closed — surfacing, not       │
-- │    corrupting — which is the intended safety behavior.                      │
-- └─────────────────────────────────────────────────────────────────────────────┘
--
-- PRECHECK (run before applying — must all return 0):
--   SELECT 'meetings',      count(*) FROM public.meetings      WHERE org_id IS NULL
--   UNION ALL SELECT 'action_items', count(*) FROM public.action_items WHERE org_id IS NULL
--   UNION ALL SELECT 'tasks',        count(*) FROM public.tasks        WHERE org_id IS NULL
--   UNION ALL SELECT 'workflows',    count(*) FROM public.workflows    WHERE org_id IS NULL
--   UNION ALL SELECT 'relationships',count(*) FROM public.relationships WHERE org_id IS NULL
--   UNION ALL SELECT 'goals',        count(*) FROM public.goals        WHERE org_id IS NULL;
--
-- ROLLBACK:  ALTER TABLE ... ALTER COLUMN org_id DROP NOT NULL;  (per table)
-- DATE:      2026-07-04 (authored; apply date TBD post-deploy)
-- ============================================================

BEGIN;

ALTER TABLE public.meetings      ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.action_items  ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.tasks         ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.workflows     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.relationships ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.goals         ALTER COLUMN org_id SET NOT NULL;

COMMIT;
