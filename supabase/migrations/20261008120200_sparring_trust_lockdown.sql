-- Reliable sparrings (part 3/3): close every path around the RPCs.
-- DEPLOY ONLY TOGETHER WITH THE APP RELEASE that uses publish_sparring /
-- join_sparring_v2. After this, older builds can still view, chat and cancel, but
-- creating and joining shows "Bitte aktualisiere Sparr" (decision 2026-10-08).
-- Non-destructive: no rows are deleted, nothing is cancelled, nobody is notified.

-- 1) No direct sparring inserts (old builds, direct API calls).
DROP POLICY IF EXISTS "users insert own sparrings" ON open_sparrings;
DROP POLICY IF EXISTS "coaches insert sparrings"   ON open_sparrings;
REVOKE INSERT ON open_sparrings FROM anon, authenticated;

-- 2) No direct signup inserts (legacy builds <= 1.2.6). Deleting/cancelling stays.
DROP POLICY IF EXISTS "legacy insert own signup" ON sparring_signups;
REVOKE INSERT ON sparring_signups FROM anon, authenticated;

-- 3) Defence in depth with readable texts for old builds. User requests (a JWT
--    subject is present) may only create sparrings via publish_sparring and
--    signups via join_sparring_v2; both set a transaction-local flag. Service-role
--    and dashboard work (no JWT subject) is unaffected.
CREATE OR REPLACE FUNCTION trg_open_sparring_require_publish()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND COALESCE(current_setting('sparr.trust_publish', true), '') <> '1' THEN
    RAISE EXCEPTION 'Bitte aktualisiere Sparr, um ein Sparring zu veröffentlichen.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_open_sparring_require_publish ON open_sparrings;
CREATE TRIGGER trg_open_sparring_require_publish
  BEFORE INSERT ON open_sparrings
  FOR EACH ROW EXECUTE FUNCTION trg_open_sparring_require_publish();

CREATE OR REPLACE FUNCTION trg_sparring_signup_require_v2()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND COALESCE(current_setting('sparr.trust_join', true), '') <> NEW.sparring_id::text THEN
    RAISE EXCEPTION 'Bitte aktualisiere Sparr, um zuzusagen.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sparring_signup_require_v2 ON sparring_signups;
CREATE TRIGGER trg_sparring_signup_require_v2
  BEFORE INSERT ON sparring_signups
  FOR EACH ROW EXECUTE FUNCTION trg_sparring_signup_require_v2();

-- 4) Place and time of a published sparring are fixed (cancel and publish anew).
--    Covers update_sparring and set_sparring_gym without changing their bodies.
--    Clearing a reference via ON DELETE SET NULL stays possible.
CREATE OR REPLACE FUNCTION trg_open_sparring_lock_place_time()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
       NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
    OR NEW.duration_min IS DISTINCT FROM OLD.duration_min
    OR NEW.address      IS DISTINCT FROM OLD.address
    OR NEW.lat          IS DISTINCT FROM OLD.lat
    OR NEW.lng          IS DISTINCT FROM OLD.lng
    OR NEW.place_name   IS DISTINCT FROM OLD.place_name
    OR (NEW.place_id IS NOT NULL AND NEW.place_id IS DISTINCT FROM OLD.place_id)
    OR (NEW.gym_id   IS NOT NULL AND NEW.gym_id   IS DISTINCT FROM OLD.gym_id)
  ) THEN
    RAISE EXCEPTION 'Ort und Zeit eines veröffentlichten Sparrings können nicht geändert werden. Sage es ab und veröffentliche es neu.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_open_sparring_lock_place_time ON open_sparrings;
CREATE TRIGGER trg_open_sparring_lock_place_time
  BEFORE UPDATE ON open_sparrings
  FOR EACH ROW EXECUTE FUNCTION trg_open_sparring_lock_place_time();
