-- ---------------------------------------------------------------------------
-- grant_venue_partner: B2B onboarding, service_role only. Creates an ACTIVE venue.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION grant_venue_partner(
  p_owner_user_id uuid,
  p_name          text,
  p_city          text,
  p_venue_type    text DEFAULT 'bar',
  p_address       text DEFAULT NULL,
  p_lat           double precision DEFAULT NULL,
  p_lng           double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO venues (owner_user_id, name, city, venue_type, address, lat, lng, is_active)
  VALUES (p_owner_user_id, p_name, p_city, p_venue_type, p_address, p_lat, p_lng, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- create_venue_event: owner of an active venue creates a FREE event tied to it.
-- No verification/IAP path. Location is taken from the venue.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_venue_event(
  p_venue_id     uuid,
  p_title        text,
  p_fight_card   text,
  p_scheduled_at timestamptz,
  p_duration_min int,
  p_max_slots    int,
  p_notes        text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  v_uid   uuid := auth.uid();
  v_venue venues%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_venue FROM venues WHERE id = p_venue_id;
  IF NOT FOUND OR v_venue.owner_user_id <> v_uid OR NOT v_venue.is_active THEN
    RAISE EXCEPTION 'not_venue_owner';
  END IF;

  INSERT INTO events (
    created_by, title, event_type, fight_card, venue_name, address, lat, lng,
    scheduled_at, duration_min, max_slots, notes, is_active, is_paid, venue_id
  )
  VALUES (
    v_uid, p_title, 'public_viewing', p_fight_card, v_venue.name, v_venue.address,
    v_venue.lat, v_venue.lng, p_scheduled_at, p_duration_min, p_max_slots, p_notes,
    true, false, p_venue_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION grant_venue_partner(uuid, text, text, text, text, double precision, double precision) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION create_venue_event(uuid, text, text, timestamptz, int, int, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION create_venue_event(uuid, text, text, timestamptz, int, int, text) TO authenticated;
-- grant_venue_partner: service_role only, no grant.
