-- Add drop_in_enabled flag to studio_schedule
ALTER TABLE studio_schedule
  ADD COLUMN IF NOT EXISTS drop_in_enabled boolean NOT NULL DEFAULT false;

-- Add booking_type to trial_bookings to distinguish trial vs. drop-in
ALTER TABLE trial_bookings
  ADD COLUMN IF NOT EXISTS booking_type text NOT NULL DEFAULT 'trial'
  CHECK (booking_type IN ('trial', 'drop_in'));

-- RPC: create a drop-in booking for a specific schedule entry
CREATE OR REPLACE FUNCTION create_drop_in_booking(
  p_studio_id    uuid,
  p_schedule_id  uuid,
  p_requested_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_enabled      boolean;
  v_booking_id   uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt.';
  END IF;

  -- Verify drop_in_enabled for this session
  SELECT drop_in_enabled INTO v_enabled
  FROM studio_schedule
  WHERE id = p_schedule_id AND studio_id = p_studio_id AND is_active = true;

  IF NOT FOUND OR NOT v_enabled THEN
    RAISE EXCEPTION 'Diese Einheit erlaubt keine Drop-in-Buchungen.';
  END IF;

  -- Prevent duplicate pending/confirmed drop-in for same session+date
  IF EXISTS (
    SELECT 1 FROM trial_bookings
    WHERE user_id = v_user_id
      AND studio_id = p_studio_id
      AND schedule_id = p_schedule_id
      AND requested_date = p_requested_date
      AND booking_type = 'drop_in'
      AND status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'Du hast für diese Einheit bereits eine Buchung.';
  END IF;

  INSERT INTO trial_bookings (
    user_id, studio_id, schedule_id, requested_date,
    booking_type, status
  )
  VALUES (
    v_user_id, p_studio_id, p_schedule_id, p_requested_date,
    'drop_in', 'pending'
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_drop_in_booking(uuid, uuid, date) TO authenticated;
