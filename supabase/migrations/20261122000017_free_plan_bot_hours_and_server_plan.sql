-- Sign-up plan decision (Frank, 2026-11-22): new orgs start on Free, which gets
-- a small bot allowance of 2 bot hours a month. Paid plans come only from
-- checkout (Phase 3), so create_org_for_user no longer takes the plan from the
-- client. Before this the sign-up wizard let anyone pick starter/pro/business/
-- ecosystem without paying, and Free had no bot-hour limit at all.

-- 1. Free = 2 bot hours/month. Other legacy plans still have no limit.
CREATE OR REPLACE FUNCTION public.bot_hours_included(p_plan text)
RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT CASE p_plan WHEN 'free' THEN 2 WHEN 'solo' THEN 15 WHEN 'team' THEN 75 ELSE NULL END::numeric;
$$;

-- 2. The server sets the plan. p_plan stays in the signature so the client that
--    is already deployed (which still sends it) keeps working; it is ignored.
CREATE OR REPLACE FUNCTION public.create_org_for_user(p_name text, p_slug text, p_plan text DEFAULT 'free'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_email TEXT;
  v_display_name TEXT;
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

  INSERT INTO public.tenant_organizations (name, slug, plan, ai_monthly_limit, settings)
  VALUES (p_name, p_slug, 'free', 100, '{}')
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
$function$;
