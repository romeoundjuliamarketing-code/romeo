-- sparring_chat_settings: per-sparring media toggle, owned by organizer
CREATE TABLE sparring_chat_settings (
  sparring_id   uuid PRIMARY KEY REFERENCES open_sparrings(id) ON DELETE CASCADE,
  media_enabled boolean NOT NULL DEFAULT false
);

ALTER TABLE sparring_chat_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member reads settings" ON sparring_chat_settings
  FOR SELECT USING (
    auth.uid() = (SELECT created_by FROM open_sparrings WHERE id = sparring_id)
    OR EXISTS (
      SELECT 1 FROM sparring_signups
      WHERE sparring_id = sparring_chat_settings.sparring_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "organizer inserts settings" ON sparring_chat_settings
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT created_by FROM open_sparrings WHERE id = sparring_id)
  );

CREATE POLICY "organizer updates settings" ON sparring_chat_settings
  FOR UPDATE USING (
    auth.uid() = (SELECT created_by FROM open_sparrings WHERE id = sparring_id)
  );

-- sparring_group_messages: the group chat messages
CREATE TABLE sparring_group_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sparring_id uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  sender_id   uuid        NOT NULL REFERENCES profiles(id)       ON DELETE CASCADE,
  content     text,
  image_url   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_or_image CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

CREATE INDEX sparring_group_messages_sparring_idx
  ON sparring_group_messages (sparring_id, created_at);

ALTER TABLE sparring_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member reads messages" ON sparring_group_messages
  FOR SELECT USING (
    auth.uid() = (SELECT created_by FROM open_sparrings WHERE id = sparring_id)
    OR EXISTS (
      SELECT 1 FROM sparring_signups
      WHERE sparring_id = sparring_group_messages.sparring_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "member inserts message" ON sparring_group_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND (
      auth.uid() = (SELECT created_by FROM open_sparrings WHERE id = sparring_id)
      OR EXISTS (
        SELECT 1 FROM sparring_signups
        WHERE sparring_id = sparring_group_messages.sparring_id
          AND user_id = auth.uid()
      )
    )
    AND (
      SELECT scheduled_at + (duration_min || ' minutes')::interval
      FROM open_sparrings WHERE id = sparring_id
    ) > now()
    AND (
      image_url IS NULL
      OR EXISTS (
        SELECT 1 FROM sparring_chat_settings
        WHERE sparring_id = sparring_group_messages.sparring_id
          AND media_enabled = true
      )
    )
  );

-- sparring_chat_reads: tracks per-user last-read timestamp for unread counts
CREATE TABLE sparring_chat_reads (
  user_id      uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  sparring_id  uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sparring_id)
);

ALTER TABLE sparring_chat_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own reads" ON sparring_chat_reads
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
