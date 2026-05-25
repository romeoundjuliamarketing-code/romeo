-- user_reports: misconduct reports per (reporter, reported_user, sparring)
CREATE TABLE user_reports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sparring_id      uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  reason           text        NOT NULL CHECK (reason IN (
    'unsportliches_verhalten',
    'gefaehrliches_verhalten',
    'beleidigung'
  )),
  details          text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Only own reports can be inserted; cannot report yourself
CREATE POLICY "Insert own report" ON user_reports
  FOR INSERT WITH CHECK (
    auth.uid() = reporter_id
    AND auth.uid() <> reported_user_id
  );
