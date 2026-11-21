-- ========================================
-- Migration: Meeting Notes (port of Logos Vision Enterprise Series N1)
-- Date: 2026-11-21
-- ========================================
--
-- A person's own notes about a meeting. `meetings` holds the AI's output; this
-- holds the human's, keyed to the human.
--
-- Privacy rule (from Logos Vision D5): a note is PRIVATE to its author by default.
-- Team visibility is an explicit per-note opt-in.
--
-- Entomate's backend uses the service-role key, which BYPASSES RLS, so the real
-- enforcement for app traffic is in backend/services/meetingNotesService.js. The
-- policies below are defence in depth: they make a private note unreadable to a
-- colleague even through a hand-rolled PostgREST call with a user JWT.
--
-- org_id and author_id have no DB defaults on purpose. The backend stamps both
-- (auth.uid() is NULL on a service-role connection), matching the S1c rule that
-- the app layer stamps org_id.

BEGIN;

CREATE TABLE IF NOT EXISTS public.meeting_notes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    -- tenant_organizations is the canonical tenant table (S1b).
    org_id uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
    meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    -- auth.users.id (= auth.uid()), which is what req.user.id carries.
    author_id uuid NOT NULL,
    -- Snapshot of the author's display name at write time, so a team note still
    -- says who wrote it after the author leaves the org.
    author_name text,
    body text NOT NULL,
    visibility text NOT NULL DEFAULT 'private',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT meeting_notes_visibility_check CHECK (visibility IN ('private', 'team')),
    CONSTRAINT meeting_notes_body_not_blank CHECK (btrim(body) <> ''),
    CONSTRAINT meeting_notes_body_max_length CHECK (char_length(body) <= 4000)
);

COMMENT ON TABLE public.meeting_notes IS 'Notes a person writes about a meeting. Private to the author unless visibility = ''team''.';
COMMENT ON COLUMN public.meeting_notes.author_id IS 'auth.users.id (= auth.uid()).';
COMMENT ON COLUMN public.meeting_notes.visibility IS 'private = author only (default); team = every member of org_id.';

-- "This meeting's notes, newest first", filtered by org.
CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting
    ON public.meeting_notes USING btree (org_id, meeting_id, created_at DESC);
-- "My notes" across meetings.
CREATE INDEX IF NOT EXISTS idx_meeting_notes_author
    ON public.meeting_notes USING btree (author_id, created_at DESC);

DROP TRIGGER IF EXISTS set_meeting_notes_updated_at ON public.meeting_notes;
CREATE TRIGGER set_meeting_notes_updated_at
    BEFORE UPDATE ON public.meeting_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

-- No anonymous access at all.
REVOKE ALL ON public.meeting_notes FROM anon;

-- SELECT carries the privacy rule. Org isolation alone is not enough: it would
-- make one colleague's private note readable by the whole org.
CREATE POLICY meeting_notes_select ON public.meeting_notes
    FOR SELECT TO authenticated
    USING (
        org_id IN (SELECT public.get_my_org_ids())
        AND (visibility = 'team' OR author_id = auth.uid())
    );

-- You may only write notes as yourself, inside your own org.
CREATE POLICY meeting_notes_insert ON public.meeting_notes
    FOR INSERT TO authenticated
    WITH CHECK (
        org_id IN (SELECT public.get_my_org_ids())
        AND author_id = auth.uid()
    );

-- USING = which rows you may edit; WITH CHECK = what they may become. Both are
-- needed, or an author could reassign author_id and hand the row away.
CREATE POLICY meeting_notes_update ON public.meeting_notes
    FOR UPDATE TO authenticated
    USING (org_id IN (SELECT public.get_my_org_ids()) AND author_id = auth.uid())
    WITH CHECK (org_id IN (SELECT public.get_my_org_ids()) AND author_id = auth.uid());

CREATE POLICY meeting_notes_delete ON public.meeting_notes
    FOR DELETE TO authenticated
    USING (org_id IN (SELECT public.get_my_org_ids()) AND author_id = auth.uid());

COMMIT;
