-- ============================================================
-- MIGRATION: 20260704000003_add_org_id_to_core_tables.sql
-- SECTION:   S1b — Org model (structure)
-- PURPOSE:   Add the org_id tenancy column to the six org-shared
--            tables so "team-shared per org" can be enforced at the
--            row level. FK → tenant_organizations(id) (the canonical
--            grouping model). ON DELETE CASCADE matches the existing
--            org-FK convention (bot_sessions, org_members, ...): deleting
--            a tenant removes its data.
--
-- NULLABILITY: org_id is left NULLABLE on purpose. The service-role
--            backend does not yet populate org_id on INSERT, so a NOT NULL
--            constraint would break new-meeting capture. Backfill (see
--            ...0004) fills existing rows; NOT NULL + backend population
--            is the S1c enforcement step.
--
-- WHY SAFE:  Additive columns only. Backend is service-role (bypasses RLS)
--            and the frontend does not query these tables directly, so
--            adding a nullable column has no runtime effect.
-- DATE:      2026-07-04
-- ROLLBACK:  ALTER TABLE public.<t> DROP COLUMN org_id;
-- ============================================================

BEGIN;

ALTER TABLE public.meetings      ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.tenant_organizations(id) ON DELETE CASCADE;
ALTER TABLE public.action_items  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.tenant_organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tasks         ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.tenant_organizations(id) ON DELETE CASCADE;
ALTER TABLE public.workflows     ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.tenant_organizations(id) ON DELETE CASCADE;
ALTER TABLE public.relationships ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.tenant_organizations(id) ON DELETE CASCADE;
ALTER TABLE public.goals         ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.tenant_organizations(id) ON DELETE CASCADE;

-- Indexes: every org-scoped RLS predicate filters on org_id.
CREATE INDEX IF NOT EXISTS idx_meetings_org_id      ON public.meetings(org_id);
CREATE INDEX IF NOT EXISTS idx_action_items_org_id  ON public.action_items(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id         ON public.tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_workflows_org_id     ON public.workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_relationships_org_id ON public.relationships(org_id);
CREATE INDEX IF NOT EXISTS idx_goals_org_id         ON public.goals(org_id);

COMMIT;
