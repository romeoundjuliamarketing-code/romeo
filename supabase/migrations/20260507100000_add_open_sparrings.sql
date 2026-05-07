-- Sparring sessions with their own address + geocoords
CREATE TABLE open_sparrings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id     uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  discipline    text NOT NULL,
  address       text NOT NULL,
  lat           double precision,
  lng           double precision,
  scheduled_at  timestamptz NOT NULL,
  duration_min  int NOT NULL DEFAULT 90,
  max_slots     int NOT NULL DEFAULT 10,
  notes         text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- User signups for sparring sessions
CREATE TABLE sparring_signups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sparring_id  uuid NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sparring_id, user_id)
);

-- RLS
ALTER TABLE open_sparrings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sparring_signups ENABLE ROW LEVEL SECURITY;

-- Any logged-in user can read active sparrings
CREATE POLICY "read active sparrings" ON open_sparrings
  FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);

-- Only coaches can create sparrings for their own studio
CREATE POLICY "coaches insert sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_coach = true
    )
  );

-- Only creator can soft-delete (set is_active = false)
CREATE POLICY "creator update sparrings" ON open_sparrings
  FOR UPDATE USING (created_by = auth.uid());

-- Any logged-in user can read signups
CREATE POLICY "read sparring signups" ON sparring_signups
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can only sign up themselves
CREATE POLICY "insert own signup" ON sparring_signups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can cancel their own signup
CREATE POLICY "delete own signup" ON sparring_signups
  FOR DELETE USING (user_id = auth.uid());
