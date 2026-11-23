-- ========================================
-- Migration: ento_ai_search_threads (EAI-02c slice 4)
-- Date: 2026-11-23
-- ========================================
-- Why: the history page ("View all conversations") lists every Entomate AI
-- thread of the caller, with search across titles and message text. The rail
-- reads the newest 20 through PostgREST, but PostgREST cannot filter on the
-- text inside `messages` or count them, so the page reads through this
-- function. Port of Logos Vision's search_logos_ai_threads() without pin and
-- archive (ento_ai_threads has neither column).
--
-- SECURITY INVOKER: the table's "ento_ai_threads_own" policy (owner AND org
-- member) decides every row; the user_id and org filters below are a second
-- fence, as in backend/routes/entoAi.js (D2).
-- Reader: GET /api/ento-ai/threads/search. No writer. Safe to run more than once.

BEGIN;

CREATE OR REPLACE FUNCTION public.ento_ai_search_threads(
  p_org_ids uuid[],
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  created_at timestamptz,
  updated_at timestamptz,
  message_count integer,
  snippet text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
  WITH q AS (
    SELECT
      nullif(btrim(coalesce(p_query, '')), '') AS term,
      -- Escape LIKE wildcards so a search for "50%" means the text "50%".
      '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pattern
  ),
  hits AS (
    SELECT
      t.id, t.title, t.created_at, t.updated_at,
      jsonb_array_length(t.messages) AS message_count,
      CASE WHEN q.term IS NULL THEN NULL ELSE (
        SELECT e->>'content'
          FROM jsonb_array_elements(t.messages) e
         WHERE e->>'content' ILIKE q.pattern
         LIMIT 1
      ) END AS matched,
      q.term
    FROM public.ento_ai_threads t, q
    WHERE t.user_id = (SELECT auth.uid())
      AND t.org_id = ANY (p_org_ids)
  )
  SELECT
    h.id, h.title, h.created_at, h.updated_at, h.message_count,
    CASE WHEN h.matched IS NULL THEN NULL ELSE
      substr(
        regexp_replace(h.matched, '\s+', ' ', 'g'),
        greatest(1, strpos(lower(regexp_replace(h.matched, '\s+', ' ', 'g')), lower(h.term)) - 60),
        180
      )
    END AS snippet,
    count(*) OVER () AS total_count
  FROM hits h, q
  WHERE h.term IS NULL
     OR h.title ILIKE q.pattern
     OR h.matched IS NOT NULL
  ORDER BY h.updated_at DESC, h.id
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 200)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.ento_ai_search_threads(uuid[], text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ento_ai_search_threads(uuid[], text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.ento_ai_search_threads(uuid[], text, integer, integer) TO authenticated, service_role;

COMMIT;
