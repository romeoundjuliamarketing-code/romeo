-- Scenarios for 20261017150000_profile_secrets.
-- Each block raises on failure (psql runs with ON_ERROR_STOP).

-- 1. Data moved, profiles columns empty.
DO $$ BEGIN
  IF (SELECT count(*) FROM profiles
       WHERE address IS NOT NULL OR address_lat IS NOT NULL OR expo_push_token IS NOT NULL) <> 0 THEN
    RAISE EXCEPTION 'FAIL 1a: profiles still hold secrets';
  END IF;
  IF (SELECT address_lat FROM profile_secrets WHERE id = '00000000-0000-0000-0000-00000000000a') <> 52.5
     OR (SELECT expo_push_token FROM profile_secrets WHERE id = '00000000-0000-0000-0000-00000000000a') <> 'ExponentPushToken[a]' THEN
    RAISE EXCEPTION 'FAIL 1b: secrets not moved';
  END IF;
END $$;

-- 2. Attacker C: cannot read profile_secrets, sees no address in profiles.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
DO $$ BEGIN
  BEGIN
    PERFORM count(*) FROM profile_secrets;
    RAISE EXCEPTION 'FAIL 2a: authenticated can query profile_secrets';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF (SELECT address FROM profiles WHERE id = '00000000-0000-0000-0000-00000000000a') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL 2b: address visible in profiles';
  END IF;
END $$;

-- 3. Old build of B writes address (verification screen) + push token: redirected.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
UPDATE profiles SET address = 'Weg 2, Hamburg', address_lat = 53.5, address_lng = 10.0
 WHERE id = '00000000-0000-0000-0000-00000000000b';
UPDATE profiles SET expo_push_token = 'ExponentPushToken[b]'
 WHERE id = '00000000-0000-0000-0000-00000000000b';
-- 4. B updates the name: secrets untouched.
UPDATE profiles SET name = 'B2' WHERE id = '00000000-0000-0000-0000-00000000000b';
DO $$ BEGIN
  IF (SELECT address FROM profiles WHERE id = '00000000-0000-0000-0000-00000000000b') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL 3a: address written into profiles';
  END IF;
  IF NOT (get_my_verification() ->> 'address_verified')::boolean THEN
    RAISE EXCEPTION 'FAIL 3b: old-build verification lost';
  END IF;
  IF NOT is_user_verified('00000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'FAIL 3c: is_user_verified lost address rule';
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT address_lat FROM profile_secrets WHERE id = '00000000-0000-0000-0000-00000000000b') <> 53.5
     OR (SELECT expo_push_token FROM profile_secrets WHERE id = '00000000-0000-0000-0000-00000000000b') <> 'ExponentPushToken[b]' THEN
    RAISE EXCEPTION 'FAIL 4: secrets of B not stored / overwritten by name update';
  END IF;
END $$;

-- 5. C without address is not verified.
DO $$ BEGIN
  IF is_user_verified('00000000-0000-0000-0000-00000000000c') THEN
    RAISE EXCEPTION 'FAIL 5: C verified without address';
  END IF;
END $$;

-- 6. Push still reaches A with the moved token.
SELECT send_push_notification('00000000-0000-0000-0000-00000000000a', 't', 'b', NULL);
DO $$ BEGIN
  IF (SELECT count(*) FROM net.sent WHERE body ->> 'to' = 'ExponentPushToken[a]') <> 1 THEN
    RAISE EXCEPTION 'FAIL 6: push not sent with moved token';
  END IF;
END $$;

-- 7. Deleting a profile removes its secrets.
DELETE FROM profiles WHERE id = '00000000-0000-0000-0000-00000000000a';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM profile_secrets WHERE id = '00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'FAIL 7: secrets survive profile deletion';
  END IF;
END $$;

-- 8. anon has no access either.
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM count(*) FROM profile_secrets;
    RAISE EXCEPTION 'FAIL 8: anon can query profile_secrets';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
