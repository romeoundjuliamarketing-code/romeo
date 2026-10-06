-- Chat overview v2: everything the redesigned chat list needs in ONE call.
--
-- Additive: get_my_chats() stays untouched for released app versions. Same
-- membership rules and unread logic as get_my_chats (20260911120100, section
-- 14); additionally returns
--   place_name        gym/studio name (sparring) or venue name (event)
--   address           meeting point as stored
--   last_sender_name  sender of the last message (NULL for system messages)
--   last_from_me      last message was sent by the caller
--   last_is_system    last message is a system message (no invented sender)
--   my_status         caller's sparring signup status, 'organizer', or NULL
--   participants      up to two OTHER chat members [{id,name,avatar_url}],
--                     organizer first; only people the caller already sees
--                     in the chat itself.

CREATE OR REPLACE FUNCTION get_my_chats_v2()
RETURNS TABLE (
  kind              text,
  chat_id           uuid,
  title             text,
  scheduled_at      timestamptz,
  duration_min      integer,
  is_organizer      boolean,
  last_message_text text,
  last_message_at   timestamptz,
  unread_count      integer,
  place_name        text,
  address           text,
  last_sender_name  text,
  last_from_me      boolean,
  last_is_system    boolean,
  my_status         text,
  participants      jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_sparrings AS (
    SELECT s.id, s.title, s.scheduled_at, s.duration_min, s.created_by,
           s.address, COALESCE(s.gym_id, s.studio_id) AS place_id
    FROM open_sparrings s
    WHERE (
        s.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM sparring_signups ss
          WHERE ss.sparring_id = s.id AND ss.user_id = auth.uid()
            AND ss.status IN ('pending','confirmed','attended','no_show')
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
      m.sparring_id, m.content, m.image_url, m.created_at, m.sender_id, m.is_system
    FROM sparring_group_messages m
    WHERE m.sparring_id IN (SELECT id FROM my_sparrings)
    ORDER BY m.sparring_id, m.created_at DESC, m.id DESC
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
    SELECT e.id, e.title, e.scheduled_at, e.duration_min, e.created_by,
           e.address, COALESCE(v.name, e.venue_name) AS place_name
    FROM events e
    LEFT JOIN venues v ON v.id = e.venue_id
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
      m.event_id, m.body, m.created_at, m.user_id
    FROM event_messages m
    WHERE m.event_id IN (SELECT id FROM my_events)
    ORDER BY m.event_id, m.created_at DESC, m.id DESC
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
    COALESCE(su.cnt, 0)  AS unread_count,
    st.name              AS place_name,
    ms.address,
    CASE WHEN COALESCE(sl.is_system, false) THEN NULL ELSE sp.name END AS last_sender_name,
    (sl.sender_id IS NOT NULL AND sl.sender_id = auth.uid() AND NOT COALESCE(sl.is_system, false)) AS last_from_me,
    COALESCE(sl.is_system, false) AS last_is_system,
    CASE WHEN ms.created_by = auth.uid() THEN 'organizer'
         ELSE (SELECT ss.status FROM sparring_signups ss
               WHERE ss.sparring_id = ms.id AND ss.user_id = auth.uid()
               ORDER BY ss.signed_up_at DESC LIMIT 1)
    END AS my_status,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'avatar_url', p.avatar_url) ORDER BY m.ord, m.at)
      FROM (
        SELECT u.uid, u.ord, u.at FROM (
          SELECT ms.created_by AS uid, 0 AS ord, NULL::timestamptz AS at
          UNION ALL
          SELECT ss.user_id, 1, ss.signed_up_at
          FROM sparring_signups ss
          WHERE ss.sparring_id = ms.id
            AND ss.status IN ('pending','confirmed','attended','no_show')
        ) u
        WHERE u.uid <> auth.uid()
        ORDER BY u.ord, u.at
        LIMIT 2
      ) m
      JOIN profiles p ON p.id = m.uid
    ), '[]'::jsonb) AS participants
  FROM my_sparrings ms
  LEFT JOIN sparring_last   sl ON sl.sparring_id = ms.id
  LEFT JOIN sparring_unread su ON su.sparring_id = ms.id
  LEFT JOIN studios         st ON st.id = ms.place_id
  LEFT JOIN profiles        sp ON sp.id = sl.sender_id

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
    COALESCE(eu.cnt, 0) AS unread_count,
    me.place_name,
    me.address,
    ep.name             AS last_sender_name,
    (el.user_id IS NOT NULL AND el.user_id = auth.uid()) AS last_from_me,
    false               AS last_is_system,
    CASE WHEN me.created_by = auth.uid() THEN 'organizer' ELSE NULL END AS my_status,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'avatar_url', p.avatar_url) ORDER BY m.ord, m.at)
      FROM (
        SELECT u.uid, u.ord, u.at FROM (
          SELECT me.created_by AS uid, 0 AS ord, NULL::timestamptz AS at
          UNION ALL
          SELECT es.user_id, 1, es.created_at
          FROM event_signups es
          WHERE es.event_id = me.id
        ) u
        WHERE u.uid <> auth.uid()
        ORDER BY u.ord, u.at
        LIMIT 2
      ) m
      JOIN profiles p ON p.id = m.uid
    ), '[]'::jsonb) AS participants
  FROM my_events me
  LEFT JOIN event_last   el ON el.event_id = me.id
  LEFT JOIN event_unread eu ON eu.event_id = me.id
  LEFT JOIN profiles     ep ON ep.id = el.user_id;
$$;

REVOKE ALL     ON FUNCTION public.get_my_chats_v2() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_chats_v2() TO authenticated;
