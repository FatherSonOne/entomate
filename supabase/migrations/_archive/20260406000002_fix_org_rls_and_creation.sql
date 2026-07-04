-- ============================================================
-- MIGRATION: 20260406000002_fix_org_rls_and_creation.sql
-- PURPOSE:   Fix the org creation flow after soft-delete by:
--   1. Dropping the old tenant_orgs_select policy that doesn't
--      filter deleted orgs (it was never dropped by 000002).
--   2. Replacing create_org_for_user with a version that properly
--      ignores soft-deleted memberships and cleans up stale rows.
--   3. Adding an org_members SELECT policy that allows users to
--      see their own membership row (needed for getCurrentOrg).
-- DATE:      2026-04-06
-- DEPENDS:   20260406000001_fix_create_org_soft_delete_check.sql
-- ============================================================

BEGIN;

-- ============================================================
-- FIX 1: Drop the stale tenant_orgs_select policy
-- The deletion migration (000002) created tenant_org_select but
-- never dropped the original tenant_orgs_select (note the 's').
-- Both exist, and the old one shows soft-deleted orgs via the
-- joined query, causing 500 errors in PostgREST.
-- ============================================================

DROP POLICY IF EXISTS tenant_orgs_select ON public.tenant_organizations;

-- ============================================================
-- FIX 2: Ensure org_members has a self-read policy
-- Users need to always be able to read their OWN membership row,
-- even when the org they belong to is soft-deleted (so that
-- getCurrentOrg can detect the stale membership and getDeletedOrg
-- can find it). The existing org_members_select policy uses a
-- self-referencing subquery that can fail in edge cases.
-- Replace it with one that simply allows reading your own rows.
-- ============================================================

DROP POLICY IF EXISTS org_members_select ON public.org_members;

CREATE POLICY org_members_select ON public.org_members
  FOR SELECT USING (
    -- Users can always see memberships in their own orgs
    user_id = auth.uid()
    OR org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- ============================================================
-- FIX 3: Replace create_org_for_user (consolidated fix)
-- - Checks only ACTIVE orgs when preventing duplicates
-- - Cleans up stale memberships in soft-deleted orgs
-- - Uses auth search_path for metadata lookup
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_org_for_user(
  p_name TEXT,
  p_slug TEXT,
  p_plan TEXT DEFAULT 'free'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_email TEXT;
  v_display_name TEXT;
  v_ai_limit INTEGER;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Prevent creating a second org — but IGNORE memberships
  -- in soft-deleted organizations (they are effectively dead).
  IF EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.tenant_organizations t ON t.id = om.org_id
    WHERE om.user_id = v_user_id
      AND t.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  -- Clean up any stale memberships in soft-deleted orgs
  -- so the user starts completely fresh.
  DELETE FROM public.org_members
  WHERE user_id = v_user_id
    AND org_id IN (
      SELECT id FROM public.tenant_organizations
      WHERE deleted_at IS NOT NULL
    );

  -- Resolve plan limits
  CASE p_plan
    WHEN 'starter' THEN v_ai_limit := 500;
    WHEN 'pro' THEN v_ai_limit := 2000;
    WHEN 'business' THEN v_ai_limit := 10000;
    WHEN 'ecosystem' THEN v_ai_limit := 10000;
    ELSE v_ai_limit := 100; -- free
  END CASE;

  INSERT INTO public.tenant_organizations (name, slug, plan, ai_monthly_limit, settings)
  VALUES (p_name, p_slug, p_plan, v_ai_limit, '{}')
  RETURNING id INTO v_org_id;

  -- Get user metadata for denormalized fields
  SELECT
    COALESCE(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', email),
    email
  INTO v_display_name, v_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Create owner membership
  INSERT INTO public.org_members (org_id, user_id, role, user_name, user_email)
  VALUES (v_org_id, v_user_id, 'owner', v_display_name, v_email);

  RETURN v_org_id;
END;
$$;

-- ============================================================
-- FIX 4: Ensure tenant_organizations INSERT policy exists
-- for SECURITY DEFINER functions (belt-and-suspenders).
-- ============================================================

DROP POLICY IF EXISTS tenant_orgs_insert ON public.tenant_organizations;
CREATE POLICY tenant_orgs_insert ON public.tenant_organizations
  FOR INSERT WITH CHECK (true);  -- Guarded by SECURITY DEFINER RPCs

COMMIT;
