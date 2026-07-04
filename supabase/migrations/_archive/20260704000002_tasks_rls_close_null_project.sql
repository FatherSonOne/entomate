-- ============================================================
-- MIGRATION: 20260704000002_tasks_rls_close_null_project.sql
-- SECTION:   S1a — Data Foundation (perimeter, follow-on fix)
-- PURPOSE:   The kept tasks policies carried an `OR (project_id IS NULL)`
--            branch — an unconditional public grant. Every project-less
--            task (all 14 today) was readable/writable by anon via
--            PostgREST. Replace that branch with an assignee check, and
--            restrict the policies to the `authenticated` role (anon fully
--            excluded). `tasks` has no owner column — `assigned_to` (text)
--            is the only per-user signal for a project-less task.
--
-- WHY SAFE:  Backend uses the service-role client (bypasses RLS) and the
--            frontend never queries `tasks` directly, so tightening the
--            authenticated/anon perimeter has no effect on the app.
-- DATE:      2026-07-04
-- ROLLBACK:  Restore the prior policies from the S1a snapshot.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "Users can view tasks" ON public.tasks;
CREATE POLICY "Users can view tasks" ON public.tasks FOR SELECT TO authenticated
USING (
  (auth.uid()::text = assigned_to)
  OR (project_id IN (SELECT id FROM public.projects
       WHERE (owner_id::text = auth.uid()::text)
          OR (auth.uid()::text = ANY (team_ids::text[]))))
);

DROP POLICY IF EXISTS "Users can update tasks" ON public.tasks;
CREATE POLICY "Users can update tasks" ON public.tasks FOR UPDATE TO authenticated
USING (
  (auth.uid()::text = assigned_to)
  OR (project_id IN (SELECT id FROM public.projects
       WHERE (owner_id::text = auth.uid()::text)
          OR (auth.uid()::text = ANY (team_ids::text[]))))
);

DROP POLICY IF EXISTS "Users can delete tasks" ON public.tasks;
CREATE POLICY "Users can delete tasks" ON public.tasks FOR DELETE TO authenticated
USING (
  (auth.uid()::text = assigned_to)
  OR (project_id IN (SELECT id FROM public.projects
       WHERE owner_id::text = auth.uid()::text))
);

DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
CREATE POLICY "Users can create tasks" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid()::text = assigned_to)
  OR (project_id IN (SELECT id FROM public.projects
       WHERE (owner_id::text = auth.uid()::text)
          OR (auth.uid()::text = ANY (team_ids::text[]))))
);

COMMIT;
