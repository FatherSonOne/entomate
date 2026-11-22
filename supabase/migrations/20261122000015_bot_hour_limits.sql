-- Bot-hour limits for the Solo / Team plans (billing rebuild, Phase 1).
--
-- Approved pricing 2026-11-22: Solo 15 bot hours/month, Team 75 shared bot
-- hours/month per org, extra hours sold in 10-hour packs. Older plans
-- (free/starter/pro/business/ecosystem) keep no bot-hour limit until they are
-- moved onto the new plans.
--
-- Usage is DERIVED from bot_sessions, never stored as a running total:
--   * a session's billable time starts at greatest(started_at, join_at)
--     (started_at is the launch call, which for a scheduled calendar bot can be
--     days before the meeting) and ends at ended_at, or now() while it runs;
--   * a session belongs to the UTC month in which its billable time starts.
-- Pack hours are a stored balance (org_bot_hour_balances). When a session ends,
-- a trigger charges the part of it that went past the plan's monthly hours to
-- the balance and records that charge on the session (pack_hours_charged).
-- Pack hours do not expire.
--
-- Only the backend (service_role) reads or writes any of this. The balance is
-- in its own table on purpose: tenant_organizations is writable by any org
-- member through the tenant_orgs_update policy.

-- 1. New plan values (old ones kept).
ALTER TABLE public.tenant_organizations
  DROP CONSTRAINT IF EXISTS tenant_organizations_plan_check;
ALTER TABLE public.tenant_organizations
  ADD CONSTRAINT tenant_organizations_plan_check
  CHECK (plan = ANY (ARRAY['free','starter','pro','business','ecosystem','solo','team']::text[]));

-- 2. Pack-hours balance, one row per org.
CREATE TABLE IF NOT EXISTS public.org_bot_hour_balances (
  org_id uuid PRIMARY KEY REFERENCES public.tenant_organizations(id) ON DELETE CASCADE,
  pack_hours numeric(10,4) NOT NULL DEFAULT 0 CHECK (pack_hours >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_bot_hour_balances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_bot_hour_balances FROM anon, authenticated;
COMMENT ON TABLE public.org_bot_hour_balances IS
  'Unused extra bot hours bought in packs. Written only by add_bot_pack_hours() and the bot_sessions settle trigger.';

-- 3. What each finished session took from the pack balance.
ALTER TABLE public.bot_sessions
  ADD COLUMN IF NOT EXISTS pack_hours_charged numeric(10,4);
COMMENT ON COLUMN public.bot_sessions.pack_hours_charged IS
  'Hours of this session charged to org_bot_hour_balances when it ended. NULL until it ends.';

CREATE INDEX IF NOT EXISTS bot_sessions_org_started_idx
  ON public.bot_sessions (org_id, started_at);

-- 4. Monthly hours included in a plan. NULL = no limit.
CREATE OR REPLACE FUNCTION public.bot_hours_included(p_plan text)
RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT CASE p_plan WHEN 'solo' THEN 15 WHEN 'team' THEN 75 ELSE NULL END::numeric;
$$;

-- 5. Billable start of a session (NULL if it never reached Recall).
CREATE OR REPLACE FUNCTION public.bot_session_billable_start(p_started timestamptz, p_join timestamptz)
RETURNS timestamptz
LANGUAGE sql IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT CASE WHEN p_started IS NULL THEN NULL ELSE greatest(p_started, coalesce(p_join, p_started)) END;
$$;

-- 6. Billable hours of a session between its billable start and p_end.
CREATE OR REPLACE FUNCTION public.bot_session_billable_hours(p_started timestamptz, p_join timestamptz, p_end timestamptz)
RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT CASE
    WHEN p_started IS NULL OR p_end IS NULL THEN 0
    ELSE greatest(0, extract(epoch FROM p_end - public.bot_session_billable_start(p_started, p_join)) / 3600.0)
  END::numeric;
$$;

-- 7. Bot-hour state of an org for the current UTC month.
CREATE OR REPLACE FUNCTION public.get_org_bot_hours(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_month timestamptz := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_plan text;
  v_included numeric;
  v_used numeric;
  v_charged numeric;
  v_pack numeric;
BEGIN
  SELECT plan INTO v_plan FROM tenant_organizations WHERE id = p_org_id;
  v_included := bot_hours_included(v_plan);

  SELECT coalesce(sum(bot_session_billable_hours(started_at, join_at, coalesce(ended_at, now()))), 0),
         coalesce(sum(pack_hours_charged), 0)
    INTO v_used, v_charged
    FROM bot_sessions
   WHERE org_id = p_org_id
     AND bot_session_billable_start(started_at, join_at) >= v_month
     AND bot_session_billable_start(started_at, join_at) < v_month + interval '1 month';

  SELECT coalesce((SELECT pack_hours FROM org_bot_hour_balances WHERE org_id = p_org_id), 0) INTO v_pack;

  RETURN jsonb_build_object(
    'plan', v_plan,
    'included_hours', v_included,
    'used_hours', round(v_used, 2),
    'pack_hours', round(v_pack, 2),
    -- Plan hours used = all hours minus the part already paid from packs.
    'remaining_hours', CASE WHEN v_included IS NULL THEN NULL
                            ELSE round(greatest(v_included + v_pack - (v_used - v_charged), 0), 2) END,
    'limited', v_included IS NOT NULL,
    'resets_at', v_month + interval '1 month'
  );
END;
$$;

-- 8. Add bought pack hours to an org's balance (Phase 3 calls this from Stripe).
CREATE OR REPLACE FUNCTION public.add_bot_pack_hours(p_org_id uuid, p_hours numeric)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF p_hours IS NULL OR p_hours <= 0 THEN
    RAISE EXCEPTION 'add_bot_pack_hours: hours must be positive';
  END IF;
  INSERT INTO org_bot_hour_balances (org_id, pack_hours)
  VALUES (p_org_id, p_hours)
  ON CONFLICT (org_id) DO UPDATE
    SET pack_hours = org_bot_hour_balances.pack_hours + EXCLUDED.pack_hours,
        updated_at = now()
  RETURNING pack_hours INTO v_balance;
  RETURN v_balance;
END;
$$;

-- 9. When a session ends, charge its hours past the plan's monthly hours to packs.
CREATE OR REPLACE FUNCTION public.bot_sessions_settle_pack_hours()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_start timestamptz := bot_session_billable_start(NEW.started_at, NEW.join_at);
  v_month timestamptz;
  v_included numeric;
  v_hours numeric;
  v_plan_used numeric;
  v_overage numeric;
  v_balance numeric;
  v_charge numeric := 0;
BEGIN
  SELECT bot_hours_included(plan) INTO v_included FROM tenant_organizations WHERE id = NEW.org_id;
  v_hours := bot_session_billable_hours(NEW.started_at, NEW.join_at, NEW.ended_at);

  IF v_included IS NOT NULL AND v_hours > 0 THEN
    -- One settle at a time per org, so two sessions ending together cannot
    -- both use the same remaining plan hours.
    PERFORM pg_advisory_xact_lock(hashtext('bot_hours:' || NEW.org_id::text));
    v_month := date_trunc('month', v_start AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

    SELECT coalesce(sum(bot_session_billable_hours(started_at, join_at, ended_at) - coalesce(pack_hours_charged, 0)), 0)
      INTO v_plan_used
      FROM bot_sessions
     WHERE org_id = NEW.org_id
       AND id <> NEW.id
       AND ended_at IS NOT NULL
       AND bot_session_billable_start(started_at, join_at) >= v_month
       AND bot_session_billable_start(started_at, join_at) < v_month + interval '1 month';

    v_overage := greatest(v_hours - greatest(v_included - v_plan_used, 0), 0);
    IF v_overage > 0 THEN
      SELECT pack_hours INTO v_balance FROM org_bot_hour_balances WHERE org_id = NEW.org_id FOR UPDATE;
      v_charge := least(v_overage, coalesce(v_balance, 0));
      IF v_charge > 0 THEN
        UPDATE org_bot_hour_balances
           SET pack_hours = pack_hours - v_charge, updated_at = now()
         WHERE org_id = NEW.org_id;
      END IF;
    END IF;
  END IF;

  NEW.pack_hours_charged := v_charge;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_sessions_settle_pack_hours ON public.bot_sessions;
CREATE TRIGGER bot_sessions_settle_pack_hours
  BEFORE UPDATE OF ended_at ON public.bot_sessions
  FOR EACH ROW
  WHEN (OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL)
  EXECUTE FUNCTION public.bot_sessions_settle_pack_hours();

-- 10. Backend only.
REVOKE ALL ON FUNCTION public.get_org_bot_hours(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_bot_pack_hours(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_sessions_settle_pack_hours() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_bot_hours(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_bot_pack_hours(uuid, numeric) TO service_role;
