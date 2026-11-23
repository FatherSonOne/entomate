-- Stripe billing (billing rebuild, Phase 3): give an org its 10-hour pack
-- exactly once per paid Checkout session.
--
-- Stripe delivers a webhook at least once and retries it until it gets a 2xx,
-- and checkout.session.completed and checkout.session.async_payment_succeeded
-- can both arrive for one session. add_bot_pack_hours() just adds, so calling
-- it straight from the webhook would give a pack twice on a retry. The grant
-- row and the hours are written in one transaction here: a second call for the
-- same session inserts nothing and adds nothing.
--
-- Subscriptions need no ledger: the webhook re-reads the subscription from
-- Stripe and sets tenant_organizations.plan from it, which is the same result
-- however often or in whatever order the events come.

CREATE TABLE IF NOT EXISTS public.stripe_bot_pack_grants (
  checkout_session_id text PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  hours numeric(10,4) NOT NULL CHECK (hours > 0),
  granted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stripe_bot_pack_grants IS
  'One row per paid Stripe Checkout session that gave an org bot-hour pack hours. Written only by grant_stripe_bot_pack().';

CREATE INDEX IF NOT EXISTS stripe_bot_pack_grants_org_id_idx
  ON public.stripe_bot_pack_grants (org_id);

-- No policies: only service_role (the backend) reads or writes this table.
ALTER TABLE public.stripe_bot_pack_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_bot_pack_grants FROM anon, authenticated;

-- Returns true when the hours were added, false when this session was already granted.
CREATE OR REPLACE FUNCTION public.grant_stripe_bot_pack(p_session_id text, p_org_id uuid, p_hours numeric)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF p_session_id IS NULL OR p_session_id = '' THEN
    RAISE EXCEPTION 'grant_stripe_bot_pack: session id is required';
  END IF;

  INSERT INTO stripe_bot_pack_grants (checkout_session_id, org_id, hours)
  VALUES (p_session_id, p_org_id, p_hours)
  ON CONFLICT (checkout_session_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  PERFORM add_bot_pack_hours(p_org_id, p_hours);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_stripe_bot_pack(text, uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_stripe_bot_pack(text, uuid, numeric) TO service_role;
