BEGIN;

ALTER TABLE public.bot_sessions
  ADD COLUMN intelligence_profile_id uuid REFERENCES public.intelligence_profiles(id) ON DELETE SET NULL;

-- Google gives recurring occurrences separate event IDs and keeps the ID when moved.
CREATE TABLE public.calendar_meeting_profiles (
  org_id uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.intelligence_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (org_id, event_id)
);

ALTER TABLE public.calendar_meeting_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.calendar_meeting_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calendar_meeting_profiles TO service_role;

COMMIT;
