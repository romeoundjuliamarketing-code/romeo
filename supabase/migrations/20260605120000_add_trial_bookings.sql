-- Helper: returns true if the current user is staff of the given studio
-- (owner OR coach member of that studio)
CREATE OR REPLACE FUNCTION is_studio_staff(p_studio_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM studios s
    WHERE s.id = p_studio_id
      AND s.owner_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.studio_id = p_studio_id
      AND p.is_coach = true
  );
$$;

GRANT EXECUTE ON FUNCTION is_studio_staff(uuid) TO authenticated;

-- Main table: trial booking requests
CREATE TABLE IF NOT EXISTS trial_bookings (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id      uuid        NOT NULL REFERENCES studios(id)    ON DELETE CASCADE,
  schedule_id    uuid        NULL       REFERENCES studio_schedule(id) ON DELETE SET NULL,
  requested_date date        NOT NULL,
  note           text        NULL,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  responded_at   timestamptz NULL,
  responded_by   uuid        NULL REFERENCES auth.users(id)
);

-- At most one open (pending) request per user per studio
CREATE UNIQUE INDEX IF NOT EXISTS trial_bookings_one_pending_per_user_studio
  ON trial_bookings (user_id, studio_id)
  WHERE status = 'pending';

-- Index for staff querying by studio + status
CREATE INDEX IF NOT EXISTS trial_bookings_studio_status_idx
  ON trial_bookings (studio_id, status);

-- Row-Level Security
ALTER TABLE trial_bookings ENABLE ROW LEVEL SECURITY;

-- SELECT: own rows or staff of the studio
CREATE POLICY "trial_bookings_select"
  ON trial_bookings
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_studio_staff(studio_id)
  );

-- INSERT: user can only insert their own rows, and only as 'pending'
-- (safety net; main path is via SECURITY DEFINER RPC). Prevents self-confirming
-- a booking by direct insert.
CREATE POLICY "trial_bookings_insert"
  ON trial_bookings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- UPDATE (user): may only cancel an own pending booking, nothing else.
-- Prevents a user from self-confirming by direct update.
CREATE POLICY "trial_bookings_update_user_cancel"
  ON trial_bookings
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- UPDATE (staff): studio staff may update bookings of their studio.
-- (The confirm/decline path runs through respond_trial_booking RPC; this
-- policy covers direct staff updates and keeps the staff path explicit.)
CREATE POLICY "trial_bookings_update_staff"
  ON trial_bookings
  FOR UPDATE
  USING (is_studio_staff(studio_id));

-- RPC: request a trial booking
CREATE OR REPLACE FUNCTION request_trial_booking(
  p_studio_id   uuid,
  p_schedule_id uuid,
  p_date        date,
  p_note        text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Guard: only one pending request per studio
  IF EXISTS (
    SELECT 1
    FROM trial_bookings
    WHERE user_id   = auth.uid()
      AND studio_id = p_studio_id
      AND status    = 'pending'
  ) THEN
    RAISE EXCEPTION 'Es existiert bereits eine offene Probetraining-Anfrage für dieses Studio.';
  END IF;

  INSERT INTO trial_bookings (user_id, studio_id, schedule_id, requested_date, note, status)
  VALUES (auth.uid(), p_studio_id, p_schedule_id, p_date, p_note, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION request_trial_booking(uuid, uuid, date, text) TO authenticated;

-- RPC: staff responds to a trial booking
CREATE OR REPLACE FUNCTION respond_trial_booking(
  p_id      uuid,
  p_confirm boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio_id uuid;
  v_status    text;
BEGIN
  SELECT studio_id, status
  INTO v_studio_id, v_status
  FROM trial_bookings
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buchung nicht gefunden.';
  END IF;

  IF NOT is_studio_staff(v_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung, um diese Buchung zu beantworten.';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Nur ausstehende Buchungen können beantwortet werden.';
  END IF;

  UPDATE trial_bookings
  SET
    status       = CASE WHEN p_confirm THEN 'confirmed' ELSE 'declined' END,
    responded_at = now(),
    responded_by = auth.uid(),
    updated_at   = now()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION respond_trial_booking(uuid, boolean) TO authenticated;
