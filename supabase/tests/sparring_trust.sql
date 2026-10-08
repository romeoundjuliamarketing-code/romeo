-- Scenario tests for reliable sparrings (radius, slot, rate limit, QR check-in,
-- confirmation/unlock, legacy data, lockdown). Run via run_sparring_trust.sh.
-- Every scenario raises on failure (ASSERT) and prints "ok ..." on success.

\set ON_ERROR_STOP 1
SET client_min_messages = notice;

-- ── Fixtures ────────────────────────────────────────────────────────────────────

INSERT INTO profiles (id, name)
SELECT ('00000000-0000-0000-0000-0000000000' || lpad(to_hex(n), 2, '0'))::uuid, 'User ' || n
  FROM generate_series(1, 60) n;
INSERT INTO profiles (id, name) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'Conc Publisher'),
  ('00000000-0000-0000-0000-0000000000c2', 'Conc Joiner');

CREATE FUNCTION t_u(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT ('00000000-0000-0000-0000-0000000000' || lpad(to_hex(n), 2, '0'))::uuid
$$;

CREATE FUNCTION t_as(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), false)
$$;

CREATE SEQUENCE t_osm;
CREATE FUNCTION t_place(p_lat double precision, p_lng double precision) RETURNS uuid
LANGUAGE sql AS $$
  INSERT INTO sparring_places (osm_type, osm_id, name, address, lat, lng)
  VALUES ('node', nextval('t_osm'), 'Kampfsportschule Test', 'Hauptstr. 1, 28195 Bremen', p_lat, p_lng)
  RETURNING id
$$;

-- Latitude north of (p_lat, p_lng) at exactly p_m metres (bisection on geo_distance_m).
CREATE FUNCTION t_north(p_lat double precision, p_lng double precision, p_m double precision)
RETURNS double precision LANGUAGE plpgsql AS $$
DECLARE lo double precision := p_lat; hi double precision := p_lat + 10; mid double precision;
BEGIN
  FOR i IN 1..200 LOOP
    mid := (lo + hi) / 2;
    IF geo_distance_m(p_lat, p_lng, mid, p_lng) < p_m THEN lo := mid; ELSE hi := mid; END IF;
  END LOOP;
  RETURN mid;
END $$;

CREATE FUNCTION t_pub(p_uid uuid, p_place uuid, p_lat double precision, p_lng double precision,
                      p_req uuid DEFAULT gen_random_uuid(),
                      p_acc double precision DEFAULT 20, p_age double precision DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  PERFORM t_as(p_uid);
  RETURN publish_sparring(p_req, p_place, 'Sparring', 'Boxen', NULL,
                          now() + interval '2 days', 90, 4, false, true,
                          p_lat, p_lng, p_acc, p_age);
END $$;

CREATE FUNCTION t_join(p_uid uuid, p_sp uuid, p_lat double precision, p_lng double precision,
                       p_acc double precision DEFAULT 20, p_age double precision DEFAULT 5)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  PERFORM t_as(p_uid);
  RETURN join_sparring_v2(p_sp, 1::smallint, p_lat, p_lng, p_acc, p_age);
END $$;

-- Direct fixture sparring (service context, bypasses the publish requirement).
CREATE FUNCTION t_fix(p_org uuid, p_start interval, p_dur integer DEFAULT 60,
                      p_lat double precision DEFAULT 53.08, p_lng double precision DEFAULT 8.80,
                      p_slots integer DEFAULT 4, p_title text DEFAULT 'Fixture')
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM t_as(NULL);
  INSERT INTO open_sparrings (created_by, title, discipline, address, lat, lng,
                              scheduled_at, duration_min, max_slots)
  VALUES (p_org, p_title, 'Boxen', 'Hauptstr. 1, 28195 Bremen', p_lat, p_lng,
          now() + p_start, p_dur, p_slots)
  RETURNING id INTO v_id;
  INSERT INTO sparring_chat_settings (sparring_id) VALUES (v_id);
  RETURN v_id;
END $$;

-- Direct fixture signup (service context).
CREATE FUNCTION t_signup(p_sp uuid, p_uid uuid, p_status text DEFAULT 'confirmed') RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM t_as(NULL);
  INSERT INTO sparring_signups (sparring_id, user_id, rules_version, rules_accepted_at, status, slot_granted_at)
  VALUES (p_sp, p_uid, 1, now(), p_status, now());
END $$;

CREATE FUNCTION t_token(p_org uuid, p_sp uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM t_as(p_org);
  r := start_checkin_session(p_sp, 53.08, 8.80, 15, 3);
  ASSERT (r->>'ok')::boolean, 'start_checkin_session failed: ' || r::text;
  RETURN r->>'token';
END $$;

CREATE FUNCTION t_checkin(p_uid uuid, p_sp uuid, p_token text,
                          p_lat double precision DEFAULT 53.0805, p_lng double precision DEFAULT 8.8005,
                          p_acc double precision DEFAULT 15, p_age double precision DEFAULT 3)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  PERFORM t_as(p_uid);
  RETURN check_in_sparring(p_sp, p_token, p_lat, p_lng, p_acc, p_age);
END $$;

CREATE FUNCTION t_fb(p_uid uuid, p_sp uuid, p_answer text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  PERFORM t_as(p_uid);
  RETURN submit_meeting_feedback(p_sp, p_answer, p_note);
END $$;

CREATE FUNCTION t_unlocked(p_uid uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM sparring_reach_unlocks WHERE user_id = p_uid)
$$;

-- Fixtures for the shell-driven concurrency test.
SELECT t_fix(t_u(50), interval '3 days', 90, 53.08, 8.80, 4, 'conc-1');
SELECT t_fix(t_u(51), interval '3 days', 90, 53.08, 8.80, 4, 'conc-2');

-- ── 1. Geodesy and radius boundaries ────────────────────────────────────────────

DO $$
DECLARE d double precision;
BEGIN
  -- Classic Vincenty reference (Flinders Peak -> Buninyong): 54 972.271 m.
  d := geo_distance_m(-37.95103342, 144.42486789, -37.65282114, 143.92649554);
  ASSERT abs(d - 54972.271) < 0.01, 'vincenty reference off: ' || d;
  ASSERT geo_distance_m(53.08, 8.80, 53.08, 8.80) = 0, 'zero distance';
  -- Nearly antipodal pair still yields a finite distance (fallback).
  d := geo_distance_m(0, 0, 0.5, 179.7);
  ASSERT d > 19000000 AND d < 20100000, 'antipodal fallback: ' || d;
  -- Boundary rule independent of rounding: exactly on the radius is allowed.
  ASSERT sparring_within_radius(150000, 150);
  ASSERT NOT sparring_within_radius(150000.001, 150);
  ASSERT sparring_within_radius(300000, 300);
  ASSERT NOT sparring_within_radius(300000.001, 300);
  RAISE NOTICE 'ok 1a geodesy: vincenty reference, antipodal fallback, inclusive boundary';
END $$;

DO $$
DECLARE
  v_place uuid := t_place(53.08, 8.80);
  r jsonb;
BEGIN
  -- Device 0.5 m inside 150 km: allowed.
  r := t_pub(t_u(1), v_place, t_north(53.08, 8.80, 149999.5), 8.80);
  ASSERT (r->>'ok')::boolean, '149.9995 km must pass: ' || r::text;
  -- 0.5 m outside 150 km: refused with distance and radius, UI rounding irrelevant.
  r := t_pub(t_u(2), v_place, t_north(53.08, 8.80, 150000.5), 8.80);
  ASSERT r->>'reason' = 'too_far', '150.0005 km must be too far: ' || r::text;
  ASSERT (r->>'radius_km')::int = 150 AND (r->>'distance_m')::numeric >= 150000;
  -- Join check uses the same rule.
  r := t_join(t_u(3), (SELECT id FROM open_sparrings WHERE created_by = t_u(1)),
              t_north(53.08, 8.80, 150000.5), 8.80);
  ASSERT r->>'reason' = 'too_far', 'join beyond 150 km: ' || r::text;
  r := t_join(t_u(3), (SELECT id FROM open_sparrings WHERE created_by = t_u(1)),
              t_north(53.08, 8.80, 149999.5), 8.80);
  ASSERT (r->>'ok')::boolean, 'join within 150 km: ' || r::text;
  RAISE NOTICE 'ok 1b radius 150 km: just inside allowed, just outside refused (publish + join)';
END $$;

DO $$
DECLARE
  v_place uuid := t_place(53.08, 8.80);
  r jsonb;
BEGIN
  INSERT INTO sparring_reach_unlocks (user_id, role) VALUES (t_u(4), 'participant'), (t_u(5), 'participant');
  r := t_pub(t_u(4), v_place, t_north(53.08, 8.80, 299999.5), 8.80);
  ASSERT (r->>'ok')::boolean, '299.9995 km must pass after unlock: ' || r::text;
  r := t_pub(t_u(5), v_place, t_north(53.08, 8.80, 300000.5), 8.80);
  ASSERT r->>'reason' = 'too_far' AND (r->>'radius_km')::int = 300, '300.0005 km: ' || r::text;
  RAISE NOTICE 'ok 1c radius 300 km after unlock: just inside allowed, just outside refused';
END $$;

-- Position quality
DO $$
DECLARE v_place uuid := t_place(53.08, 8.80); r jsonb;
BEGIN
  r := t_pub(t_u(6), v_place, 53.08, 8.80, gen_random_uuid(), 201, 5);
  ASSERT r->>'reason' = 'location_inaccurate', r::text;
  r := t_pub(t_u(6), v_place, 53.08, 8.80, gen_random_uuid(), 20, 121);
  ASSERT r->>'reason' = 'location_stale', r::text;
  r := t_pub(t_u(6), v_place, NULL, NULL);
  ASSERT r->>'reason' = 'location_missing', r::text;
  r := t_pub(t_u(6), v_place, 53.08, 8.80, gen_random_uuid(), 200, 120);
  ASSERT (r->>'ok')::boolean, 'accuracy 200 m / age 120 s are still ok: ' || r::text;
  RAISE NOTICE 'ok 1d position quality: >200 m, >120 s and missing refused; limits inclusive';
END $$;

-- ── 2. Device position, not search city ─────────────────────────────────────────

DO $$
DECLARE v_place uuid := t_place(48.137, 11.575); r jsonb;  -- Munich venue
BEGIN
  -- The early check (what the app calls while the map shows any search city)
  -- only knows slot/rate without a device fix and never reports a distance.
  PERFORM t_as(t_u(7));
  r := check_sparring_eligibility('publish', NULL, v_place);
  ASSERT (r->>'ok')::boolean AND NOT r ? 'distance_m', r::text;
  -- With the device in Bremen the Munich venue is too far, whatever the search city.
  r := check_sparring_eligibility('publish', NULL, v_place, 53.08, 8.80, 20, 5);
  ASSERT r->>'reason' = 'too_far', r::text;
  -- Publishing without a device fix is impossible.
  r := t_pub(t_u(7), v_place, NULL, NULL);
  ASSERT r->>'reason' = 'location_missing', r::text;
  RAISE NOTICE 'ok 2 only the device fix decides; no fix = no distance, no publish';
END $$;

-- ── 3. One active sparring ──────────────────────────────────────────────────────

DO $$
DECLARE
  v_place uuid := t_place(53.08, 8.80);
  v_other uuid := t_fix(t_u(9), interval '2 days');
  r jsonb; v_sp uuid;
BEGIN
  r := t_pub(t_u(8), v_place, 53.08, 8.80);
  ASSERT (r->>'ok')::boolean, r::text;
  v_sp := (r->>'sparring_id')::uuid;
  -- Second publication blocked.
  r := t_pub(t_u(8), v_place, 53.08, 8.80);
  ASSERT r->>'reason' = 'slot_taken' AND (r->>'active_sparring_id')::uuid = v_sp, r::text;
  -- Joining another sparring blocked while organizing.
  r := t_join(t_u(8), v_other, 53.08, 8.80);
  ASSERT r->>'reason' = 'slot_taken', r::text;
  -- Organizer cannot join own sparring.
  r := t_join(t_u(8), v_sp, 53.08, 8.80);
  ASSERT r->>'reason' = 'own_sparring', r::text;
  -- Own sparring + own signup row count once.
  PERFORM t_signup(v_sp, t_u(8));
  PERFORM t_as(t_u(8));
  ASSERT (get_sparring_reach_status()->>'active_count')::int = 1, 'organizer counted twice';
  -- Joined participant cannot join a second one or publish.
  r := t_join(t_u(10), v_sp, 53.08, 8.80);
  ASSERT (r->>'ok')::boolean, r::text;
  r := t_join(t_u(10), v_other, 53.08, 8.80);
  ASSERT r->>'reason' = 'slot_taken', r::text;
  r := t_pub(t_u(10), v_place, 53.08, 8.80);
  ASSERT r->>'reason' = 'slot_taken', r::text;
  -- Double tap on join: same answer, still one signup.
  r := t_join(t_u(10), v_sp, 53.08, 8.80);
  ASSERT (r->>'ok')::boolean AND (r->>'replayed')::boolean, r::text;
  RAISE NOTICE 'ok 3a one active sparring: publish/join/organize combinations blocked, no double count';
END $$;

-- Lockdown: direct table writes and the old RPC cannot bypass the rules.
DO $$
DECLARE v_sp uuid := t_fix(t_u(11), interval '2 days'); ok boolean;
BEGIN
  PERFORM t_as(t_u(12));
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO open_sparrings (created_by, title, discipline, address, lat, lng, scheduled_at)
    VALUES (t_u(12), 'Antarktis', 'Boxen', 'Südpol', -90, 0, now() + interval '1 day');
    ok := true;
  EXCEPTION WHEN insufficient_privilege THEN ok := false; END;
  ASSERT NOT ok, 'direct sparring insert must be refused';
  BEGIN
    INSERT INTO sparring_signups (sparring_id, user_id, rules_version, rules_accepted_at)
    VALUES (v_sp, t_u(12), 0, now());
    ok := true;
  EXCEPTION WHEN insufficient_privilege THEN ok := false; END;
  ASSERT NOT ok, 'direct signup insert must be refused';
  BEGIN
    PERFORM 1 FROM sparring_reach_unlocks;
    ok := true;
  EXCEPTION WHEN insufficient_privilege THEN ok := false; END;
  ASSERT NOT ok, 'unlock table must not be readable';
  BEGIN
    INSERT INTO sparring_reach_unlocks (user_id, role) VALUES (t_u(12), 'participant');
    ok := true;
  EXCEPTION WHEN insufficient_privilege THEN ok := false; END;
  ASSERT NOT ok, 'unlock table must not be writable';
  BEGIN
    PERFORM try_unlock_reach(t_u(12), v_sp, 'participant');
    ok := true;
  EXCEPTION WHEN insufficient_privilege THEN ok := false; END;
  ASSERT NOT ok, 'internal unlock helper must not be callable';
  RESET ROLE;
  -- Old RPC (builds 1.2.7) skips the trust checks -> refused with update hint.
  BEGIN
    PERFORM join_sparring(v_sp, 1::smallint);
    ok := true;
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Bitte aktualisiere Sparr%', SQLERRM;
    ok := false;
  END;
  ASSERT NOT ok, 'old join_sparring must be refused';
  -- Direct insert even with privileges (defence in depth) needs publish_sparring.
  BEGIN
    INSERT INTO open_sparrings (created_by, title, discipline, address, scheduled_at)
    VALUES (t_u(12), 'x', 'Boxen', 'y', now() + interval '1 day');
    ok := true;
  EXCEPTION WHEN raise_exception THEN ok := false; END;
  ASSERT NOT ok, 'insert trigger must refuse user context';
  RAISE NOTICE 'ok 3b lockdown: direct inserts, unlock table, internal helper, old join_sparring refused';
END $$;

-- ── 4. Cancellation and regular end free the slot ───────────────────────────────

DO $$
DECLARE
  v_place uuid := t_place(53.08, 8.80);
  v_sp uuid; v_b uuid := t_fix(t_u(14), interval '2 days'); v_past uuid; r jsonb;
BEGIN
  r := t_pub(t_u(13), v_place, 53.08, 8.80);
  v_sp := (r->>'sparring_id')::uuid;
  PERFORM t_as(t_u(13));
  PERFORM deactivate_sparring(v_sp);
  r := t_pub(t_u(13), v_place, 53.08, 8.80);
  ASSERT (r->>'ok')::boolean, 'cancel must free the slot: ' || r::text;

  -- Participant cancels -> free; event cancellation frees all participants.
  r := t_join(t_u(15), v_b, 53.08, 8.80);
  ASSERT (r->>'ok')::boolean, r::text;
  PERFORM t_as(t_u(15));
  PERFORM cancel_sparring_signup(v_b);
  PERFORM t_as(t_u(15));
  ASSERT (get_sparring_reach_status()->>'active_count')::int = 0, 'own cancel frees slot';
  r := t_join(t_u(16), v_b, 53.08, 8.80);
  ASSERT (r->>'ok')::boolean, r::text;
  PERFORM t_as(t_u(14));
  PERFORM deactivate_sparring(v_b);
  PERFORM t_as(t_u(16));
  ASSERT (get_sparring_reach_status()->>'active_count')::int = 0, 'event cancel frees participants';

  -- Ended sparring with open confirmation does not block.
  v_past := t_fix(t_u(17), interval '-3 hours', 60);
  PERFORM t_signup(v_past, t_u(18));
  r := t_pub(t_u(17), v_place, 53.08, 8.80);
  ASSERT (r->>'ok')::boolean, 'past own sparring must not block: ' || r::text;
  r := t_pub(t_u(18), v_place, 53.08, 8.80);
  ASSERT (r->>'ok')::boolean, 'past signup must not block: ' || r::text;
  RAISE NOTICE 'ok 4 cancel, event cancel and regular end free the slot; open confirmation does not block';
END $$;

-- ── 5. Rolling publication limit ────────────────────────────────────────────────

DO $$
DECLARE
  v_place uuid := t_place(53.08, 8.80);
  v_req uuid := gen_random_uuid();
  r jsonb; v_first timestamptz; i integer;
BEGIN
  r := t_pub(t_u(19), v_place, 53.08, 8.80, v_req);
  ASSERT (r->>'ok')::boolean, r::text;
  -- Retry of the same publication: same sparring, no extra count.
  r := t_pub(t_u(19), v_place, 53.08, 8.80, v_req);
  ASSERT (r->>'replayed')::boolean, r::text;
  ASSERT (SELECT count(*) FROM sparring_publish_log WHERE user_id = t_u(19)) = 1, 'retry counted';
  -- Make the first one 20 h old so the next possible time is checkable.
  UPDATE sparring_publish_log SET published_at = now() - interval '20 hours' WHERE user_id = t_u(19);
  SELECT published_at INTO v_first FROM sparring_publish_log WHERE user_id = t_u(19);
  -- Create-cancel-recreate twice more.
  FOR i IN 1..2 LOOP
    PERFORM t_as(t_u(19));
    PERFORM deactivate_sparring((SELECT id FROM open_sparrings WHERE created_by = t_u(19) AND is_active));
    r := t_pub(t_u(19), v_place, 53.08, 8.80);
    ASSERT (r->>'ok')::boolean, r::text;
  END LOOP;
  PERFORM t_as(t_u(19));
  PERFORM deactivate_sparring((SELECT id FROM open_sparrings WHERE created_by = t_u(19) AND is_active));
  -- Deleting a sparring does not erase the evidence either.
  PERFORM t_as(NULL);
  DELETE FROM open_sparrings WHERE created_by = t_u(19);
  r := t_pub(t_u(19), v_place, 53.08, 8.80);
  ASSERT r->>'reason' = 'rate_limited', r::text;
  ASSERT (r->>'next_publish_at')::timestamptz = v_first + interval '24 hours', r::text;
  PERFORM t_as(t_u(19));
  r := get_sparring_reach_status();
  ASSERT (r->>'publish_used')::int = 3 AND (r->>'publish_next_at')::timestamptz = v_first + interval '24 hours', r::text;
  -- Once the oldest leaves the window, publishing works again.
  UPDATE sparring_publish_log SET published_at = now() - interval '25 hours'
   WHERE user_id = t_u(19) AND published_at = v_first;
  r := t_pub(t_u(19), v_place, 53.08, 8.80);
  ASSERT (r->>'ok')::boolean, r::text;
  RAISE NOTICE 'ok 5 rate limit: cancel/delete/recreate counted, retry not counted, exact next time';
END $$;

-- ── 6/7. QR check-in ────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_org uuid := t_u(20);
  v_sp  uuid := t_fix(t_u(20), interval '10 minutes', 60);
  v_sp2 uuid := t_fix(t_u(26), interval '10 minutes', 60);
  v_late uuid := t_fix(t_u(27), interval '3 hours', 60);
  v_tok text; v_tok2 text; r jsonb;
BEGIN
  PERFORM t_signup(v_sp, t_u(21));
  PERFORM t_signup(v_sp, t_u(22), 'pending');
  PERFORM t_signup(v_sp, t_u(23), 'cancelled');
  PERFORM t_signup(v_sp2, t_u(28));

  -- Organizer must be near the venue to open a session.
  PERFORM t_as(v_org);
  r := start_checkin_session(v_sp, 53.20, 8.80, 15, 3);
  ASSERT r->>'reason' = 'too_far_from_venue', r::text;
  r := start_checkin_session(v_sp, 53.08, 8.80, 500, 3);
  ASSERT r->>'reason' = 'location_inaccurate', r::text;
  PERFORM t_as(t_u(21));
  r := start_checkin_session(v_sp, 53.08, 8.80, 15, 3);
  ASSERT r->>'reason' = 'not_organizer', r::text;
  -- Outside the window: concrete opening time.
  PERFORM t_as(t_u(27));
  r := start_checkin_session(v_late, 53.08, 8.80, 15, 3);
  ASSERT r->>'reason' = 'checkin_not_open'
     AND (r->>'opens_at')::timestamptz = (SELECT scheduled_at FROM open_sparrings WHERE id = v_late) - interval '30 minutes', r::text;

  v_tok  := t_token(v_org, v_sp);
  v_tok2 := t_token(t_u(26), v_sp2);
  ASSERT v_tok !~ '[0-9a-f]{8}-[0-9a-f]{4}', 'token must not contain ids';
  ASSERT NOT EXISTS (SELECT 1 FROM sparring_checkin_tokens WHERE token_hash = convert_to(v_tok, 'UTF8')),
         'raw token must not be stored';

  -- Rejections
  r := t_checkin(t_u(21), v_sp, 'x' || v_tok);
  ASSERT r->>'reason' = 'token_invalid', r::text;
  r := t_checkin(t_u(21), v_sp, v_tok2);
  ASSERT r->>'reason' = 'token_wrong_sparring', r::text;
  r := t_checkin(v_org, v_sp, v_tok);
  ASSERT r->>'reason' = 'organizer_self', r::text;
  r := t_checkin(t_u(24), v_sp, v_tok);
  ASSERT r->>'reason' = 'not_participant', 'stranger: ' || r::text;
  r := t_checkin(t_u(23), v_sp, v_tok);
  ASSERT r->>'reason' = 'not_participant', 'cancelled signup: ' || r::text;
  r := t_checkin(t_u(21), v_sp, v_tok, 53.09, 8.80);  -- ~1.1 km away
  ASSERT r->>'reason' = 'too_far_from_venue', r::text;
  r := t_checkin(t_u(21), v_sp, v_tok, 53.0805, 8.8005, 15, 400);
  ASSERT r->>'reason' = 'location_stale', r::text;
  BEGIN
    PERFORM t_checkin(NULL, v_sp, v_tok);
    ASSERT false, 'anonymous check-in must raise';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM = 'not_authenticated', SQLERRM;
  END;

  -- Two different participants with the same valid code; repeats are idempotent.
  r := t_checkin(t_u(21), v_sp, v_tok);
  ASSERT (r->>'ok')::boolean AND NOT (r->>'already')::boolean, r::text;
  r := t_checkin(t_u(22), v_sp, v_tok);
  ASSERT (r->>'ok')::boolean, 'pending participant with same token: ' || r::text;
  r := t_checkin(t_u(21), v_sp, v_tok);
  ASSERT (r->>'ok')::boolean AND (r->>'already')::boolean, r::text;
  ASSERT (SELECT count(*) FROM sparring_checkins WHERE sparring_id = v_sp) = 2, 'no duplicates';
  ASSERT (SELECT distance_bucket_m FROM sparring_checkins WHERE sparring_id = v_sp AND user_id = t_u(21)) % 50 = 0;

  -- Expired code
  PERFORM t_signup(v_sp, t_u(25));
  UPDATE sparring_checkin_tokens SET expires_at = now() - interval '1 second';
  r := t_checkin(t_u(25), v_sp, v_tok);
  ASSERT r->>'reason' = 'token_expired', r::text;

  -- Organizer list
  PERFORM t_as(v_org);
  ASSERT (SELECT count(*) FROM get_sparring_checkins(v_sp)) = 2;
  PERFORM t_as(t_u(21));
  ASSERT (SELECT count(*) FROM get_sparring_checkins(v_sp)) = 0, 'list is organizer-only';
  RAISE NOTICE 'ok 6/7 QR: wrong/foreign/expired code, self-scan, strangers, cancelled, far, stale refused; shared code, no duplicates';
END $$;

-- Cancelled sparring: no session, no check-in.
DO $$
DECLARE v_sp uuid := t_fix(t_u(29), interval '10 minutes', 60); v_tok text; r jsonb;
BEGIN
  PERFORM t_signup(v_sp, t_u(30));
  v_tok := t_token(t_u(29), v_sp);
  PERFORM t_as(t_u(29));
  PERFORM deactivate_sparring(v_sp);
  r := t_checkin(t_u(30), v_sp, v_tok);
  ASSERT r->>'reason' = 'sparring_cancelled', r::text;
  PERFORM t_as(t_u(29));
  r := start_checkin_session(v_sp, 53.08, 8.80, 15, 3);
  ASSERT r->>'reason' = 'sparring_cancelled', r::text;
  RAISE NOTICE 'ok 6b cancelled sparring refuses session and check-in';
END $$;

-- ── 8/9. Confirmation and unlock ────────────────────────────────────────────────

DO $$
DECLARE
  v_org uuid := t_u(31);
  -- Started 70 min ago, 60 min long: ended 10 min ago, check-in still open.
  v_sp uuid := t_fix(t_u(31), interval '-70 minutes', 60);
  v_tok text; r jsonb;
BEGIN
  PERFORM t_signup(v_sp, t_u(32));   -- scans, never confirms
  PERFORM t_signup(v_sp, t_u(33));   -- confirms without scan
  PERFORM t_signup(v_sp, t_u(34));   -- scans and confirms
  v_tok := t_token(v_org, v_sp);
  PERFORM t_checkin(t_u(32), v_sp, v_tok);
  PERFORM t_checkin(t_u(34), v_sp, v_tok);

  -- Scan alone: nothing.
  ASSERT NOT t_unlocked(t_u(32)), 'scan alone must not unlock';
  -- Confirmation without scan: recorded, nothing unlocked.
  r := t_fb(t_u(33), v_sp, 'happened');
  ASSERT (r->>'ok')::boolean AND NOT (r->>'unlocked')::boolean, r::text;
  ASSERT NOT t_unlocked(t_u(33)) AND NOT t_unlocked(v_org), 'confirm without scan must not unlock';
  -- Organizer self-statement: nothing.
  r := t_fb(v_org, v_sp, 'happened');
  ASSERT NOT (r->>'unlocked')::boolean AND NOT t_unlocked(v_org), 'organizer alone must not unlock';
  -- Qualifying participant: scan + own positive confirmation -> participant and organizer.
  r := t_fb(t_u(34), v_sp, 'happened');
  ASSERT (r->>'unlocked')::boolean, r::text;
  ASSERT t_unlocked(t_u(34)) AND t_unlocked(v_org);
  ASSERT (SELECT role FROM sparring_reach_unlocks WHERE user_id = v_org) = 'organizer';
  ASSERT (SELECT sparring_id FROM sparring_reach_unlocks WHERE user_id = t_u(34)) = v_sp;
  ASSERT (SELECT count(*) FROM notifications WHERE user_id = v_org AND type = 'sparring_reach_unlocked') = 1;
  -- Repeat answer: same answer, no second unlock.
  r := t_fb(t_u(34), v_sp, 'happened');
  ASSERT (r->>'already')::boolean AND NOT (r->>'unlocked')::boolean, r::text;
  ASSERT (SELECT count(*) FROM sparring_reach_unlocks WHERE user_id = t_u(34)) = 1;
  -- Radius 300, slot limit still one.
  PERFORM t_as(t_u(34));
  r := get_sparring_reach_status();
  ASSERT (r->>'radius_km')::int = 300 AND (r->>'active_limit')::int = 1 AND (r->>'unlock_unseen')::boolean, r::text;
  PERFORM ack_reach_unlock();
  ASSERT NOT (get_sparring_reach_status()->>'unlock_unseen')::boolean;
  r := t_pub(t_u(34), t_place(53.08, 8.80), 53.08, 8.80);
  ASSERT (r->>'ok')::boolean, r::text;
  r := t_pub(t_u(34), t_place(53.08, 8.80), 53.08, 8.80);
  ASSERT r->>'reason' = 'slot_taken', 'limit stays one after unlock: ' || r::text;
  RAISE NOTICE 'ok 8 unlock only with scan + own confirmation; organizer via checked-in participant; once; slot limit stays 1';
END $$;

-- Timing and missing answers.
DO $$
DECLARE
  v_future uuid := t_fix(t_u(35), interval '10 minutes', 60);
  v_old    uuid := t_fix(t_u(37), interval '-80 hours', 60);
  r jsonb;
BEGIN
  PERFORM t_signup(v_future, t_u(36));
  r := t_fb(t_u(36), v_future, 'happened');
  ASSERT r->>'reason' = 'feedback_not_open', 'not before the end: ' || r::text;
  PERFORM t_signup(v_old, t_u(38));
  r := t_fb(t_u(38), v_old, 'happened');
  ASSERT r->>'reason' = 'feedback_closed', 'not after 72 h: ' || r::text;
  RAISE NOTICE 'ok 8b confirmation only between planned end and end + 72 h';
END $$;

DO $$
DECLARE
  v_org uuid := t_u(39);
  v_sp uuid := t_fix(t_u(39), interval '-70 minutes', 60);
  v_tok text; r jsonb;
BEGIN
  PERFORM t_signup(v_sp, t_u(40));
  PERFORM t_signup(v_sp, t_u(41));
  PERFORM t_signup(v_sp, t_u(42));   -- never answers, never scans
  v_tok := t_token(v_org, v_sp);
  PERFORM t_checkin(t_u(40), v_sp, v_tok);
  PERFORM t_checkin(t_u(41), v_sp, v_tok);
  -- Conflicting report first ...
  r := t_fb(t_u(40), v_sp, 'problem', 'Organisator war nicht da');
  ASSERT (r->>'ok')::boolean;
  ASSERT (SELECT meeting_conflict_at IS NOT NULL FROM open_sparrings WHERE id = v_sp);
  -- ... stops automatic unlocks from this sparring.
  r := t_fb(t_u(41), v_sp, 'happened');
  ASSERT NOT (r->>'unlocked')::boolean AND NOT t_unlocked(t_u(41)) AND NOT t_unlocked(v_org), r::text;
  -- No automatic penalty: statuses untouched, no no_show anywhere.
  ASSERT NOT EXISTS (SELECT 1 FROM sparring_signups WHERE sparring_id = v_sp AND status <> 'confirmed'),
         'statuses must stay unchanged';
  ASSERT (SELECT note FROM sparring_meeting_feedback WHERE sparring_id = v_sp AND user_id = t_u(40)) = 'Organisator war nicht da';
  RAISE NOTICE 'ok 9 conflict recorded and stops unlocks; no automatic no-show for missing answers/scans';
END $$;

-- Earlier unlock is kept when a later answer disagrees.
DO $$
DECLARE v_sp uuid := t_fix(t_u(43), interval '-70 minutes', 60); v_tok text;
BEGIN
  PERFORM t_signup(v_sp, t_u(44));
  PERFORM t_signup(v_sp, t_u(45));
  v_tok := t_token(t_u(43), v_sp);
  PERFORM t_checkin(t_u(44), v_sp, v_tok);
  PERFORM t_fb(t_u(44), v_sp, 'happened');
  ASSERT t_unlocked(t_u(44));
  PERFORM t_fb(t_u(45), v_sp, 'cancelled');
  ASSERT t_unlocked(t_u(44)) AND t_unlocked(t_u(43)), 'granted unlocks are not revoked';
  RAISE NOTICE 'ok 9b later contradiction does not revoke earlier unlocks';
END $$;

-- ── 10. Legacy data and edits ───────────────────────────────────────────────────

DO $$
DECLARE
  v_sp uuid; v_legacy uuid; r jsonb; ok boolean;
  v_place uuid := t_place(53.08, 8.80);
BEGIN
  r := t_pub(t_u(46), v_place, 53.08, 8.80);
  v_sp := (r->>'sparring_id')::uuid;
  ASSERT (SELECT lat = 53.08 AND place_id = v_place AND permission_confirmed_at IS NOT NULL
            FROM open_sparrings WHERE id = v_sp), 'target coords come from the place';

  -- Title/description edit still works; place/time cannot move.
  PERFORM t_as(t_u(46));
  PERFORM update_sparring(v_sp, 'Neuer Titel', 'Neue Notiz', 'Boxen',
    (SELECT address FROM open_sparrings WHERE id = v_sp), 53.08, 8.80,
    (SELECT scheduled_at FROM open_sparrings WHERE id = v_sp), 90, 4, false);
  ASSERT (SELECT title FROM open_sparrings WHERE id = v_sp) = 'Neuer Titel';
  BEGIN
    PERFORM update_sparring(v_sp, 'Neuer Titel', NULL, 'Boxen', 'Südpol', -90, 0,
      (SELECT scheduled_at FROM open_sparrings WHERE id = v_sp), 90, 4, false);
    ok := true;
  EXCEPTION WHEN raise_exception THEN ok := false; END;
  ASSERT NOT ok, 'moving the place must be refused';
  BEGIN
    PERFORM update_sparring(v_sp, 'Neuer Titel', NULL, 'Boxen',
      (SELECT address FROM open_sparrings WHERE id = v_sp), 53.08, 8.80,
      now() + interval '20 days', 90, 4, false);
    ok := true;
  EXCEPTION WHEN raise_exception THEN ok := false; END;
  ASSERT NOT ok, 'moving the time must be refused';
  BEGIN
    INSERT INTO studios (id, name) VALUES ('00000000-0000-0000-0000-00000000ff01', 'Gym');
    PERFORM set_sparring_gym(v_sp, '00000000-0000-0000-0000-00000000ff01', NULL);
    ok := true;
  EXCEPTION WHEN raise_exception THEN ok := false; END;
  ASSERT NOT ok, 'switching the gym must be refused';

  -- Legacy sparring without coordinates: still counts as active for its owner,
  -- joining refused with an explained reason, cancelling works.
  v_legacy := t_fix(t_u(47), interval '2 days', 90, NULL, NULL);
  r := t_join(t_u(48), v_legacy, 53.08, 8.80);
  ASSERT r->>'reason' = 'place_unknown', r::text;
  r := t_pub(t_u(47), v_place, 53.08, 8.80);
  ASSERT r->>'reason' = 'slot_taken', r::text;
  PERFORM t_as(t_u(47));
  PERFORM deactivate_sparring(v_legacy);
  r := t_pub(t_u(47), v_place, 53.08, 8.80);
  ASSERT (r->>'ok')::boolean, 'after cancelling legacy row: ' || r::text;

  -- Legacy multiple active sparrings stay; nothing new while one is active.
  PERFORM t_fix(t_u(49), interval '2 days');
  PERFORM t_fix(t_u(49), interval '4 days');
  PERFORM t_as(t_u(49));
  ASSERT (get_sparring_reach_status()->>'active_count')::int = 2, 'legacy rows kept';
  r := t_pub(t_u(49), v_place, 53.08, 8.80);
  ASSERT r->>'reason' = 'slot_taken', r::text;

  -- Existing accounts start at 150 km.
  ASSERT (get_sparring_reach_status()->>'radius_km')::int = 150;
  RAISE NOTICE 'ok 10 legacy rows kept but cannot be bypassed; place/time/gym locked; title editable';
END $$;

-- Waitlist promotion skips users who meanwhile hold another active sparring.
DO $$
DECLARE
  v_full uuid := t_fix(t_u(52), interval '2 days', 90, 53.08, 8.80, 1);
  r jsonb;
BEGIN
  r := t_join(t_u(53), v_full, 53.08, 8.80);
  ASSERT r->>'status' IN ('pending','confirmed'), r::text;
  r := t_join(t_u(54), v_full, 53.08, 8.80);
  ASSERT r->>'status' = 'waitlisted', r::text;
  r := t_join(t_u(55), v_full, 53.08, 8.80);
  ASSERT r->>'status' = 'waitlisted', r::text;
  -- First in line publishes an own sparring meanwhile.
  r := t_pub(t_u(54), t_place(53.08, 8.80), 53.08, 8.80);
  ASSERT (r->>'ok')::boolean, r::text;
  PERFORM t_as(t_u(53));
  PERFORM cancel_sparring_signup(v_full);
  ASSERT (SELECT status FROM sparring_signups WHERE sparring_id = v_full AND user_id = t_u(54)) = 'waitlisted',
         'busy user must be skipped';
  ASSERT (SELECT status FROM sparring_signups WHERE sparring_id = v_full AND user_id = t_u(55)) = 'pending',
         'next in line moves up';
  RAISE NOTICE 'ok 11 waitlist promotion respects the one-active rule';
END $$;

-- Intro acknowledgement is account-bound and versioned.
DO $$
BEGIN
  PERFORM t_as(t_u(56));
  ASSERT NOT (get_sparring_reach_status()->>'intro_acked')::boolean;
  PERFORM ack_sparring_intro(1::smallint);
  ASSERT (get_sparring_reach_status()->>'intro_acked')::boolean;
  RAISE NOTICE 'ok 12 intro acknowledgement stored per account with version';
END $$;

-- Coach publication follows the same rules and needs the studio link.
DO $$
DECLARE r jsonb;
BEGIN
  INSERT INTO studios (id, name) VALUES ('00000000-0000-0000-0000-00000000ff02', 'Studio');
  UPDATE profiles SET is_coach = true, studio_id = '00000000-0000-0000-0000-00000000ff02' WHERE id = t_u(57);
  PERFORM t_as(t_u(57));
  r := publish_sparring(gen_random_uuid(), t_place(53.08, 8.80), 'Studio', 'Boxen', NULL,
                        now() + interval '2 days', 90, 4, false, true, 53.08, 8.80, 20, 5,
                        NULL, '00000000-0000-0000-0000-00000000ff02');
  ASSERT (r->>'ok')::boolean, r::text;
  r := publish_sparring(gen_random_uuid(), t_place(53.08, 8.80), 'Studio', 'Boxen', NULL,
                        now() + interval '3 days', 90, 4, false, true, 53.08, 8.80, 20, 5,
                        NULL, '00000000-0000-0000-0000-00000000ff02');
  ASSERT r->>'reason' = 'slot_taken', r::text;
  PERFORM t_as(t_u(58));
  r := publish_sparring(gen_random_uuid(), t_place(53.08, 8.80), 'Studio', 'Boxen', NULL,
                        now() + interval '2 days', 90, 4, false, true, 53.08, 8.80, 20, 5,
                        NULL, '00000000-0000-0000-0000-00000000ff02');
  ASSERT r->>'reason' = 'not_coach', r::text;
  -- Self-declaration is mandatory.
  r := publish_sparring(gen_random_uuid(), t_place(53.08, 8.80), 'x', 'Boxen', NULL,
                        now() + interval '2 days', 90, 4, false, false, 53.08, 8.80, 20, 5);
  ASSERT r->>'reason' = 'permission_not_confirmed', r::text;
  RAISE NOTICE 'ok 13 coaches: same limits; studio link and self-declaration required';
END $$;

-- Plain street address needs a venue name; the label never moves the target.
DO $$
DECLARE v_place uuid; r jsonb;
BEGIN
  INSERT INTO sparring_places (osm_type, osm_id, name, address, lat, lng, category)
  VALUES ('node', nextval('t_osm'), 'Hauptstr. 2', 'Hauptstr. 2, 28195 Bremen', 53.08, 8.80, 'address')
  RETURNING id INTO v_place;
  PERFORM t_as(t_u(59));
  r := publish_sparring(gen_random_uuid(), v_place, 'x', 'Boxen', NULL, now() + interval '2 days',
                        90, 4, false, true, 53.08, 8.80, 20, 5);
  ASSERT r->>'reason' = 'place_label_required', r::text;
  r := publish_sparring(gen_random_uuid(), v_place, 'x', 'Boxen', NULL, now() + interval '2 days',
                        90, 4, false, true, 53.08, 8.80, 20, 5, NULL, NULL, NULL, 'verbotenwort Gym');
  ASSERT r->>'reason' = 'place_label_invalid', r::text;
  r := publish_sparring(gen_random_uuid(), v_place, 'x', 'Boxen', NULL, now() + interval '2 days',
                        90, 4, false, true, 53.08, 8.80, 20, 5, NULL, NULL, NULL, 'Boxclub Nord');
  ASSERT (r->>'ok')::boolean, r::text;
  ASSERT (SELECT place_name = 'Boxclub Nord' AND lat = 53.08 FROM open_sparrings
           WHERE id = (r->>'sparring_id')::uuid);
  RAISE NOTICE 'ok 14 plain address requires a clean venue name; coordinates stay from the place';
END $$;

SELECT t_as(NULL);
