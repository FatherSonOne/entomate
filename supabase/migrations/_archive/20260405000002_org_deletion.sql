-- ============================================================
-- MIGRATION: 20260405000002_org_deletion.sql
-- PURPOSE:   Organization soft-delete with 30-day recovery window
--            and owner-only hard-delete for permanent removal.
-- DATE:      2026-04-05
-- DEPENDS:   20260405000001_tenant_multi_tenancy.sql
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: Add soft-delete columns to tenant_organizations
-- ============================================================

ALTER TABLE public.tenant_organizations
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_orgs_deleted_at
  ON public.tenant_organizations(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ============================================================
-- SECTION 2: Update RLS — exclude soft-deleted from normal SELECT
-- ============================================================

-- Drop and recreate the select policy to filter out deleted orgs
DROP POLICY IF EXISTS tenant_org_select ON public.tenant_organizations;

CREATE POLICY tenant_org_select ON public.tenant_organizations
  FOR SELECT USING (
    deleted_at IS NULL
    AND id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- New policy: owner can see their own soft-deleted orgs (for interstitial)
DROP POLICY IF EXISTS tenant_org_select_deleted ON public.tenant_organizations;

CREATE POLICY tenant_org_select_deleted ON public.tenant_organizations
  FOR SELECT USING (
    deleted_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

-- ============================================================
-- SECTION 3: soft_delete_org RPC
-- Owner or admin can soft-delete an organization.
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_org(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Check caller is owner or admin
  SELECT role INTO v_role
  FROM public.org_members
  WHERE org_id = p_org_id
    AND user_id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied: only owners and admins can archive an organization';
  END IF;

  UPDATE public.tenant_organizations
  SET deleted_at = NOW(),
      deleted_by = auth.uid()
  WHERE id = p_org_id
    AND deleted_at IS NULL;
END;
$$;

-- ============================================================
-- SECTION 4: hard_delete_org RPC
-- Owner-only permanent deletion. FK cascades handle org_members,
-- org_invites, and org_ai_usage_monthly.
-- ============================================================

CREATE OR REPLACE FUNCTION public.hard_delete_org(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Owner-only guard
  IF NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the organization owner can permanently delete';
  END IF;

  -- Hard-delete — FK ON DELETE CASCADE handles org_members,
  -- org_invites, and org_ai_usage_monthly.
  -- User-owned data (projects, tasks, automations, agents) is NOT org-scoped
  -- and remains intact.
  DELETE FROM public.tenant_organizations
  WHERE id = p_org_id;
END;
$$;

-- ============================================================
-- SECTION 5: restore_org RPC
-- Owner-only, within 30-day recovery window.
-- ============================================================

CREATE OR REPLACE FUNCTION public.restore_org(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Owner-only guard + 30-day window
  IF NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Permission denied: only the organization owner can restore';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_organizations
    WHERE id = p_org_id
      AND deleted_at IS NOT NULL
      AND deleted_at > NOW() - INTERVAL '30 days'
  ) THEN
    RAISE EXCEPTION 'Cannot restore: organization not found, not deleted, or past 30-day recovery window';
  END IF;

  UPDATE public.tenant_organizations
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = p_org_id;
END;
$$;

COMMIT;
