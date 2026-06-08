-- sparring_ratings: one rating per (rater, rated_user, sparring) pair
CREATE TABLE sparring_ratings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rated_user_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sparring_id   uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  stars         smallint    NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment       text        NOT NULL CHECK (char_length(comment) <= 200),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rater_id, rated_user_id, sparring_id)
);

ALTER TABLE sparring_ratings ENABLE ROW LEVEL SECURITY;

-- Rater can read their own ratings
CREATE POLICY "Own ratings readable" ON sparring_ratings
  FOR SELECT USING (auth.uid() = rater_id);

-- Anyone can read ratings for a given rated_user (needed for avg calculation)
CREATE POLICY "Ratings for user readable" ON sparring_ratings
  FOR SELECT USING (true);

-- Insert only when signed up for that sparring and not rating yourself
CREATE POLICY "Insert own rating" ON sparring_ratings
  FOR INSERT WITH CHECK (
    auth.uid() = rater_id
    AND auth.uid() <> rated_user_id
    AND EXISTS (
      SELECT 1 FROM sparring_signups
      WHERE sparring_id = sparring_ratings.sparring_id
        AND user_id = auth.uid()
    )
  );

CREATE INDEX ON sparring_ratings (rated_user_id);
CREATE INDEX ON sparring_ratings (sparring_id);
