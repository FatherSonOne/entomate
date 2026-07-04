-- ============================================================
-- MIGRATION: 20260704000005_org_scoped_rls_upgrade.sql
-- SECTION:   S1b — Org model (enforcement policy)
-- PURPOSE:   Upgrade the S1a owner-scoped perimeter policies to true
--            "team-shared per org" policies keyed on org_id via the
--            canonical helper get_my_org_ids() (SELECT org_id FROM
--            org_members WHERE user_id = auth.uid()). An authenticated
--            user now sees every row in any org they belong to — the
--            intended tenancy model — instead of only rows they personally
--            created.
--
--            Also folds in two deferred S1a hygiene items:
--            * goals: drops goals_select_policy's `goal_type='company'`
--              branch (readable by ANY public caller) and its dead
--              users.team_id join (public.users is empty).
--            * user_org_id(): pin search_path (mutable-search_path advisory).
--
-- WHY SAFE:  Backend is service-role (bypasses RLS); frontend does not query
--            these tables directly. Rows with a NULL org_id (future backend
--            inserts, pre-S1c) are simply invisible to authenticated callers
--            and still reachable by the service role — perimeter preserved.
-- DATE:      2026-07-04
-- ROLLBACK:  Restore the S1a policies from migration ...0001 / ...0002.
-- ============================================================

BEGIN;

-- meetings ---------------------------------------------------------------
DROP POLICY IF EXISTS meetings_owner ON public.meetings;
CREATE POLICY meetings_org ON public.meetings FOR ALL TO authenticated
  USING (org_id IN (SELECT public.get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT public.get_my_org_ids()));

-- action_items -----------------------------------------------------------
DROP POLICY IF EXISTS action_items_via_meeting ON public.action_items;
CREATE POLICY action_items_org ON public.action_items FOR ALL TO authenticated
  USING (org_id IN (SELECT public.get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT public.get_my_org_ids()));

-- tasks (replace the 4 assignee/project policies; keep service-role grant) -
DROP POLICY IF EXISTS "Users can view tasks"   ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON public.tasks;
CREATE POLICY tasks_org ON public.tasks FOR ALL TO authenticated
  USING (org_id IN (SELECT public.get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT public.get_my_org_ids()));

-- workflows --------------------------------------------------------------
DROP POLICY IF EXISTS workflows_owner ON public.workflows;
CREATE POLICY workflows_org ON public.workflows FOR ALL TO authenticated
  USING (org_id IN (SELECT public.get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT public.get_my_org_ids()));

-- relationships ----------------------------------------------------------
DROP POLICY IF EXISTS relationships_owner ON public.relationships;
CREATE POLICY relationships_org ON public.relationships FOR ALL TO authenticated
  USING (org_id IN (SELECT public.get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT public.get_my_org_ids()));

-- goals (drop the company-goal public leak + dead users join) ------------
DROP POLICY IF EXISTS goals_select_policy ON public.goals;
DROP POLICY IF EXISTS goals_insert_policy ON public.goals;
DROP POLICY IF EXISTS goals_update_policy ON public.goals;
DROP POLICY IF EXISTS goals_delete_policy ON public.goals;
CREATE POLICY goals_org ON public.goals FOR ALL TO authenticated
  USING (org_id IN (SELECT public.get_my_org_ids()))
  WITH CHECK (org_id IN (SELECT public.get_my_org_ids()));

-- Pin user_org_id() search_path (advisory: function_search_path_mutable) --
CREATE OR REPLACE FUNCTION public.user_org_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT org_id
  FROM public.org_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$function$;

COMMIT;
