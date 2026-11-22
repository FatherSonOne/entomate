-- ========================================
-- Migration: summary templates per meeting type
-- Date: 2026-11-22
--
-- meetings.summary_template: which template wrote the summary (general,
-- one_on_one, standup, sales, client, interview, planning). Set by the AI
-- pipeline, or chosen on the meeting page and kept for reprocessing.
-- meetings.summary_sections: [{ title, items[] }] extra sections for that type.
-- Additive only: nothing is dropped or changed. RLS is unchanged (row-level).
-- ========================================

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS summary_template text,
  ADD COLUMN IF NOT EXISTS summary_sections jsonb;
