-- ========================================
-- Migration: timed, per-speaker transcript lines on meetings
-- Date: 2026-11-21
-- Ported from Logos Vision 20270413100000_meeting_transcript_segments.sql
-- ========================================
--
-- `meetings.transcript` stays the flat "Speaker: words" text that the AI pipeline,
-- Ask and recaps read. This column keeps the same lines with their time and speaker
-- apart, so the transcript viewer can search, jump to a moment and rename a speaker:
--   [{ "atMs": 12345, "endMs": 15000, "speaker": "Frank", "text": "..." }, ...]
-- `atMs` is milliseconds from the start of the recording.
--
-- Written by the backend (service role) when a Recall bot finishes, and by the
-- speaker-rename endpoint. Reads go through the existing meetings RLS, so no new
-- policy is needed. A plain nullable column: no default, no backfill.

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS transcript_segments jsonb;

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_transcript_segments_is_array;
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_transcript_segments_is_array
  CHECK (transcript_segments IS NULL OR jsonb_typeof(transcript_segments) = 'array');

COMMENT ON COLUMN public.meetings.transcript_segments IS
  'Timed transcript lines [{atMs, endMs?, speaker, text}]. NULL when the meeting has no timed transcript (pasted or uploaded).';
