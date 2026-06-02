-- Security fix: block is_featured=true on INSERT.
-- Previously only the UPDATE policy blocked this; a direct API INSERT
-- with is_featured=true was not rejected by RLS.

DROP POLICY IF EXISTS "coaches insert sparrings" ON open_sparrings;
DROP POLICY IF EXISTS "users insert own sparrings" ON open_sparrings;

CREATE POLICY "coaches insert sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND studio_id IS NOT NULL
    AND NOT is_featured
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_coach = true
        AND studio_id = open_sparrings.studio_id
    )
  );

CREATE POLICY "users insert own sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND studio_id IS NULL
    AND NOT is_featured
  );
