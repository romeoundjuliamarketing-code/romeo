-- Sparring notifications + app-icon badge support.
--
-- Adds notifications for three sparring events and teaches the push helper to
-- carry the recipient's unread-feed count as the app-icon badge:
--   1. send_push_notification: include `badge` = unread `notifications` count so
--      iOS/Android set the app-icon badge even while the app is closed.
--   2. sparring_signups INSERT  -> notify the organizer ("sparring_signup").
--   3. deactivate_sparring RPC  -> notify all signed-up participants
--      ("sparring_cancelled").
--   4. sparring_group_messages INSERT -> push-only fan-out to chat members
--      (no in-app feed row: the chat has its own unread tracking).
--
-- Design rule: the app-icon badge, the header bell and the Home-tab dot all
-- mirror the in-app `notifications` feed. Chat messages send a push banner but
-- deliberately do NOT create feed rows, so they never inflate that count.

-- ─── 1. send_push_notification: attach unread-feed count as badge ───────────────

CREATE OR REPLACE FUNCTION send_push_notification(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_data    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_badge int;
BEGIN
  SELECT expo_push_token INTO v_token
  FROM profiles
  WHERE id = p_user_id;

  -- No token stored — nothing to send
  IF v_token IS NULL THEN
    RETURN;
  END IF;

  -- Unread in-app notifications drive the app-icon badge. notify_user inserts
  -- the feed row before calling this helper, so a just-created notification is
  -- already counted here.
  SELECT count(*) INTO v_badge
  FROM notifications
  WHERE user_id = p_user_id
    AND read_at IS NULL;

  PERFORM net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    body    := jsonb_build_object(
                 'to',    v_token,
                 'title', p_title,
                 'body',  p_body,
                 'badge', v_badge,
                 'data',  COALESCE(p_data, '{}'::jsonb)
               ),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  -- Push errors must never abort the surrounding transaction
  NULL;
END;
$$;

-- ─── 2. Notify organizer when someone signs up for their sparring ───────────────

CREATE OR REPLACE FUNCTION notify_sparring_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
  v_title   text;
  v_name    text;
BEGIN
  SELECT created_by, title INTO v_creator, v_title
  FROM open_sparrings
  WHERE id = NEW.sparring_id;

  -- Skip if the organizer signs up to their own sparring or row vanished
  IF v_creator IS NULL OR v_creator = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(name, 'Jemand') INTO v_name
  FROM profiles
  WHERE id = NEW.user_id;

  PERFORM notify_user(
    v_creator,
    'sparring_signup',
    'Neue Sparring-Anmeldung',
    v_name || ' hat sich für "' || COALESCE(v_title, 'dein Sparring') || '" angemeldet.',
    jsonb_build_object('sparring_id', NEW.sparring_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_sparring_signup ON sparring_signups;
CREATE TRIGGER trg_notify_sparring_signup
  AFTER INSERT ON sparring_signups
  FOR EACH ROW
  EXECUTE FUNCTION notify_sparring_signup();

-- ─── 3. Notify participants when the organizer cancels the sparring ─────────────

CREATE OR REPLACE FUNCTION deactivate_sparring(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title   text;
  v_creator uuid;
  r         record;
BEGIN
  UPDATE open_sparrings
  SET is_active = false
  WHERE id = p_id
    AND created_by = auth.uid()
  RETURNING title, created_by INTO v_title, v_creator;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sparring nicht gefunden oder keine Berechtigung';
  END IF;

  -- Fan out a cancellation notice to everyone who had signed up
  FOR r IN
    SELECT user_id
    FROM sparring_signups
    WHERE sparring_id = p_id
      AND user_id <> v_creator
  LOOP
    PERFORM notify_user(
      r.user_id,
      'sparring_cancelled',
      'Sparring abgesagt',
      '"' || COALESCE(v_title, 'Ein Sparring') || '" wurde vom Organisator abgesagt.',
      jsonb_build_object('sparring_id', p_id)
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION deactivate_sparring(uuid) TO authenticated;

-- ─── 4. Push-only fan-out for new group-chat messages ───────────────────────────
-- Chat messages must NOT create in-app feed rows (the chat tracks its own unread
-- state via sparring_chat_reads), so this calls send_push_notification directly
-- instead of notify_user.

CREATE OR REPLACE FUNCTION notify_sparring_group_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title  text;
  v_sender text;
  v_body   text;
  r        record;
BEGIN
  SELECT title INTO v_title
  FROM open_sparrings
  WHERE id = NEW.sparring_id;

  SELECT COALESCE(name, 'Jemand') INTO v_sender
  FROM profiles
  WHERE id = NEW.sender_id;

  IF NEW.content IS NOT NULL AND length(NEW.content) > 0 THEN
    v_body := v_sender || ': ' || left(NEW.content, 120);
  ELSE
    v_body := v_sender || ' hat ein Bild gesendet.';
  END IF;

  -- Recipients: organizer + all signed-up participants, minus the sender
  FOR r IN
    SELECT DISTINCT uid FROM (
      SELECT created_by AS uid FROM open_sparrings WHERE id = NEW.sparring_id
      UNION
      SELECT user_id AS uid FROM sparring_signups WHERE sparring_id = NEW.sparring_id
    ) members
    WHERE uid IS NOT NULL
      AND uid <> NEW.sender_id
  LOOP
    PERFORM send_push_notification(
      r.uid,
      COALESCE(v_title, 'Sparring-Chat'),
      v_body,
      jsonb_build_object('sparring_id', NEW.sparring_id, 'kind', 'sparring_message')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_sparring_group_message ON sparring_group_messages;
CREATE TRIGGER trg_notify_sparring_group_message
  AFTER INSERT ON sparring_group_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_sparring_group_message();

-- Trigger helper functions stay internal — never callable from the API.
REVOKE EXECUTE ON FUNCTION notify_sparring_signup()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_sparring_group_message()   FROM PUBLIC, anon, authenticated;
