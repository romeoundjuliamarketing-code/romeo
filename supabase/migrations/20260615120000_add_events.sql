-- Events / Public Viewing: paid events visible on the map.
-- Created inactive; activated after a 9.99 EUR consumable IAP
-- via RevenueCat webhook -> activate_event RPC (mirrors map_boosts pattern).

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id           uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by   uuid             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text             NOT NULL,
  event_type   text             NOT NULL DEFAULT 'public_viewing',
  fight_card   text,            -- what is being shown
  venue_name   text,
  address      text,
  lat          double precision,
  lng          double precision,
  scheduled_at timestamptz      NOT NULL,
  duration_min int              NOT NULL DEFAULT 120,
  max_slots    int              NOT NULL DEFAULT 20,
  notes        text,
  is_active    boolean          NOT NULL DEFAULT false,
  is_paid      boolean          NOT NULL DEFAULT false,
  created_at   timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX events_active_time_idx ON events (scheduled_at) WHERE is_active = true;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Anyone may read active events on the map.
CREATE POLICY "anyone reads active events" ON events
  FOR SELECT USING (is_active = true);

-- Creator may read their own events (e.g. pending payment).
CREATE POLICY "creator reads own events" ON events
  FOR SELECT USING (auth.uid() = created_by);

-- All writes go through SECURITY DEFINER RPCs only.

-- ---------------------------------------------------------------------------
-- event_signups
-- ---------------------------------------------------------------------------
CREATE TABLE event_signups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_signups ENABLE ROW LEVEL SECURITY;

-- Participants (and creator) can read signups for active events.
CREATE POLICY "read signups of active events" ON event_signups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
        AND (e.is_active OR e.created_by = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- event_messages
-- ---------------------------------------------------------------------------
CREATE TABLE event_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;

-- Only signed-up participants or creator may read messages.
CREATE POLICY "participants read event messages" ON event_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM event_signups s
      WHERE s.event_id = event_messages.event_id
        AND s.user_id  = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id         = event_messages.event_id
        AND e.created_by = auth.uid()
    )
  );

-- Only signed-up participants or creator may insert messages.
CREATE POLICY "participants write event messages" ON event_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM event_signups s
        WHERE s.event_id = event_messages.event_id
          AND s.user_id  = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM events e
        WHERE e.id         = event_messages.event_id
          AND e.created_by = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- create_event
-- Inserts an inactive event and returns its id.
-- Requires a "verified" creator: email confirmed + at least one real-person
-- signal (address, coach vouch, or active studio membership).
-- NOTE: profiles has no stored verification_tier column; the tier is derived
-- from flags exactly as computeVerificationTier() does client-side.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_event(
  p_title        text,
  p_fight_card   text,
  p_venue_name   text,
  p_address      text,
  p_lat          double precision,
  p_lng          double precision,
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
  v_id  uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Reuse the canonical verification check (same rule as sparrings).
  IF NOT is_user_verified(v_uid) THEN
    RAISE EXCEPTION 'verification required';
  END IF;

  INSERT INTO events (
    created_by, title, fight_card, venue_name, address, lat, lng,
    scheduled_at, duration_min, max_slots, notes
  )
  VALUES (
    v_uid, p_title, p_fight_card, p_venue_name, p_address, p_lat, p_lng,
    p_scheduled_at, p_duration_min, p_max_slots, p_notes
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- activate_event
-- Called exclusively by the rc-boost-webhook Edge Function via service role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION activate_event(p_event_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE events
     SET is_active = true, is_paid = true
   WHERE id = p_event_id AND created_by = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event not found or not owned by user';
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- signup_event / cancel_event_signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION signup_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only verified users may participate (same rule as sparrings).
  IF NOT is_user_verified(auth.uid()) THEN
    RAISE EXCEPTION 'verification required';
  END IF;

  INSERT INTO event_signups (event_id, user_id)
  VALUES (p_event_id, auth.uid())
  ON CONFLICT (event_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_event_signup(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM event_signups
  WHERE event_id = p_event_id AND user_id = auth.uid();
END;
$$;

-- ---------------------------------------------------------------------------
-- deactivate_event: creator only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deactivate_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE events
     SET is_active = false
   WHERE id = p_event_id AND created_by = auth.uid();
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION create_event(text, text, text, text, double precision, double precision, timestamptz, int, int, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION activate_event(uuid, uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION signup_event(uuid)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION cancel_event_signup(uuid)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION deactivate_event(uuid)         FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION create_event(text, text, text, text, double precision, double precision, timestamptz, int, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION signup_event(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_event_signup(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_event(uuid)          TO authenticated;
-- activate_event is service_role only (no grant to authenticated)
