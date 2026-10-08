-- Reliable sparrings (part 1/3): schema, config and geodesy. Additive only.
-- Spec: Vault "Features/Verlaessliche-Sparrings.md" (2026-10-08).
--
-- Rules (enforced by the RPCs in 20261008120100, locked down in 20261008120200):
--   * publish / binding join only within 150 km of the current device position,
--     300 km after the first qualifying confirmed meeting (exactly 150/300 km ok)
--   * one active sparring per user (own or binding signup) until its planned end
--   * at most 3 first-time publications per rolling 24 h (cancellations still count)
--   * QR check-in at the venue + post-meeting confirmation unlock the 300 km radius
--
-- Legacy data (documented, nothing invented, nothing deleted):
--   * duration_min is NOT NULL DEFAULT 90 on every row, so every sparring has a
--     computable planned end (scheduled_at + duration_min).
--   * 181 rows have no lat/lng. They still count as active until their end and stay
--     cancellable; joining and check-in are refused with an explained reason.
--   * No account is unlocked automatically: sparring_reach_unlocks starts empty,
--     historic signups / attended marks do not qualify.
--   * Users with several active sparrings keep them; they cannot add another one
--     while at least one is active.

-- ── Central config (mirrored in src/data/sparringConfig.ts) ─────────────────────

CREATE OR REPLACE FUNCTION sparring_trust_radius_base_km() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 150 $$;
CREATE OR REPLACE FUNCTION sparring_trust_radius_unlocked_km() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 300 $$;
CREATE OR REPLACE FUNCTION sparring_trust_loc_max_age_s() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 120 $$;
CREATE OR REPLACE FUNCTION sparring_trust_loc_max_accuracy_m() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 200 $$;
CREATE OR REPLACE FUNCTION sparring_trust_publish_limit() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 3 $$;
CREATE OR REPLACE FUNCTION sparring_trust_publish_window() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '24 hours' $$;
CREATE OR REPLACE FUNCTION sparring_trust_checkin_open_before() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '30 minutes' $$;
CREATE OR REPLACE FUNCTION sparring_trust_checkin_close_after() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '60 minutes' $$;
CREATE OR REPLACE FUNCTION sparring_trust_checkin_radius_m() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 500 $$;
CREATE OR REPLACE FUNCTION sparring_trust_qr_ttl() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '60 seconds' $$;
CREATE OR REPLACE FUNCTION sparring_trust_feedback_window() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '72 hours' $$;
CREATE OR REPLACE FUNCTION sparring_trust_intro_version() RETURNS smallint
LANGUAGE sql IMMUTABLE AS $$ SELECT 1::smallint $$;
-- Allowed device clock skew for "fix age" (a slightly negative age is not an error).
CREATE OR REPLACE FUNCTION sparring_trust_loc_future_skew_s() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 30 $$;

-- ── Geodesy ─────────────────────────────────────────────────────────────────────

-- Geodesic distance in metres on the WGS84 ellipsoid (Vincenty inverse formula).
-- Falls back to a spherical great-circle distance (mean earth radius) for the rare
-- nearly-antipodal pairs where the iteration does not converge.
CREATE OR REPLACE FUNCTION geo_distance_m(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision)
RETURNS double precision
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE AS $$
DECLARE
  a  CONSTANT double precision := 6378137.0;
  f  CONSTANT double precision := 1 / 298.257223563;
  b  CONSTANT double precision := 6378137.0 * (1 - 1 / 298.257223563);
  L        double precision := radians(p_lng2 - p_lng1);
  u1       double precision := atan((1 - f) * tan(radians(p_lat1)));
  u2       double precision := atan((1 - f) * tan(radians(p_lat2)));
  sin_u1   double precision := sin(u1);
  cos_u1   double precision := cos(u1);
  sin_u2   double precision := sin(u2);
  cos_u2   double precision := cos(u2);
  lam      double precision := L;
  lam_prev double precision;
  sin_lam  double precision;
  cos_lam  double precision;
  sin_sig  double precision;
  cos_sig  double precision;
  sig      double precision;
  sin_alp  double precision;
  cos2_alp double precision;
  cos_2sm  double precision;
  c        double precision;
  u_sq     double precision;
  big_a    double precision;
  big_b    double precision;
  d_sig    double precision;
  i        integer := 0;
  dphi     double precision;
  hav      double precision;
BEGIN
  IF p_lat1 = p_lat2 AND p_lng1 = p_lng2 THEN
    RETURN 0;
  END IF;

  LOOP
    sin_lam := sin(lam);
    cos_lam := cos(lam);
    sin_sig := sqrt((cos_u2 * sin_lam) ^ 2
                    + (cos_u1 * sin_u2 - sin_u1 * cos_u2 * cos_lam) ^ 2);
    IF sin_sig = 0 THEN
      RETURN 0;  -- coincident points
    END IF;
    cos_sig  := sin_u1 * sin_u2 + cos_u1 * cos_u2 * cos_lam;
    sig      := atan2(sin_sig, cos_sig);
    sin_alp  := cos_u1 * cos_u2 * sin_lam / sin_sig;
    cos2_alp := 1 - sin_alp ^ 2;
    cos_2sm  := CASE WHEN cos2_alp = 0 THEN 0
                     ELSE cos_sig - 2 * sin_u1 * sin_u2 / cos2_alp END;
    c        := f / 16 * cos2_alp * (4 + f * (4 - 3 * cos2_alp));
    lam_prev := lam;
    lam      := L + (1 - c) * f * sin_alp
                * (sig + c * sin_sig * (cos_2sm + c * cos_sig * (-1 + 2 * cos_2sm ^ 2)));
    i := i + 1;
    EXIT WHEN abs(lam - lam_prev) < 1e-12 OR i >= 200;
  END LOOP;

  IF abs(lam - lam_prev) >= 1e-12 THEN
    -- No convergence (nearly antipodal): great-circle distance is ample here.
    dphi := radians(p_lat2 - p_lat1);
    hav  := sin(dphi / 2) ^ 2
            + cos(radians(p_lat1)) * cos(radians(p_lat2)) * sin(radians(p_lng2 - p_lng1) / 2) ^ 2;
    RETURN 2 * 6371008.8 * asin(least(1, sqrt(hav)));
  END IF;

  u_sq  := cos2_alp * (a ^ 2 - b ^ 2) / b ^ 2;
  big_a := 1 + u_sq / 16384 * (4096 + u_sq * (-768 + u_sq * (320 - 175 * u_sq)));
  big_b := u_sq / 1024 * (256 + u_sq * (-128 + u_sq * (74 - 47 * u_sq)));
  d_sig := big_b * sin_sig * (cos_2sm + big_b / 4
           * (cos_sig * (-1 + 2 * cos_2sm ^ 2)
              - big_b / 6 * cos_2sm * (-3 + 4 * sin_sig ^ 2) * (-3 + 4 * cos_2sm ^ 2)));
  RETURN b * big_a * (sig - d_sig);
END;
$$;

-- Boundary rule in one place: exactly on the radius is allowed.
CREATE OR REPLACE FUNCTION sparring_within_radius(p_distance_m double precision, p_radius_km integer)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT p_distance_m <= p_radius_km::double precision * 1000
$$;

-- ── Server-resolved places ──────────────────────────────────────────────────────

-- Written only by the Edge Function resolve-sparring-place (service role) from
-- OpenStreetMap/Nominatim results. Target coordinates of new sparrings come from
-- here, never from the client.
CREATE TABLE IF NOT EXISTS sparring_places (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_type    text NOT NULL CHECK (osm_type IN ('node','way','relation')),
  osm_id      bigint NOT NULL,
  name        text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  address     text NOT NULL CHECK (char_length(btrim(address)) BETWEEN 5 AND 300),
  lat         double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  category    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (osm_type, osm_id)
);
ALTER TABLE sparring_places ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sparring_places FROM anon, authenticated;

-- Non-public suggestions for missing venues. Reviewed manually (service role,
-- Supabase dashboard), like gym_correction_requests. Never applied automatically.
CREATE TABLE IF NOT EXISTS sparring_place_suggestions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  address     text NOT NULL CHECK (char_length(btrim(address)) BETWEEN 5 AND 300),
  note        text CHECK (note IS NULL OR char_length(note) <= 280),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','applied','rejected')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sparring_place_suggestions_user_idx
  ON sparring_place_suggestions (user_id, created_at);
ALTER TABLE sparring_place_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sparring_place_suggestions FROM anon, authenticated;

-- Per-user quota for place searches (protects the shared Nominatim access).
CREATE TABLE IF NOT EXISTS sparring_place_search_log (
  user_id     uuid NOT NULL,
  searched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sparring_place_search_log_idx
  ON sparring_place_search_log (user_id, searched_at);
ALTER TABLE sparring_place_search_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sparring_place_search_log FROM anon, authenticated;

-- ── Publication log (rate-limit evidence) ───────────────────────────────────────

-- One row per first-time publication. Never deleted by cancelling or deleting the
-- sparring (FK sets NULL), so cancel-and-recreate cannot reset the limit. The
-- client-generated request_id makes network retries idempotent.
CREATE TABLE IF NOT EXISTS sparring_publish_log (
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_id   uuid NOT NULL,
  sparring_id  uuid REFERENCES open_sparrings(id) ON DELETE SET NULL,
  distance_km  integer,          -- rounded, no coordinates stored
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS sparring_publish_log_window_idx
  ON sparring_publish_log (user_id, published_at);
ALTER TABLE sparring_publish_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sparring_publish_log FROM anon, authenticated;

-- ── Radius unlock (exactly once per user) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS sparring_reach_unlocks (
  user_id      uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  sparring_id  uuid REFERENCES open_sparrings(id) ON DELETE SET NULL,
  role         text NOT NULL CHECK (role IN ('participant','organizer')),
  unlocked_at  timestamptz NOT NULL DEFAULT now(),
  seen_at      timestamptz
);
ALTER TABLE sparring_reach_unlocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sparring_reach_unlocks FROM anon, authenticated;

-- ── QR check-in ─────────────────────────────────────────────────────────────────

-- Only the sha256 of the random token is stored; the token itself exists only in
-- the organizer's QR code. Bound to sparring + organizer, valid <= 60 s.
CREATE TABLE IF NOT EXISTS sparring_checkin_tokens (
  token_hash   bytea PRIMARY KEY,
  sparring_id  uuid NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sparring_checkin_tokens_sparring_idx
  ON sparring_checkin_tokens (sparring_id, expires_at);
ALTER TABLE sparring_checkin_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sparring_checkin_tokens FROM anon, authenticated;

-- One check-in per participant and sparring. Only a coarse distance bucket is
-- kept, never the participant's coordinates.
CREATE TABLE IF NOT EXISTS sparring_checkins (
  sparring_id        uuid NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_in_at      timestamptz NOT NULL DEFAULT now(),
  distance_bucket_m  integer,
  PRIMARY KEY (sparring_id, user_id)
);
ALTER TABLE sparring_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sparring_checkins FROM anon, authenticated;

-- ── Post-meeting confirmation ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sparring_meeting_feedback (
  sparring_id  uuid NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answer       text NOT NULL CHECK (answer IN ('happened','cancelled','problem')),
  note         text CHECK (note IS NULL OR char_length(note) <= 280),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sparring_id, user_id)
);
ALTER TABLE sparring_meeting_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sparring_meeting_feedback FROM anon, authenticated;

-- ── Columns on existing tables ──────────────────────────────────────────────────

ALTER TABLE open_sparrings
  ADD COLUMN IF NOT EXISTS place_id                uuid REFERENCES sparring_places(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS place_name              text,
  ADD COLUMN IF NOT EXISTS permission_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_at          timestamptz,
  ADD COLUMN IF NOT EXISTS meeting_conflict_at     timestamptz;

CREATE INDEX IF NOT EXISTS open_sparrings_created_by_active_idx
  ON open_sparrings (created_by, scheduled_at) WHERE is_active;

-- Account-bound acknowledgement of the intro sheet (with version).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sparring_intro_version smallint;

-- Records when a sparring was switched off, without touching deactivate_sparring
-- (its body is owned by the notification work). Cancelled = switched off before
-- its planned end; switching off afterwards is just "ending".
CREATE OR REPLACE FUNCTION trg_open_sparring_deactivated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_active AND NOT NEW.is_active AND NEW.deactivated_at IS NULL THEN
    NEW.deactivated_at := now();
  ELSIF NEW.is_active THEN
    NEW.deactivated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_open_sparring_deactivated_at ON open_sparrings;
CREATE TRIGGER trg_open_sparring_deactivated_at
  BEFORE UPDATE OF is_active ON open_sparrings
  FOR EACH ROW EXECUTE FUNCTION trg_open_sparring_deactivated_at();
