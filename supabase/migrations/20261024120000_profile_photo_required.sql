-- Profile photo required for sparrings (join + publish).
--
-- The app asks for a face-checked photo (on-device detection) before joining
-- or publishing. The server only checks that a photo exists; the face check
-- itself cannot be verified here for free.
--
-- ROLLOUT: sparring_photo_required() starts as false. Builds up to 1.4.0 do
-- not know the reason 'photo_required' and would only show a generic error,
-- so flip it to true once the new build is live and most users updated:
--   CREATE OR REPLACE FUNCTION sparring_photo_required() RETURNS boolean
--   LANGUAGE sql IMMUTABLE AS $$ SELECT true $$;

CREATE OR REPLACE FUNCTION sparring_photo_required() RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$ SELECT false $$;

-- Single place for join and publish: sparring_trust_evaluate() is used by
-- join_sparring_v2, publish_sparring and check_sparring_eligibility.
-- Body = live definition (2026-10-24) plus the photo check before the slot check.
CREATE OR REPLACE FUNCTION public.sparring_trust_evaluate(p_uid uuid, p_action text, p_sparring_id uuid, p_place_id uuid, p_lat double precision, p_lng double precision, p_accuracy_m double precision, p_fix_age_s double precision, p_require_position boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF sparring_photo_required() AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = p_uid AND btrim(coalesce(p.avatar_url, '')) <> ''
  ) THEN
    RETURN v_base || jsonb_build_object('ok', false, 'reason', 'photo_required');
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
$function$;

-- New report reason "Fake-Profilbild" (old builds keep sending the old three).
ALTER TABLE user_reports DROP CONSTRAINT IF EXISTS user_reports_reason_check;
ALTER TABLE user_reports ADD CONSTRAINT user_reports_reason_check
  CHECK (reason = ANY (ARRAY['unsportliches_verhalten'::text, 'gefaehrliches_verhalten'::text, 'beleidigung'::text, 'fake_profilbild'::text]));
