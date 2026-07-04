-- ============================================================
-- MIGRATION: 20260406000001_fix_create_org_soft_delete_check.sql
-- PURPOSE:   Fix create_org_for_user to allow creating a new org
--            when user only has membership in a soft-deleted org.
--            Also auto-clean the stale membership before creating.
-- DATE:      2026-04-06
-- DEPENDS:   20260405000002_org_deletion.sql
-- ============================================================

BEGIN;

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

  -- Prevent creating a second org — but ignore memberships
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

COMMIT;
