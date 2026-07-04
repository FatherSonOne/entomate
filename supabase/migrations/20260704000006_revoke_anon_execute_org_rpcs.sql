-- ============================================================
-- MIGRATION: 20260704000006_revoke_anon_execute_org_rpcs.sql
-- SECTION:   S1c — Tenancy enforcement (RPC least-privilege)
-- PURPOSE:   Remove the anon EXECUTE grant on the four org-lifecycle RPCs.
--            These mutate/read organization state and are meant to be called
--            only by an authenticated end user (the app calls them with the
--            user's JWT). Their bodies ALREADY fail closed for anon — each
--            checks auth.uid() against org_members for owner/admin, so an anon
--            caller (auth.uid() IS NULL) hits a "Permission denied" /
--            "Not authenticated" RAISE before any state change. This migration
--            closes the gap one layer earlier (defense in depth / least
--            privilege): anon can no longer even invoke them.
--
-- SCOPE:     Only the four lifecycle functions. The RLS-internal helpers
--            get_my_org_ids() / user_org_id() keep their grants — they are
--            STABLE, return empty for a caller with no membership, and are
--            referenced inside policies that are already scoped TO authenticated.
--
-- WHY SAFE:  authenticated (the real caller) retains EXECUTE. No app path calls
--            these as anon. Fully reversible: GRANT EXECUTE ... TO anon.
-- DATE:      2026-07-04
-- ============================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.create_org_for_user(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_org(uuid)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.hard_delete_org(uuid)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_org(uuid)                   FROM anon;

COMMIT;
