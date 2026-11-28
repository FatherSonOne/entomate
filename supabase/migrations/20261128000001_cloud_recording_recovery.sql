BEGIN;

ALTER TABLE public.meetings
  ADD COLUMN room_audio_lease_id uuid,
  ADD COLUMN room_audio_lease_until timestamptz;

CREATE INDEX meetings_cloud_recording_pending_idx ON public.meetings (updated_at, id)
  WHERE recording_job->>'roomCapture' = 'daily'
    AND recording_job->>'status' IN ('stopping', 'processing');

CREATE FUNCTION public.claim_cloud_recording(p_lease uuid, p_room uuid DEFAULT NULL)
RETURNS SETOF public.live_meeting_rooms
LANGUAGE sql
SET search_path = ''
AS $$
  WITH candidate AS (
    SELECT m.id
    FROM public.meetings m
    JOIN public.live_meeting_rooms r ON r.meeting_id = m.id AND r.id = m.id
    WHERE m.org_id = r.org_id AND m.created_by::text = r.host_id::text
      AND (p_room IS NULL OR r.id = p_room)
      AND m.recording_job->>'roomCapture' = 'daily'
      AND m.recording_job->>'status' IN ('stopping', 'processing')
      AND (m.recording_job->>'status' <> 'stopping' OR m.updated_at <= now() - interval '30 seconds')
      AND coalesce((m.recording_job->>'cloudRetryAt')::timestamptz, '-infinity') <= now()
      AND coalesce(m.room_audio_lease_until, '-infinity') <= now()
    ORDER BY m.updated_at, m.id
    LIMIT 1
    FOR UPDATE OF m SKIP LOCKED
  ), claimed AS (
    UPDATE public.meetings m
    SET room_audio_lease_id = p_lease, room_audio_lease_until = now() + interval '75 seconds'
    FROM candidate c WHERE m.id = c.id
    RETURNING m.id
  )
  SELECT r.* FROM public.live_meeting_rooms r JOIN claimed c ON c.id = r.id;
$$;

REVOKE ALL ON FUNCTION public.claim_cloud_recording(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cloud_recording(uuid, uuid) TO service_role;

-- Production uses the existing private cron credential and internal job endpoint.
SELECT cron.schedule('entomate-cloud-recording', '* * * * *', $cron$
  SELECT net.http_post(
    url := 'https://entomate.onrender.com/api/internal/jobs/cloud-recording',
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Token', s.token),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  ) FROM private.cron_secrets s WHERE s.name = 'jobs'
    AND EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.recording_job->>'roomCapture' = 'daily'
        AND m.recording_job->>'status' IN ('stopping', 'processing')
        AND coalesce(m.room_audio_lease_until, '-infinity') <= now()
        AND coalesce((m.recording_job->>'cloudRetryAt')::timestamptz, '-infinity') <= now()
    );
$cron$);

COMMIT;
