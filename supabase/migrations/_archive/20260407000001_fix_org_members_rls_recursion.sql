-- ============================================================
-- MIGRATION: 20260407000001_fix_org_members_rls_recursion.sql
-- PURPOSE:   Fix infinite recursion in org_members RLS policies.
--            The org_members SELECT/INSERT/UPDATE/DELETE policies
--            all reference org_members in their own subqueries,
--            causing PostgreSQL infinite recursion errors.
--            Fix: create a SECURITY DEFINER helper function that
--            bypasses RLS to get the user's org IDs, then use it
--            in all policies.
-- DATE:      2026-04-07
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Helper function — bypasses RLS to break recursion
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
-- STEP 2: Fix org_members policies (the source of recursion)
-- ============================================================

-- SELECT: see your own rows + all members in your orgs
DROP POLICY IF EXISTS org_members_select ON public.org_members;
CREATE POLICY org_members_select ON public.org_members
  FOR SELECT USING (
    org_id IN (SELECT public.get_my_org_ids())
  );

-- INSERT: owner/admin can add members
DROP POLICY IF EXISTS org_members_insert ON public.org_members;
CREATE POLICY org_members_insert ON public.org_members
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT public.get_my_org_ids()
    )
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = org_members.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- UPDATE: owner/admin can update roles
DROP POLICY IF EXISTS org_members_update ON public.org_members;
CREATE POLICY org_members_update ON public.org_members
  FOR UPDATE USING (
    org_id IN (SELECT public.get_my_org_ids())
  );

-- DELETE: owner/admin can remove members
DROP POLICY IF EXISTS org_members_delete ON public.org_members;
CREATE POLICY org_members_delete ON public.org_members
  FOR DELETE USING (
    org_id IN (SELECT public.get_my_org_ids())
  );

-- ============================================================
-- STEP 3: Fix tenant_organizations policies too (use helper)
-- ============================================================

DROP POLICY IF EXISTS tenant_orgs_select ON public.tenant_organizations;
DROP POLICY IF EXISTS tenant_org_select ON public.tenant_organizations;
CREATE POLICY tenant_org_select ON public.tenant_organizations
  FOR SELECT USING (
    deleted_at IS NULL
    AND id IN (SELECT public.get_my_org_ids())
  );

-- Owner can see soft-deleted orgs (for interstitial)
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

-- ============================================================
-- STEP 4: Fix org_invites policies (use helper)
-- ============================================================

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

-- ============================================================
-- STEP 5: Fix org_ai_usage_monthly policy (use helper)
-- ============================================================

DROP POLICY IF EXISTS org_ai_usage_select ON public.org_ai_usage_monthly;
CREATE POLICY org_ai_usage_select ON public.org_ai_usage_monthly
  FOR SELECT USING (
    org_id IN (SELECT public.get_my_org_ids())
  );

COMMIT;
