-- Ensure user_settings table exists (originally in server/db/migrations)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY,
  theme_mode TEXT NOT NULL DEFAULT 'system',
  accent_mode TEXT NOT NULL DEFAULT 'system',
  accent_color TEXT NOT NULL DEFAULT '#00A86B',
  reduce_motion BOOLEAN NOT NULL DEFAULT false,
  notifications_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  meetings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Store Google Calendar tokens in user_settings instead of cookies
-- Tokens are stored in calendar_json JSONB column (encrypted at rest by Supabase)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS calendar_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN user_settings.calendar_json IS 'Google Calendar OAuth tokens and preferences. Keys: tokens (object), connected_at (timestamp), calendar_id (preferred calendar)';
