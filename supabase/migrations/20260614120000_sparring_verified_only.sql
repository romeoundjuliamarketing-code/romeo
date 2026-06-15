-- Per-sparring "verified members only" option.
ALTER TABLE open_sparrings
  ADD COLUMN IF NOT EXISTS verified_only boolean NOT NULL DEFAULT false;

-- Server-side check mirroring get_my_verification's "verified" tier.
CREATE OR REPLACE FUNCTION is_user_verified(p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_uid AND u.email_confirmed_at IS NOT NULL)
    AND (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = p_uid AND (p.address_lat IS NOT NULL OR p.coach_verified_at IS NOT NULL))
      OR EXISTS (SELECT 1 FROM studio_memberships sm WHERE sm.user_id = p_uid AND sm.status = 'active')
    );
$$;

REVOKE EXECUTE ON FUNCTION is_user_verified(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION is_user_verified(uuid) TO authenticated;

-- Enforce verified-only at signup time.
DROP POLICY IF EXISTS "insert own signup" ON sparring_signups;
CREATE POLICY "insert own signup" ON sparring_signups
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      is_user_verified(auth.uid())
      OR NOT EXISTS (
        SELECT 1 FROM open_sparrings os
        WHERE os.id = sparring_id AND os.verified_only = true
      )
    )
  );
