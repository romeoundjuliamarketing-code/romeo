-- Allow studio_id to be null for user-created sparrings
ALTER TABLE open_sparrings ALTER COLUMN studio_id DROP NOT NULL;

-- Replace the single coach-only INSERT policy with two separate policies
DROP POLICY IF EXISTS "coaches insert sparrings" ON open_sparrings;

-- Coaches can create sparrings for their own studio (unchanged behaviour)
CREATE POLICY "coaches insert sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND studio_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_coach = true
        AND studio_id = open_sparrings.studio_id
    )
  );

-- Any authenticated user can create a sparring without a studio
CREATE POLICY "users insert own sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND studio_id IS NULL
  );
