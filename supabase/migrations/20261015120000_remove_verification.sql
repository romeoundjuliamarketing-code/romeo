-- Remove the old "verified" status (too easy to get: any geocodable address counted).
-- is_user_verified() still gates create_event/signup_event and old clients, so it now
-- only means "email confirmed" instead of being dropped.
-- get_my_verification() stays untouched for old builds (their local create gate needs it).

CREATE OR REPLACE FUNCTION is_user_verified(p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_uid AND u.email_confirmed_at IS NOT NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION is_user_verified(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION is_user_verified(uuid) TO authenticated;

-- verified_only no longer has a meaning; open up existing sparrings.
-- Column and RPC params stay because old builds still send them.
UPDATE open_sparrings SET verified_only = false WHERE verified_only = true;

-- Coach vouching is gone; block it for old builds.
CREATE OR REPLACE FUNCTION verify_member(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'feature_removed';
END;
$$;

REVOKE EXECUTE ON FUNCTION verify_member(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION verify_member(uuid) TO authenticated;
