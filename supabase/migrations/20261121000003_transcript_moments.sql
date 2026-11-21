-- ========================================
-- Migration: transcript timecodes for summary items and action items
-- Date: 2026-11-21
-- ========================================
--
-- Links what the AI summary says back to the moment in the transcript it came from,
-- so a decision, key point or action item can jump to that line.
--
-- meetings.summary_moments: { "keyPoints": [atMs|null, ...], "decisions": [atMs|null, ...] }
--   aligned by index with meetings.key_points / meetings.decisions. Kept as a separate
--   column so the existing string arrays (read by recaps, sync and the UI) keep their shape.
-- action_items.transcript_at_ms: ms from the start of the recording, or NULL.
--
-- Both are written only by the backend (service role) and only for meetings that have
-- transcript_segments. NULL means "no timed transcript" or "no confident match".

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS summary_moments jsonb;

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_summary_moments_is_object;
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_summary_moments_is_object
  CHECK (summary_moments IS NULL OR jsonb_typeof(summary_moments) = 'object');

COMMENT ON COLUMN public.meetings.summary_moments IS
  'Transcript timecodes for summary items: {keyPoints: [ms|null], decisions: [ms|null]}, index-aligned with key_points/decisions.';

ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS transcript_at_ms integer;

ALTER TABLE public.action_items
  DROP CONSTRAINT IF EXISTS action_items_transcript_at_ms_nonneg;
ALTER TABLE public.action_items
  ADD CONSTRAINT action_items_transcript_at_ms_nonneg
  CHECK (transcript_at_ms IS NULL OR transcript_at_ms >= 0);

COMMENT ON COLUMN public.action_items.transcript_at_ms IS
  'Milliseconds from the start of the recording where this action item was said. NULL when unknown.';
