-- =====================================================
-- Fix Agent Table Names
-- =====================================================
-- Problem: The TypeScript agents framework (src/agents/) queries tables
-- named `agents`, `agent_runs`, `agent_run_steps`, but the existing
-- migration (20251219_002_week7_automations_tables.sql) created
-- `ai_agents` and `agent_execution_logs` instead.
--
-- Solution: Create the three tables the agents framework expects.
-- Leave `ai_agents` and `agent_execution_logs` untouched (legacy).
-- =====================================================

-- =====================================================
-- 1. AGENTS TABLE
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'agents'
    ) THEN
        CREATE TABLE public.agents (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name        TEXT NOT NULL,
            description TEXT,
            enabled     BOOLEAN NOT NULL DEFAULT true,
            trigger_type TEXT NOT NULL DEFAULT 'manual',
            trigger_config JSONB NOT NULL DEFAULT '{}',
            actions     JSONB NOT NULL DEFAULT '[]',
            guardrails  JSONB NOT NULL DEFAULT '{}',
            created_by  TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    ELSE
        -- Table already exists — ensure all expected columns are present
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'enabled') THEN
            ALTER TABLE public.agents ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT true;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'trigger_type') THEN
            ALTER TABLE public.agents ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'manual';
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'trigger_config') THEN
            ALTER TABLE public.agents ADD COLUMN trigger_config JSONB NOT NULL DEFAULT '{}';
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'actions') THEN
            ALTER TABLE public.agents ADD COLUMN actions JSONB NOT NULL DEFAULT '[]';
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'guardrails') THEN
            ALTER TABLE public.agents ADD COLUMN guardrails JSONB NOT NULL DEFAULT '{}';
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'created_by') THEN
            ALTER TABLE public.agents ADD COLUMN created_by TEXT;
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'created_at') THEN
            ALTER TABLE public.agents ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
        END IF;
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'updated_at') THEN
            ALTER TABLE public.agents ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
        END IF;

        COMMENT ON TABLE public.agents IS 'Agent definitions consumed by the TypeScript agents framework';
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_enabled
    ON public.agents (enabled);
CREATE INDEX IF NOT EXISTS idx_agents_trigger_type
    ON public.agents (trigger_type);
CREATE INDEX IF NOT EXISTS idx_agents_created_by
    ON public.agents (created_by);
CREATE INDEX IF NOT EXISTS idx_agents_updated_at
    ON public.agents (updated_at DESC);

-- =====================================================
-- 2. AGENT_RUNS TABLE
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'agent_runs'
    ) THEN
        CREATE TABLE public.agent_runs (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            agent_id         UUID NOT NULL REFERENCES public.agents (id) ON DELETE CASCADE,
            status           TEXT NOT NULL DEFAULT 'running'
                             CHECK (status IN ('running', 'success', 'failed', 'skipped')),
            trigger_event_id TEXT,
            input            JSONB NOT NULL DEFAULT '{}',
            output           JSONB,
            error            TEXT,
            attempt          INTEGER NOT NULL DEFAULT 1,
            started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            finished_at      TIMESTAMPTZ
        );

        COMMENT ON TABLE public.agent_runs IS 'Execution runs for agents; one row per invocation attempt';
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_id
    ON public.agent_runs (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status
    ON public.agent_runs (status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_trigger_event_id
    ON public.agent_runs (trigger_event_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at
    ON public.agent_runs (started_at DESC);

-- Unique partial index: prevent duplicate runs for the same trigger event
-- while a run is still in progress or already succeeded.
CREATE UNIQUE INDEX IF NOT EXISTS ux_agent_runs_idempotent
    ON public.agent_runs (agent_id, trigger_event_id)
    WHERE trigger_event_id IS NOT NULL
      AND status IN ('running', 'success');

-- =====================================================
-- 3. AGENT_RUN_STEPS TABLE
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'agent_run_steps'
    ) THEN
        CREATE TABLE public.agent_run_steps (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            agent_run_id UUID NOT NULL REFERENCES public.agent_runs (id) ON DELETE CASCADE,
            step_index   INTEGER NOT NULL,
            step_type    TEXT NOT NULL,
            status       TEXT NOT NULL DEFAULT 'running'
                         CHECK (status IN ('running', 'success', 'failed', 'skipped')),
            input        JSONB,
            output       JSONB,
            error        TEXT,
            started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            finished_at  TIMESTAMPTZ
        );

        COMMENT ON TABLE public.agent_run_steps IS 'Individual steps within an agent run';
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run_id
    ON public.agent_run_steps (agent_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_run_steps_status
    ON public.agent_run_steps (status);

-- Composite index: fetch all steps for a run in order
CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run_order
    ON public.agent_run_steps (agent_run_id, step_index);

-- =====================================================
-- 4. UPDATED_AT TRIGGER
-- =====================================================
-- Reuse or create a generic set_updated_at function, then attach it
-- to the agents table so updated_at stays current on every UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$fn$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_agents_updated_at'
          AND tgrelid = 'public.agents'::regclass
    ) THEN
        CREATE TRIGGER trg_agents_updated_at
            BEFORE UPDATE ON public.agents
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- =====================================================
-- 5. GRANTS (match existing pattern from week7 migration)
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_runs      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_run_steps TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents          TO anon;
GRANT SELECT, INSERT                ON public.agent_runs       TO anon;
GRANT SELECT, INSERT                ON public.agent_run_steps  TO anon;

-- =====================================================
-- 6. RLS (enable but leave permissive for now; tighten per-tenant later)
-- =====================================================
ALTER TABLE public.agents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_run_steps ENABLE ROW LEVEL SECURITY;

-- Permissive policies so existing code keeps working
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'agents' AND policyname = 'agents_authenticated_all'
    ) THEN
        CREATE POLICY agents_authenticated_all ON public.agents
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'agents' AND policyname = 'agents_anon_all'
    ) THEN
        CREATE POLICY agents_anon_all ON public.agents
            FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'agent_runs' AND policyname = 'agent_runs_authenticated_all'
    ) THEN
        CREATE POLICY agent_runs_authenticated_all ON public.agent_runs
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'agent_runs' AND policyname = 'agent_runs_anon_read_insert'
    ) THEN
        CREATE POLICY agent_runs_anon_read_insert ON public.agent_runs
            FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'agent_run_steps' AND policyname = 'agent_run_steps_authenticated_all'
    ) THEN
        CREATE POLICY agent_run_steps_authenticated_all ON public.agent_run_steps
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'agent_run_steps' AND policyname = 'agent_run_steps_anon_read_insert'
    ) THEN
        CREATE POLICY agent_run_steps_anon_read_insert ON public.agent_run_steps
            FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;
