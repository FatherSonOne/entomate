-- Calendar sync tracking: prevent duplicate Google Calendar events
-- Adds calendar_event_id to tables that can be synced to Google Calendar

ALTER TABLE action_items ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

-- Index for quick lookup during sync
CREATE INDEX IF NOT EXISTS idx_action_items_calendar_event ON action_items(calendar_event_id) WHERE calendar_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_calendar_event ON goals(calendar_event_id) WHERE calendar_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_calendar_event ON meetings(calendar_event_id) WHERE calendar_event_id IS NOT NULL;
