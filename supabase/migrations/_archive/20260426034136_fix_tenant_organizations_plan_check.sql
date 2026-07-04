-- ============================================================
-- MIGRATION: 20260426034136_fix_tenant_organizations_plan_check
-- SECTION:   S2 — migration-history reconciliation
-- PROVENANCE: RECOVERED 2026-07-04 from the remote migration ledger
--            (supabase_migrations.schema_migrations). Applied to production
--            on 2026-04-26 but never committed to the repo. Restored here to
--            close the reproducibility gap. Already applied on prod; idempotent
--            (DROP CONSTRAINT IF EXISTS) and safe to re-run.
-- ============================================================

BEGIN;

ALTER TABLE public.tenant_organizations
  DROP CONSTRAINT IF EXISTS tenant_organizations_plan_check;

ALTER TABLE public.tenant_organizations
  ADD CONSTRAINT tenant_organizations_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'business', 'ecosystem'));

COMMIT;
