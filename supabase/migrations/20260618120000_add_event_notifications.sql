-- Event notifications — mirrors the sparring notifications
-- (20260617120000_add_sparring_notifications.sql) for public-viewing events.
--
--   1. event_signups INSERT  -> notify the organizer ("event_signup").
--   2. deactivate_event RPC  -> notify all signed-up participants
--      ("event_cancelled").
--   3. event_messages INSERT -> push-only fan-out to chat members
--      (no in-app feed row: the chat has its own unread tracking).
--
-- Reuses notify_user / send_push_notification from the notifications subsystem.
-- The in-app feed, app-icon badge and Home-tab dot pick up the new feed types
-- automatically — no client change required.

-- ─── 1. Notify organizer when someone signs up for their event ──────────────────
-- signup_event uses ON CONFLICT DO NOTHING, so this AFTER INSERT trigger fires
-- only on a real new signup, never on a duplicate.

CREATE OR REPLACE FUNCTION notify_event_signup()
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
  FROM events
  WHERE id = NEW.event_id;

  IF v_creator IS NULL OR v_creator = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(name, 'Jemand') INTO v_name
  FROM profiles
  WHERE id = NEW.user_id;

  PERFORM notify_user(
    v_creator,
    'event_signup',
    'Neue Event-Anmeldung',
    v_name || ' hat sich für "' || COALESCE(v_title, 'dein Event') || '" angemeldet.',
    jsonb_build_object('event_id', NEW.event_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_signup ON event_signups;
CREATE TRIGGER trg_notify_event_signup
  AFTER INSERT ON event_signups
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_signup();

-- ─── 2. Notify participants when the organizer cancels the event ────────────────
-- Keeps the original silent no-op semantics (no RAISE when not the owner); only
-- adds the fan-out when a row was actually deactivated.

CREATE OR REPLACE FUNCTION deactivate_event(p_event_id uuid)
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
  UPDATE events
     SET is_active = false
   WHERE id = p_event_id AND created_by = auth.uid()
  RETURNING title, created_by INTO v_title, v_creator;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT user_id
    FROM event_signups
    WHERE event_id = p_event_id
      AND user_id <> v_creator
  LOOP
    PERFORM notify_user(
      r.user_id,
      'event_cancelled',
      'Event abgesagt',
      '"' || COALESCE(v_title, 'Ein Event') || '" wurde vom Organisator abgesagt.',
      jsonb_build_object('event_id', p_event_id)
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION deactivate_event(uuid) TO authenticated;

-- ─── 3. Push-only fan-out for new event-chat messages ───────────────────────────
-- No in-app feed row (the chat tracks its own unread state), so this calls
-- send_push_notification directly instead of notify_user.

CREATE OR REPLACE FUNCTION notify_event_message()
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
  FROM events
  WHERE id = NEW.event_id;

  SELECT COALESCE(name, 'Jemand') INTO v_sender
  FROM profiles
  WHERE id = NEW.user_id;

  v_body := v_sender || ': ' || left(NEW.body, 120);

  FOR r IN
    SELECT DISTINCT uid FROM (
      SELECT created_by AS uid FROM events WHERE id = NEW.event_id
      UNION
      SELECT user_id AS uid FROM event_signups WHERE event_id = NEW.event_id
    ) members
    WHERE uid IS NOT NULL
      AND uid <> NEW.user_id
  LOOP
    PERFORM send_push_notification(
      r.uid,
      COALESCE(v_title, 'Event-Chat'),
      v_body,
      jsonb_build_object('event_id', NEW.event_id, 'kind', 'event_message')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_message ON event_messages;
CREATE TRIGGER trg_notify_event_message
  AFTER INSERT ON event_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_message();

-- Trigger helper functions stay internal — never callable from the API.
REVOKE EXECUTE ON FUNCTION notify_event_signup()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_event_message() FROM PUBLIC, anon, authenticated;
