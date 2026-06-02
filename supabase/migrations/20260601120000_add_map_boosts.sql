-- Map-Boost-Badge: paid 30-day featured marker on the sparring map.
-- Users purchase a consumable IAP (sparr_map_boost_30d) which activates
-- is_featured via a RevenueCat webhook → Edge Function → activate_map_boost RPC.

CREATE TABLE map_boosts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  sparring_id  uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  is_active    boolean     NOT NULL DEFAULT true
);

CREATE INDEX map_boosts_sparring_active_idx
  ON map_boosts (sparring_id, expires_at)
  WHERE is_active = true;

ALTER TABLE map_boosts ENABLE ROW LEVEL SECURITY;

-- User can read their own boosts (including expired) for status display.
CREATE POLICY "user reads own boosts" ON map_boosts
  FOR SELECT USING (auth.uid() = user_id);

-- Anyone can read active, non-expired boosts so useOpenSparrings can show
-- featured markers for all boosted sparrings on the map.
CREATE POLICY "anyone reads active boosts" ON map_boosts
  FOR SELECT USING (is_active = true AND expires_at > now());

-- All writes go through SECURITY DEFINER RPCs only.

-- ---------------------------------------------------------------------------
-- activate_map_boost
-- Called exclusively by the rc-boost-webhook Edge Function via service role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION activate_map_boost(
  p_sparring_id  uuid,
  p_user_id      uuid,
  p_duration_days int DEFAULT 30
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at timestamptz;
BEGIN
  -- Only allow calls from the service role (Edge Function).
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Verify p_user_id is the creator of the sparring.
  IF NOT EXISTS (
    SELECT 1 FROM open_sparrings
    WHERE id = p_sparring_id
      AND created_by = p_user_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'sparring not found or not owned by user';
  END IF;

  -- Block duplicate active boosts for the same sparring.
  IF EXISTS (
    SELECT 1 FROM map_boosts
    WHERE sparring_id = p_sparring_id
      AND is_active = true
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'active boost already exists for this sparring';
  END IF;

  v_expires_at := now() + (p_duration_days || ' days')::interval;

  INSERT INTO map_boosts (user_id, sparring_id, expires_at)
  VALUES (p_user_id, p_sparring_id, v_expires_at);

  RETURN json_build_object(
    'success',     true,
    'expires_at',  v_expires_at::text
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- get_my_boost_status
-- Called by the client to display remaining boost time.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_boost_status(p_sparring_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     map_boosts%ROWTYPE;
  v_days    int;
BEGIN
  SELECT * INTO v_row
  FROM map_boosts
  WHERE sparring_id = p_sparring_id
    AND user_id     = auth.uid()
    AND is_active   = true
    AND expires_at  > now()
  ORDER BY expires_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'is_active',      false,
      'expires_at',     null,
      'days_remaining', null
    );
  END IF;

  v_days := GREATEST(0, EXTRACT(DAY FROM (v_row.expires_at - now()))::int);

  RETURN json_build_object(
    'is_active',      true,
    'expires_at',     v_row.expires_at::text,
    'days_remaining', v_days
  );
END;
$$;
