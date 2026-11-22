-- ========================================
-- Migration: org_id on projects, automations, agents
-- Date: 2026-11-22
-- ========================================
--
-- Why (audit finding 3): these three tables have no org column, so the
-- backend (service-role key, no RLS) cannot limit them to one tenant. Same
-- shape as the S1c columns on tasks/meetings: uuid FK to
-- tenant_organizations, ON DELETE CASCADE, indexed, NOT NULL.
--
-- Backfill: none of the 15 existing rows (5 projects, 9 automations,
-- 1 agent, checked 2026-11-22) has an owner that is an org member, so they
-- are all assigned to org 058c37a6-… ("Quantum Ecosystems"), the org that
-- already holds every existing meeting and task. Change the id below first
-- if they belong somewhere else.
--
-- Two parts, because the backend must start writing org_id in between:
--   PART 1 (now): add the column, backfill, FK, index. Old code keeps working.
--   Deploy the backend change that stamps and filters org_id.
--   PART 2 (after deploy): make org_id NOT NULL.
-- Safe to run more than once.

-- ============ PART 1 ============
BEGIN;

ALTER TABLE public.projects    ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE public.agents      ADD COLUMN IF NOT EXISTS org_id uuid;

-- Owner's org where we can tell, otherwise the org that holds existing data.
UPDATE public.projects p SET org_id = m.org_id
  FROM public.org_members m WHERE p.org_id IS NULL AND m.user_id = p.owner_id;
UPDATE public.automations a SET org_id = m.org_id
  FROM public.org_members m WHERE a.org_id IS NULL AND m.user_id::text = a.created_by;
UPDATE public.agents g SET org_id = m.org_id
  FROM public.org_members m WHERE g.org_id IS NULL AND m.user_id::text = g.created_by;

UPDATE public.projects    SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;
UPDATE public.automations SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;
UPDATE public.agents      SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_org_id_fkey') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.tenant_organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automations_org_id_fkey') THEN
    ALTER TABLE public.automations ADD CONSTRAINT automations_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.tenant_organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agents_org_id_fkey') THEN
    ALTER TABLE public.agents ADD CONSTRAINT agents_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.tenant_organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_org_id    ON public.projects (org_id);
CREATE INDEX IF NOT EXISTS idx_automations_org_id ON public.automations (org_id);
CREATE INDEX IF NOT EXISTS idx_agents_org_id      ON public.agents (org_id);

COMMIT;

-- ============ PART 2 (run only after the backend deploy) ============
-- BEGIN;
-- UPDATE public.projects    SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;
-- UPDATE public.automations SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;
-- UPDATE public.agents      SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;
-- ALTER TABLE public.projects    ALTER COLUMN org_id SET NOT NULL;
-- ALTER TABLE public.automations ALTER COLUMN org_id SET NOT NULL;
-- ALTER TABLE public.agents      ALTER COLUMN org_id SET NOT NULL;
-- COMMIT;

-- Check (expect 0 nulls and 3 rows):
-- SELECT 'projects', count(*) FILTER (WHERE org_id IS NULL) FROM public.projects
-- UNION ALL SELECT 'automations', count(*) FILTER (WHERE org_id IS NULL) FROM public.automations
-- UNION ALL SELECT 'agents', count(*) FILTER (WHERE org_id IS NULL) FROM public.agents;
