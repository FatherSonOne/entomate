-- ========================================
-- Migration: In-browser meeting recorder (no bot)
-- Date: 2026-11-21
-- ========================================
-- The recorder saves audio in 30-second pieces while the meeting is recorded, so a closed
-- tab loses at most one piece. The pieces live in the private `meeting-recordings` bucket
-- under {org_id}/{meeting_id}/; only the backend (service role) reads or writes them, so
-- the bucket has no client policies. They are deleted once the transcript is saved.
--
-- meetings.recording_job tracks one recording:
--   { status: 'recording'|'transcribing'|'done'|'failed', mode: 'mic'|'camera'|'tab',
--     mimeType, startedAt, startedBy, finishedAt?, pieces?, durationMs?, error?, updatedAt }

ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS recording_job jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meetings_recording_job_is_object'
  ) THEN
    ALTER TABLE public.meetings
      ADD CONSTRAINT meetings_recording_job_is_object
      CHECK (recording_job IS NULL OR jsonb_typeof(recording_job) = 'object');
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('meeting-recordings', 'meeting-recordings', false, 10485760,
        ARRAY['audio/webm', 'audio/ogg', 'audio/mp4'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
