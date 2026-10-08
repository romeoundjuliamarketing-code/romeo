-- Reliable sparrings (part 2/3): RPCs. Additive; old clients keep working until
-- 20261008120200_sparring_trust_lockdown.sql is applied together with the release.
--
-- All business decisions happen here. The client never supplies radius, unlock
-- state, distance or target coordinates; it supplies only its current device fix
-- (lat/lng, reported accuracy, age of the fix). Device coordinates can be spoofed:
-- this is a plausibility check, not a proof of presence.
--
-- Business refusals are returned as {ok:false, reason, ...} (never as raw errors)
-- so the app can explain them. Positions are only used for the comparison and are
-- never stored; only rounded results are kept.

-- ── Internal helpers (no API grants) ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sparring_end_at(p_scheduled_at timestamptz, p_duration_min integer)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT p_scheduled_at + make_interval(mins => COALESCE(p_duration_min, 90))
$$;

-- Cancelled = switched off before its planned end (rows switched off before
-- deactivated_at existed count as cancelled: no unlock can come from them).
CREATE OR REPLACE FUNCTION sparring_is_cancelled(
  p_is_active boolean, p_deactivated_at timestamptz, p_end_at timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT p_is_active AND (p_deactivated_at IS NULL OR p_deactivated_at < p_end_at)
$$;

-- Serialises all slot / rate-limit relevant mutations of one user across devices.
CREATE OR REPLACE FUNCTION sparring_user_lock_key(p_uid uuid)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT hashtextextended('sparring_user:' || p_uid::text, 0)
$$;

CREATE OR REPLACE FUNCTION sparring_user_lock(p_uid uuid)
RETURNS void LANGUAGE sql AS $$
  SELECT pg_advisory_xact_lock(sparring_user_lock_key(p_uid))
$$;

-- Active sparrings of a user: own active sparrings before their planned end plus
-- binding signups (pending/confirmed) on active sparrings before their end.
-- UNION de-duplicates an organizer who also has a signup row on the same sparring.
CREATE OR REPLACE FUNCTION sparring_active_ids(p_uid uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id
    FROM open_sparrings s
   WHERE s.created_by = p_uid
     AND s.is_active
     AND sparring_end_at(s.scheduled_at, s.duration_min) > now()
  UNION
  SELECT s.id
    FROM sparring_signups ss
    JOIN open_sparrings s ON s.id = ss.sparring_id
   WHERE ss.user_id = p_uid
     AND ss.status IN ('pending','confirmed')
     AND s.is_active
     AND sparring_end_at(s.scheduled_at, s.duration_min) > now()
$$;

CREATE OR REPLACE FUNCTION sparring_user_radius_km(p_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM sparring_reach_unlocks WHERE user_id = p_uid)
              THEN sparring_trust_radius_unlocked_km()
              ELSE sparring_trust_radius_base_km() END
$$;

-- NULL when the device fix is usable, otherwise the reason.
CREATE OR REPLACE FUNCTION sparring_position_problem(
  p_lat double precision, p_lng double precision,
  p_accuracy_m double precision, p_fix_age_s double precision)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_lat IS NULL OR p_lng IS NULL
      OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180
      THEN 'location_missing'
    WHEN p_accuracy_m IS NULL OR p_accuracy_m < 0
      OR p_accuracy_m > sparring_trust_loc_max_accuracy_m()
      THEN 'location_inaccurate'
    WHEN p_fix_age_s IS NULL
      OR p_fix_age_s > sparring_trust_loc_max_age_s()
      OR p_fix_age_s < -sparring_trust_loc_future_skew_s()
      THEN 'location_stale'
    ELSE NULL
  END
$$;

-- Rolling publication window: used count and, when exhausted, the exact moment
-- the oldest counted publication leaves the window.
CREATE OR REPLACE FUNCTION sparring_publish_rate(p_uid uuid, OUT used integer, OUT next_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT count(*)::int INTO used
    FROM sparring_publish_log
   WHERE user_id = p_uid AND published_at > now() - sparring_trust_publish_window();

  next_at := NULL;
  IF used >= sparring_trust_publish_limit() THEN
    SELECT published_at + sparring_trust_publish_window() INTO next_at
      FROM sparring_publish_log
     WHERE user_id = p_uid AND published_at > now() - sparring_trust_publish_window()
     ORDER BY published_at
     OFFSET used - sparring_trust_publish_limit()
     LIMIT 1;
  END IF;
END;
$$;

-- Shared rule evaluation for the early check and the binding writes.
--   p_action 'publish': slot, rate, then (with place + position) distance
--   p_action 'join'   : sparring state, slot, then (with position) distance
-- Without a position only slot / rate / state are checked (no distance invented).
CREATE OR REPLACE FUNCTION sparring_trust_evaluate(
  p_uid uuid, p_action text, p_sparring_id uuid, p_place_id uuid,
  p_lat double precision, p_lng double precision,
  p_accuracy_m double precision, p_fix_age_s double precision,
  p_require_position boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_radius   integer := sparring_user_radius_km(p_uid);
  v_active   uuid;
  v_used     integer;
  v_next     timestamptz;
  v_tlat     double precision;
  v_tlng     double precision;
  v_sp       record;
  v_problem  text;
  v_dist     double precision;
  v_base     jsonb;
BEGIN
  v_base := jsonb_build_object('radius_km', v_radius,
                               'unlocked', v_radius = sparring_trust_radius_unlocked_km());

  IF p_action = 'join' THEN
    SELECT id, created_by, scheduled_at, duration_min, is_active, verified_only, lat, lng
      INTO v_sp FROM open_sparrings WHERE id = p_sparring_id;
    IF NOT FOUND OR NOT v_sp.is_active THEN
      RETURN v_base || jsonb_build_object('ok', false, 'reason', 'sparring_gone');
    END IF;
    IF v_sp.created_by = p_uid THEN
      RETURN v_base || jsonb_build_object('ok', false, 'reason', 'own_sparring');
    END IF;
    IF v_sp.scheduled_at <= now() THEN
      RETURN v_base || jsonb_build_object('ok', false, 'reason', 'sparring_started');
    END IF;
    IF v_sp.verified_only AND NOT is_user_verified(p_uid) THEN
      RETURN v_base || jsonb_build_object('ok', false, 'reason', 'verified_only');
    END IF;
  ELSIF p_action <> 'publish' THEN
    RETURN v_base || jsonb_build_object('ok', false, 'reason', 'invalid_action');
  END IF;

  SELECT a INTO v_active FROM sparring_active_ids(p_uid) a
   WHERE p_sparring_id IS NULL OR a <> p_sparring_id
   LIMIT 1;
  IF v_active IS NOT NULL THEN
    RETURN v_base || jsonb_build_object('ok', false, 'reason', 'slot_taken',
                                        'active_sparring_id', v_active);
  END IF;

  IF p_action = 'publish' THEN
    SELECT r.used, r.next_at INTO v_used, v_next FROM sparring_publish_rate(p_uid) r;
    IF v_next IS NOT NULL THEN
      RETURN v_base || jsonb_build_object('ok', false, 'reason', 'rate_limited',
                                          'next_publish_at', v_next);
    END IF;
    IF p_place_id IS NULL THEN
      IF p_require_position THEN
        RETURN v_base || jsonb_build_object('ok', false, 'reason', 'place_invalid');
      END IF;
      RETURN v_base || jsonb_build_object('ok', true);
    END IF;
    SELECT lat, lng INTO v_tlat, v_tlng FROM sparring_places WHERE id = p_place_id;
    IF NOT FOUND THEN
      RETURN v_base || jsonb_build_object('ok', false, 'reason', 'place_invalid');
    END IF;
  ELSE
    v_tlat := v_sp.lat;
    v_tlng := v_sp.lng;
    IF v_tlat IS NULL OR v_tlng IS NULL THEN
      RETURN v_base || jsonb_build_object('ok', false, 'reason', 'place_unknown');
    END IF;
  END IF;

  IF p_lat IS NULL AND p_lng IS NULL AND NOT p_require_position THEN
    RETURN v_base || jsonb_build_object('ok', true);
  END IF;

  v_problem := sparring_position_problem(p_lat, p_lng, p_accuracy_m, p_fix_age_s);
  IF v_problem IS NOT NULL THEN
    RETURN v_base || jsonb_build_object('ok', false, 'reason', v_problem);
  END IF;

  v_dist := geo_distance_m(p_lat, p_lng, v_tlat, v_tlng);
  IF NOT sparring_within_radius(v_dist, v_radius) THEN
    RETURN v_base || jsonb_build_object('ok', false, 'reason', 'too_far',
                                        'distance_m', round(v_dist));
  END IF;

  RETURN v_base || jsonb_build_object('ok', true, 'distance_m', round(v_dist));
END;
$$;

CREATE OR REPLACE FUNCTION try_unlock_reach(p_uid uuid, p_sparring_id uuid, p_role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO sparring_reach_unlocks (user_id, sparring_id, role)
  VALUES (p_uid, p_sparring_id, p_role)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION sparring_active_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sparring_user_radius_km(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sparring_publish_rate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sparring_trust_evaluate(uuid,text,uuid,uuid,double precision,double precision,double precision,double precision,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION try_unlock_reach(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sparring_user_lock(uuid) FROM PUBLIC, anon, authenticated;

-- ── Status for "Meine Sparrings" ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_sparring_reach_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_unlock record;
  v_active uuid;
  v_count  integer;
  v_used   integer;
  v_next   timestamptz;
  v_intro  smallint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT unlocked_at, seen_at, sparring_id INTO v_unlock
    FROM sparring_reach_unlocks WHERE user_id = v_uid;

  SELECT count(*)::int INTO v_count FROM sparring_active_ids(v_uid);
  -- The soonest active sparring is the one to link to.
  SELECT s.id INTO v_active
    FROM open_sparrings s
   WHERE s.id IN (SELECT sparring_active_ids(v_uid))
   ORDER BY s.scheduled_at
   LIMIT 1;

  SELECT r.used, r.next_at INTO v_used, v_next FROM sparring_publish_rate(v_uid) r;
  SELECT sparring_intro_version INTO v_intro FROM profiles WHERE id = v_uid;

  RETURN jsonb_build_object(
    'radius_km',           sparring_user_radius_km(v_uid),
    'base_radius_km',      sparring_trust_radius_base_km(),
    'unlocked_radius_km',  sparring_trust_radius_unlocked_km(),
    'unlocked',            v_unlock.unlocked_at IS NOT NULL,
    'unlocked_at',         v_unlock.unlocked_at,
    'unlock_unseen',       v_unlock.unlocked_at IS NOT NULL AND v_unlock.seen_at IS NULL,
    'active_count',        v_count,
    'active_limit',        1,
    'active_sparring_id',  v_active,
    'publish_used',        v_used,
    'publish_limit',       sparring_trust_publish_limit(),
    'publish_next_at',     v_next,
    'intro_acked',         COALESCE(v_intro, 0) >= sparring_trust_intro_version(),
    'intro_version',       sparring_trust_intro_version(),
    'server_now',          now()
  );
END;
$$;

-- Non-binding early check (no writes). The binding check runs again inside
-- publish_sparring / join_sparring_v2.
CREATE OR REPLACE FUNCTION check_sparring_eligibility(
  p_action      text,
  p_sparring_id uuid DEFAULT NULL,
  p_place_id    uuid DEFAULT NULL,
  p_lat         double precision DEFAULT NULL,
  p_lng         double precision DEFAULT NULL,
  p_accuracy_m  double precision DEFAULT NULL,
  p_fix_age_s   double precision DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_action = 'join' THEN
    SELECT status INTO v_existing FROM sparring_signups
     WHERE sparring_id = p_sparring_id AND user_id = v_uid;
    IF v_existing IN ('pending','confirmed','waitlisted') THEN
      RETURN jsonb_build_object('ok', true, 'already', v_existing);
    END IF;
  END IF;
  RETURN sparring_trust_evaluate(v_uid, p_action, p_sparring_id, p_place_id,
                                 p_lat, p_lng, p_accuracy_m, p_fix_age_s, false);
END;
$$;

-- ── Publish ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION publish_sparring(
  p_request_id           uuid,
  p_place_id             uuid,
  p_title                text,
  p_discipline           text,
  p_notes                text,
  p_scheduled_at         timestamptz,
  p_duration_min         integer,
  p_max_slots            integer,
  p_verified_only        boolean,
  p_permission_confirmed boolean,
  p_lat                  double precision,
  p_lng                  double precision,
  p_accuracy_m           double precision,
  p_fix_age_s            double precision,
  p_gym_id               uuid DEFAULT NULL,
  p_studio_id            uuid DEFAULT NULL,
  p_access_note          text DEFAULT NULL,
  p_place_label          text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_prev    uuid;
  v_place   sparring_places%ROWTYPE;
  v_eval    jsonb;
  v_id      uuid;
  v_title   text := btrim(COALESCE(p_title, ''));
  v_disc    text := btrim(COALESCE(p_discipline, ''));
  v_notes   text := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_access  text := NULLIF(btrim(COALESCE(p_access_note, '')), '');
  v_label   text := NULLIF(btrim(COALESCE(p_place_label, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_request');
  END IF;

  PERFORM sparring_user_lock(v_uid);

  -- Network retry of the same publication: same answer, no extra rate count.
  SELECT sparring_id INTO v_prev FROM sparring_publish_log
   WHERE user_id = v_uid AND request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'sparring_id', v_prev, 'replayed', true);
  END IF;

  IF p_studio_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM profiles
                    WHERE id = v_uid AND is_coach = true AND studio_id = p_studio_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_coach');
    END IF;
  ELSIF NOT can_create_sparring() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'subscription_required');
  END IF;

  IF p_permission_confirmed IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'permission_not_confirmed');
  END IF;
  IF char_length(v_title) NOT BETWEEN 1 AND 80 OR char_length(v_disc) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'details_invalid');
  END IF;
  IF v_notes IS NOT NULL AND char_length(v_notes) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'details_invalid');
  END IF;
  IF v_access IS NOT NULL AND char_length(v_access) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'details_invalid');
  END IF;
  IF p_scheduled_at IS NULL OR p_scheduled_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'time_invalid');
  END IF;
  IF p_duration_min IS NULL OR p_duration_min NOT BETWEEN 30 AND 300 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duration_invalid');
  END IF;
  IF p_max_slots IS NULL OR p_max_slots NOT BETWEEN 1 AND 50 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'details_invalid');
  END IF;

  SELECT * INTO v_place FROM sparring_places WHERE id = p_place_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'place_invalid');
  END IF;
  -- A plain street address needs a name for the venue (e.g. "Boxclub Nord").
  -- The label never changes the coordinates.
  IF v_label IS NOT NULL AND (char_length(v_label) NOT BETWEEN 2 AND 80 OR NOT is_text_clean(v_label)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'place_label_invalid');
  END IF;
  IF v_place.category = 'address' AND v_label IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'place_label_required');
  END IF;

  v_eval := sparring_trust_evaluate(v_uid, 'publish', NULL, p_place_id,
                                    p_lat, p_lng, p_accuracy_m, p_fix_age_s, true);
  IF NOT (v_eval->>'ok')::boolean THEN
    RETURN v_eval;
  END IF;

  BEGIN
    PERFORM set_config('sparr.trust_publish', '1', true);
    INSERT INTO open_sparrings (
      studio_id, is_at_studio, created_by, title, discipline, notes,
      address, lat, lng, place_id, place_name, permission_confirmed_at,
      scheduled_at, duration_min, max_slots, verified_only, is_featured,
      gym_id, access_note
    ) VALUES (
      p_studio_id, p_studio_id IS NOT NULL, v_uid, v_title, v_disc, v_notes,
      v_place.address, v_place.lat, v_place.lng, v_place.id, COALESCE(v_label, v_place.name), now(),
      p_scheduled_at, p_duration_min, p_max_slots, COALESCE(p_verified_only, false), false,
      CASE WHEN p_gym_id IS NOT NULL AND EXISTS (SELECT 1 FROM studios WHERE id = p_gym_id)
           THEN p_gym_id END,
      v_access
    )
    RETURNING id INTO v_id;
    PERFORM set_config('sparr.trust_publish', '', true);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%CONTENT_FILTER_BLOCKED%' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'content_blocked');
    END IF;
    RAISE;
  END;

  INSERT INTO sparring_chat_settings (sparring_id) VALUES (v_id)
  ON CONFLICT (sparring_id) DO NOTHING;

  INSERT INTO sparring_publish_log (user_id, request_id, sparring_id, distance_km)
  VALUES (v_uid, p_request_id, v_id, round(((v_eval->>'distance_m')::numeric) / 1000));

  RETURN jsonb_build_object('ok', true, 'sparring_id', v_id, 'replayed', false);
END;
$$;

-- ── Binding join ────────────────────────────────────────────────────────────────

-- Wraps the existing join_sparring (capacity, waitlist, consent, notifications)
-- after the trust checks. join_sparring's body stays untouched; the lockdown
-- migration makes signup inserts require this wrapper.
CREATE OR REPLACE FUNCTION join_sparring_v2(
  p_sparring_id   uuid,
  p_rules_version smallint,
  p_lat           double precision,
  p_lng           double precision,
  p_accuracy_m    double precision,
  p_fix_age_s     double precision)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_existing text;
  v_eval     jsonb;
  v_status   text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_rules_version IS NULL OR p_rules_version < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rules_required');
  END IF;

  PERFORM sparring_user_lock(v_uid);

  -- Retry / double tap: already in, same answer, no location needed.
  SELECT status INTO v_existing FROM sparring_signups
   WHERE sparring_id = p_sparring_id AND user_id = v_uid;
  IF v_existing IN ('pending','confirmed','waitlisted') THEN
    RETURN jsonb_build_object('ok', true, 'status', v_existing, 'replayed', true);
  END IF;

  v_eval := sparring_trust_evaluate(v_uid, 'join', p_sparring_id, NULL,
                                    p_lat, p_lng, p_accuracy_m, p_fix_age_s, true);
  IF NOT (v_eval->>'ok')::boolean THEN
    RETURN v_eval;
  END IF;

  BEGIN
    PERFORM set_config('sparr.trust_join', p_sparring_id::text, true);
    v_status := join_sparring(p_sparring_id, p_rules_version);
    PERFORM set_config('sparr.trust_join', '', true);
  EXCEPTION WHEN raise_exception THEN
    -- Remaining refusals of join_sparring (e.g. full after a late cancellation)
    -- carry readable German text; the app shows a generic localised message.
    RETURN jsonb_build_object('ok', false, 'reason', 'join_failed', 'detail', SQLERRM);
  END;

  RETURN jsonb_build_object('ok', true, 'status', v_status, 'replayed', false,
                            'distance_m', v_eval->'distance_m');
END;
$$;

-- Waitlist promotion skips users who meanwhile hold another active sparring.
-- Patched in place (same technique as 20261007120100) so the live body,
-- including its language-aware notification, stays untouched otherwise.
CREATE OR REPLACE FUNCTION pg_temp.patch(p_fn regprocedure, p_old text, p_new text)
RETURNS void LANGUAGE plpgsql AS $f$
DECLARE
  d text := pg_get_functiondef(p_fn);
BEGIN
  IF position(p_old IN d) = 0 THEN
    RAISE EXCEPTION 'trust patch: snippet not found in %: %', p_fn, left(p_old, 80);
  END IF;
  EXECUTE replace(d, p_old, p_new);
END;
$f$;

SELECT pg_temp.patch('public.promote_sparring_waitlist(uuid)', $o$     ORDER BY signed_up_at, id
     LIMIT v_free
       FOR UPDATE
  LOOP
$o$, $n$     ORDER BY signed_up_at, id
       FOR UPDATE
  LOOP
    EXIT WHEN v_count >= v_free;
    -- One active sparring per user (20261008120100). A try-lock avoids deadlocks
    -- with that user's own concurrent publish/join; if busy, the next person in
    -- line moves up.
    CONTINUE WHEN NOT pg_try_advisory_xact_lock(sparring_user_lock_key(r.user_id));
    CONTINUE WHEN EXISTS (SELECT 1 FROM sparring_active_ids(r.user_id) a WHERE a <> p_sparring_id);
$n$);

-- ── Check-in ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION start_checkin_session(
  p_sparring_id uuid,
  p_lat         double precision,
  p_lng         double precision,
  p_accuracy_m  double precision,
  p_fix_age_s   double precision)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_sp      record;
  v_end     timestamptz;
  v_opens   timestamptz;
  v_closes  timestamptz;
  v_problem text;
  v_dist    double precision;
  v_token   text;
  v_expires timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id, created_by, scheduled_at, duration_min, is_active, deactivated_at, lat, lng
    INTO v_sp FROM open_sparrings WHERE id = p_sparring_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sparring_gone');
  END IF;
  IF v_sp.created_by <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_organizer');
  END IF;

  v_end    := sparring_end_at(v_sp.scheduled_at, v_sp.duration_min);
  v_opens  := v_sp.scheduled_at - sparring_trust_checkin_open_before();
  v_closes := v_end + sparring_trust_checkin_close_after();

  IF sparring_is_cancelled(v_sp.is_active, v_sp.deactivated_at, v_end) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sparring_cancelled');
  END IF;
  IF now() < v_opens THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'checkin_not_open', 'opens_at', v_opens);
  END IF;
  IF now() > v_closes THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'checkin_closed');
  END IF;
  IF v_sp.lat IS NULL OR v_sp.lng IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'place_unknown');
  END IF;

  v_problem := sparring_position_problem(p_lat, p_lng, p_accuracy_m, p_fix_age_s);
  IF v_problem IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_problem);
  END IF;
  v_dist := geo_distance_m(p_lat, p_lng, v_sp.lat, v_sp.lng);
  IF v_dist > sparring_trust_checkin_radius_m() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far_from_venue',
                              'distance_m', round(v_dist));
  END IF;

  DELETE FROM sparring_checkin_tokens
   WHERE sparring_id = p_sparring_id AND expires_at < now() - interval '10 minutes';

  -- 24 random bytes, URL-safe; only the hash is stored.
  v_token   := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  v_expires := now() + sparring_trust_qr_ttl();
  INSERT INTO sparring_checkin_tokens (token_hash, sparring_id, organizer_id, expires_at)
  VALUES (digest(v_token, 'sha256'), p_sparring_id, v_uid, v_expires);

  RETURN jsonb_build_object('ok', true, 'token', v_token, 'expires_at', v_expires,
                            'server_now', now(),
                            'ttl_s', extract(epoch FROM sparring_trust_qr_ttl())::int);
END;
$$;

CREATE OR REPLACE FUNCTION check_in_sparring(
  p_sparring_id uuid,
  p_token       text,
  p_lat         double precision,
  p_lng         double precision,
  p_accuracy_m  double precision,
  p_fix_age_s   double precision)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_tok     record;
  v_sp      record;
  v_status  text;
  v_end     timestamptz;
  v_opens   timestamptz;
  v_closes  timestamptz;
  v_problem text;
  v_dist    double precision;
  v_at      timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Repeated scan after success: same success, no duplicate.
  SELECT checked_in_at INTO v_at FROM sparring_checkins
   WHERE sparring_id = p_sparring_id AND user_id = v_uid;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'checked_in_at', v_at, 'already', true);
  END IF;

  IF p_token IS NULL OR char_length(p_token) NOT BETWEEN 16 AND 128 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalid');
  END IF;
  SELECT sparring_id, organizer_id, expires_at INTO v_tok
    FROM sparring_checkin_tokens WHERE token_hash = digest(p_token, 'sha256');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalid');
  END IF;
  IF v_tok.sparring_id <> p_sparring_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_wrong_sparring');
  END IF;
  IF v_tok.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_expired');
  END IF;

  SELECT id, created_by, scheduled_at, duration_min, is_active, deactivated_at, lat, lng
    INTO v_sp FROM open_sparrings WHERE id = p_sparring_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sparring_gone');
  END IF;
  IF v_sp.created_by = v_uid OR v_tok.organizer_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'organizer_self');
  END IF;
  -- Token must still belong to the sparring's organizer.
  IF v_tok.organizer_id <> v_sp.created_by THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'token_invalid');
  END IF;

  SELECT status INTO v_status FROM sparring_signups
   WHERE sparring_id = p_sparring_id AND user_id = v_uid;
  IF v_status IS NULL OR v_status NOT IN ('pending','confirmed','attended') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_participant');
  END IF;

  v_end    := sparring_end_at(v_sp.scheduled_at, v_sp.duration_min);
  v_opens  := v_sp.scheduled_at - sparring_trust_checkin_open_before();
  v_closes := v_end + sparring_trust_checkin_close_after();
  IF sparring_is_cancelled(v_sp.is_active, v_sp.deactivated_at, v_end) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sparring_cancelled');
  END IF;
  IF now() < v_opens THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'checkin_not_open', 'opens_at', v_opens);
  END IF;
  IF now() > v_closes THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'checkin_closed');
  END IF;
  IF v_sp.lat IS NULL OR v_sp.lng IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'place_unknown');
  END IF;

  v_problem := sparring_position_problem(p_lat, p_lng, p_accuracy_m, p_fix_age_s);
  IF v_problem IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_problem);
  END IF;
  v_dist := geo_distance_m(p_lat, p_lng, v_sp.lat, v_sp.lng);
  IF v_dist > sparring_trust_checkin_radius_m() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_far_from_venue',
                              'distance_m', round(v_dist));
  END IF;

  INSERT INTO sparring_checkins (sparring_id, user_id, distance_bucket_m)
  VALUES (p_sparring_id, v_uid, (ceil(v_dist / 50) * 50)::int)
  ON CONFLICT (sparring_id, user_id) DO NOTHING;

  SELECT checked_in_at INTO v_at FROM sparring_checkins
   WHERE sparring_id = p_sparring_id AND user_id = v_uid;
  RETURN jsonb_build_object('ok', true, 'checked_in_at', v_at, 'already', false);
END;
$$;

-- Role-aware state for the sparring detail (also after the sparring was ended).
CREATE OR REPLACE FUNCTION get_sparring_trust_state(p_sparring_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_sp      record;
  v_status  text;
  v_role    text;
  v_end     timestamptz;
  v_cancel  boolean;
  v_check   timestamptz;
  v_answer  text;
  v_count   integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT id, created_by, scheduled_at, duration_min, is_active, deactivated_at, lat, lng,
         meeting_conflict_at
    INTO v_sp FROM open_sparrings WHERE id = p_sparring_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('role', 'none', 'server_now', now());
  END IF;

  SELECT status INTO v_status FROM sparring_signups
   WHERE sparring_id = p_sparring_id AND user_id = v_uid;
  v_role := CASE
    WHEN v_sp.created_by = v_uid THEN 'organizer'
    WHEN v_status IN ('pending','confirmed','attended') THEN 'participant'
    ELSE 'none' END;

  v_end    := sparring_end_at(v_sp.scheduled_at, v_sp.duration_min);
  v_cancel := sparring_is_cancelled(v_sp.is_active, v_sp.deactivated_at, v_end);

  SELECT checked_in_at INTO v_check FROM sparring_checkins
   WHERE sparring_id = p_sparring_id AND user_id = v_uid;
  SELECT answer INTO v_answer FROM sparring_meeting_feedback
   WHERE sparring_id = p_sparring_id AND user_id = v_uid;
  IF v_role = 'organizer' THEN
    SELECT count(*)::int INTO v_count FROM sparring_checkins WHERE sparring_id = p_sparring_id;
  END IF;

  RETURN jsonb_build_object(
    'role',               v_role,
    'signup_status',      v_status,
    'cancelled',          v_cancel,
    'has_place',          v_sp.lat IS NOT NULL AND v_sp.lng IS NOT NULL,
    'starts_at',          v_sp.scheduled_at,
    'ends_at',            v_end,
    'checkin_opens_at',   v_sp.scheduled_at - sparring_trust_checkin_open_before(),
    'checkin_closes_at',  v_end + sparring_trust_checkin_close_after(),
    'checked_in_at',      v_check,
    'checked_in_count',   v_count,
    'feedback_answer',    v_answer,
    'feedback_opens_at',  v_end,
    'feedback_closes_at', v_end + sparring_trust_feedback_window(),
    'can_feedback',       v_role <> 'none' AND NOT v_cancel AND v_answer IS NULL
                          AND now() >= v_end AND now() <= v_end + sparring_trust_feedback_window(),
    'server_now',         now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_sparring_checkins(p_sparring_id uuid)
RETURNS TABLE (user_id uuid, name text, avatar_url text, checked_in_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM open_sparrings
                  WHERE id = p_sparring_id AND created_by = auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT c.user_id, p.name, p.avatar_url, c.checked_in_at
      FROM sparring_checkins c
      JOIN profiles p ON p.id = c.user_id
     WHERE c.sparring_id = p_sparring_id
     ORDER BY c.checked_in_at;
END;
$$;

-- ── Post-meeting confirmation and unlock ────────────────────────────────────────

CREATE OR REPLACE FUNCTION submit_meeting_feedback(
  p_sparring_id uuid,
  p_answer      text,
  p_note        text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_sp       record;
  v_status   text;
  v_is_org   boolean;
  v_end      timestamptz;
  v_existing text;
  v_note     text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_unlocked boolean := false;
  v_org_unlocked boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_answer IS NULL OR p_answer NOT IN ('happened','cancelled','problem') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'answer_invalid');
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 280 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'note_too_long');
  END IF;

  -- Serialises feedback of all members of this sparring (conflict vs. unlock).
  SELECT id, created_by, scheduled_at, duration_min, is_active, deactivated_at, meeting_conflict_at
    INTO v_sp FROM open_sparrings WHERE id = p_sparring_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sparring_gone');
  END IF;

  v_is_org := v_sp.created_by = v_uid;
  SELECT status INTO v_status FROM sparring_signups
   WHERE sparring_id = p_sparring_id AND user_id = v_uid;
  IF NOT v_is_org AND (v_status IS NULL OR v_status NOT IN ('pending','confirmed','attended')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_participant');
  END IF;

  v_end := sparring_end_at(v_sp.scheduled_at, v_sp.duration_min);
  IF sparring_is_cancelled(v_sp.is_active, v_sp.deactivated_at, v_end) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sparring_cancelled');
  END IF;
  IF now() < v_end THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'feedback_not_open', 'opens_at', v_end);
  END IF;
  IF now() > v_end + sparring_trust_feedback_window() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'feedback_closed');
  END IF;

  -- First answer stands; a retry returns it.
  SELECT answer INTO v_existing FROM sparring_meeting_feedback
   WHERE sparring_id = p_sparring_id AND user_id = v_uid;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'answer', v_existing, 'already', true, 'unlocked', false);
  END IF;

  INSERT INTO sparring_meeting_feedback (sparring_id, user_id, answer, note)
  VALUES (p_sparring_id, v_uid, p_answer, v_note);

  IF p_answer <> 'happened' THEN
    -- Contradiction: stop further automatic unlocks from this sparring. Earlier
    -- unlocks stay (no automatic penalty); the feedback rows are the record.
    UPDATE open_sparrings SET meeting_conflict_at = COALESCE(meeting_conflict_at, now())
     WHERE id = p_sparring_id;
    RETURN jsonb_build_object('ok', true, 'answer', p_answer, 'already', false, 'unlocked', false);
  END IF;

  IF v_sp.meeting_conflict_at IS NULL THEN
    IF NOT v_is_org AND EXISTS (SELECT 1 FROM sparring_checkins
                                 WHERE sparring_id = p_sparring_id AND user_id = v_uid) THEN
      -- Qualifying participation: own check-in + own positive confirmation.
      v_unlocked := try_unlock_reach(v_uid, p_sparring_id, 'participant');
      -- Qualifying organization: another checked-in participant confirmed.
      v_org_unlocked := try_unlock_reach(v_sp.created_by, p_sparring_id, 'organizer');
    ELSIF v_is_org AND EXISTS (
      SELECT 1
        FROM sparring_meeting_feedback f
        JOIN sparring_checkins c ON c.sparring_id = f.sparring_id AND c.user_id = f.user_id
        JOIN sparring_signups ss ON ss.sparring_id = f.sparring_id AND ss.user_id = f.user_id
       WHERE f.sparring_id = p_sparring_id
         AND f.user_id <> v_uid
         AND f.answer = 'happened'
         AND ss.status IN ('pending','confirmed','attended')) THEN
      v_unlocked := try_unlock_reach(v_uid, p_sparring_id, 'organizer');
    END IF;
  END IF;

  IF v_org_unlocked THEN
    PERFORM sparring_notify_safe_i18n(
      v_sp.created_by, 'sparring_reach_unlocked',
      'Erstes Treffen bestätigt',
      'Erstes Treffen bestätigt – dein Radius beträgt jetzt 300 km. Du kannst weiterhin einen Termin gleichzeitig planen.',
      'First meeting confirmed',
      'First meeting confirmed – your radius is now 300 km. You can still plan one sparring at a time.',
      jsonb_build_object('sparring_id', p_sparring_id));
  END IF;

  RETURN jsonb_build_object('ok', true, 'answer', p_answer, 'already', false, 'unlocked', v_unlocked);
END;
$$;

-- ── Small acknowledgements ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ack_sparring_intro(p_version smallint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_version IS NULL OR p_version < 1 OR p_version > sparring_trust_intro_version() THEN
    RAISE EXCEPTION 'invalid_intro_version';
  END IF;
  UPDATE profiles
     SET sparring_intro_version = GREATEST(COALESCE(sparring_intro_version, 0), p_version)
   WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION ack_reach_unlock()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE sparring_reach_unlocks SET seen_at = now()
   WHERE user_id = auth.uid() AND seen_at IS NULL
$$;

-- ── Places ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION submit_place_suggestion(p_name text, p_address text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_name text := btrim(COALESCE(p_name, ''));
  v_addr text := btrim(COALESCE(p_address, ''));
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 120 OR char_length(v_addr) NOT BETWEEN 5 AND 300
     OR (v_note IS NOT NULL AND char_length(v_note) > 280) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'details_invalid');
  END IF;
  IF (SELECT count(*) FROM sparring_place_suggestions
       WHERE user_id = v_uid AND created_at > now() - interval '1 day') >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'suggestion_rate_limited');
  END IF;
  INSERT INTO sparring_place_suggestions (user_id, name, address, note)
  VALUES (v_uid, v_name, v_addr, v_note)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- Called by the Edge Function with the user's JWT before each Nominatim request.
CREATE OR REPLACE FUNCTION consume_place_search_quota()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  PERFORM sparring_user_lock(v_uid);
  DELETE FROM sparring_place_search_log
   WHERE user_id = v_uid AND searched_at < now() - interval '1 day';
  IF (SELECT count(*) FROM sparring_place_search_log
       WHERE user_id = v_uid AND searched_at > now() - interval '10 minutes') >= 30 THEN
    RETURN false;
  END IF;
  INSERT INTO sparring_place_search_log (user_id) VALUES (v_uid);
  RETURN true;
END;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION get_sparring_reach_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION check_sparring_eligibility(text,uuid,uuid,double precision,double precision,double precision,double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION publish_sparring(uuid,uuid,text,text,text,timestamptz,integer,integer,boolean,boolean,double precision,double precision,double precision,double precision,uuid,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION join_sparring_v2(uuid,smallint,double precision,double precision,double precision,double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION start_checkin_session(uuid,double precision,double precision,double precision,double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION check_in_sparring(uuid,text,double precision,double precision,double precision,double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_sparring_trust_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_sparring_checkins(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION submit_meeting_feedback(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ack_sparring_intro(smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ack_reach_unlock() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION submit_place_suggestion(text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION consume_place_search_quota() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION get_sparring_reach_status() TO authenticated;
GRANT EXECUTE ON FUNCTION check_sparring_eligibility(text,uuid,uuid,double precision,double precision,double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION publish_sparring(uuid,uuid,text,text,text,timestamptz,integer,integer,boolean,boolean,double precision,double precision,double precision,double precision,uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION join_sparring_v2(uuid,smallint,double precision,double precision,double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION start_checkin_session(uuid,double precision,double precision,double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION check_in_sparring(uuid,text,double precision,double precision,double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sparring_trust_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sparring_checkins(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_meeting_feedback(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION ack_sparring_intro(smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION ack_reach_unlock() TO authenticated;
GRANT EXECUTE ON FUNCTION submit_place_suggestion(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_place_search_quota() TO authenticated;
