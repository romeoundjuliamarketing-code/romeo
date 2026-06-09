-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: notification subsystem
-- Includes:
--   1. expo_push_token drift-fix
--   2. pg_net extension
--   3. notifications table + RLS
--   4. send_push_notification / notify_user / notify_studio_staff helpers
--   5. mark_all_notifications_read RPC
--   6. Updated request_trial_booking / respond_trial_booking with notifications
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drift-fix: ensure expo_push_token exists (may be missing on remote)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token text;

-- 2. Enable pg_net for outbound HTTP calls (uses the net schema)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text        NOT NULL,
  title      text        NOT NULL,
  body       text        NOT NULL,
  data       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  read_at    timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;

-- 4. Row-Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users may only read their own notifications
CREATE POLICY "notifications_select"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users may update (mark as read) their own notifications
CREATE POLICY "notifications_update"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No INSERT policy: all inserts go through SECURITY DEFINER functions only

-- 5a. Internal helper: send Expo push notification via pg_net
-- Never raises an exception to the caller.
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
BEGIN
  SELECT expo_push_token INTO v_token
  FROM profiles
  WHERE id = p_user_id;

  -- No token stored — nothing to send
  IF v_token IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    body    := jsonb_build_object(
                 'to',    v_token,
                 'title', p_title,
                 'body',  p_body,
                 'data',  COALESCE(p_data, '{}'::jsonb)
               ),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  -- Push errors must never abort the surrounding transaction
  NULL;
END;
$$;

-- 5b. Core helper: insert a notification row then attempt push delivery
-- Not granted to authenticated — called only from other DEFINER functions.
CREATE OR REPLACE FUNCTION notify_user(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text,
  p_data    jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, COALESCE(p_data, '{}'::jsonb));

  PERFORM send_push_notification(p_user_id, p_title, p_body, p_data);
END;
$$;

-- 5c. Broadcast helper: notify every staff member of a studio (owner + coaches),
-- optionally excluding one user (e.g. the person who triggered the event).
-- Not granted to authenticated — called only from other DEFINER functions.
CREATE OR REPLACE FUNCTION notify_studio_staff(
  p_studio_id    uuid,
  p_type         text,
  p_title        text,
  p_body         text,
  p_data         jsonb,
  p_exclude_user uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient uuid;
BEGIN
  -- Collect DISTINCT recipients: studio owner UNION coaches of that studio
  FOR v_recipient IN
    SELECT DISTINCT recipient
    FROM (
      SELECT owner_user_id AS recipient
      FROM studios
      WHERE id = p_studio_id
        AND owner_user_id IS NOT NULL
      UNION
      SELECT id AS recipient
      FROM profiles
      WHERE studio_id = p_studio_id
        AND is_coach = true
    ) AS staff
    -- Exclude the triggering user (NULL-safe comparison)
    WHERE recipient IS DISTINCT FROM p_exclude_user
  LOOP
    PERFORM notify_user(v_recipient, p_type, p_title, p_body, p_data);
  END LOOP;
END;
$$;

-- Lock down the internal helpers: they take an arbitrary recipient user_id and
-- run as SECURITY DEFINER, so they must NOT be callable from the API. Internal
-- calls from other DEFINER functions run as the owner and keep working.
REVOKE EXECUTE ON FUNCTION send_push_notification(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_user(uuid, text, text, text, jsonb)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_studio_staff(uuid, text, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- 6. Public RPC: mark all own unread notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
  SET read_at = now()
  WHERE user_id  = auth.uid()
    AND read_at  IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;

-- 7a. Updated RPC: request_trial_booking — notify studio staff on new request
CREATE OR REPLACE FUNCTION request_trial_booking(
  p_studio_id   uuid,
  p_schedule_id uuid,
  p_date        date,
  p_note        text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id        uuid;
  v_name      text;
  v_studio_name text;
BEGIN
  -- Guard: only one pending request per studio
  IF EXISTS (
    SELECT 1
    FROM trial_bookings
    WHERE user_id   = auth.uid()
      AND studio_id = p_studio_id
      AND status    = 'pending'
  ) THEN
    RAISE EXCEPTION 'Es existiert bereits eine offene Probetraining-Anfrage für dieses Studio.';
  END IF;

  INSERT INTO trial_bookings (user_id, studio_id, schedule_id, requested_date, note, status)
  VALUES (auth.uid(), p_studio_id, p_schedule_id, p_date, p_note, 'pending')
  RETURNING id INTO v_id;

  -- Load requester name and studio name for notification text
  SELECT COALESCE(name, 'Jemand') INTO v_name
  FROM profiles
  WHERE id = auth.uid();

  SELECT name INTO v_studio_name
  FROM studios
  WHERE id = p_studio_id;

  -- Notify all studio staff (owner + coaches), exclude the requester themselves
  PERFORM notify_studio_staff(
    p_studio_id,
    'trial_requested',
    'Neue Probetraining-Anfrage',
    v_name || ' möchte ein Probetraining.',
    jsonb_build_object('booking_id', v_id, 'studio_id', p_studio_id),
    auth.uid()
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION request_trial_booking(uuid, uuid, date, text) TO authenticated;

-- 7b. Updated RPC: respond_trial_booking — notify the requesting user on decision
CREATE OR REPLACE FUNCTION respond_trial_booking(
  p_id      uuid,
  p_confirm boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio_id   uuid;
  v_user_id     uuid;
  v_status      text;
  v_studio_name text;
BEGIN
  SELECT studio_id, user_id, status
  INTO v_studio_id, v_user_id, v_status
  FROM trial_bookings
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buchung nicht gefunden.';
  END IF;

  IF NOT is_studio_staff(v_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung, um diese Buchung zu beantworten.';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Nur ausstehende Buchungen können beantwortet werden.';
  END IF;

  UPDATE trial_bookings
  SET
    status       = CASE WHEN p_confirm THEN 'confirmed' ELSE 'declined' END,
    responded_at = now(),
    responded_by = auth.uid(),
    updated_at   = now()
  WHERE id = p_id;

  -- Load studio name for notification text
  SELECT name INTO v_studio_name
  FROM studios
  WHERE id = v_studio_id;

  IF p_confirm THEN
    PERFORM notify_user(
      v_user_id,
      'trial_confirmed',
      'Probetraining bestätigt',
      'Dein Probetraining bei ' || COALESCE(v_studio_name, 'dem Studio') || ' wurde bestätigt.',
      jsonb_build_object('booking_id', p_id, 'studio_id', v_studio_id)
    );
  ELSE
    PERFORM notify_user(
      v_user_id,
      'trial_declined',
      'Probetraining abgelehnt',
      'Dein Probetraining bei ' || COALESCE(v_studio_name, 'dem Studio') || ' wurde leider abgelehnt.',
      jsonb_build_object('booking_id', p_id, 'studio_id', v_studio_id)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION respond_trial_booking(uuid, boolean) TO authenticated;
