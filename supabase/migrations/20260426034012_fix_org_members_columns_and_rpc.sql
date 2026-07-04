-- ============================================================
-- MIGRATION: 20260426034012_fix_org_members_columns_and_rpc
-- SECTION:   S2 — migration-history reconciliation
-- PROVENANCE: RECOVERED 2026-07-04 from the remote migration ledger
--            (supabase_migrations.schema_migrations). This SQL was applied
--            to production on 2026-04-26 but the file was never committed to
--            the repo — it existed only in the remote ledger. Restoring it
--            here closes that reproducibility/data-loss gap. It is already
--            applied on prod; it is idempotent (CREATE OR REPLACE / IF NOT
--            EXISTS) and safe to re-run.
--
--            It CONSOLIDATES and supersedes three earlier local files that
--            were never applied under their own names:
--              20260406000001_fix_create_org_soft_delete_check.sql
--              20260406000002_fix_org_rls_and_creation.sql
--              20260407000001_fix_org_members_rls_recursion.sql
--            (those three are retired in the S2 baseline step.)
-- ============================================================

-- ============================================================
-- MIGRATION: fix_org_members_columns_and_rpc
-- PURPOSE:   The live org_members table predated the multi-tenancy
--            migration, so CREATE TABLE IF NOT EXISTS skipped adding
--            the denormalized user_name/user_email/user_avatar_url
--            columns. create_org_for_user inserts into them and 400s.
--            This consolidates fixes from migrations 20260406000001,
--            20260406000002, and 20260407000001 into one idempotent
--            patch that brings the live DB up to date.
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Add missing columns to org_members
-- ============================================================

ALTER TABLE public.org_members
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS user_avatar_url TEXT;

-- ============================================================
-- STEP 2: Helper function to break RLS recursion on org_members
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid();
$$;

-- ============================================================
-- STEP 3: Replace create_org_for_user (consolidated, latest)
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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.tenant_organizations t ON t.id = om.org_id
    WHERE om.user_id = v_user_id
      AND t.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  DELETE FROM public.org_members
  WHERE user_id = v_user_id
    AND org_id IN (
      SELECT id FROM public.tenant_organizations
      WHERE deleted_at IS NOT NULL
    );

  CASE p_plan
    WHEN 'starter' THEN v_ai_limit := 500;
    WHEN 'pro' THEN v_ai_limit := 2000;
    WHEN 'business' THEN v_ai_limit := 10000;
    WHEN 'ecosystem' THEN v_ai_limit := 10000;
    ELSE v_ai_limit := 100;
  END CASE;

  INSERT INTO public.tenant_organizations (name, slug, plan, ai_monthly_limit, settings)
  VALUES (p_name, p_slug, p_plan, v_ai_limit, '{}')
  RETURNING id INTO v_org_id;

  SELECT
    COALESCE(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', email),
    email
  INTO v_display_name, v_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public.org_members (org_id, user_id, role, user_name, user_email)
  VALUES (v_org_id, v_user_id, 'owner', v_display_name, v_email);

  RETURN v_org_id;
END;
$$;

-- ============================================================
-- STEP 4: Fix RLS — drop stale policies, use helper, no recursion
-- ============================================================

DROP POLICY IF EXISTS tenant_orgs_select ON public.tenant_organizations;
DROP POLICY IF EXISTS tenant_org_select ON public.tenant_organizations;
CREATE POLICY tenant_org_select ON public.tenant_organizations
  FOR SELECT USING (
    deleted_at IS NULL
    AND id IN (SELECT public.get_my_org_ids())
  );

DROP POLICY IF EXISTS tenant_org_select_deleted ON public.tenant_organizations;
CREATE POLICY tenant_org_select_deleted ON public.tenant_organizations
  FOR SELECT USING (
    deleted_at IS NOT NULL
    AND id IN (SELECT public.get_my_org_ids())
  );

DROP POLICY IF EXISTS tenant_orgs_update ON public.tenant_organizations;
CREATE POLICY tenant_orgs_update ON public.tenant_organizations
  FOR UPDATE USING (
    id IN (SELECT public.get_my_org_ids())
  );

DROP POLICY IF EXISTS tenant_orgs_insert ON public.tenant_organizations;
CREATE POLICY tenant_orgs_insert ON public.tenant_organizations
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS org_members_select ON public.org_members;
CREATE POLICY org_members_select ON public.org_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR org_id IN (SELECT public.get_my_org_ids())
  );

DROP POLICY IF EXISTS org_members_insert ON public.org_members;
CREATE POLICY org_members_insert ON public.org_members
  FOR INSERT WITH CHECK (
    org_id IN (SELECT public.get_my_org_ids())
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = org_members.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS org_members_update ON public.org_members;
CREATE POLICY org_members_update ON public.org_members
  FOR UPDATE USING (
    org_id IN (SELECT public.get_my_org_ids())
  );

DROP POLICY IF EXISTS org_members_delete ON public.org_members;
CREATE POLICY org_members_delete ON public.org_members
  FOR DELETE USING (
    org_id IN (SELECT public.get_my_org_ids())
  );

DROP POLICY IF EXISTS org_invites_select ON public.org_invites;
CREATE POLICY org_invites_select ON public.org_invites
  FOR SELECT USING (
    org_id IN (SELECT public.get_my_org_ids())
    OR email = (SELECT auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS org_invites_insert ON public.org_invites;
CREATE POLICY org_invites_insert ON public.org_invites
  FOR INSERT WITH CHECK (
    org_id IN (SELECT public.get_my_org_ids())
  );

DROP POLICY IF EXISTS org_invites_update ON public.org_invites;
CREATE POLICY org_invites_update ON public.org_invites
  FOR UPDATE USING (
    org_id IN (SELECT public.get_my_org_ids())
  );

DROP POLICY IF EXISTS org_ai_usage_select ON public.org_ai_usage_monthly;
CREATE POLICY org_ai_usage_select ON public.org_ai_usage_monthly
  FOR SELECT USING (
    org_id IN (SELECT public.get_my_org_ids())
  );

COMMIT;
