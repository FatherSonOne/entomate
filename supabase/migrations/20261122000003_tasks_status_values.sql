-- ========================================
-- Migration: Accept the task statuses the app writes
-- Date: 2026-11-22
-- ========================================
-- The live check allowed only todo / in_progress / review / completed, but the API
-- (backend/schemas/tasks.js) writes open / in_progress / review / done / blocked.
-- Creating, completing, reopening and marking a task Blocked all failed.
-- This only widens the check: the legacy values stay valid, no rows change.
-- The Tasks view (frontend/src/services/tasksView.ts) reads todo as open and
-- completed as done.

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (
  status::text = ANY (ARRAY[
    'open', 'in_progress', 'review', 'blocked', 'done',
    'todo', 'completed'
  ]::text[])
);
