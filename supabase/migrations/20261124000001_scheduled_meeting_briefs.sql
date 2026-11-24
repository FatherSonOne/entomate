BEGIN;

CREATE TABLE public.ento_ai_brief_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  calendar_binding text NOT NULL,
  event_id text NOT NULL,
  starts_at timestamptz NOT NULL,
  lead_minutes smallint NOT NULL CHECK (lead_minutes IN (5, 15, 30, 60)),
  time_zone text NOT NULL,
  check_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ready', 'failed')),
  attempts smallint NOT NULL DEFAULT 0,
  thread_id uuid REFERENCES public.ento_ai_threads(id) ON DELETE CASCADE,
  UNIQUE (user_id, org_id, calendar_binding, event_id),
  CHECK ((status = 'ready') = (thread_id IS NOT NULL))
);

CREATE INDEX ento_ai_brief_schedules_due ON public.ento_ai_brief_schedules (check_at)
  WHERE status = 'scheduled';

ALTER TABLE public.ento_ai_brief_schedules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ento_ai_brief_schedules FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ento_ai_brief_schedules TO service_role;

-- Publish and mark ready together. A cancellation or expired claim cannot leave a stray thread.
CREATE FUNCTION public.complete_ento_ai_brief_schedule(
  p_id uuid, p_claim timestamptz, p_title text, p_messages jsonb
) RETURNS uuid
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  job public.ento_ai_brief_schedules%ROWTYPE;
  new_thread uuid;
BEGIN
  SELECT * INTO job FROM public.ento_ai_brief_schedules
    WHERE id = p_id AND status = 'scheduled' AND check_at = p_claim AND check_at > now()
    FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF job.starts_at <= now()
    OR NOT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = job.user_id AND org_id = job.org_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.user_settings s WHERE s.user_id = job.user_id
        AND s.calendar_json #>> '{tokens,refresh_token}' IS NOT NULL
        AND coalesce('connected:' || (s.calendar_json ->> 'connected_at'),
          'token:' || encode(sha256(convert_to(s.calendar_json #>> '{tokens,refresh_token}', 'UTF8')), 'hex')) = job.calendar_binding
    ) THEN
    UPDATE public.ento_ai_brief_schedules SET status = 'failed' WHERE id = job.id;
    RETURN NULL;
  END IF;

  INSERT INTO public.ento_ai_threads (user_id, org_id, title, messages)
    VALUES (job.user_id, job.org_id, left(p_title, 120), p_messages) RETURNING id INTO new_thread;
  UPDATE public.ento_ai_brief_schedules SET status = 'ready', thread_id = new_thread WHERE id = job.id;
  RETURN new_thread;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_ento_ai_brief_schedule(uuid, timestamptz, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ento_ai_brief_schedule(uuid, timestamptz, text, jsonb) TO service_role;

-- Wake the worker even when the web service is asleep. Skip calls when nothing is due.
SELECT cron.schedule('entomate-meeting-briefs', '* * * * *', $cron$
  SELECT net.http_post(
    url := 'https://entomate.onrender.com/api/internal/jobs/meeting-briefs',
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Token', s.token),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  ) FROM private.cron_secrets s WHERE s.name = 'jobs'
    AND EXISTS (SELECT 1 FROM public.ento_ai_brief_schedules WHERE status = 'scheduled' AND check_at <= now());
$cron$);

COMMIT;
