-- ========================================
-- Migration: moments marked while the bot is in a call
-- Date: 2026-11-22
-- ========================================
-- POST /api/admin/bots/:sessionId/marks appends { id, atMs, at, quote, speaker, note, by }.
-- The debrief lists them with timecodes. Service-role writes only (no new RLS needed:
-- bot_sessions is read and written by the backend's service key).

ALTER TABLE public.bot_sessions
  ADD COLUMN IF NOT EXISTS marks jsonb NOT NULL DEFAULT '[]'::jsonb;
