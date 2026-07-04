-- ============================================================
-- MIGRATION: 20260405000001_tenant_multi_tenancy.sql
-- PURPOSE:   Multi-tenant organization system for Entomate.
--            Creates tenant_organizations, org_members, org_invites,
--            org_ai_usage_monthly tables. Adds plan tiers matching
--            the QntmEcos billing system (free/starter/pro/business).
--            Includes RPC bootstrap for org creation (bypasses RLS).
-- DATE:      2026-04-05
-- SAFE:      Fully idempotent via IF NOT EXISTS / CREATE OR REPLACE
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: tenant_organizations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenant_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free'
    CHECK (plan IN ('free', 'starter', 'pro', 'business', 'ecosystem')),
  ai_monthly_limit INTEGER DEFAULT 100,
  ai_custom_api_key TEXT,
  ai_custom_api_key_active BOOLEAN DEFAULT false,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.tenant_organizations IS
  'Multi-tenant organizations for Entomate. Each org has a plan tier and usage limits.';

CREATE INDEX IF NOT EXISTS idx_tenant_orgs_slug
  ON public.tenant_organizations(slug);

-- ============================================================
-- SECTION 2: org_members
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  -- Denormalized user info (populated by trigger or app layer)
  user_name TEXT,
  user_email TEXT,
  user_avatar_url TEXT,
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user
  ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org
  ON public.org_members(org_id);

-- ============================================================
-- SECTION 3: org_invites
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member'
    CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, email, status)
);

CREATE INDEX IF NOT EXISTS idx_org_invites_email
  ON public.org_invites(email);
CREATE INDEX IF NOT EXISTS idx_org_invites_token
  ON public.org_invites(token);

-- ============================================================
-- SECTION 4: org_ai_usage_monthly
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_ai_usage_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  request_count INTEGER DEFAULT 0,
  tokens_input BIGINT DEFAULT 0,
  tokens_output BIGINT DEFAULT 0,
  estimated_cost NUMERIC(10, 4) DEFAULT 0,
  UNIQUE(org_id, month)
);

CREATE INDEX IF NOT EXISTS idx_org_ai_usage_org_month
  ON public.org_ai_usage_monthly(org_id, month);

-- ============================================================
-- SECTION 5: RLS Policies
-- ============================================================

ALTER TABLE public.tenant_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_ai_usage_monthly ENABLE ROW LEVEL SECURITY;

-- tenant_organizations: members can read their own org
DROP POLICY IF EXISTS tenant_orgs_select ON public.tenant_organizations;
CREATE POLICY tenant_orgs_select ON public.tenant_organizations
  FOR SELECT USING (
    id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- tenant_organizations: owner/admin can update
DROP POLICY IF EXISTS tenant_orgs_update ON public.tenant_organizations;
CREATE POLICY tenant_orgs_update ON public.tenant_organizations
  FOR UPDATE USING (
    id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- org_members: members can read their own org's members
DROP POLICY IF EXISTS org_members_select ON public.org_members;
CREATE POLICY org_members_select ON public.org_members
  FOR SELECT USING (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- org_members: owner/admin can insert
DROP POLICY IF EXISTS org_members_insert ON public.org_members;
CREATE POLICY org_members_insert ON public.org_members
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- org_members: owner/admin can update roles
DROP POLICY IF EXISTS org_members_update ON public.org_members;
CREATE POLICY org_members_update ON public.org_members
  FOR UPDATE USING (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- org_members: owner/admin can delete
DROP POLICY IF EXISTS org_members_delete ON public.org_members;
CREATE POLICY org_members_delete ON public.org_members
  FOR DELETE USING (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- org_invites: org members can read invites
DROP POLICY IF EXISTS org_invites_select ON public.org_invites;
CREATE POLICY org_invites_select ON public.org_invites
  FOR SELECT USING (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
    )
    OR email = (SELECT auth.jwt() ->> 'email')
  );

-- org_invites: owner/admin can insert
DROP POLICY IF EXISTS org_invites_insert ON public.org_invites;
CREATE POLICY org_invites_insert ON public.org_invites
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- org_invites: owner/admin can update (revoke)
DROP POLICY IF EXISTS org_invites_update ON public.org_invites;
CREATE POLICY org_invites_update ON public.org_invites
  FOR UPDATE USING (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- org_ai_usage_monthly: members can read
DROP POLICY IF EXISTS org_ai_usage_select ON public.org_ai_usage_monthly;
CREATE POLICY org_ai_usage_select ON public.org_ai_usage_monthly
  FOR SELECT USING (
    org_id IN (
      SELECT om.org_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- ============================================================
-- SECTION 6: RPC — create_org_for_user (SECURITY DEFINER)
-- Bypasses RLS chicken-and-egg for org creation.
-- Creates the org + owner membership in one transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_org_for_user(
  p_name TEXT,
  p_slug TEXT,
  p_plan TEXT DEFAULT 'free'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_email TEXT;
  v_display_name TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Prevent creating a second org
  IF EXISTS (SELECT 1 FROM public.org_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  -- Resolve plan limits
  DECLARE
    v_ai_limit INTEGER;
  BEGIN
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
  END;

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
-- SECTION 7: RPC — increment_ai_usage (atomic upsert)
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_org_id UUID,
  p_month DATE DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month DATE;
BEGIN
  v_month := COALESCE(p_month, date_trunc('month', CURRENT_DATE)::DATE);

  INSERT INTO public.org_ai_usage_monthly (org_id, month, request_count)
  VALUES (p_org_id, v_month, 1)
  ON CONFLICT (org_id, month)
  DO UPDATE SET request_count = org_ai_usage_monthly.request_count + 1;
END;
$$;

-- ============================================================
-- SECTION 8: Updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_orgs_updated_at ON public.tenant_organizations;
CREATE TRIGGER trg_tenant_orgs_updated_at
  BEFORE UPDATE ON public.tenant_organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
