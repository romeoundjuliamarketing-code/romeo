-- Security fix: two hardening changes to sparring_ratings INSERT policy.
--
-- 1. Rated user must be a participant (signed up or organizer) of the same sparring.
--    Previously any signed-up user could rate any arbitrary user in the system.
--
-- 2. Rating window is now enforced server-side: sparring must have already
--    occurred and be within the 7-day window. Previously enforced client-side only.

DROP POLICY IF EXISTS "Insert own rating" ON sparring_ratings;

CREATE POLICY "Insert own rating" ON sparring_ratings
  FOR INSERT WITH CHECK (
    auth.uid() = rater_id
    AND auth.uid() <> rated_user_id
    -- Rater must be signed up for this sparring
    AND EXISTS (
      SELECT 1 FROM sparring_signups
      WHERE sparring_id = sparring_ratings.sparring_id
        AND user_id     = auth.uid()
    )
    -- Rated user must be a participant (signup or organizer)
    AND (
      EXISTS (
        SELECT 1 FROM sparring_signups
        WHERE sparring_id = sparring_ratings.sparring_id
          AND user_id     = sparring_ratings.rated_user_id
      )
      OR EXISTS (
        SELECT 1 FROM open_sparrings
        WHERE id         = sparring_ratings.sparring_id
          AND created_by = sparring_ratings.rated_user_id
      )
    )
    -- Server-side 7-day rating window
    AND EXISTS (
      SELECT 1 FROM open_sparrings
      WHERE id           = sparring_ratings.sparring_id
        AND scheduled_at <= now()
        AND scheduled_at >= now() - interval '7 days'
    )
  );
