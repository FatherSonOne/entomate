-- ========================================
-- Migration: calendar auto-join columns on bot_sessions
-- Date: 2026-11-22
-- ========================================
--
-- Why: feature audit 2026-11-22, rec 1. services/calendarAutoJoin.js
-- schedules a Recall bot for calendar events with a video link. Each
-- scheduled bot records which calendar event (and start time) it is for, so
-- a second run never schedules it twice and a moved or cancelled event can
-- have its bot withdrawn. The title is the calendar event's, so the meeting
-- the transcript lands in is named after it.
--
-- Additive only; safe to run more than once.

ALTER TABLE public.bot_sessions
  ADD COLUMN IF NOT EXISTS calendar_event_key text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS join_at timestamptz;

-- One live bot per calendar event. A bot withdrawn because the event moved
-- is 'stopped' and drops out, so moving the event back can schedule again.
CREATE UNIQUE INDEX IF NOT EXISTS bot_sessions_org_calendar_event_key
  ON public.bot_sessions (org_id, calendar_event_key)
  WHERE calendar_event_key IS NOT NULL AND status <> 'stopped';
