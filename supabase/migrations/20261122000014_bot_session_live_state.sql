-- ========================================
-- Migration: bot_sessions.live_state
-- Date: 2026-11-22
-- ========================================
-- What the bot is doing in the call, saved so it survives a server restart:
--   { "recording": true|false, "recordingAt": ISO,   -- Recall in_call_recording / in_call_not_recording
--     "captions": true|false }                       -- live captions were requested at launch
-- The live views use it to say "in the call, not recording" honestly, and to
-- warn when no captions arrive while the bot should be hearing people.
ALTER TABLE public.bot_sessions ADD COLUMN IF NOT EXISTS live_state jsonb;
