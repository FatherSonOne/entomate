-- Lightweight notification inbox for cross-app alerts arriving from Pulse / LV.
-- Receives notification.send events via the ecosystem-inbound function so the
-- Entomate UI can surface them without a heavier real-time channel.

CREATE TABLE IF NOT EXISTS public.ecosystem_notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = broadcast
    source_app  text NOT NULL,
    title       text,
    body        text,
    urgency     text NOT NULL DEFAULT 'normal'
                CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),
    metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
    read        boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecosystem_notifications_user_unread
    ON public.ecosystem_notifications(user_id, read, created_at DESC)
    WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_ecosystem_notifications_created
    ON public.ecosystem_notifications(created_at DESC);

ALTER TABLE public.ecosystem_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications (and any user_id IS NULL broadcasts)
DROP POLICY IF EXISTS "users_read_own_notifications" ON public.ecosystem_notifications;
CREATE POLICY "users_read_own_notifications"
    ON public.ecosystem_notifications FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can mark their own notifications as read
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.ecosystem_notifications;
CREATE POLICY "users_update_own_notifications"
    ON public.ecosystem_notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role inserts (edge function uses SUPABASE_SERVICE_ROLE_KEY) are
-- already permitted by their bypass-RLS context; no INSERT policy needed.
