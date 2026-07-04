-- ============================================================
-- MIGRATION: 20260704000001_rls_perimeter_lockdown.sql
-- SECTION:   S1a — Data Foundation & Multi-Tenancy (perimeter)
-- PURPOSE:   Close the anon-key hole. ~25 public tables were reachable
--            by anyone holding the anon key (shipped in the frontend
--            bundle): 10 with RLS OFF, ~15 with wide-open USING(true)
--            policies. This enables RLS and removes/scopes those grants.
--
-- WHY SAFE:  The backend now runs on the service-role client (see
--            backend/config/supabase.js) which BYPASSES RLS, and the
--            frontend touches NONE of these tables directly. So enabling
--            RLS + dropping wide-open policies closes the perimeter with
--            no effect on the running app.
--
-- SCOPE:     Perimeter only. Policies are scoped to the CURRENT owner
--            column (created_by / user_id / owner_id). S1b upgrades these
--            to org_id-scoped once org_id is added + backfilled.
-- DATE:      2026-07-04
-- ROLLBACK:  Per-table snapshot captured before apply. To revert a table:
--            ALTER TABLE public.<t> DISABLE ROW LEVEL SECURITY; and/or
--            restore the dropped policy from the snapshot.
-- ============================================================

BEGIN;

-- ============================================================
-- GROUP A — RLS was OFF but correct scoped policies already exist.
--           Just enable RLS so they take effect.
-- ============================================================
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GROUP B — RLS was OFF, no policy. Enable + owner-scoped policy.
--           (created_by columns here are varchar → cast auth.uid()::text)
-- ============================================================

-- meetings — owned by created_by (varchar)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meetings_owner ON public.meetings;
CREATE POLICY meetings_owner ON public.meetings FOR ALL TO authenticated
  USING (created_by = auth.uid()::text)
  WITH CHECK (created_by = auth.uid()::text);

-- action_items — no owner column; scope through parent meeting
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS action_items_via_meeting ON public.action_items;
CREATE POLICY action_items_via_meeting ON public.action_items FOR ALL TO authenticated
  USING (meeting_id IN (SELECT id FROM public.meetings WHERE created_by = auth.uid()::text))
  WITH CHECK (meeting_id IN (SELECT id FROM public.meetings WHERE created_by = auth.uid()::text));

-- user_settings — self (user_id uuid)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_settings_self ON public.user_settings;
CREATE POLICY user_settings_self ON public.user_settings FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- search_conversations — self (user_id uuid)
ALTER TABLE public.search_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS search_conversations_self ON public.search_conversations;
CREATE POLICY search_conversations_self ON public.search_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- users — self row (id uuid = auth.uid()). Team-wide read comes in S1b.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_self ON public.users;
CREATE POLICY users_self ON public.users FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- GROUP C — Sensitive / internal tables, RLS was OFF.
--           Enable RLS with NO permissive policy = deny anon/authenticated
--           entirely; the service-role backend still reaches them.
-- ============================================================
ALTER TABLE public.secrets_vault ENABLE ROW LEVEL SECURITY;       -- encrypted secrets: never client-readable
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;    -- ops logs: service-role only
ALTER TABLE public.automation_templates ENABLE ROW LEVEL SECURITY;-- catalog: served by backend
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;               -- grouping model reconciled in S1b

-- ============================================================
-- GROUP D — RLS on, but a wide-open USING(true) policy shadowed the
--           correct scoped policies already present. Drop the shadow.
-- ============================================================
DROP POLICY IF EXISTS "Allow all agents"            ON public.agents;            -- keeps agents_*_own
DROP POLICY IF EXISTS "Users can read agents"        ON public.ai_agents;         -- keeps ai_agents_*_own
DROP POLICY IF EXISTS "Users can insert own agents"  ON public.ai_agents;
DROP POLICY IF EXISTS "Users can update own agents"  ON public.ai_agents;
DROP POLICY IF EXISTS "Users can delete own agents"  ON public.ai_agents;
DROP POLICY IF EXISTS "Allow all tasks"              ON public.tasks;             -- keeps project-scoped + service-role

-- ============================================================
-- GROUP E — RLS on, ONLY a wide-open policy. Replace with owner-scope
--           where an owner column exists; else drop → deny-all (service serves).
-- ============================================================

-- relationships — created_by (text)
DROP POLICY IF EXISTS "Users can view relationships"   ON public.relationships;
DROP POLICY IF EXISTS "Users can create relationships" ON public.relationships;
DROP POLICY IF EXISTS "Users can update relationships" ON public.relationships;
DROP POLICY IF EXISTS "Users can delete relationships" ON public.relationships;
DROP POLICY IF EXISTS relationships_owner ON public.relationships;
CREATE POLICY relationships_owner ON public.relationships FOR ALL TO authenticated
  USING (created_by = auth.uid()::text)
  WITH CHECK (created_by = auth.uid()::text);

-- workflows — created_by (uuid)
DROP POLICY IF EXISTS "Allow all workflows operations" ON public.workflows;
DROP POLICY IF EXISTS workflows_owner ON public.workflows;
CREATE POLICY workflows_owner ON public.workflows FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- agent_explanations — drop wide-open write grants; keep the good scoped SELECT.
--   (INSERT/UPDATE now service-role only, which is what "Service can ..." meant.)
DROP POLICY IF EXISTS "Service can insert explanations" ON public.agent_explanations;
DROP POLICY IF EXISTS "Service can update explanations" ON public.agent_explanations;

-- No-owner / internal tables → drop wide-open policy → deny-all (service serves).
DROP POLICY IF EXISTS "Allow all workflow_executions operations" ON public.workflow_executions;
DROP POLICY IF EXISTS "Allow all workflow_versions operations"   ON public.workflow_versions;
DROP POLICY IF EXISTS "Allow all metrics"                        ON public.metrics;
DROP POLICY IF EXISTS "Allow all queries"                        ON public.queries;
DROP POLICY IF EXISTS "Allow all components operations"          ON public.components;
DROP POLICY IF EXISTS "Users can insert executions"             ON public.agent_executions;
DROP POLICY IF EXISTS "Users can read executions"              ON public.agent_executions;

-- embeddings / search_documents — USING(true) let ANY authenticated user read
-- ALL rows (cross-tenant leak). Drop → deny-all; backend RAG uses service role.
DROP POLICY IF EXISTS embeddings_select_authenticated ON public.embeddings;
DROP POLICY IF EXISTS search_docs_select_authenticated ON public.search_documents;

COMMIT;
