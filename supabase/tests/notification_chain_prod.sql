-- Snapshot of the production notification chain (pg_get_functiondef, 2026-10-09).
-- Loaded by run_sparring_notifications.sh so the job is tested against the real send path.

CREATE OR REPLACE FUNCTION public.discipline_label(p_value text, p_lang text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_lang <> 'en' OR p_value IS NULL THEN p_value
    ELSE COALESCE((
      SELECT m.en FROM (VALUES
        ('Boxen', 'Boxing'), ('Kickboxen', 'Kickboxing'), ('K1 / Kickboxen', 'K1 / Kickboxing'),
        ('Ringen', 'Wrestling'), ('Sonstiges', 'Other')
      ) AS m(de, en) WHERE m.de = p_value), p_value)
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.notif_time(p_ts timestamp with time zone, p_lang text, p_with_date boolean)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_lang = 'en' AND p_with_date THEN to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'DD/MM "at" HH24:MI')
    WHEN p_lang = 'en'                 THEN to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
    WHEN p_with_date                   THEN to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || ' Uhr'
    ELSE                                    to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'HH24:MI') || ' Uhr'
  END;
$function$
;

CREATE OR REPLACE FUNCTION public.notification_lang(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT language FROM profiles WHERE id = p_user_id), 'de');
$function$
;

CREATE OR REPLACE FUNCTION public.notify_user(p_user_id uuid, p_type text, p_title text, p_body text, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, COALESCE(p_data, '{}'::jsonb));

  PERFORM send_push_notification(p_user_id, p_title, p_body, p_data);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_user_i18n(p_user_id uuid, p_type text, p_title_de text, p_body_de text, p_title_en text, p_body_en text, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_en boolean := notification_lang(p_user_id) = 'en'
                  AND NULLIF(p_title_en, '') IS NOT NULL AND NULLIF(p_body_en, '') IS NOT NULL;
BEGIN
  PERFORM notify_user(
    p_user_id, p_type,
    CASE WHEN v_en THEN p_title_en ELSE p_title_de END,
    CASE WHEN v_en THEN p_body_en ELSE p_body_de END,
    p_data);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_push_notification(p_user_id uuid, p_title text, p_body text, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
  v_badge int;
BEGIN
  SELECT expo_push_token INTO v_token
  FROM profiles
  WHERE id = p_user_id;

  IF v_token IS NULL THEN
    RETURN;
  END IF;

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
  NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sparring_end_at(p_scheduled_at timestamp with time zone, p_duration_min integer)
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT p_scheduled_at + make_interval(mins => COALESCE(p_duration_min, 90))
$function$
;

CREATE OR REPLACE FUNCTION public.sparring_is_cancelled(p_is_active boolean, p_deactivated_at timestamp with time zone, p_end_at timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT NOT p_is_active AND (p_deactivated_at IS NULL OR p_deactivated_at < p_end_at)
$function$
;

CREATE OR REPLACE FUNCTION public.sparring_notify_safe_i18n(p_user_id uuid, p_type text, p_title_de text, p_body_de text, p_title_en text, p_body_en text, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM notify_user_i18n(p_user_id, p_type, p_title_de, p_body_de, p_title_en, p_body_en, p_data);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sparring lifecycle: % for % failed: %', p_type, p_user_id, SQLERRM;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sparring_title_for(p_title text, p_lang text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_disc text;
BEGIN
  IF p_lang <> 'en' OR p_title IS NULL OR p_title !~ ' – Sparring$' THEN
    RETURN p_title;
  END IF;
  v_disc := regexp_replace(p_title, ' – Sparring$', '');
  IF v_disc = 'Sonstiges' THEN RETURN 'Sparring'; END IF;
  IF v_disc IN ('Boxen','Kickboxen','K1 / Kickboxen','Ringen','BJJ','MMA','Muay Thai','Wrestling') THEN
    RETURN discipline_label(v_disc, p_lang) || ' – Sparring';
  END IF;
  RETURN p_title;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sparring_trust_feedback_window()
 RETURNS interval
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ SELECT interval '72 hours' $function$
;

CREATE OR REPLACE FUNCTION public.trg_open_sparring_rescheduled()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
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
$function$
;