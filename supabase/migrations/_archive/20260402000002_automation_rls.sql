-- Automation & Agent Tables: Row-Level Security
-- Date: 2026-04-02
-- Problem: All automation tables had wide-open grants to both anon and
--          authenticated roles with zero row-level restrictions.
-- Fix:     Enable RLS, create ownership policies, revoke anon access.
--
-- NOTE: created_by columns may be TEXT (not UUID) in the live DB,
--       so all comparisons use auth.uid()::text for safety.

-- =====================================================
-- 1. REVOKE OVERLY-BROAD ANON GRANTS
--    (Keep anon SELECT on automation_templates only)
-- =====================================================

REVOKE ALL ON automations          FROM anon;
REVOKE ALL ON automation_logs      FROM anon;
REVOKE ALL ON ai_agents            FROM anon;
REVOKE ALL ON agent_execution_logs FROM anon;
REVOKE ALL ON team_members         FROM anon;

-- Tighten authenticated grants to match what RLS will enforce
-- (authenticated still needs table-level permission; RLS does the filtering)
REVOKE DELETE ON automation_logs      FROM authenticated;
REVOKE UPDATE ON automation_logs      FROM authenticated;
REVOKE DELETE ON agent_execution_logs FROM authenticated;
REVOKE UPDATE ON agent_execution_logs FROM authenticated;

-- automation_templates stays read-only for everyone
GRANT SELECT ON automation_templates TO anon;
GRANT SELECT ON automation_templates TO authenticated;

-- =====================================================
-- 2. AUTOMATIONS  (user_id / created_by ownership)
--    user_id is UUID, created_by may be UUID or TEXT
-- =====================================================

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automations_select_own" ON automations;
CREATE POLICY "automations_select_own" ON automations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR created_by::text = auth.uid()::text
  );

DROP POLICY IF EXISTS "automations_insert_own" ON automations;
CREATE POLICY "automations_insert_own" ON automations
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(user_id, auth.uid()) = auth.uid()
    AND COALESCE(created_by::text, auth.uid()::text) = auth.uid()::text
  );

DROP POLICY IF EXISTS "automations_update_own" ON automations;
CREATE POLICY "automations_update_own" ON automations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR created_by::text = auth.uid()::text)
  WITH CHECK (user_id = auth.uid() OR created_by::text = auth.uid()::text);

DROP POLICY IF EXISTS "automations_delete_own" ON automations;
CREATE POLICY "automations_delete_own" ON automations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR created_by::text = auth.uid()::text);

-- =====================================================
-- 3. AUTOMATION_LOGS  (scoped through automation_id FK)
-- =====================================================

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_logs_select_own" ON automation_logs;
CREATE POLICY "automation_logs_select_own" ON automation_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_logs.automation_id
        AND (a.user_id = auth.uid() OR a.created_by::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "automation_logs_insert_own" ON automation_logs;
CREATE POLICY "automation_logs_insert_own" ON automation_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_logs.automation_id
        AND (a.user_id = auth.uid() OR a.created_by::text = auth.uid()::text)
    )
  );

-- No UPDATE or DELETE policies for automation_logs (append-only audit trail)

-- =====================================================
-- 4. AI_AGENTS  (same ownership pattern as automations)
--    user_id is UUID, created_by may be UUID or TEXT
-- =====================================================

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_agents_select_own" ON ai_agents;
CREATE POLICY "ai_agents_select_own" ON ai_agents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR created_by::text = auth.uid()::text);

DROP POLICY IF EXISTS "ai_agents_insert_own" ON ai_agents;
CREATE POLICY "ai_agents_insert_own" ON ai_agents
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(user_id, auth.uid()) = auth.uid()
    AND COALESCE(created_by::text, auth.uid()::text) = auth.uid()::text
  );

DROP POLICY IF EXISTS "ai_agents_update_own" ON ai_agents;
CREATE POLICY "ai_agents_update_own" ON ai_agents
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR created_by::text = auth.uid()::text)
  WITH CHECK (user_id = auth.uid() OR created_by::text = auth.uid()::text);

DROP POLICY IF EXISTS "ai_agents_delete_own" ON ai_agents;
CREATE POLICY "ai_agents_delete_own" ON ai_agents
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR created_by::text = auth.uid()::text);

-- =====================================================
-- 5. AGENT_EXECUTION_LOGS  (scoped through agent_id FK)
-- =====================================================

ALTER TABLE agent_execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_exec_logs_select_own" ON agent_execution_logs;
CREATE POLICY "agent_exec_logs_select_own" ON agent_execution_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ai_agents a
      WHERE a.id = agent_execution_logs.agent_id
        AND (a.user_id = auth.uid() OR a.created_by::text = auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "agent_exec_logs_insert_own" ON agent_execution_logs;
CREATE POLICY "agent_exec_logs_insert_own" ON agent_execution_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_agents a
      WHERE a.id = agent_execution_logs.agent_id
        AND (a.user_id = auth.uid() OR a.created_by::text = auth.uid()::text)
    )
  );

-- No UPDATE or DELETE policies for agent_execution_logs (append-only audit trail)

-- =====================================================
-- 6. TEAM_MEMBERS  (team-scoped visibility)
-- =====================================================

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members_select_same_team" ON team_members;
CREATE POLICY "team_members_select_same_team" ON team_members
  FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT tm.team_id FROM team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "team_members_insert_own" ON team_members;
CREATE POLICY "team_members_insert_own" ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "team_members_update_own" ON team_members;
CREATE POLICY "team_members_update_own" ON team_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "team_members_delete_own" ON team_members;
CREATE POLICY "team_members_delete_own" ON team_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 7. AGENTS / AGENT_RUNS / AGENT_RUN_STEPS
--    (IF EXISTS -- companion migration may create these)
--    created_by is TEXT in agents table
-- =====================================================

DO $$
BEGIN
  -- ---------------------------------------------------
  -- agents (created_by ownership, TEXT column)
  -- ---------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agents') THEN
    ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

    -- Drop any permissive policies from the table-creation migration
    DROP POLICY IF EXISTS "agents_authenticated_all" ON agents;
    DROP POLICY IF EXISTS "agents_anon_all" ON agents;

    DROP POLICY IF EXISTS "agents_select_own" ON agents;
    CREATE POLICY "agents_select_own" ON agents
      FOR SELECT TO authenticated
      USING (created_by = auth.uid()::text);

    DROP POLICY IF EXISTS "agents_insert_own" ON agents;
    CREATE POLICY "agents_insert_own" ON agents
      FOR INSERT TO authenticated
      WITH CHECK (COALESCE(created_by, auth.uid()::text) = auth.uid()::text);

    DROP POLICY IF EXISTS "agents_update_own" ON agents;
    CREATE POLICY "agents_update_own" ON agents
      FOR UPDATE TO authenticated
      USING (created_by = auth.uid()::text)
      WITH CHECK (created_by = auth.uid()::text);

    DROP POLICY IF EXISTS "agents_delete_own" ON agents;
    CREATE POLICY "agents_delete_own" ON agents
      FOR DELETE TO authenticated
      USING (created_by = auth.uid()::text);

    -- Revoke anon if granted
    REVOKE ALL ON agents FROM anon;
  END IF;

  -- ---------------------------------------------------
  -- agent_runs (scoped through agent_id FK -> agents)
  -- ---------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_runs') THEN
    ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

    -- Drop any permissive policies from the table-creation migration
    DROP POLICY IF EXISTS "agent_runs_authenticated_all" ON agent_runs;
    DROP POLICY IF EXISTS "agent_runs_anon_read_insert" ON agent_runs;

    DROP POLICY IF EXISTS "agent_runs_select_own" ON agent_runs;
    CREATE POLICY "agent_runs_select_own" ON agent_runs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM agents ag
          WHERE ag.id = agent_runs.agent_id
            AND ag.created_by = auth.uid()::text
        )
      );

    DROP POLICY IF EXISTS "agent_runs_insert_own" ON agent_runs;
    CREATE POLICY "agent_runs_insert_own" ON agent_runs
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM agents ag
          WHERE ag.id = agent_runs.agent_id
            AND ag.created_by = auth.uid()::text
        )
      );

    DROP POLICY IF EXISTS "agent_runs_update_own" ON agent_runs;
    CREATE POLICY "agent_runs_update_own" ON agent_runs
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM agents ag
          WHERE ag.id = agent_runs.agent_id
            AND ag.created_by = auth.uid()::text
        )
      );

    -- No DELETE -- runs are historical records

    REVOKE ALL ON agent_runs FROM anon;
  END IF;

  -- ---------------------------------------------------
  -- agent_run_steps (scoped through agent_run_id FK -> agent_runs -> agents)
  -- ---------------------------------------------------
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_run_steps') THEN
    ALTER TABLE agent_run_steps ENABLE ROW LEVEL SECURITY;

    -- Drop any permissive policies from the table-creation migration
    DROP POLICY IF EXISTS "agent_run_steps_authenticated_all" ON agent_run_steps;
    DROP POLICY IF EXISTS "agent_run_steps_anon_read_insert" ON agent_run_steps;

    DROP POLICY IF EXISTS "agent_run_steps_select_own" ON agent_run_steps;
    CREATE POLICY "agent_run_steps_select_own" ON agent_run_steps
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM agent_runs ar
          JOIN agents ag ON ag.id = ar.agent_id
          WHERE ar.id = agent_run_steps.agent_run_id
            AND ag.created_by = auth.uid()::text
        )
      );

    DROP POLICY IF EXISTS "agent_run_steps_insert_own" ON agent_run_steps;
    CREATE POLICY "agent_run_steps_insert_own" ON agent_run_steps
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM agent_runs ar
          JOIN agents ag ON ag.id = ar.agent_id
          WHERE ar.id = agent_run_steps.agent_run_id
            AND ag.created_by = auth.uid()::text
        )
      );

    -- No UPDATE or DELETE -- steps are immutable audit records

    REVOKE ALL ON agent_run_steps FROM anon;
  END IF;
END $$;

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON POLICY "automations_select_own"      ON automations          IS 'Owner can read their automations';
COMMENT ON POLICY "automations_insert_own"      ON automations          IS 'Authenticated users create automations owned by themselves';
COMMENT ON POLICY "automations_update_own"      ON automations          IS 'Owner can modify their automations';
COMMENT ON POLICY "automations_delete_own"      ON automations          IS 'Owner can remove their automations';
COMMENT ON POLICY "automation_logs_select_own"  ON automation_logs      IS 'Owner can read logs for their automations';
COMMENT ON POLICY "automation_logs_insert_own"  ON automation_logs      IS 'Owner can append logs for their automations';
COMMENT ON POLICY "ai_agents_select_own"        ON ai_agents            IS 'Owner can read their agents';
COMMENT ON POLICY "ai_agents_insert_own"        ON ai_agents            IS 'Authenticated users create agents owned by themselves';
COMMENT ON POLICY "ai_agents_update_own"        ON ai_agents            IS 'Owner can modify their agents';
COMMENT ON POLICY "ai_agents_delete_own"        ON ai_agents            IS 'Owner can remove their agents';
COMMENT ON POLICY "agent_exec_logs_select_own"  ON agent_execution_logs IS 'Owner can read execution logs for their agents';
COMMENT ON POLICY "agent_exec_logs_insert_own"  ON agent_execution_logs IS 'Owner can append execution logs for their agents';
COMMENT ON POLICY "team_members_select_same_team" ON team_members       IS 'Users can see members in their own team(s)';
COMMENT ON POLICY "team_members_insert_own"     ON team_members         IS 'Users can add themselves to a team';
COMMENT ON POLICY "team_members_update_own"     ON team_members         IS 'Users can update their own team membership';
COMMENT ON POLICY "team_members_delete_own"     ON team_members         IS 'Users can remove themselves from a team';
