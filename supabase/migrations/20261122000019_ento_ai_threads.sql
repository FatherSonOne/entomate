-- ========================================
-- Migration: ento_ai_threads (EAI-03)
-- Date: 2026-11-22
-- ========================================
-- Why: the Entomate AI panel kept its conversation in sessionStorage, so a
-- reload lost the thread id and a second device saw nothing. The route did
-- write each exchange to conversations / conversation_messages, but nothing
-- read them back, and those rows carry no org and no per-message data (tool
-- chips, follow-ups, the page asked on). Same shape as Logos Vision's
-- logos_ai_threads (one row per thread, messages as a JSON array).
--
-- Writer: backend/routes/entoAi.js through the caller's user-JWT client (D2),
-- by ento_ai_append_thread() below. Reader: GET /api/ento-ai/threads/latest.
-- conversations is left as it is; /api/assistant/query still writes it.
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ento_ai_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- tenant_organizations, NOT organizations: org_id comes from org_members,
  -- whose org_id references tenant_organizations.
  org_id uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  title text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(messages) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The only read: this user's most recent thread.
CREATE INDEX IF NOT EXISTS idx_ento_ai_threads_user_updated
  ON public.ento_ai_threads (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_ento_ai_threads_updated_at ON public.ento_ai_threads;
CREATE TRIGGER trg_ento_ai_threads_updated_at
  BEFORE UPDATE ON public.ento_ai_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ento_ai_threads ENABLE ROW LEVEL SECURITY;

-- Owner AND member, ANDed: a user reads only their own threads, and only in an
-- org they still belong to (a removed member loses the threads with the org).
-- The AND also stops a user stamping a foreign org_id on their own row.
DROP POLICY IF EXISTS "ento_ai_threads_own" ON public.ento_ai_threads;
CREATE POLICY "ento_ai_threads_own" ON public.ento_ai_threads
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND org_id IN (SELECT public.get_my_org_ids()))
  WITH CHECK (user_id = auth.uid() AND org_id IN (SELECT public.get_my_org_ids()));

REVOKE ALL ON public.ento_ai_threads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ento_ai_threads TO authenticated;
GRANT ALL ON public.ento_ai_threads TO service_role;

-- Appends messages to a thread the caller can see, or starts one when
-- p_thread_id is null or not theirs. One UPDATE, so two devices answering in
-- the same thread cannot overwrite each other's messages. Keeps the last 100.
-- SECURITY INVOKER: the policy above decides every row it touches.
CREATE OR REPLACE FUNCTION public.ento_ai_append_thread(
  p_thread_id uuid,
  p_org_id uuid,
  p_title text,
  p_messages jsonb
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF jsonb_typeof(p_messages) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_messages must be a JSON array';
  END IF;

  IF p_thread_id IS NOT NULL THEN
    UPDATE public.ento_ai_threads t
       SET messages = (
             SELECT coalesce(jsonb_agg(e ORDER BY i), '[]'::jsonb)
               FROM jsonb_array_elements(t.messages || p_messages) WITH ORDINALITY AS x(e, i)
              WHERE i > jsonb_array_length(t.messages || p_messages) - 100
           )
     WHERE t.id = p_thread_id
     RETURNING t.id INTO v_id;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.ento_ai_threads (user_id, org_id, title, messages)
    VALUES (auth.uid(), p_org_id, left(p_title, 120), p_messages)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ento_ai_append_thread(uuid, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ento_ai_append_thread(uuid, uuid, text, jsonb) TO authenticated, service_role;

COMMIT;
