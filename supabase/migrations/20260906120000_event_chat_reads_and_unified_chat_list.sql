-- Block 1: make chats findable and unify unread tracking.
--
--   1. event_chat_reads: per-user last-read timestamp for event chats
--      (mirrors sparring_chat_reads, which already exists).
--   2. get_my_chats(): one RPC returning BOTH sparring and event chats,
--      including chats without any message yet.
--
-- get_my_chat_list() is deliberately left untouched: clients already shipped
-- to the stores call it and would break on a changed return signature.

-- ---------------------------------------------------------------------------
-- 1. event_chat_reads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_chat_reads (
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id     uuid        NOT NULL REFERENCES events(id)     ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE event_chat_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user manages own event reads" ON event_chat_reads;
CREATE POLICY "user manages own event reads" ON event_chat_reads
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. get_my_chats()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_chats()
RETURNS TABLE (
  kind              text,
  chat_id           uuid,
  title             text,
  scheduled_at      timestamptz,
  duration_min      integer,
  is_organizer      boolean,
  last_message_text text,
  last_message_at   timestamptz,
  unread_count      integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_sparrings AS (
    SELECT s.id, s.title, s.scheduled_at, s.duration_min, s.created_by
    FROM open_sparrings s
    WHERE (
        s.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM sparring_signups ss
          WHERE ss.sparring_id = s.id AND ss.user_id = auth.uid()
        )
      )
      AND EXISTS (
        SELECT 1 FROM sparring_chat_settings cs WHERE cs.sparring_id = s.id
      )
  ),
  sparring_reads AS (
    SELECT sparring_id, last_read_at
    FROM sparring_chat_reads
    WHERE user_id = auth.uid()
  ),
  sparring_last AS (
    SELECT DISTINCT ON (m.sparring_id)
      m.sparring_id, m.content, m.image_url, m.created_at
    FROM sparring_group_messages m
    WHERE m.sparring_id IN (SELECT id FROM my_sparrings)
    ORDER BY m.sparring_id, m.created_at DESC
  ),
  sparring_unread AS (
    SELECT m.sparring_id, count(*)::int AS cnt
    FROM sparring_group_messages m
    LEFT JOIN sparring_reads r ON r.sparring_id = m.sparring_id
    WHERE m.sparring_id IN (SELECT id FROM my_sparrings)
      AND m.sender_id <> auth.uid()
      AND m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY m.sparring_id
  ),
  my_events AS (
    SELECT e.id, e.title, e.scheduled_at, e.duration_min, e.created_by
    FROM events e
    WHERE e.created_by = auth.uid()
       OR EXISTS (
         SELECT 1 FROM event_signups es
         WHERE es.event_id = e.id AND es.user_id = auth.uid()
       )
  ),
  event_reads AS (
    SELECT event_id, last_read_at
    FROM event_chat_reads
    WHERE user_id = auth.uid()
  ),
  event_last AS (
    SELECT DISTINCT ON (m.event_id)
      m.event_id, m.body, m.created_at
    FROM event_messages m
    WHERE m.event_id IN (SELECT id FROM my_events)
    ORDER BY m.event_id, m.created_at DESC
  ),
  event_unread AS (
    SELECT m.event_id, count(*)::int AS cnt
    FROM event_messages m
    LEFT JOIN event_reads r ON r.event_id = m.event_id
    WHERE m.event_id IN (SELECT id FROM my_events)
      AND m.user_id <> auth.uid()
      AND m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY m.event_id
  )
  SELECT
    'sparring'::text AS kind,
    ms.id            AS chat_id,
    ms.title,
    ms.scheduled_at,
    ms.duration_min,
    (ms.created_by = auth.uid()) AS is_organizer,
    COALESCE(
      sl.content,
      CASE WHEN sl.image_url IS NOT NULL THEN 'Bild' ELSE NULL END
    ) AS last_message_text,
    sl.created_at        AS last_message_at,
    COALESCE(su.cnt, 0)  AS unread_count
  FROM my_sparrings ms
  LEFT JOIN sparring_last   sl ON sl.sparring_id = ms.id
  LEFT JOIN sparring_unread su ON su.sparring_id = ms.id

  UNION ALL

  SELECT
    'event'::text AS kind,
    me.id         AS chat_id,
    me.title,
    me.scheduled_at,
    me.duration_min,
    (me.created_by = auth.uid()) AS is_organizer,
    el.body             AS last_message_text,
    el.created_at       AS last_message_at,
    COALESCE(eu.cnt, 0) AS unread_count
  FROM my_events me
  LEFT JOIN event_last   el ON el.event_id = me.id
  LEFT JOIN event_unread eu ON eu.event_id = me.id

  -- Ordinals, not names: the output columns share their names with the
  -- RETURNS TABLE parameters, which is ambiguous in a UNION's ORDER BY.
  -- 8 = last_message_at, 4 = scheduled_at.
  ORDER BY 8 DESC NULLS LAST, 4 DESC;
$$;

GRANT EXECUTE ON FUNCTION get_my_chats() TO authenticated;
