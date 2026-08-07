-- challenge_ratings: one clarity rating per (user, challenge_id) pair; users may update their own.
-- challenge_id is not a foreign key — it comes from the static app data (src/data/sparringChallenges.ts).
CREATE TABLE challenge_ratings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id text        NOT NULL CHECK (char_length(challenge_id) <= 40),
  clarity      smallint    NOT NULL CHECK (clarity BETWEEN 1 AND 3),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

ALTER TABLE challenge_ratings ENABLE ROW LEVEL SECURITY;

-- Only read your own ratings — evaluation happens via the Supabase dashboard, not the app.
CREATE POLICY "Read own challenge ratings" ON challenge_ratings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Insert own challenge rating" ON challenge_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own challenge rating" ON challenge_ratings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX ON challenge_ratings (challenge_id);
