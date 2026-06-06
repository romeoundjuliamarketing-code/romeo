-- User verification: free, layered "verified" badge.
-- Adds nullable profile columns (address/phone/coach-vouch) and two SECURITY DEFINER RPCs.

-- ── Profile columns (all nullable, non-breaking) ──────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS address           text,
  ADD COLUMN IF NOT EXISTS address_lat       double precision,
  ADD COLUMN IF NOT EXISTS address_lng       double precision,
  ADD COLUMN IF NOT EXISTS phone             text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS coach_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS coach_verified_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- ── get_my_verification: returns raw flags for the calling user ────────────────
-- Tier is computed client-side from these flags (see src/utils/verificationTier.ts).
CREATE OR REPLACE FUNCTION get_my_verification()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_email_verified  boolean;
  v_address_verified boolean;
  v_studio_verified boolean;
  v_coach_vouched   boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT (email_confirmed_at IS NOT NULL)
    INTO v_email_verified
    FROM auth.users WHERE id = v_uid;

  SELECT (address_lat IS NOT NULL), (coach_verified_at IS NOT NULL)
    INTO v_address_verified, v_coach_vouched
    FROM profiles WHERE id = v_uid;

  SELECT EXISTS (
    SELECT 1 FROM studio_memberships
    WHERE user_id = v_uid AND status = 'active'
  ) INTO v_studio_verified;

  RETURN json_build_object(
    'email_verified',   COALESCE(v_email_verified, false),
    'address_verified', COALESCE(v_address_verified, false),
    'studio_verified',  COALESCE(v_studio_verified, false),
    'coach_vouched',    COALESCE(v_coach_vouched, false),
    'phone_verified',   false  -- SMS not enabled (cost); always false for now
  );
END;
$$;

-- ── verify_member: a coach vouches that a member is a real person ──────────────
-- Caller must be a coach in the same studio as the target. Self-vouch blocked.
CREATE OR REPLACE FUNCTION verify_member(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_is_coach     boolean;
  v_coach_studio uuid;
  v_target_studio uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_user_id = v_uid THEN
    RAISE EXCEPTION 'cannot_verify_self';
  END IF;

  SELECT is_coach, studio_id INTO v_is_coach, v_coach_studio
    FROM profiles WHERE id = v_uid;
  IF v_is_coach IS NOT TRUE THEN
    RAISE EXCEPTION 'not_a_coach';
  END IF;

  SELECT studio_id INTO v_target_studio FROM profiles WHERE id = p_user_id;
  IF v_coach_studio IS NULL OR v_target_studio IS NULL OR v_coach_studio <> v_target_studio THEN
    RAISE EXCEPTION 'not_same_studio';
  END IF;

  UPDATE profiles
     SET coach_verified_at = now(),
         coach_verified_by = v_uid
   WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

-- ── Permissions: authenticated only, never anon/public ────────────────────────
REVOKE EXECUTE ON FUNCTION get_my_verification()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION verify_member(uuid)        FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_my_verification()      TO authenticated;
GRANT  EXECUTE ON FUNCTION verify_member(uuid)        TO authenticated;
