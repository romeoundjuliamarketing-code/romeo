-- RPC: return the current user's sparring chat list in a single query.
-- Replaces the previous 3-round-trip client waterfall + unbounded message
-- download. Last message + unread count are computed server-side.
CREATE OR REPLACE FUNCTION get_my_chat_list()
RETURNS TABLE (
  sparring_id       uuid,
  sparring_title    text,
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
      -- Only sparrings whose chat has been enabled
      AND EXISTS (
        SELECT 1 FROM sparring_chat_settings cs WHERE cs.sparring_id = s.id
      )
  ),
  my_reads AS (
    SELECT sparring_id, last_read_at
    FROM sparring_chat_reads
    WHERE user_id = auth.uid()
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.sparring_id)
      m.sparring_id, m.content, m.image_url, m.created_at
    FROM sparring_group_messages m
    WHERE m.sparring_id IN (SELECT id FROM my_sparrings)
    ORDER BY m.sparring_id, m.created_at DESC
  ),
  unread AS (
    SELECT m.sparring_id, count(*)::int AS cnt
    FROM sparring_group_messages m
    LEFT JOIN my_reads r ON r.sparring_id = m.sparring_id
    WHERE m.sparring_id IN (SELECT id FROM my_sparrings)
      AND m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY m.sparring_id
  )
  SELECT
    ms.id,
    ms.title,
    ms.scheduled_at,
    ms.duration_min,
    (ms.created_by = auth.uid()) AS is_organizer,
    COALESCE(
      lm.content,
      CASE WHEN lm.image_url IS NOT NULL THEN 'Bild' ELSE NULL END
    ) AS last_message_text,
    lm.created_at AS last_message_at,
    COALESCE(u.cnt, 0) AS unread_count
  FROM my_sparrings ms
  LEFT JOIN last_msg lm ON lm.sparring_id = ms.id
  LEFT JOIN unread   u  ON u.sparring_id  = ms.id
  ORDER BY ms.scheduled_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_my_chat_list() TO authenticated;
