-- Realtime for group chats: the supabase_realtime publication on Prod was
-- empty, so postgres_changes subscriptions (useChatMessageStream,
-- useSparringChatList) never received inserts. Live messages, own images
-- and unread badges only appeared after reopening the chat.
--
-- Realtime applies the tables' RLS SELECT policies per subscriber, so users
-- only receive rows they can already read. Idempotent: tables already in the
-- publication are skipped.

BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sparring_group_messages', 'event_messages'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

COMMIT;
