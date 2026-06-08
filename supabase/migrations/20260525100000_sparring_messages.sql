-- sparring_messages: 1:1 messages between a sparring participant and the organizer
CREATE TABLE sparring_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sparring_id  uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  sender_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content      text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sparring_messages ENABLE ROW LEVEL SECURITY;

-- Sender or recipient can read their own messages
CREATE POLICY "Conversation participants can read" ON sparring_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

-- Anyone signed up for the sparring can send (not to themselves)
CREATE POLICY "Signed-up users can send" ON sparring_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND auth.uid() <> recipient_id
    AND (
      -- Either sender is signed up
      EXISTS (
        SELECT 1 FROM sparring_signups
        WHERE sparring_id = sparring_messages.sparring_id
          AND user_id = auth.uid()
      )
      -- Or sender is the organizer
      OR EXISTS (
        SELECT 1 FROM open_sparrings
        WHERE id = sparring_messages.sparring_id
          AND created_by = auth.uid()
      )
    )
  );

-- Allow marking messages as read (only recipient can update read_at)
CREATE POLICY "Recipient can mark read" ON sparring_messages
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Indexes for common queries
CREATE INDEX ON sparring_messages (sparring_id, sender_id, recipient_id);
CREATE INDEX ON sparring_messages (recipient_id, read_at) WHERE read_at IS NULL;
