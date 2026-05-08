-- Geocoordinates cached on studios to avoid re-geocoding on every sparring creation
ALTER TABLE studios ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS lng double precision;

-- Allow studio owners to update their own studio row
CREATE POLICY "Studio owners can update their studio"
  ON studios
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
