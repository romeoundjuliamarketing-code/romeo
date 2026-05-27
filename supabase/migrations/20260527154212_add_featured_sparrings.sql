-- Add is_featured flag to open_sparrings.
-- Only Romeo (Dashboard / service role) can set this to true.
-- Regular app users are blocked via the updated UPDATE policy.

ALTER TABLE open_sparrings
  ADD COLUMN is_featured boolean NOT NULL DEFAULT false;

-- Replace the creator update policy with one that prevents
-- any app user (including the creator) from setting is_featured = true.
-- The Supabase Dashboard uses the service role which bypasses RLS,
-- so Romeo can still toggle is_featured freely from there.
DROP POLICY "creator update sparrings" ON open_sparrings;

CREATE POLICY "creator update sparrings" ON open_sparrings
  FOR UPDATE
  USING  (created_by = auth.uid())
  WITH CHECK (is_featured = false);
