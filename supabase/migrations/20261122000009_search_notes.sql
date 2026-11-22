-- ========================================
-- Migration: Search notes (clips)
-- Date: 2026-11-22
-- ========================================
--
-- The Notes column on the Search page: snippets, decisions, answers and
-- transcript lines a person clips from search, the ⌘K palette, a meeting page
-- or another module, plus notes they type themselves. Private to the person
-- who wrote them (there is no team visibility).
--
-- The backend uses the service-role key, which BYPASSES RLS, so the real
-- enforcement for app traffic is in backend/services/searchNotesService.js
-- (every query is scoped by user_id and org). The policies below are defence
-- in depth. org_id and user_id have no defaults: the backend stamps both.

BEGIN;

CREATE TABLE IF NOT EXISTS public.search_notes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
    -- auth.users.id (= auth.uid()), which is what req.user.id carries.
    user_id uuid NOT NULL,
    -- What was clipped: a typed note, or a copy of a result.
    kind text NOT NULL DEFAULT 'note',
    -- Copied text (the snippet, the decision, the answer, or the typed note).
    body text NOT NULL,
    -- Where it came from, kept so the clip still links back after edits.
    source_type text,
    source_id text,
    source_label text,
    at_ms integer,
    -- The search that found it, and the surface it was clipped from.
    query text,
    origin text NOT NULL DEFAULT 'search',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT search_notes_kind_check CHECK (kind IN ('note', 'meeting', 'decision', 'action_item', 'task', 'project', 'transcript', 'answer', 'meeting_note')),
    CONSTRAINT search_notes_origin_check CHECK (origin IN ('search', 'palette', 'meeting', 'ask', 'tasks', 'other')),
    CONSTRAINT search_notes_body_not_blank CHECK (btrim(body) <> ''),
    CONSTRAINT search_notes_body_max_length CHECK (char_length(body) <= 8000),
    CONSTRAINT search_notes_at_ms_nonneg CHECK (at_ms IS NULL OR at_ms >= 0)
);

COMMENT ON TABLE public.search_notes IS 'Notes and clips collected on the Search page. Private to user_id.';

CREATE INDEX IF NOT EXISTS idx_search_notes_user
    ON public.search_notes USING btree (user_id, org_id, created_at DESC);

DROP TRIGGER IF EXISTS set_search_notes_updated_at ON public.search_notes;
CREATE TRIGGER set_search_notes_updated_at
    BEFORE UPDATE ON public.search_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.search_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.search_notes FROM anon;

CREATE POLICY search_notes_select ON public.search_notes
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() AND org_id IN (SELECT public.get_my_org_ids()));

CREATE POLICY search_notes_insert ON public.search_notes
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND org_id IN (SELECT public.get_my_org_ids()));

CREATE POLICY search_notes_update ON public.search_notes
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid() AND org_id IN (SELECT public.get_my_org_ids()));

CREATE POLICY search_notes_delete ON public.search_notes
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

COMMIT;
