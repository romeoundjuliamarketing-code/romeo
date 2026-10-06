-- Community member count for the Home greeting line
-- ("Sparr-Community · X registrierte Mitglieder").
--
-- Returns one aggregate number, never rows: the client cannot read auth.users
-- and must not load account data just to count it.
--
-- Counted: accounts in auth.users that are
--   - not soft-deleted (deleted_at IS NULL; delete_my_account() hard-deletes, so
--     deleted accounts are already gone — this also covers a future soft delete),
--   - not anonymous,
--   - confirmed (e-mail or phone),
--   - not currently banned.
-- Not profiles: a profile row is not the same as a registered member (on
-- 2026-09-28 there was one account without a profile).
-- Test accounts: there is no marker for them in the schema, so they cannot be
-- excluded here. Add a flag first if they should be.
--
-- SECURITY DEFINER with an empty search_path; only signed-in users may call it.
-- Not applied to production by this change.

CREATE OR REPLACE FUNCTION public.get_community_member_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)
    FROM auth.users u
   WHERE u.deleted_at IS NULL
     AND COALESCE(u.is_anonymous, false) = false
     AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)
     AND (u.banned_until IS NULL OR u.banned_until <= now());
$$;

REVOKE ALL ON FUNCTION public.get_community_member_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_community_member_count() TO authenticated;
