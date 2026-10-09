-- Sparring notifications that are safe for every app version:
--   A. 3h reminder before the start (all builds, no request to re-confirm)
--   B. one-time "did your sparring take place?" after the end
--
-- Runs as its own cron job `sparring-notifications`. It never changes a signup
-- status; the old `sparring-lifecycle` job (24h confirmation, slot expiry) stays
-- paused until 1.2.7 is the minimum version.
--
-- Facts this relies on (checked on prod 2026-10-09):
-- - sparring_signups.status 'pending' = binding signup, re-confirmation still
--   open; 'confirmed' = re-confirmed. 'waitlisted' has no slot.
-- - End of a sparring = sparring_end_at(scheduled_at, duration_min);
--   open_sparrings.duration_min is NOT NULL (default 90), so no duration is
--   invented here.
-- - Push goes notify_user -> notifications row + send_push_notification ->
--   net.http_post (pg_net, async, no retry). send_push_notification swallows
--   its own errors; sparring_notify_safe_i18n swallows everything else with a
--   WARNING. The only durable proof of a send is the notifications row, so this
--   job checks for it and releases its claim when it is missing.
-- - No per-user time zone exists. Times use the zone of the existing
--   notification formatter notif_time (see notification_time_zone()).
-- - One push token per account (profiles.expo_push_token), no app version per
--   device. B therefore stays switched off (see app_flags below).

-- ── Job switches ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sparring_notification_jobs (
  job          text        PRIMARY KEY CHECK (job IN ('reminder_3h', 'feedback')),
  enabled      boolean     NOT NULL DEFAULT false,
  -- Set automatically when a job is switched on; B ignores sparrings that
  -- ended before this moment (no historic wave).
  active_since timestamptz
);

ALTER TABLE public.sparring_notification_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sparring_notification_jobs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_sparring_notification_job_switch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.enabled AND (TG_OP = 'INSERT' OR NOT OLD.enabled) THEN
    NEW.active_since := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sparring_notification_job_switch ON public.sparring_notification_jobs;
CREATE TRIGGER trg_sparring_notification_job_switch
  BEFORE INSERT OR UPDATE OF enabled ON public.sparring_notification_jobs
  FOR EACH ROW EXECUTE FUNCTION public.trg_sparring_notification_job_switch();

REVOKE EXECUTE ON FUNCTION public.trg_sparring_notification_job_switch() FROM PUBLIC, anon, authenticated;

-- A is compatible with every build and starts on. B stays off: see header.
INSERT INTO public.sparring_notification_jobs (job, enabled) VALUES
  ('reminder_3h', true),
  ('feedback',    false)
ON CONFLICT (job) DO NOTHING;

-- ── Claims for B ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sparring_feedback_reminders (
  sparring_id uuid        NOT NULL REFERENCES public.open_sparrings(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempts    smallint    NOT NULL DEFAULT 1,
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  PRIMARY KEY (sparring_id, user_id)
);

ALTER TABLE public.sparring_feedback_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sparring_feedback_reminders FROM PUBLIC, anon, authenticated;

-- ── Helpers ─────────────────────────────────────────────────────────────────────

-- The zone notif_time() formats with. Kept in one place for this job; there is
-- no per-user or per-sparring zone in the data model.
CREATE OR REPLACE FUNCTION public.notification_time_zone()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT 'Europe/Berlin'::text $$;

-- Title for a notification body: localized, at most 40 characters including
-- the ellipsis. Cuts by code point; the stored title is untouched.
CREATE OR REPLACE FUNCTION public.notification_short_title(p_title text, p_lang text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN t IS NULL OR t = '' THEN NULL
    WHEN char_length(t) <= 40 THEN t
    ELSE rtrim(left(t, 39)) || '…'
  END
  FROM (SELECT btrim(sparring_title_for(p_title, p_lang)) AS t) s
$$;

-- When the feedback question may go out: one hour after the end, moved out of
-- the night (22:00–09:00 local) to 09:00 the next morning.
CREATE OR REPLACE FUNCTION public.sparring_feedback_send_at(p_end timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_tz    text      := notification_time_zone();
  v_local timestamp := (p_end + interval '1 hour') AT TIME ZONE v_tz;
BEGIN
  IF v_local::time >= time '22:00' THEN
    RETURN ((v_local::date + 1) + time '09:00') AT TIME ZONE v_tz;
  ELSIF v_local::time < time '09:00' THEN
    RETURN (v_local::date + time '09:00') AT TIME ZONE v_tz;
  END IF;
  RETURN p_end + interval '1 hour';
END;
$$;

-- Durable proof that notify_user ran in this transaction (cron runs one
-- transaction per call, so now() is the same for the insert and this check).
CREATE OR REPLACE FUNCTION public.sparring_notification_written(p_user_id uuid, p_type text, p_sparring_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM notifications
     WHERE user_id = p_user_id
       AND type = p_type
       AND data->>'sparring_id' = p_sparring_id::text
       AND created_at = now()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.notification_short_title(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sparring_feedback_send_at(timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sparring_notification_written(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

-- ── The job ─────────────────────────────────────────────────────────────────────

-- p_now is the clock for all due-checks (tests pass fixed times); stored
-- timestamps always use the real now().
CREATE OR REPLACE FUNCTION public.process_sparring_notifications_at(p_now timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz         text := notification_time_zone();
  v_reminder   boolean;
  v_feedback   boolean;
  v_fb_since   timestamptz;
  v_lang       text;
  v_today      boolean;
  v_title      text;
  v_head_de    text;
  v_head_en    text;
  v_sent3      integer := 0;
  v_fail3      integer := 0;
  v_sentfb     integer := 0;
  v_failfb     integer := 0;
  r            record;
BEGIN
  -- A second run (overlapping cron, manual call) leaves immediately.
  IF NOT pg_try_advisory_xact_lock(hashtext('process_sparring_notifications')) THEN
    RETURN jsonb_build_object('skipped', 'already_running');
  END IF;

  SELECT enabled INTO v_reminder FROM sparring_notification_jobs WHERE job = 'reminder_3h';
  SELECT enabled, active_since INTO v_feedback, v_fb_since
    FROM sparring_notification_jobs WHERE job = 'feedback';

  -- A. 3h reminder. Claiming via UPDATE … WHERE reminder_3h_sent_at IS NULL is
  -- row-locked, so the old lifecycle job (same column) can never send twice.
  -- Only before the start; late signups (slot within the last 3h) are skipped.
  IF COALESCE(v_reminder, false) THEN
    FOR r IN
      WITH due AS (
        UPDATE sparring_signups ss
           SET reminder_3h_sent_at = now()
          FROM open_sparrings os
         WHERE os.id = ss.sparring_id
           AND os.is_active
           AND ss.status IN ('pending', 'confirmed')
           AND ss.reminder_3h_sent_at IS NULL
           AND p_now >= os.scheduled_at - interval '3 hours'
           AND p_now <  os.scheduled_at
           AND COALESCE(ss.slot_granted_at, ss.signed_up_at) <= os.scheduled_at - interval '3 hours'
        RETURNING ss.user_id, ss.sparring_id, os.title, os.scheduled_at
      )
      SELECT * FROM due
    LOOP
      v_today := (r.scheduled_at AT TIME ZONE v_tz)::date = (p_now AT TIME ZONE v_tz)::date;
      v_head_de := CASE WHEN v_today THEN 'Sparring heute um ' ELSE 'Sparring morgen um ' END
                   || notif_time(r.scheduled_at, 'de', false);
      v_head_en := CASE WHEN v_today THEN 'Sparring today at ' ELSE 'Sparring tomorrow at ' END
                   || notif_time(r.scheduled_at, 'en', false);

      PERFORM sparring_notify_safe_i18n(
        r.user_id,
        'sparring_reminder_3h',
        v_head_de,
        '„' || COALESCE(notification_short_title(r.title, 'de'), 'Sparring')
          || '“ – kannst du doch nicht? Sag bitte rechtzeitig ab.',
        v_head_en,
        '“' || COALESCE(notification_short_title(r.title, 'en'), 'Sparring')
          || '” — can’t make it? Please cancel in time.',
        jsonb_build_object('sparring_id', r.sparring_id)
      );

      IF sparring_notification_written(r.user_id, 'sparring_reminder_3h', r.sparring_id) THEN
        v_sent3 := v_sent3 + 1;
      ELSE
        -- Not written: release the claim so the next run retries (until start).
        UPDATE sparring_signups SET reminder_3h_sent_at = NULL
         WHERE sparring_id = r.sparring_id AND user_id = r.user_id
           AND reminder_3h_sent_at = now();
        v_fail3 := v_fail3 + 1;
      END IF;
    END LOOP;
  END IF;

  -- B. Feedback question, once per person and sparring.
  IF COALESCE(v_feedback, false) AND v_fb_since IS NOT NULL THEN
    FOR r IN
      WITH ended AS (
        SELECT os.id, os.created_by, os.title,
               sparring_end_at(os.scheduled_at, os.duration_min) AS end_at,
               os.is_active, os.deactivated_at
          FROM open_sparrings os
         WHERE os.scheduled_at < p_now
           AND os.scheduled_at > p_now - interval '4 days'
      ),
      candidates AS (
        SELECT e.id AS sparring_id, e.created_by AS user_id, e.title, e.end_at
          FROM ended e
        UNION
        SELECT e.id, ss.user_id, e.title, e.end_at
          FROM ended e
          JOIN sparring_signups ss ON ss.sparring_id = e.id
         WHERE ss.status IN ('pending', 'confirmed', 'attended')
      ),
      eligible AS (
        SELECT c.*
          FROM candidates c
          JOIN ended e   ON e.id = c.sparring_id
          JOIN profiles p ON p.id = c.user_id
         WHERE NOT sparring_is_cancelled(e.is_active, e.deactivated_at, e.end_at)
           AND c.end_at >= v_fb_since
           AND p_now >= sparring_feedback_send_at(c.end_at)
           AND p_now <= c.end_at + sparring_trust_feedback_window()
           AND p.sparring_intro_version IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM sparring_meeting_feedback f
                            WHERE f.sparring_id = c.sparring_id AND f.user_id = c.user_id)
      ),
      claimed AS (
        INSERT INTO sparring_feedback_reminders AS fr (sparring_id, user_id)
        SELECT sparring_id, user_id FROM eligible
        ON CONFLICT (sparring_id, user_id) DO UPDATE
           SET attempts = fr.attempts + 1, claimed_at = now()
         WHERE fr.sent_at IS NULL AND fr.attempts < 5
        RETURNING fr.sparring_id, fr.user_id
      )
      SELECT cl.sparring_id, cl.user_id, el.title
        FROM claimed cl
        JOIN eligible el ON el.sparring_id = cl.sparring_id AND el.user_id = cl.user_id
    LOOP
      -- Re-check right before sending: answer or cancellation may have landed.
      CONTINUE WHEN EXISTS (SELECT 1 FROM sparring_meeting_feedback f
                             WHERE f.sparring_id = r.sparring_id AND f.user_id = r.user_id);

      PERFORM sparring_notify_safe_i18n(
        r.user_id,
        'sparring_feedback_due',
        'Hat euer Sparring stattgefunden?',
        'Gib kurz Rückmeldung zu „' || COALESCE(notification_short_title(r.title, 'de'), 'deinem Sparring') || '“.',
        'Did your sparring session take place?',
        'Let us know about “' || COALESCE(notification_short_title(r.title, 'en'), 'your sparring') || '”.',
        jsonb_build_object('sparring_id', r.sparring_id)
      );

      IF sparring_notification_written(r.user_id, 'sparring_feedback_due', r.sparring_id) THEN
        UPDATE sparring_feedback_reminders SET sent_at = now()
         WHERE sparring_id = r.sparring_id AND user_id = r.user_id;
        v_sentfb := v_sentfb + 1;
      ELSE
        v_failfb := v_failfb + 1;   -- row stays unsent; retried up to 5 attempts
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'reminder_3h_sent',   v_sent3,
    'reminder_3h_failed', v_fail3,
    'feedback_sent',      v_sentfb,
    'feedback_failed',    v_failfb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_sparring_notifications()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT process_sparring_notifications_at(now()) $$;

REVOKE ALL ON FUNCTION public.process_sparring_notifications_at(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_sparring_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_sparring_notifications_at(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_sparring_notifications() TO service_role;

-- Upserts by job name: re-running this migration never creates a second job.
SELECT cron.schedule(
  'sparring-notifications',
  '*/5 * * * *',
  $$SELECT public.process_sparring_notifications()$$
);
