-- Switch every notification call site to the i18n helpers (20261007120000).
-- Each function is patched in place from its live definition: an exact
-- snippet is replaced and the function re-created. A missing snippet aborts
-- the whole migration, so nothing is half-applied. German texts stay
-- byte-identical; English variants are added next to them.

CREATE OR REPLACE FUNCTION pg_temp.patch(p_fn regprocedure, p_old text, p_new text)
RETURNS void LANGUAGE plpgsql AS $f$
DECLARE
  d text := pg_get_functiondef(p_fn);
BEGIN
  IF position(p_old IN d) = 0 THEN
    RAISE EXCEPTION 'i18n patch: snippet not found in %: %', p_fn, left(p_old, 80);
  END IF;
  EXECUTE replace(d, p_old, p_new);
END;
$f$;

-- ── join_sparring ────────────────────────────────────────────────────────────
SELECT pg_temp.patch('public.join_sparring(uuid,smallint)', $o$    PERFORM notify_user(
      v_sp.created_by,
      'sparring_signup',
      'Neue Sparring-Anmeldung',
      COALESCE(v_name, 'Jemand') || ' hat sich für „' || COALESCE(v_sp.title, 'dein Sparring') || '“ angemeldet.',
      jsonb_build_object('sparring_id', p_sparring_id)
    );$o$, $n$    PERFORM notify_user_i18n(
      v_sp.created_by,
      'sparring_signup',
      'Neue Sparring-Anmeldung',
      COALESCE(v_name, 'Jemand') || ' hat sich für „' || COALESCE(v_sp.title, 'dein Sparring') || '“ angemeldet.',
      'New sparring sign-up',
      COALESCE(v_name, 'Someone') || ' signed up for “' || COALESCE(sparring_title_for(v_sp.title, 'en'), 'your sparring') || '”.',
      jsonb_build_object('sparring_id', p_sparring_id)
    );$n$);

-- ── trg_sparring_signup_legacy_notify ───────────────────────────────────────
SELECT pg_temp.patch('public.trg_sparring_signup_legacy_notify()', $o$PERFORM notify_user(
      v_sp.created_by,
      'sparring_signup',
      'Neue Sparring-Anmeldung',
      COALESCE(v_name, 'Jemand') || ' hat sich für „' || COALESCE(v_sp.title, 'dein Sparring') || '“ angemeldet.',
      jsonb_build_object('sparring_id', NEW.sparring_id)
    );$o$, $n$PERFORM notify_user_i18n(
      v_sp.created_by,
      'sparring_signup',
      'Neue Sparring-Anmeldung',
      COALESCE(v_name, 'Jemand') || ' hat sich für „' || COALESCE(v_sp.title, 'dein Sparring') || '“ angemeldet.',
      'New sparring sign-up',
      COALESCE(v_name, 'Someone') || ' signed up for “' || COALESCE(sparring_title_for(v_sp.title, 'en'), 'your sparring') || '”.',
      jsonb_build_object('sparring_id', NEW.sparring_id)
    );$n$);

-- ── cancel_sparring_signup ──────────────────────────────────────────────────
SELECT pg_temp.patch('public.cancel_sparring_signup(uuid)', $o$      PERFORM notify_user(
        v_sp.created_by,
        'sparring_signup_cancelled',
        'Teilnehmer abgemeldet',
        COALESCE(v_name, 'Jemand') || ' hat sich von „' || COALESCE(v_sp.title, 'deinem Sparring') || '“ abgemeldet.',
        jsonb_build_object('sparring_id', p_sparring_id)
      );$o$, $n$      PERFORM notify_user_i18n(
        v_sp.created_by,
        'sparring_signup_cancelled',
        'Teilnehmer abgemeldet',
        COALESCE(v_name, 'Jemand') || ' hat sich von „' || COALESCE(v_sp.title, 'deinem Sparring') || '“ abgemeldet.',
        'Participant withdrew',
        COALESCE(v_name, 'Someone') || ' withdrew from “' || COALESCE(sparring_title_for(v_sp.title, 'en'), 'your sparring') || '”.',
        jsonb_build_object('sparring_id', p_sparring_id)
      );$n$);

-- ── deactivate_sparring ─────────────────────────────────────────────────────
SELECT pg_temp.patch('public.deactivate_sparring(uuid)', $o$    PERFORM notify_user(
      r.user_id,
      'sparring_cancelled',
      'Sparring abgesagt',
      '"' || COALESCE(v_title, 'Ein Sparring') || '" wurde vom Organisator abgesagt.',
      jsonb_build_object('sparring_id', p_id)
    );$o$, $n$    PERFORM notify_user_i18n(
      r.user_id,
      'sparring_cancelled',
      'Sparring abgesagt',
      '"' || COALESCE(v_title, 'Ein Sparring') || '" wurde vom Organisator abgesagt.',
      'Sparring cancelled',
      '“' || COALESCE(sparring_title_for(v_title, 'en'), 'A sparring') || '” was cancelled by the organiser.',
      jsonb_build_object('sparring_id', p_id)
    );$n$);

-- ── deactivate_event ────────────────────────────────────────────────────────
SELECT pg_temp.patch('public.deactivate_event(uuid)', $o$    PERFORM notify_user(
      r.user_id,
      'event_cancelled',
      'Event abgesagt',
      '"' || COALESCE(v_title, 'Ein Event') || '" wurde vom Organisator abgesagt.',
      jsonb_build_object('event_id', p_event_id)
    );$o$, $n$    PERFORM notify_user_i18n(
      r.user_id,
      'event_cancelled',
      'Event abgesagt',
      '"' || COALESCE(v_title, 'Ein Event') || '" wurde vom Organisator abgesagt.',
      'Event cancelled',
      '"' || COALESCE(v_title, 'An event') || '" was cancelled by the organiser.',
      jsonb_build_object('event_id', p_event_id)
    );$n$);

-- ── notify_event_signup ─────────────────────────────────────────────────────
SELECT pg_temp.patch('public.notify_event_signup()', $o$  PERFORM notify_user(
    v_creator,
    'event_signup',
    'Neue Event-Anmeldung',
    v_name || ' hat sich für "' || COALESCE(v_title, 'dein Event') || '" angemeldet.',
    jsonb_build_object('event_id', NEW.event_id)
  );$o$, $n$  PERFORM notify_user_i18n(
    v_creator,
    'event_signup',
    'Neue Event-Anmeldung',
    v_name || ' hat sich für "' || COALESCE(v_title, 'dein Event') || '" angemeldet.',
    'New event sign-up',
    CASE WHEN v_name = 'Jemand' THEN 'Someone' ELSE v_name END
      || ' signed up for "' || COALESCE(v_title, 'your event') || '".',
    jsonb_build_object('event_id', NEW.event_id)
  );$n$);

-- ── notify_event_message (push only) ───────────────────────────────────────
SELECT pg_temp.patch('public.notify_event_message()', $o$    PERFORM send_push_notification(
      r.uid,
      COALESCE(v_title, 'Event-Chat'),
      v_body,
      jsonb_build_object('event_id', NEW.event_id, 'kind', 'event_message')
    );$o$, $n$    PERFORM push_i18n(
      r.uid,
      COALESCE(v_title, 'Event-Chat'),
      v_body,
      COALESCE(v_title, 'Event chat'),
      CASE WHEN v_sender = 'Jemand' THEN 'Someone' ELSE v_sender END || ': ' || left(NEW.body, 120),
      jsonb_build_object('event_id', NEW.event_id, 'kind', 'event_message')
    );$n$);

-- ── notify_sparring_group_message (push only) ──────────────────────────────
SELECT pg_temp.patch('public.notify_sparring_group_message()', $o$  v_body   text;
  r        record;$o$, $n$  v_body   text;
  v_body_en text;
  r        record;$n$);
SELECT pg_temp.patch('public.notify_sparring_group_message()', $o$  IF NEW.is_system THEN
    v_body := left(COALESCE(NEW.content, ''), 120);
  ELSIF NEW.content IS NOT NULL AND length(NEW.content) > 0 THEN
    v_body := COALESCE(v_sender, 'Jemand') || ': ' || left(NEW.content, 120);
  ELSE
    v_body := COALESCE(v_sender, 'Jemand') || ' hat ein Bild gesendet.';
  END IF;$o$, $n$  IF NEW.is_system THEN
    v_body := left(COALESCE(NEW.content, ''), 120);
    v_body_en := regexp_replace(regexp_replace(v_body,
      '^(.+) hat sich angemeldet$', '\1 signed up'), '^(.+) hat abgesagt$', '\1 cancelled');
  ELSIF NEW.content IS NOT NULL AND length(NEW.content) > 0 THEN
    v_body := COALESCE(v_sender, 'Jemand') || ': ' || left(NEW.content, 120);
    v_body_en := CASE WHEN COALESCE(v_sender, 'Jemand') = 'Jemand' THEN 'Someone' ELSE v_sender END
      || ': ' || left(NEW.content, 120);
  ELSE
    v_body := COALESCE(v_sender, 'Jemand') || ' hat ein Bild gesendet.';
    v_body_en := CASE WHEN COALESCE(v_sender, 'Jemand') = 'Jemand' THEN 'Someone' ELSE v_sender END
      || ' sent a photo.';
  END IF;$n$);
SELECT pg_temp.patch('public.notify_sparring_group_message()', $o$    PERFORM send_push_notification(
      r.uid,
      COALESCE(v_title, 'Sparring-Chat'),
      v_body,
      jsonb_build_object('sparring_id', NEW.sparring_id, 'kind', 'sparring_message')
    );$o$, $n$    PERFORM push_i18n(
      r.uid,
      COALESCE(v_title, 'Sparring-Chat'),
      v_body,
      COALESCE(sparring_title_for(v_title, 'en'), 'Sparring chat'),
      v_body_en,
      jsonb_build_object('sparring_id', NEW.sparring_id, 'kind', 'sparring_message')
    );$n$);

-- ── promote_sparring_waitlist ───────────────────────────────────────────────
SELECT pg_temp.patch('public.promote_sparring_waitlist(uuid)', $o$PERFORM notify_user(
      r.user_id,
      'sparring_waitlist_promoted',
      'Ein Platz ist frei geworden',$o$, $n$PERFORM notify_user_i18n(
      r.user_id,
      'sparring_waitlist_promoted',
      'Ein Platz ist frei geworden',$n$);
SELECT pg_temp.patch('public.promote_sparring_waitlist(uuid)', $o$               || ' Uhr in der App, sonst wird der Platz wieder freigegeben.'
           END,
      jsonb_build_object('sparring_id', p_sparring_id)$o$, $n$               || ' Uhr in der App, sonst wird der Platz wieder freigegeben.'
           END,
      'A spot opened up',
      'You''re now in “' || COALESCE(sparring_title_for(v_sp.title, 'en'), 'the sparring') || '”. '
        || CASE
             WHEN sparring_is_last_minute_slot(now(), v_sp.scheduled_at)
               THEN 'Please quickly confirm in the app that you''re coming.'
             ELSE 'Please confirm your attendance in the app by '
               || notif_time(v_sp.scheduled_at - sparring_confirm_deadline(), 'en', true)
               || ', otherwise the spot will be released.'
           END,
      jsonb_build_object('sparring_id', p_sparring_id)$n$);

-- ── update_sparring ─────────────────────────────────────────────────────────
SELECT pg_temp.patch('public.update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)',
$o$  v_body       text;
$o$, $n$  v_body       text;
  v_lines_en   text[] := '{}';
  v_intro_en   text;
  v_body_en    text;
$n$);
SELECT pg_temp.patch('public.update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)',
$o$    v_lines := v_lines || ('Neue Zeit: ' || sparring_format_berlin(p_scheduled_at)
      || ' (vorher ' || sparring_format_berlin(v_sp.scheduled_at) || ')');
$o$, $n$    v_lines := v_lines || ('Neue Zeit: ' || sparring_format_berlin(p_scheduled_at)
      || ' (vorher ' || sparring_format_berlin(v_sp.scheduled_at) || ')');
    v_lines_en := v_lines_en || ('New time: ' || sparring_format_berlin_en(p_scheduled_at)
      || ' (before ' || sparring_format_berlin_en(v_sp.scheduled_at) || ')');
$n$);
SELECT pg_temp.patch('public.update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)',
$o$    v_lines := v_lines || ('Neuer Ort: ' || v_address);
$o$, $n$    v_lines := v_lines || ('Neuer Ort: ' || v_address);
    v_lines_en := v_lines_en || ('New location: ' || v_address);
$n$);
SELECT pg_temp.patch('public.update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)',
$o$    v_lines := v_lines || ('Neue Dauer: ' || p_duration_min || ' Min. (vorher ' || v_sp.duration_min || ' Min.)');
$o$, $n$    v_lines := v_lines || ('Neue Dauer: ' || p_duration_min || ' Min. (vorher ' || v_sp.duration_min || ' Min.)');
    v_lines_en := v_lines_en || ('New duration: ' || p_duration_min || ' min (before ' || v_sp.duration_min || ' min)');
$n$);
SELECT pg_temp.patch('public.update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)',
$o$    v_lines := v_lines || ('Neue Disziplin: ' || v_discipline || ' (vorher ' || v_sp.discipline || ')');
$o$, $n$    v_lines := v_lines || ('Neue Disziplin: ' || v_discipline || ' (vorher ' || v_sp.discipline || ')');
    v_lines_en := v_lines_en || ('New discipline: ' || discipline_label(v_discipline, 'en')
      || ' (before ' || discipline_label(v_sp.discipline, 'en') || ')');
$n$);
SELECT pg_temp.patch('public.update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)',
$o$    || E'\n' || array_to_string(v_lines, E'\n');
$o$, $n$    || E'\n' || array_to_string(v_lines, E'\n');
  v_intro_en := '“' || sparring_title_for(CASE WHEN 'title' = ANY(v_changed) THEN v_title ELSE v_sp.title END, 'en')
    || '” was changed.' || E'\n' || array_to_string(v_lines_en, E'\n');
$n$);
SELECT pg_temp.patch('public.update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)',
$o$      v_body := v_intro || E'\n' || 'Du stehst weiterhin auf der Warteliste.';
$o$, $n$      v_body := v_intro || E'\n' || 'Du stehst weiterhin auf der Warteliste.';
      v_body_en := v_intro_en || E'\n' || 'You are still on the waiting list.';
$n$);
SELECT pg_temp.patch('public.update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)',
$o$      v_body := v_intro || E'\n' || 'Bitte bestätige den neuen Termin in der App';
$o$, $n$      v_body := v_intro || E'\n' || 'Bitte bestätige den neuen Termin in der App';
      v_body_en := v_intro_en || E'\n' || 'Please confirm the new date in the app';
$n$);
SELECT pg_temp.patch('public.update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)',
$o$          || ' Uhr freigegeben.';
      ELSE
        v_body := v_body || '.';
      END IF;$o$, $n$          || ' Uhr freigegeben.';
        v_body_en := v_body_en || ', otherwise your spot will be released on '
          || notif_time(p_scheduled_at - sparring_confirm_deadline(), 'en', true) || '.';
      ELSE
        v_body := v_body || '.';
        v_body_en := v_body_en || '.';
      END IF;$n$);
SELECT pg_temp.patch('public.update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)',
$o$    PERFORM sparring_notify_safe(
      r.user_id,
      'sparring_updated',
      'Sparring geändert',
      v_body,
$o$, $n$    PERFORM sparring_notify_safe_i18n(
      r.user_id,
      'sparring_updated',
      'Sparring geändert',
      v_body,
      'Sparring changed',
      v_body_en,
$n$);

-- ── process_sparring_lifecycle ──────────────────────────────────────────────
SELECT pg_temp.patch('public.process_sparring_lifecycle()', $o$  v_body text;
$o$, $n$  v_body text;
  v_body_en text;
$n$);
SELECT pg_temp.patch('public.process_sparring_lifecycle()', $o$      PERFORM sparring_notify_safe(
        r.user_id,
        'sparring_slot_expired',
        'Dein Platz wurde freigegeben',
        'Du hast deine Teilnahme an „' || COALESCE(r.title, 'dem Sparring') || '“ nicht bestätigt, '
          || 'deshalb wurde dein Platz freigegeben. Das zählt nicht gegen dich. '
          || 'Ist noch ein Platz frei, kannst du erneut zusagen.',
$o$, $n$      PERFORM sparring_notify_safe_i18n(
        r.user_id,
        'sparring_slot_expired',
        'Dein Platz wurde freigegeben',
        'Du hast deine Teilnahme an „' || COALESCE(r.title, 'dem Sparring') || '“ nicht bestätigt, '
          || 'deshalb wurde dein Platz freigegeben. Das zählt nicht gegen dich. '
          || 'Ist noch ein Platz frei, kannst du erneut zusagen.',
        'Your spot was released',
        'You didn''t confirm your attendance at “' || COALESCE(sparring_title_for(r.title, 'en'), 'the sparring') || '”, '
          || 'so your spot was released. This doesn''t count against you. '
          || 'If a spot is still free, you can sign up again.',
$n$);
SELECT pg_temp.patch('public.process_sparring_lifecycle()', $o$      PERFORM sparring_notify_safe(
        r.user_id,
        'sparring_confirm_7d',
        'Bist du weiterhin dabei?',
        '„' || COALESCE(r.title, 'Dein Sparring') || '“ ist am '
          || to_char(r.scheduled_at AT TIME ZONE 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || ' Uhr. '
          || 'Falls du nicht mehr kannst, sag bitte jetzt ab – dann kann jemand nachrücken.',
$o$, $n$      PERFORM sparring_notify_safe_i18n(
        r.user_id,
        'sparring_confirm_7d',
        'Bist du weiterhin dabei?',
        '„' || COALESCE(r.title, 'Dein Sparring') || '“ ist am '
          || to_char(r.scheduled_at AT TIME ZONE 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || ' Uhr. '
          || 'Falls du nicht mehr kannst, sag bitte jetzt ab – dann kann jemand nachrücken.',
        'Are you still in?',
        '“' || COALESCE(sparring_title_for(r.title, 'en'), 'Your sparring') || '” is on '
          || notif_time(r.scheduled_at, 'en', true) || '. '
          || 'If you can''t make it any more, please cancel now so someone else can move up.',
$n$);
SELECT pg_temp.patch('public.process_sparring_lifecycle()', $o$      || to_char(r.scheduled_at AT TIME ZONE 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || ' Uhr.';
    IF now() < r.scheduled_at - v_confirm - v_react$o$, $n$      || to_char(r.scheduled_at AT TIME ZONE 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || ' Uhr.';
    v_body_en := 'Please confirm your attendance at “' || COALESCE(sparring_title_for(r.title, 'en'), 'your sparring')
      || '” on ' || notif_time(r.scheduled_at, 'en', true) || '.';
    IF now() < r.scheduled_at - v_confirm - v_react$n$);
SELECT pg_temp.patch('public.process_sparring_lifecycle()', $o$        || ' Uhr freigegeben.';
    END IF;
    PERFORM sparring_notify_safe(
      r.user_id,
      'sparring_confirm_24h',
      'Bist du dabei?',
      v_body,
$o$, $n$        || ' Uhr freigegeben.';
      v_body_en := v_body_en || ' Without confirmation your spot will be released at '
        || notif_time(r.scheduled_at - v_confirm, 'en', false) || '.';
    END IF;
    PERFORM sparring_notify_safe_i18n(
      r.user_id,
      'sparring_confirm_24h',
      'Bist du dabei?',
      v_body,
      'Are you in?',
      v_body_en,
$n$);
SELECT pg_temp.patch('public.process_sparring_lifecycle()', $o$        || to_char(r.scheduled_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI') || ' Uhr.';
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
$o$, $n$        || to_char(r.scheduled_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI') || ' Uhr.';
      v_body_en := '“' || COALESCE(sparring_title_for(r.title, 'en'), 'Your sparring') || '” starts today at '
        || notif_time(r.scheduled_at, 'en', false) || '.';
      IF r.status = 'pending' THEN
        v_body := v_body || ' Bitte bestätige noch kurz, dass du kommst.';
        v_body_en := v_body_en || ' Please quickly confirm that you''re coming.';
      ELSE
        v_body := v_body || ' Falls du doch nicht kannst, sag bitte ab – die anderen rechnen mit dir.';
        v_body_en := v_body_en || ' If you can''t make it after all, please cancel – the others are counting on you.';
      END IF;
      PERFORM sparring_notify_safe_i18n(
        r.user_id,
        'sparring_reminder_3h',
        'Gleich geht''s los',
        v_body,
        'Starting soon',
        v_body_en,
$n$);
SELECT pg_temp.patch('public.process_sparring_lifecycle()', $o$      PERFORM sparring_notify_safe(
        r.created_by,
        'sparring_attendance_reminder',
        'Wer war dabei?',
        'Bitte erfasse die Anwesenheit für „' || COALESCE(r.title, 'dein Sparring') || '“. '
          || 'So bleibt die Zuverlässigkeit aller Teilnehmer fair.',
$o$, $n$      PERFORM sparring_notify_safe_i18n(
        r.created_by,
        'sparring_attendance_reminder',
        'Wer war dabei?',
        'Bitte erfasse die Anwesenheit für „' || COALESCE(r.title, 'dein Sparring') || '“. '
          || 'So bleibt die Zuverlässigkeit aller Teilnehmer fair.',
        'Who was there?',
        'Please record attendance for “' || COALESCE(sparring_title_for(r.title, 'en'), 'your sparring') || '”. '
          || 'This keeps everyone''s reliability fair.',
$n$);

-- ── sign_membership ─────────────────────────────────────────────────────────
SELECT pg_temp.patch('public.sign_membership(uuid)', $o$notify_studio_staff(
    v_plan.studio_id,
    'membership_requested',
    'Neue Mitgliedschaftsanfrage',
    v_name || ' möchte eine Mitgliedschaft (' || v_plan.name || ').',
$o$, $n$notify_studio_staff_i18n(
    v_plan.studio_id,
    'membership_requested',
    'Neue Mitgliedschaftsanfrage',
    v_name || ' möchte eine Mitgliedschaft (' || v_plan.name || ').',
    'New membership request',
    v_name || ' would like a membership (' || v_plan.name || ').',
$n$);

-- ── request_studio_join ─────────────────────────────────────────────────────
SELECT pg_temp.patch('public.request_studio_join(uuid)', $o$notify_studio_staff(
    p_studio_id, 'studio_join_request', 'Neue Beitrittsanfrage',
    v_requester || ' möchte deinem Team beitreten.',
$o$, $n$notify_studio_staff_i18n(
    p_studio_id, 'studio_join_request', 'Neue Beitrittsanfrage',
    v_requester || ' möchte deinem Team beitreten.',
    'New join request',
    v_requester || ' would like to join your team.',
$n$);

-- ── respond_studio_join ─────────────────────────────────────────────────────
SELECT pg_temp.patch('public.respond_studio_join(uuid,boolean)', $o$notify_user(
    v_user_id, 'studio_join_response',
    CASE WHEN p_approve THEN 'Beitritt bestätigt' ELSE 'Beitritt abgelehnt' END,
    CASE WHEN p_approve THEN 'Du bist jetzt Mitglied bei ' || v_studio_nm || '.'
         ELSE 'Deine Beitrittsanfrage bei ' || v_studio_nm || ' wurde abgelehnt.' END,
$o$, $n$notify_user_i18n(
    v_user_id, 'studio_join_response',
    CASE WHEN p_approve THEN 'Beitritt bestätigt' ELSE 'Beitritt abgelehnt' END,
    CASE WHEN p_approve THEN 'Du bist jetzt Mitglied bei ' || v_studio_nm || '.'
         ELSE 'Deine Beitrittsanfrage bei ' || v_studio_nm || ' wurde abgelehnt.' END,
    CASE WHEN p_approve THEN 'Join confirmed' ELSE 'Join declined' END,
    CASE WHEN p_approve THEN 'You are now a member of ' || v_studio_nm || '.'
         ELSE 'Your join request at ' || v_studio_nm || ' was declined.' END,
$n$);

-- ── respond_membership_request ──────────────────────────────────────────────
SELECT pg_temp.patch('public.respond_membership_request(uuid,boolean)', $o$notify_user(
      v_user_id,
      'membership_confirmed',
      'Mitgliedschaft bestätigt',
      'Deine Mitgliedschaft bei ' || COALESCE(v_studio_name, 'dem Studio') || ' ist aktiv.',
$o$, $n$notify_user_i18n(
      v_user_id,
      'membership_confirmed',
      'Mitgliedschaft bestätigt',
      'Deine Mitgliedschaft bei ' || COALESCE(v_studio_name, 'dem Studio') || ' ist aktiv.',
      'Membership confirmed',
      'Your membership at ' || COALESCE(v_studio_name, 'the studio') || ' is active.',
$n$);
SELECT pg_temp.patch('public.respond_membership_request(uuid,boolean)', $o$notify_user(
      v_user_id,
      'membership_declined',
      'Mitgliedschaftsanfrage abgelehnt',
      'Deine Mitgliedschaftsanfrage bei ' || COALESCE(v_studio_name, 'dem Studio') || ' wurde leider abgelehnt.',
$o$, $n$notify_user_i18n(
      v_user_id,
      'membership_declined',
      'Mitgliedschaftsanfrage abgelehnt',
      'Deine Mitgliedschaftsanfrage bei ' || COALESCE(v_studio_name, 'dem Studio') || ' wurde leider abgelehnt.',
      'Membership request declined',
      'Unfortunately your membership request at ' || COALESCE(v_studio_name, 'the studio') || ' was declined.',
$n$);

-- ── request_membership_cancellation ─────────────────────────────────────────
SELECT pg_temp.patch('public.request_membership_cancellation(uuid)', $o$notify_studio_staff(
    v_studio_id,
    'cancellation_requested',
    'Kündigung eingegangen',
    v_name || ' hat die Mitgliedschaft gekündigt.',
$o$, $n$notify_studio_staff_i18n(
    v_studio_id,
    'cancellation_requested',
    'Kündigung eingegangen',
    v_name || ' hat die Mitgliedschaft gekündigt.',
    'Cancellation received',
    v_name || ' cancelled the membership.',
$n$);

-- ── confirm_membership_end ──────────────────────────────────────────────────
SELECT pg_temp.patch('public.confirm_membership_end(uuid)', $o$  PERFORM notify_user(
    v_user_id,
    'membership_ended',
    'Mitgliedschaft beendet',
    'Deine Mitgliedschaft bei ' || COALESCE(v_studio_name, 'dem Studio') || ' wurde beendet.',
$o$, $n$  PERFORM notify_user_i18n(
    v_user_id,
    'membership_ended',
    'Mitgliedschaft beendet',
    'Deine Mitgliedschaft bei ' || COALESCE(v_studio_name, 'dem Studio') || ' wurde beendet.',
    'Membership ended',
    'Your membership at ' || COALESCE(v_studio_name, 'the studio') || ' has ended.',
$n$);
