-- ============================================================
-- MIGRATION: 20260704000004_backfill_org_id_and_retire_dup_orgs.sql
-- SECTION:   S1b — Org model (data)
-- PURPOSE:   (1) Backfill org_id on the six org-shared tables to the
--            canonical tenant "Quantum Ecosystems". Today all live rows
--            belong to it: the 1 user-owned meeting maps via its owner,
--            the 7 'system'-owned meetings + orphan tasks/workflows have no
--            other tenant. action_items inherit their parent meeting's org.
--            (2) Retire the two duplicate single-owner orgs (Dev, QntmEcos).
--            Confirmed with Frank 2026-07-04: their only child rows are 2
--            owner memberships + 3 orphaned April test bot_sessions (meeting_ids
--            already dangling). CASCADE removes them.
--
-- WHY SAFE:  Pre-launch data (8 meetings / 13 action_items / 14 tasks /
--            5 workflows). Backend service-role unaffected; frontend does
--            not read these tables. Deleting the dup orgs cascades only
--            through org_members / bot_sessions / org_invites / usage — all
--            empty except the 3 test sessions Frank approved deleting.
-- DATE:      2026-07-04
-- ROLLBACK:  org_id backfill: UPDATE ... SET org_id = NULL. Org deletion is
--            NOT reversible — approved deletion of throwaway test tenants.
-- ============================================================

BEGIN;

-- Canonical tenant: Quantum Ecosystems = 058c37a6-15f3-4cef-bd08-dd2220eb8e99

-- action_items first: inherit the parent meeting's (soon-to-be-set) org via
-- the same canonical assignment; no parent → canonical anyway.
UPDATE public.meetings      SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;
UPDATE public.action_items  SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;
UPDATE public.tasks         SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;
UPDATE public.workflows     SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;
UPDATE public.relationships SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;
UPDATE public.goals         SET org_id = '058c37a6-15f3-4cef-bd08-dd2220eb8e99' WHERE org_id IS NULL;

-- Retire the two duplicate test orgs (cascades members + orphaned test sessions).
DELETE FROM public.tenant_organizations
WHERE id IN ('19338e74-a67e-4a9a-bb47-28909a56d047',   -- Dev (empty)
             '8fc94762-2253-409f-b005-58d805b54823');  -- QntmEcos (3 orphaned test sessions)

COMMIT;
