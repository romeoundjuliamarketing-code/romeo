-- Add indexes for common query patterns
CREATE INDEX ON open_sparrings (studio_id);
CREATE INDEX ON open_sparrings (scheduled_at) WHERE is_active = true;
CREATE INDEX ON sparring_signups (sparring_id);
CREATE INDEX ON sparring_signups (user_id);

-- Fix INSERT policy: coach can only create sparrings for their own studio
DROP POLICY IF EXISTS "coaches insert sparrings" ON open_sparrings;
CREATE POLICY "coaches insert sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_coach = true
        AND studio_id = open_sparrings.studio_id
    )
  );

-- Fix UPDATE policy: add WITH CHECK to prevent column mutation attacks
DROP POLICY IF EXISTS "creator update sparrings" ON open_sparrings;
CREATE POLICY "creator update sparrings" ON open_sparrings
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
