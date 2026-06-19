-- studio_ratings: one rating per (rater, studio) pair; users may update their own
CREATE TABLE studio_ratings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  studio_id  uuid        NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  stars      smallint    NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment    text        NOT NULL DEFAULT '' CHECK (char_length(comment) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rater_id, studio_id)
);

ALTER TABLE studio_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read studio ratings (needed for the average + count)
CREATE POLICY "Studio ratings readable" ON studio_ratings
  FOR SELECT USING (true);

-- Insert only your own rating, and never for a studio you own
CREATE POLICY "Insert own studio rating" ON studio_ratings
  FOR INSERT WITH CHECK (
    auth.uid() = rater_id
    AND NOT EXISTS (
      SELECT 1 FROM studios
      WHERE studios.id = studio_ratings.studio_id
        AND studios.owner_user_id = auth.uid()
    )
  );

-- Update only your own rating (re-rating via upsert)
CREATE POLICY "Update own studio rating" ON studio_ratings
  FOR UPDATE USING (auth.uid() = rater_id)
  WITH CHECK (auth.uid() = rater_id);

CREATE INDEX ON studio_ratings (studio_id);
