-- Coaches can insert new sessions for their own studio
CREATE POLICY "Coaches können Studioplan eintragen"
ON studio_schedule
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.studio_id = studio_id
      AND profiles.is_coach = true
  )
);

-- Coaches can update (soft-delete via is_active) sessions of their own studio
CREATE POLICY "Coaches können Studioplan ändern"
ON studio_schedule
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.studio_id = studio_schedule.studio_id
      AND profiles.is_coach = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.studio_id = studio_schedule.studio_id
      AND profiles.is_coach = true
  )
);
