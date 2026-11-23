-- Drop the legacy Entomate plans from the plan check (billing rebuild follow-up).
--
-- starter / pro / business were the Pulse-copied tiers ($19/$49/$99). The
-- approved plans are free / solo / team, plus the contact-only ecosystem
-- bundle. Measured 2026-11-23 before this ran: no org (deleted or not) is on
-- starter, pro or business (3 free, 1 team, 1 ecosystem). The last one, the
-- Entomate Test Org, moved pro -> team in Phase 4.
--
-- ADD CONSTRAINT validates every existing row, so this fails rather than
-- strands an org if one is on a legacy plan again by the time it runs.

ALTER TABLE public.tenant_organizations
  DROP CONSTRAINT IF EXISTS tenant_organizations_plan_check;
ALTER TABLE public.tenant_organizations
  ADD CONSTRAINT tenant_organizations_plan_check
  CHECK (plan = ANY (ARRAY['free','solo','team','ecosystem']::text[]));
