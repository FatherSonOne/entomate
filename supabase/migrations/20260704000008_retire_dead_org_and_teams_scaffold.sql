-- ============================================================
-- MIGRATION: 20260704000008_retire_dead_org_and_teams_scaffold
-- SECTION:   S2 — repo/schema cleanup
-- STATUS:    APPLIED 2026-07-04 (verified: 3 tables dropped, team_members +
--            all 16 org_id/team_id columns retained, 0 dangling FKs).
-- PURPOSE:   Retire three abandoned tenancy tables that are superseded by the
--            canonical org_id model (tenant_organizations / org_members, S1b/S1c):
--              - organizations          (0 rows; parallel to tenant_organizations)
--              - organization_members   (0 rows; parallel to org_members)
--              - teams                  (1 sentinel "Default Team" seed row)
--
-- SCOPE / SAFETY:
--   * COLUMNS ARE KEPT. Backend code still reads/writes organization_id and
--     team_id (secretsVault, hubEventPublisher, logosVisionService, goals/
--     automations routes, ActionItemTracker, aiAgentService, ...). Only the
--     dead TABLES and their dangling FKs are removed here. Consolidating those
--     columns onto org_id is a separate backend task (tracked, not done here).
--   * team_members is RETAINED — assignmentAgent + ExplainabilityService query
--     it live via .from('team_members').
--   * No views/matviews reference these objects (verified).
--   * organizations is referenced only by the dead backend/test-hub.js harness.
--
-- ROLLBACK:  recreate the tables + FKs (they held no real data).
-- DATE:      2026-07-04
-- ============================================================

BEGIN;

-- 1. Decouple the surviving shared_contacts policy from the (empty) org_members
--    branch. org_members is empty, so this is behaviorally identical today.
DROP POLICY IF EXISTS "Users can view own contacts" ON public.shared_contacts;
CREATE POLICY "Users can view own contacts" ON public.shared_contacts
  FOR SELECT USING (owner_id = auth.uid());

-- 2. Drop the FK constraints pointing at the retired tables (KEEP the columns).
ALTER TABLE public.shared_contacts   DROP CONSTRAINT IF EXISTS shared_contacts_organization_id_fkey;
ALTER TABLE public.shared_companies  DROP CONSTRAINT IF EXISTS shared_companies_organization_id_fkey;
ALTER TABLE public.cross_app_events  DROP CONSTRAINT IF EXISTS cross_app_events_organization_id_fkey;
ALTER TABLE public.api_keys          DROP CONSTRAINT IF EXISTS api_keys_organization_id_fkey;
ALTER TABLE public.audit_log         DROP CONSTRAINT IF EXISTS audit_log_organization_id_fkey;
ALTER TABLE public.users             DROP CONSTRAINT IF EXISTS users_team_id_fkey;

-- 3. Remove the org 'view' policy that reads organization_members, so the table
--    can be dropped, then drop the retired tables. organization_members FKs
--    organizations, so it must go first.
DROP POLICY IF EXISTS "Org members can view org" ON public.organizations;
DROP TABLE IF EXISTS public.organization_members;
DROP TABLE IF EXISTS public.organizations;
DROP TABLE IF EXISTS public.teams;

COMMIT;
