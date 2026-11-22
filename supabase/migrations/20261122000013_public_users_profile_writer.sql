-- ========================================
-- Migration: give public.users a writer (X1)
-- Date: 2026-11-22
-- ========================================
-- Why: public.users had 0 rows for 5 auth users and nothing wrote to it (no
-- trigger, no app insert). Six FKs point at it — projects.owner_id,
-- action_items.assigned_to_id, goals.owner_id, agent_overrides.user_id,
-- learning_patterns.user_id, user_learning_preferences.user_id — so
-- POST /api/projects (owner_id = req.user.id) failed with
-- "violates foreign key constraint projects_owner_id_fkey" for every user.
--
-- Why a writer and not repointing the FKs at auth.users: the backend also
-- READS public.users (speakerNames full_name, ActionItemTrackerService
-- team_id/full_name, secretsVault email). Repointing would stop the 500 but
-- leave those readers on an empty table.
--
-- 1. handle_new_auth_user(): AFTER INSERT on auth.users adds the profile row.
--    Any failure is downgraded to a WARNING so a sign-up can never fail
--    because of this table.
-- 2. Backfill every existing auth user.
--
-- email is NOT NULL + UNIQUE here but optional in auth.users (phone sign-up);
-- the id stands in so the row still exists for the FKs.
-- RLS is unchanged: users_self (id = auth.uid()) keeps each row private.
-- Safe to run more than once.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, NEW.id::text),
      left(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), 255),
      left(COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'), 512)
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user: no public.users row for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_public_users ON auth.users;
CREATE TRIGGER on_auth_user_created_public_users
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

INSERT INTO public.users (id, email, full_name, avatar_url)
SELECT
  u.id,
  COALESCE(u.email, u.id::text),
  left(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), 255),
  left(COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'), 512)
FROM auth.users u
ON CONFLICT DO NOTHING;

COMMIT;
