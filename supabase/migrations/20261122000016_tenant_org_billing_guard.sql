-- Only the backend may set an org's billing fields (billing rebuild, before Phase 3).
--
-- The tenant_orgs_update policy lets any org member update the org row, and
-- tenant_orgs_insert accepts any row, so before this a member could give their
-- org plan = 'ecosystem' (no bot-hour limit) or fill in Stripe ids through the
-- REST API. No client code writes these columns: the app changes only name,
-- slug and settings (tenantOrgService.updateOrg) and creates orgs through the
-- create_org_for_user RPC.
--
-- The guard checks current_user, so it stops direct writes by anon and
-- authenticated and lets through service_role (backend, Stripe webhooks) and
-- SECURITY DEFINER functions (create_org_for_user, soft_delete_org, restore_org).
-- create_org_for_user still takes a plan from the client; that is closed with
-- the sign-up plan decision, not here.

CREATE OR REPLACE FUNCTION public.tenant_organizations_guard_billing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.plan IS DISTINCT FROM 'free'
       OR NEW.stripe_customer_id IS NOT NULL
       OR NEW.stripe_subscription_id IS NOT NULL
       OR NEW.ecosystem_access IS DISTINCT FROM false
       OR NEW.ai_monthly_limit IS DISTINCT FROM 50 THEN
      RAISE EXCEPTION 'Billing fields of an organization can only be set by the server'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.ecosystem_access IS DISTINCT FROM OLD.ecosystem_access
     OR NEW.ai_monthly_limit IS DISTINCT FROM OLD.ai_monthly_limit THEN
    RAISE EXCEPTION 'Billing fields of an organization can only be changed by the server'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_organizations_guard_billing ON public.tenant_organizations;
CREATE TRIGGER tenant_organizations_guard_billing
  BEFORE INSERT OR UPDATE ON public.tenant_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.tenant_organizations_guard_billing();

REVOKE ALL ON FUNCTION public.tenant_organizations_guard_billing() FROM PUBLIC, anon, authenticated;
