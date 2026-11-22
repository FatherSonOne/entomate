-- ========================================
-- Migration: Drop the legacy automations and custom-agent tables
-- Date: 2026-11-22
-- Approved by Frankie ("yes you can drop them").
-- The 9 automations rows were converted to paused workflows in
-- 20261122000004; no code reads these tables after commit 8161670.
-- CASCADE only removes the foreign keys from agent_executions and
-- agent_execution_logs to ai_agents; those two tables are kept.
-- ========================================

DROP TABLE IF EXISTS public.automation_logs CASCADE;
DROP TABLE IF EXISTS public.automations CASCADE;
DROP TABLE IF EXISTS public.ai_agents CASCADE;
