-- ========================================
-- Migration: action item nudges
-- Date: 2026-11-22
-- Surface audit gap 3 ("chase what was agreed"): a person can send the owner
-- of an action item a reminder email from Tasks. These columns record the last
-- one so the button can say "Nudged today" and the server can refuse a second
-- nudge within 24 hours. Additive only; existing rows get NULL / 0.
-- ========================================

ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS last_nudged_at timestamptz,
  ADD COLUMN IF NOT EXISTS nudge_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.action_items.last_nudged_at IS 'When someone last sent the owner a reminder email from Entomate';
COMMENT ON COLUMN public.action_items.nudge_count IS 'How many reminder emails have been sent for this item';
