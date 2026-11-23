-- ========================================
-- Migration: follow_ups (follow-up email after a meeting)
-- Date: 2026-11-23
-- ========================================
-- One drafted follow-up email per meeting: who gets it, the subject, the
-- opening line, which sections go in, and whether it is waiting, sent or
-- stopped. Direction C "Letter" (Slate pick 2026-11-23): the draft is sent on
-- its own at send_at unless someone edits or stops it.
--
-- Writer: backend/services/followUp.js with the service role only. Reader: the
-- same service for GET /api/meetings/:id/follow-up; org members may also read
-- their org's rows directly. Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL UNIQUE REFERENCES public.meetings(id) ON DELETE CASCADE,
  -- The person it is sent for: their name signs it and replies go to them.
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'stopped', 'failed')),
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(recipients) = 'array'),
  subject text,
  opening text,
  signoff text,
  include jsonb NOT NULL DEFAULT '{"decisions": true, "items": true, "next": true, "summary": false, "copy": true}'::jsonb,
  next_meeting jsonb,
  send_at timestamptz,
  sent_at timestamptz,
  sent_to jsonb,
  error text,
  provider_id text,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The job's only query: scheduled rows that are due.
CREATE INDEX IF NOT EXISTS idx_follow_ups_due
  ON public.follow_ups (send_at)
  WHERE status = 'scheduled';

DROP TRIGGER IF EXISTS trg_follow_ups_updated_at ON public.follow_ups;
CREATE TRIGGER trg_follow_ups_updated_at
  BEFORE UPDATE ON public.follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- Members read their org's follow-ups. Writes go through the backend only.
DROP POLICY IF EXISTS "follow_ups_org_read" ON public.follow_ups;
CREATE POLICY "follow_ups_org_read" ON public.follow_ups
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public.get_my_org_ids()));

REVOKE ALL ON public.follow_ups FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.follow_ups FROM authenticated;
GRANT SELECT ON public.follow_ups TO authenticated;
GRANT ALL ON public.follow_ups TO service_role;

-- Per person: send my follow-ups on their own (direction C). On by default,
-- as picked; the Follow-up tab has the switch. A column, not a key inside
-- meetings_json, because Settings replaces that JSON whole on save.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS follow_up_auto_send boolean NOT NULL DEFAULT true;

-- The job: draft new follow-ups and send the due ones. Runs at :05, :15, ...
-- so with entomate-autojoin (:00, :10, ...) the server is asked every 5 min.
-- The token lives in private.cron_secrets (migration 20261122000019).
select cron.unschedule(jobid) from cron.job where jobname = 'entomate-followups';

select cron.schedule(
  'entomate-followups',
  '5-59/10 * * * *',
  $cron$
  select net.http_post(
    url := 'https://entomate.onrender.com/api/internal/jobs/followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Token', (select token from private.cron_secrets where name = 'jobs')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
  $cron$
);

COMMIT;
