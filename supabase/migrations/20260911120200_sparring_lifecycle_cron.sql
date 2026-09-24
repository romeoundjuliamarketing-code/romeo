-- Sparring commitment (3/3): time-driven lifecycle via pg_cron
--
-- One SECURITY DEFINER function, run every 15 minutes (free, inside the DB).
-- Steps run in the order C, A, B, E, D:
--   C  expiry                pending past the confirm deadline -> expired + waitlist moves up
--   A  7-day check-in        pending, booked >= 7 days ahead  -> "Bist du weiterhin dabei?"
--   B  24h confirmation ask  pending                         -> "Bist du dabei?"
--   E  3h final reminder     pending/confirmed, slot held >= 3h ahead -> "Gleich geht's los"
--   D  attendance reminder   organizer, 1h after the end      -> "Wer war dabei?"
-- C runs first and is the only step that locks sparring rows (sparring first,
-- then signups — the RPC lock order). A/B/E only lock signup rows afterwards and
-- never wait for a sparring lock, so the run cannot deadlock with the RPCs.
--
-- Idempotency (spec 16.3): every step is a threshold check ("now() >= X") plus a
-- NULL flag / status guard, flipped in the same UPDATE that selects the rows.
-- A late or repeated run never skips a step and never sends twice; a concurrent
-- run blocks on the row lock and then fails the re-checked guard.
--
-- Nobody is ever marked no_show automatically. Expiry only hits slots whose
-- holder was asked at least sparring_reaction_time() before the confirm
-- deadline (a missed cron window never costs anyone their slot) and that are
-- not last-minute slots (sparring_is_last_minute_slot()). Rescheduling resets
-- the reminder flags (trigger below), so no one expires on an ask for an old date.
--
-- Deadlines come from sparring_cancel_deadline() / sparring_confirm_deadline() /
-- sparring_confirm_window() (migration 2) — change them there, in one place.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Step D flag (one reminder per sparring)
ALTER TABLE open_sparrings
  ADD COLUMN IF NOT EXISTS attendance_reminder_sent_at timestamptz;

-- Step E flag (one final reminder per signup)
ALTER TABLE sparring_signups
  ADD COLUMN IF NOT EXISTS reminder_3h_sent_at timestamptz;

-- A failing notification (e.g. a recipient deleted mid-run) must not roll back
-- the whole lifecycle run.
CREATE OR REPLACE FUNCTION sparring_notify_safe(
  p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_user(p_user_id, p_type, p_title, p_body, p_data);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sparring lifecycle: % for % failed: %', p_type, p_user_id, SQLERRM;
END;
$$;

REVOKE EXECUTE ON FUNCTION sparring_notify_safe(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Rescheduling restarts the reminder lifecycle of open commitments and the
-- organizer's attendance reminder.
CREATE OR REPLACE FUNCTION trg_open_sparring_rescheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    -- 7d/24h flags are only read for pending rows, so clearing them on
    -- confirmed rows as well is harmless and keeps this to one UPDATE.
    UPDATE sparring_signups
       SET reminder_7d_sent_at  = NULL,
           reminder_24h_sent_at = NULL,
           reminder_3h_sent_at  = NULL
     WHERE sparring_id = NEW.id
       AND status IN ('pending', 'confirmed');
    NEW.attendance_reminder_sent_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_open_sparring_rescheduled ON open_sparrings;
CREATE TRIGGER trg_open_sparring_rescheduled
  BEFORE UPDATE OF scheduled_at ON open_sparrings
  FOR EACH ROW
  EXECUTE FUNCTION trg_open_sparring_rescheduled();

REVOKE EXECUTE ON FUNCTION trg_open_sparring_rescheduled() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION process_sparring_lifecycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Tunables
  v_reminder_7d         boolean  := true;
  v_reminder_3h         boolean  := true;
  v_final_reminder      interval := interval '3 hours';  -- before the start
  v_attendance_reminder boolean  := true;
  v_attendance_grace    interval := interval '1 hour';   -- after the scheduled end
  v_attendance_horizon  interval := interval '7 days';   -- never nag about older sparrings

  v_confirm interval := sparring_confirm_deadline();
  v_window  interval := sparring_confirm_window();
  v_react   interval := sparring_reaction_time();

  v_n7   integer := 0;
  v_n24  integer := 0;
  v_n3   integer := 0;
  v_nexp integer := 0;
  v_nprm integer := 0;
  v_natt integer := 0;
  v_sid  uuid;
  v_body text;
  r      record;
BEGIN
  -- ── C. Expire unconfirmed slots, then refill from the waitlist ────────────
  -- Per sparring, lock the sparring row first (same lock order as the RPCs).
  FOR v_sid IN
    SELECT DISTINCT ss.sparring_id
      FROM sparring_signups ss
      JOIN open_sparrings os ON os.id = ss.sparring_id
     WHERE os.is_active
       AND ss.status = 'pending'
       AND os.scheduled_at > now()
       AND now() >= os.scheduled_at - v_confirm
  LOOP
    PERFORM 1 FROM open_sparrings WHERE id = v_sid FOR UPDATE;

    FOR r IN
      WITH gone AS (
        UPDATE sparring_signups ss
           SET status = 'expired'
          FROM open_sparrings os
         WHERE ss.sparring_id = v_sid
           AND os.id = ss.sparring_id
           AND os.is_active
           AND os.scheduled_at > now()
           AND ss.status = 'pending'
           AND now() >= os.scheduled_at - v_confirm
           AND NOT sparring_is_last_minute_slot(COALESCE(ss.slot_granted_at, ss.signed_up_at), os.scheduled_at)
           AND ss.reminder_24h_sent_at IS NOT NULL
           AND ss.reminder_24h_sent_at < os.scheduled_at - v_confirm - v_react
        RETURNING ss.user_id, os.title
      )
      SELECT * FROM gone
    LOOP
      PERFORM sparring_notify_safe(
        r.user_id,
        'sparring_slot_expired',
        'Dein Platz wurde freigegeben',
        'Du hast deine Teilnahme an „' || COALESCE(r.title, 'dem Sparring') || '“ nicht bestätigt, '
          || 'deshalb wurde dein Platz freigegeben. Das zählt nicht gegen dich. '
          || 'Ist noch ein Platz frei, kannst du erneut zusagen.',
        jsonb_build_object('sparring_id', v_sid)
      );
      v_nexp := v_nexp + 1;
    END LOOP;

    BEGIN
      v_nprm := v_nprm + promote_sparring_waitlist(v_sid);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sparring lifecycle: promotion for % failed: %', v_sid, SQLERRM;
    END;
  END LOOP;

  -- ── A. 7-day check-in (only for early bookings, no status change) ─────────
  IF v_reminder_7d THEN
    FOR r IN
      WITH due AS (
        UPDATE sparring_signups ss
           SET reminder_7d_sent_at = now()
          FROM open_sparrings os
         WHERE os.id = ss.sparring_id
           AND os.is_active
           AND ss.status = 'pending'
           AND ss.reminder_7d_sent_at IS NULL
           AND now() >= os.scheduled_at - interval '7 days'
           AND now() <  os.scheduled_at - v_window
           AND ss.signed_up_at <= os.scheduled_at - interval '7 days'
        RETURNING ss.user_id, ss.sparring_id, os.title, os.scheduled_at
      )
      SELECT * FROM due
    LOOP
      PERFORM sparring_notify_safe(
        r.user_id,
        'sparring_confirm_7d',
        'Bist du weiterhin dabei?',
        '„' || COALESCE(r.title, 'Dein Sparring') || '“ ist am '
          || to_char(r.scheduled_at AT TIME ZONE 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || ' Uhr. '
          || 'Falls du nicht mehr kannst, sag bitte jetzt ab – dann kann jemand nachrücken.',
        jsonb_build_object('sparring_id', r.sparring_id)
      );
      v_n7 := v_n7 + 1;
    END LOOP;
  END IF;

  -- ── B. 24h confirmation request ────────────────────────────────────────────
  FOR r IN
    WITH due AS (
      UPDATE sparring_signups ss
         SET reminder_24h_sent_at = now()
        FROM open_sparrings os
       WHERE os.id = ss.sparring_id
         AND os.is_active
         AND ss.status = 'pending'
         AND ss.reminder_24h_sent_at IS NULL
         AND now() >= os.scheduled_at - v_window
         AND os.scheduled_at > now()
      RETURNING ss.user_id, ss.sparring_id, ss.slot_granted_at, ss.signed_up_at, os.title, os.scheduled_at
    )
    SELECT * FROM due
  LOOP
    v_body := 'Bitte bestätige deine Teilnahme an „' || COALESCE(r.title, 'deinem Sparring') || '“ am '
      || to_char(r.scheduled_at AT TIME ZONE 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || ' Uhr.';
    -- Only announce the expiry when step C will actually apply to this slot.
    IF now() < r.scheduled_at - v_confirm - v_react
       AND NOT sparring_is_last_minute_slot(COALESCE(r.slot_granted_at, r.signed_up_at), r.scheduled_at) THEN
      v_body := v_body || ' Ohne Bestätigung wird dein Platz um '
        || to_char((r.scheduled_at - v_confirm) AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
        || ' Uhr freigegeben.';
    END IF;
    PERFORM sparring_notify_safe(
      r.user_id,
      'sparring_confirm_24h',
      'Bist du dabei?',
      v_body,
      jsonb_build_object('sparring_id', r.sparring_id)
    );
    v_n24 := v_n24 + 1;
  END LOOP;

  -- ── E. Final reminder shortly before the start ─────────────────────────────
  -- Pending slots still standing here are last-minute slots (C never expires
  -- them). Slots granted inside the window (late join, late promotion) skip
  -- this step: they just got a notification anyway.
  IF v_reminder_3h THEN
    FOR r IN
      WITH due AS (
        UPDATE sparring_signups ss
           SET reminder_3h_sent_at = now()
          FROM open_sparrings os
         WHERE os.id = ss.sparring_id
           AND os.is_active
           AND ss.status IN ('pending', 'confirmed')
           AND ss.reminder_3h_sent_at IS NULL
           AND now() >= os.scheduled_at - v_final_reminder
           AND os.scheduled_at > now()
           AND COALESCE(ss.slot_granted_at, ss.signed_up_at) <= os.scheduled_at - v_final_reminder
        RETURNING ss.user_id, ss.sparring_id, ss.status, os.title, os.scheduled_at
      )
      SELECT * FROM due
    LOOP
      v_body := '„' || COALESCE(r.title, 'Dein Sparring') || '“ beginnt heute um '
        || to_char(r.scheduled_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI') || ' Uhr.';
      IF r.status = 'pending' THEN
        v_body := v_body || ' Bitte bestätige noch kurz, dass du kommst.';
      ELSE
        v_body := v_body || ' Falls du doch nicht kannst, sag bitte ab – die anderen rechnen mit dir.';
      END IF;
      PERFORM sparring_notify_safe(
        r.user_id,
        'sparring_reminder_3h',
        'Gleich geht''s los',
        v_body,
        jsonb_build_object('sparring_id', r.sparring_id)
      );
      v_n3 := v_n3 + 1;
    END LOOP;
  END IF;

  -- ── D. Ask the organizer to record attendance ─────────────────────────────
  IF v_attendance_reminder THEN
    FOR r IN
      WITH due AS (
        UPDATE open_sparrings os
           SET attendance_reminder_sent_at = now()
         WHERE os.is_active
           AND os.attendance_reminder_sent_at IS NULL
           AND now() >= os.scheduled_at + make_interval(mins => os.duration_min) + v_attendance_grace
           AND os.scheduled_at >= now() - v_attendance_horizon
           AND EXISTS (
             SELECT 1 FROM sparring_signups ss
              WHERE ss.sparring_id = os.id
                AND ss.status = 'confirmed'
                AND ss.user_id <> os.created_by
           )
        RETURNING os.id, os.created_by, os.title
      )
      SELECT * FROM due
    LOOP
      PERFORM sparring_notify_safe(
        r.created_by,
        'sparring_attendance_reminder',
        'Wer war dabei?',
        'Bitte erfasse die Anwesenheit für „' || COALESCE(r.title, 'dein Sparring') || '“. '
          || 'So bleibt die Zuverlässigkeit aller Teilnehmer fair.',
        jsonb_build_object('sparring_id', r.id)
      );
      v_natt := v_natt + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'reminded_7d',          v_n7,
    'reminded_24h',         v_n24,
    'reminded_3h',          v_n3,
    'expired',              v_nexp,
    'promoted',             v_nprm,
    'attendance_reminders', v_natt
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION process_sparring_lifecycle() FROM PUBLIC, anon, authenticated;

-- Upserts by job name: re-running this migration never creates a second job.
SELECT cron.schedule(
  'sparring-lifecycle',
  '*/15 * * * *',
  $$SELECT public.process_sparring_lifecycle()$$
);
