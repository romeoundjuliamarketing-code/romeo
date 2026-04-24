ALTER TABLE team_announcements
ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL;
