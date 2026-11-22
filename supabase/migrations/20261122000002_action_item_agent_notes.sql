-- ========================================
-- Migration: Agent notes on action items
-- Date: 2026-11-22
-- ========================================
-- What the Priority, Deadline and Assignment agents recommended for an item
-- after its meeting was processed, why, how confident they were, and whether
-- the change was applied. Written by backend/services/meetingEvents.js and
-- shown under each action item ("Why").
--
-- Shape: { reviewed_at, priority?, deadline?, assignment? }, each
--   { recommended, reason, confidence, applied }.
-- Nullable, no default: items the agents never reviewed stay null.
-- RLS is unchanged: the column inherits action_items' existing policies.

ALTER TABLE public.action_items ADD COLUMN IF NOT EXISTS agent_notes jsonb;

COMMENT ON COLUMN public.action_items.agent_notes IS
  'Agent recommendations after meeting processing: {reviewed_at, priority, deadline, assignment}, each {recommended, reason, confidence, applied}.';
