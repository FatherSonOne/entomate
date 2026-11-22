-- ========================================
-- Migration: org-scoped SELECT on projects and agents (EAI-01b)
-- Date: 2026-11-22
-- ========================================
-- Why: the only SELECT policies were owner-only — projects by owner_id /
-- team_ids, agents by created_by. All 9 projects have a NULL owner_id, so a
-- user-JWT client saw 0 of its own org's projects and agents (measured
-- 2026-11-22 as the org-058c owner: 0 of 5 projects, 0 of 1 agent).
-- org_id exists and is filled on both (20261122000001).
--
-- Adds an org SELECT policy, same shape as tasks_org / meetings_org.
-- Permissive policies OR together, so the owner policies keep working for
-- any row with a NULL org_id. Writes are unchanged: they stay owner-only for
-- user JWTs and the backend writes with the service key.
-- No frontend code reads these tables directly; the reader is the assistant
-- route (backend/routes/assistant.js), which moves to the user client with it.
-- Safe to run more than once.

BEGIN;

DROP POLICY IF EXISTS "projects_org_select" ON public.projects;
CREATE POLICY "projects_org_select" ON public.projects
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.get_my_org_ids()));

DROP POLICY IF EXISTS "agents_org_select" ON public.agents;
CREATE POLICY "agents_org_select" ON public.agents
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.get_my_org_ids()));

COMMIT;
