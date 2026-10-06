-- Scenario tests for update_sparring (spec 2026-09-27-sparring-edit-design.md, section 8).
-- Run via supabase/tests/run_sparring_edit.sh against a throwaway local DB.
-- Every scenario raises on failure (ASSERT) and prints "ok ..." on success.

\set ON_ERROR_STOP 1
SET client_min_messages = notice;

-- ── Fixtures ────────────────────────────────────────────────────────────────────

INSERT INTO profiles (id, name, expo_push_token) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Olli Organisator', 'tok-o'),
  ('00000000-0000-0000-0000-00000000000b', 'Anna',             'tok-a'),
  ('00000000-0000-0000-0000-00000000000c', 'Ben',              'tok-b'),
  ('00000000-0000-0000-0000-00000000000d', 'Cem',              'tok-c'),
  ('00000000-0000-0000-0000-00000000000e', 'Xaver Fremd',      'tok-x');

CREATE FUNCTION t_as(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), false)
$$;

CREATE FUNCTION t_org() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-00000000000a'::uuid $$;
CREATE FUNCTION t_a()   RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-00000000000b'::uuid $$;
CREATE FUNCTION t_b()   RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-00000000000c'::uuid $$;
CREATE FUNCTION t_c()   RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-00000000000d'::uuid $$;
CREATE FUNCTION t_x()   RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-00000000000e'::uuid $$;

CREATE FUNCTION t_sparring(p_in interval, p_slots integer DEFAULT 10, p_studio uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO open_sparrings (created_by, title, discipline, address, lat, lng,
                              scheduled_at, duration_min, max_slots, studio_id, is_at_studio)
  VALUES (t_org(), 'Freitagssparring', 'Boxen', 'Hauptstr. 1, 28195 Bremen', 53.08, 8.80,
          date_trunc('minute', now() + p_in), 90, p_slots, p_studio, p_studio IS NOT NULL)
  RETURNING id INTO v_id;
  INSERT INTO sparring_chat_settings (sparring_id) VALUES (v_id);
  RETURN v_id;
END $$;

-- Signup that has existed for a day (so it predates any edit in the test).
CREATE FUNCTION t_signup(p_sp uuid, p_uid uuid, p_status text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO sparring_signups (sparring_id, user_id, signed_up_at, rules_version, rules_accepted_at,
                                status, slot_granted_at, confirmed_at)
  VALUES (p_sp, p_uid, now() - interval '1 day', 1, now() - interval '1 day', p_status,
          CASE WHEN p_status IN ('pending','confirmed') THEN now() - interval '1 day' END,
          CASE WHEN p_status = 'confirmed' THEN now() - interval '12 hours' END)
$$;

-- Calls update_sparring with the current row, overridden by p_o.
CREATE FUNCTION t_edit(p_sp uuid, p_o jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE s open_sparrings%ROWTYPE;
BEGIN
  SELECT * INTO s FROM open_sparrings WHERE id = p_sp;
  RETURN update_sparring(
    p_sp,
    COALESCE(p_o->>'title', s.title),
    CASE WHEN p_o ? 'notes' THEN p_o->>'notes' ELSE s.notes END,
    COALESCE(p_o->>'discipline', s.discipline),
    COALESCE(p_o->>'address', s.address),
    CASE WHEN p_o ? 'lat' THEN (p_o->>'lat')::double precision ELSE s.lat END,
    CASE WHEN p_o ? 'lng' THEN (p_o->>'lng')::double precision ELSE s.lng END,
    COALESCE((p_o->>'scheduled_at')::timestamptz, s.scheduled_at),
    COALESCE((p_o->>'duration_min')::integer, s.duration_min),
    COALESCE((p_o->>'max_slots')::integer, s.max_slots),
    COALESCE((p_o->>'verified_only')::boolean, s.verified_only)
  );
END $$;

CREATE FUNCTION t_status(p_sp uuid, p_uid uuid) RETURNS text LANGUAGE sql AS $$
  SELECT status FROM sparring_signups WHERE sparring_id = p_sp AND user_id = p_uid
$$;

CREATE FUNCTION t_notes(p_sp uuid, p_type text, p_uid uuid DEFAULT NULL) RETURNS integer LANGUAGE sql AS $$
  SELECT count(*)::int FROM notifications
   WHERE data->>'sparring_id' = p_sp::text AND type = p_type
     AND (p_uid IS NULL OR user_id = p_uid)
$$;

CREATE FUNCTION t_body(p_sp uuid, p_type text, p_uid uuid) RETURNS text LANGUAGE sql AS $$
  SELECT body FROM notifications
   WHERE data->>'sparring_id' = p_sp::text AND type = p_type AND user_id = p_uid
   ORDER BY created_at DESC LIMIT 1
$$;

-- "Time passes": move every timestamp of one sparring into the past.
CREATE FUNCTION t_shift(p_sp uuid, p_by interval) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  SET LOCAL session_replication_role = replica;   -- no reschedule trigger
  UPDATE open_sparrings
     SET scheduled_at = scheduled_at - p_by,
         edited_at = edited_at - p_by,
         material_changed_at = material_changed_at - p_by
   WHERE id = p_sp;
  UPDATE sparring_signups
     SET signed_up_at = signed_up_at - p_by,
         rules_accepted_at = rules_accepted_at - p_by,
         slot_granted_at = slot_granted_at - p_by,
         confirmed_at = confirmed_at - p_by,
         reminder_7d_sent_at = reminder_7d_sent_at - p_by,
         reminder_24h_sent_at = reminder_24h_sent_at - p_by,
         reminder_3h_sent_at = reminder_3h_sent_at - p_by
   WHERE sparring_id = p_sp;
  SET LOCAL session_replication_role = origin;
END $$;

-- ── F. German Berlin date label ─────────────────────────────────────────────────
DO $$ BEGIN
  ASSERT sparring_format_berlin('2026-10-12 12:00+00') = 'Mo 12.10., 14:00', 'summer time label';
  ASSERT sparring_format_berlin('2026-12-05 17:00+00') = 'Sa 05.12., 18:00', 'winter time label';
  RAISE NOTICE 'ok F  Datum Europe/Berlin, deutsches Format';
END $$;

-- ── 1. Time change with confirmed participants ──────────────────────────────────
DO $$
DECLARE sp uuid; res jsonb; old_at timestamptz; new_at timestamptz; body text; msgs int;
BEGIN
  sp := t_sparring(interval '3 days', 2);
  PERFORM t_signup(sp, t_a(), 'confirmed');
  PERFORM t_signup(sp, t_b(), 'pending');
  PERFORM t_signup(sp, t_c(), 'waitlisted');
  SELECT scheduled_at INTO old_at FROM open_sparrings WHERE id = sp;
  new_at := old_at + interval '1 day 2 hours';

  SELECT count(*) INTO msgs FROM sparring_group_messages WHERE sparring_id = sp;
  PERFORM t_as(t_org());
  res := t_edit(sp, jsonb_build_object('scheduled_at', new_at));

  ASSERT (res->>'material')::boolean, 'material flag';
  ASSERT (res->>'notified')::int = 3, format('notified %s', res->>'notified');
  ASSERT res->'changed_fields' = '["scheduled_at"]'::jsonb, format('changed %s', res->'changed_fields');
  ASSERT t_status(sp, t_a()) = 'pending', 'confirmed -> pending';
  ASSERT (SELECT confirmed_at IS NULL FROM sparring_signups WHERE sparring_id = sp AND user_id = t_a()), 'confirmed_at cleared';
  ASSERT t_status(sp, t_b()) = 'pending', 'pending stays pending';
  ASSERT t_status(sp, t_c()) = 'waitlisted', 'waitlist untouched';
  ASSERT t_notes(sp, 'sparring_updated', t_a()) = 1 AND t_notes(sp, 'sparring_updated', t_b()) = 1
     AND t_notes(sp, 'sparring_updated', t_c()) = 1 AND t_notes(sp, 'sparring_updated', t_org()) = 0,
     'one notice per participant, none for the organizer';
  body := t_body(sp, 'sparring_updated', t_a());
  ASSERT body LIKE '%Neue Zeit: ' || sparring_format_berlin(new_at) || ' (vorher ' || sparring_format_berlin(old_at) || ')%', body;
  ASSERT body LIKE '%Bitte bestätige den neuen Termin%', body;
  ASSERT t_body(sp, 'sparring_updated', t_c()) LIKE '%weiterhin auf der Warteliste%', 'waitlist wording';
  ASSERT (SELECT data->'changed_fields' FROM notifications WHERE type = 'sparring_updated' AND user_id = t_a() AND data->>'sparring_id' = sp::text) = '["scheduled_at"]'::jsonb, 'data.changed_fields';
  ASSERT (SELECT material_changed_at IS NOT NULL AND edited_at IS NOT NULL FROM open_sparrings WHERE id = sp), 'timestamps set';
  -- Before the 24h window: the regular 24h ask stays due, so step C cannot use an old ask.
  ASSERT (SELECT bool_and(reminder_24h_sent_at IS NULL) FROM sparring_signups WHERE sparring_id = sp AND status = 'pending'), '24h ask reset';
  ASSERT (SELECT count(*) FROM test_push_log WHERE payload->>'body' LIKE '%wurde geändert%' AND payload->>'to' = 'tok-a') = 1, 'exactly one push to A';
  ASSERT (SELECT count(*) FROM sparring_group_messages WHERE sparring_id = sp) = msgs, 'no chat system message from the edit';
  RAISE NOTICE 'ok 1  Zeit ändern mit confirmed-Teilnehmern';
END $$;

-- ── 2. Material change 2h before the start ──────────────────────────────────────
DO $$
DECLARE sp uuid; res jsonb; body text; r jsonb;
BEGIN
  sp := t_sparring(interval '2 hours');
  PERFORM t_signup(sp, t_a(), 'confirmed');
  PERFORM t_signup(sp, t_b(), 'confirmed');
  PERFORM t_as(t_org());
  res := t_edit(sp, jsonb_build_object('address', 'Weserstr. 9, 28199 Bremen', 'lat', 53.07, 'lng', 8.79));
  ASSERT res->'changed_fields' = '["location"]'::jsonb, res::text;
  ASSERT t_status(sp, t_a()) = 'pending', 'reset to pending';
  body := t_body(sp, 'sparring_updated', t_a());
  ASSERT body LIKE '%Neuer Ort: Weserstr. 9, 28199 Bremen%', body;
  ASSERT body NOT LIKE '%freigegeben%', 'no expiry announced without reaction time';

  r := process_sparring_lifecycle();
  ASSERT t_status(sp, t_a()) = 'pending' AND t_status(sp, t_b()) = 'pending', format('nobody expires: %s', r);

  PERFORM t_as(t_a());
  ASSERT cancel_sparring_signup(sp) = 'cancelled', 'penalty-free cancel after change';
  RAISE NOTICE 'ok 2  Änderung 2h vor Start: kein Verfall, straffreie Absage';
END $$;

-- ── 3. max_slots below the commitments ──────────────────────────────────────────
DO $$
DECLARE sp uuid; failed boolean := false; msg text;
BEGIN
  sp := t_sparring(interval '3 days', 3);
  PERFORM t_signup(sp, t_a(), 'pending');
  PERFORM t_signup(sp, t_b(), 'confirmed');
  PERFORM t_as(t_org());
  BEGIN
    PERFORM t_edit(sp, '{"max_slots": 1}');
  EXCEPTION WHEN OTHERS THEN failed := true; msg := SQLERRM;
  END;
  ASSERT failed AND msg LIKE '%bereits 2 Personen zugesagt%', coalesce(msg, 'no error');
  ASSERT (SELECT max_slots FROM open_sparrings WHERE id = sp) = 3, 'unchanged';
  PERFORM t_edit(sp, '{"max_slots": 2}');
  ASSERT (SELECT max_slots FROM open_sparrings WHERE id = sp) = 2, 'down to the commitments is fine';
  RAISE NOTICE 'ok 3  max_slots unter Zusagen abgelehnt';
END $$;

-- ── 4. Raise max_slots with a waitlist ──────────────────────────────────────────
DO $$
DECLARE sp uuid; res jsonb;
BEGIN
  sp := t_sparring(interval '3 days', 1);
  PERFORM t_signup(sp, t_a(), 'pending');
  PERFORM t_signup(sp, t_b(), 'waitlisted');
  PERFORM t_as(t_org());
  res := t_edit(sp, '{"max_slots": 2}');
  ASSERT NOT (res->>'material')::boolean, 'small change';
  ASSERT t_status(sp, t_b()) = 'pending', 'waitlist moved up';
  ASSERT t_notes(sp, 'sparring_waitlist_promoted', t_b()) = 1, 'promotion notice';
  ASSERT t_notes(sp, 'sparring_updated') = 0, 'no change notice';
  RAISE NOTICE 'ok 4  max_slots erhöhen: Warteliste rückt nach';
END $$;

-- ── 5. Stranger and anon ────────────────────────────────────────────────────────
DO $$
DECLARE sp uuid; failed boolean := false; msg text;
BEGIN
  sp := t_sparring(interval '3 days');
  PERFORM t_as(t_x());
  BEGIN
    PERFORM t_edit(sp, '{"title": "Gekapert"}');
  EXCEPTION WHEN OTHERS THEN failed := true; msg := SQLERRM;
  END;
  ASSERT failed AND msg LIKE '%keine Berechtigung%', coalesce(msg, 'no error');
  ASSERT (SELECT title FROM open_sparrings WHERE id = sp) = 'Freitagssparring', 'unchanged';
  RAISE NOTICE 'ok 5a Fremder User: abgelehnt';
END $$;

DO $$ BEGIN
  ASSERT NOT has_function_privilege('anon',
    'update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)', 'EXECUTE'),
    'anon must not execute';
  ASSERT has_function_privilege('authenticated',
    'update_sparring(uuid,text,text,text,text,double precision,double precision,timestamptz,integer,integer,boolean)', 'EXECUTE'),
    'authenticated executes';
  ASSERT NOT has_function_privilege('authenticated', 'sparring_format_berlin(timestamptz)', 'EXECUTE'), 'helper revoked';
  RAISE NOTICE 'ok 5b anon ohne Ausführungsrecht';
END $$;

-- ── 6. Inactive, started, new time in the past ──────────────────────────────────
DO $$
DECLARE sp uuid; failed boolean; msg text;
BEGIN
  PERFORM t_as(t_org());

  sp := t_sparring(interval '3 days');
  PERFORM deactivate_sparring(sp);
  failed := false;
  BEGIN PERFORM t_edit(sp, '{"title": "Neu"}'); EXCEPTION WHEN OTHERS THEN failed := true; msg := SQLERRM; END;
  ASSERT failed AND msg LIKE '%nicht mehr bearbeitet%', coalesce(msg, 'inactive accepted');

  sp := t_sparring(interval '-1 hour');
  failed := false;
  BEGIN PERFORM t_edit(sp, '{"title": "Neu"}'); EXCEPTION WHEN OTHERS THEN failed := true; msg := SQLERRM; END;
  ASSERT failed AND msg LIKE '%nicht mehr bearbeitet%', coalesce(msg, 'started accepted');

  sp := t_sparring(interval '3 days');
  failed := false;
  BEGIN PERFORM t_edit(sp, jsonb_build_object('scheduled_at', now() - interval '1 hour')); EXCEPTION WHEN OTHERS THEN failed := true; msg := SQLERRM; END;
  ASSERT failed AND msg LIKE '%in der Zukunft%', coalesce(msg, 'past time accepted');

  failed := false;
  BEGIN PERFORM t_edit(sp, '{"duration_min": 601}'); EXCEPTION WHEN OTHERS THEN failed := true; msg := SQLERRM; END;
  ASSERT failed AND msg LIKE '%600 Minuten%', coalesce(msg, 'duration accepted');

  sp := t_sparring(interval '3 days', 10, gen_random_uuid());
  failed := false;
  BEGIN PERFORM t_edit(sp, '{"address": "Anderswo 1"}'); EXCEPTION WHEN OTHERS THEN failed := true; msg := SQLERRM; END;
  ASSERT failed AND msg LIKE '%Studio-Sparrings%', coalesce(msg, 'studio location changed');
  PERFORM t_edit(sp, '{"discipline": "MMA"}');   -- everything else stays editable

  failed := false;
  BEGIN PERFORM t_edit(t_sparring(interval '3 days'), '{"title": "verbotenwort"}'); EXCEPTION WHEN OTHERS THEN failed := true; msg := SQLERRM; END;
  ASSERT failed AND msg LIKE '%CONTENT_FILTER_BLOCKED%', coalesce(msg, 'filter bypassed');
  RAISE NOTICE 'ok 6  inaktiv / begonnen / Vergangenheit / Dauer / Studio-Ort / Wortfilter';
END $$;

-- ── 7. Title only: no notification ──────────────────────────────────────────────
DO $$
DECLARE sp uuid; res jsonb; pushes_before int;
BEGIN
  sp := t_sparring(interval '3 days');
  PERFORM t_signup(sp, t_a(), 'confirmed');
  SELECT count(*) INTO pushes_before FROM test_push_log;
  PERFORM t_as(t_org());
  res := t_edit(sp, '{"title": "Samstagssparring", "notes": "Bitte Handschuhe mitbringen", "verified_only": true}');
  ASSERT NOT (res->>'material')::boolean AND (res->>'notified')::int = 0, res::text;
  ASSERT t_status(sp, t_a()) = 'confirmed', 'status untouched';
  ASSERT t_notes(sp, 'sparring_updated') = 0, 'no notice';
  ASSERT (SELECT count(*) FROM test_push_log) = pushes_before, 'no push';
  ASSERT (SELECT edited_at IS NOT NULL AND material_changed_at IS NULL AND title = 'Samstagssparring'
            FROM open_sparrings WHERE id = sp), 'edited_at only';
  res := t_edit(sp, '{}');
  ASSERT res->'changed_fields' = '[]'::jsonb, 'no-op save';
  RAISE NOTICE 'ok 7  nur Titel/Notiz/verified_only: keine Push, "Bearbeitet"';
END $$;

-- ── 8. Several material fields at once: exactly one notice per person ───────────
DO $$
DECLARE sp uuid; res jsonb; body text;
BEGIN
  sp := t_sparring(interval '3 days');
  PERFORM t_signup(sp, t_a(), 'confirmed');
  PERFORM t_signup(sp, t_b(), 'pending');
  PERFORM t_as(t_org());
  res := t_edit(sp, jsonb_build_object(
    'scheduled_at', now() + interval '4 days', 'address', 'Neuer Weg 2, 28195 Bremen',
    'duration_min', 120, 'discipline', 'MMA', 'title', 'MMA-Abend'));
  ASSERT (res->>'notified')::int = 2, res::text;
  ASSERT t_notes(sp, 'sparring_updated', t_a()) = 1 AND t_notes(sp, 'sparring_updated', t_b()) = 1, 'one each';
  ASSERT (SELECT count(*) FROM test_push_log WHERE payload->>'to' = 'tok-a' AND payload->>'body' LIKE '„MMA-Abend“ wurde geändert%') = 1, 'one push each';
  body := t_body(sp, 'sparring_updated', t_a());
  ASSERT body LIKE '%Neue Zeit:%' AND body LIKE '%Neuer Ort: Neuer Weg 2%'
     AND body LIKE '%Neue Dauer: 120 Min. (vorher 90 Min.)%' AND body LIKE '%Neue Disziplin: MMA (vorher Boxen)%', body;
  RAISE NOTICE 'ok 8  mehrere Felder: genau eine Nachricht pro Person';
END $$;

-- ── 9. Penalty-free cancel after a change (inside the cancel deadline) ──────────
DO $$
DECLARE sp uuid; ctrl uuid;
BEGIN
  -- Control: without a change, cancelling a confirmed slot 5h before is late.
  ctrl := t_sparring(interval '5 hours');
  PERFORM t_signup(ctrl, t_a(), 'confirmed');
  PERFORM t_as(t_a());
  ASSERT cancel_sparring_signup(ctrl) = 'cancelled_late', 'control case';

  sp := t_sparring(interval '5 hours');
  PERFORM t_signup(sp, t_a(), 'confirmed');
  PERFORM t_signup(sp, t_b(), 'confirmed');
  PERFORM t_as(t_org());
  PERFORM t_edit(sp, jsonb_build_object('scheduled_at', now() + interval '5 hours 30 minutes'));

  PERFORM t_as(t_a());
  ASSERT cancel_sparring_signup(sp) = 'cancelled', 'not re-confirmed: no consequence';

  PERFORM t_as(t_b());
  PERFORM confirm_sparring(sp);
  ASSERT t_status(sp, t_b()) = 'confirmed', 're-confirmed';
  ASSERT cancel_sparring_signup(sp) = 'cancelled_late', 're-confirmed then late: normal rule';
  RAISE NOTICE 'ok 9  straffreie Absage nach Änderung, nach Neubestätigung normale Regel';
END $$;

-- ── 10. Direct client UPDATEs ───────────────────────────────────────────────────
DO $$
DECLARE sp uuid; boosted uuid; denied int := 0;
BEGIN
  sp := t_sparring(interval '3 days');
  boosted := t_sparring(interval '3 days');
  UPDATE open_sparrings SET is_featured = true WHERE id = boosted;

  PERFORM t_as(t_org());
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE open_sparrings SET scheduled_at = scheduled_at + interval '1 day' WHERE id = sp;
  EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
  BEGIN UPDATE open_sparrings SET max_slots = 1 WHERE id = sp;
  EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
  BEGIN UPDATE open_sparrings SET is_active = false WHERE id = boosted;
  EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
  RESET ROLE;
  ASSERT denied = 3, format('denied %s of 3', denied);

  -- The supported paths still work for the creator, boosted sparrings included.
  PERFORM t_edit(boosted, '{"title": "Geboostet und bearbeitet"}');
  PERFORM deactivate_sparring(boosted);
  ASSERT (SELECT title = 'Geboostet und bearbeitet' AND NOT is_active FROM open_sparrings WHERE id = boosted), 'rpc paths';
  ASSERT (SELECT is_active AND max_slots = 10 FROM open_sparrings WHERE id = sp), 'untouched';
  RAISE NOTICE 'ok 10 direkte UPDATEs gesperrt, RPCs funktionieren (auch geboostet)';
END $$;

-- ── 11. Cron expiry after a change inside the 24h window ────────────────────────
DO $$
DECLARE sp uuid; late uuid; body text;
BEGIN
  -- Enough reaction time: the change notice is the ask, expiry at the deadline.
  sp := t_sparring(interval '12 hours');
  PERFORM t_signup(sp, t_a(), 'confirmed');
  PERFORM t_as(t_org());
  PERFORM t_edit(sp, '{"discipline": "BJJ"}');
  ASSERT (SELECT reminder_24h_sent_at IS NOT NULL FROM sparring_signups WHERE sparring_id = sp AND user_id = t_a()), 'notice counts as ask';
  body := t_body(sp, 'sparring_updated', t_a());
  ASSERT body LIKE '%sonst wird dein Platz am % Uhr freigegeben.', body;

  PERFORM process_sparring_lifecycle();
  ASSERT t_status(sp, t_a()) = 'pending', 'not before the deadline';
  PERFORM t_shift(sp, interval '7 hours');            -- now 5h before the start
  PERFORM process_sparring_lifecycle();
  ASSERT t_status(sp, t_a()) = 'expired', 'expires at the deadline';

  -- Too little reaction time: never expires.
  late := t_sparring(interval '7 hours');
  PERFORM t_signup(late, t_a(), 'confirmed');
  PERFORM t_as(t_org());
  PERFORM t_edit(late, '{"duration_min": 60}');
  ASSERT t_body(late, 'sparring_updated', t_a()) NOT LIKE '%freigegeben%', 'no expiry announced';
  PERFORM t_shift(late, interval '3 hours');          -- now 4h before the start
  PERFORM process_sparring_lifecycle();
  ASSERT t_status(late, t_a()) = 'pending', 'no expiry without reaction time';

  -- An ask sent BEFORE the change never counts (flag is overwritten).
  late := t_sparring(interval '20 hours');
  PERFORM t_signup(late, t_b(), 'pending');
  UPDATE sparring_signups SET reminder_24h_sent_at = now() - interval '3 hours'
   WHERE sparring_id = late AND user_id = t_b();
  PERFORM t_shift(late, interval '13 hours');         -- 7h before; old ask 23h before the start
  PERFORM t_as(t_org());
  PERFORM t_edit(late, '{"discipline": "Ringen"}');   -- change 7h before: under 2h until the deadline
  PERFORM t_shift(late, interval '3 hours');          -- 4h before: past the confirm deadline
  PERFORM process_sparring_lifecycle();
  ASSERT t_status(late, t_b()) = 'pending', 'old ask must not expire the slot';
  RAISE NOTICE 'ok 11 Cron-Verfall nur mit Reaktionszeit nach der Änderung';
END $$;

-- ── 12. Waitlist promoted in the same save as a material change ─────────────────
DO $$
DECLARE sp uuid;
BEGIN
  sp := t_sparring(interval '3 days', 1);
  PERFORM t_signup(sp, t_a(), 'confirmed');
  PERFORM t_signup(sp, t_b(), 'waitlisted');
  PERFORM t_as(t_org());
  PERFORM t_edit(sp, jsonb_build_object('max_slots', 2, 'duration_min', 60));
  ASSERT t_status(sp, t_b()) = 'pending', 'promoted';
  ASSERT t_notes(sp, 'sparring_waitlist_promoted', t_b()) = 1 AND t_notes(sp, 'sparring_updated', t_b()) = 1,
    'promotion + change, one of each type';
  PERFORM t_as(t_b());
  ASSERT cancel_sparring_signup(sp) = 'cancelled', 'promoted in the same save counts as not re-confirmed';
  RAISE NOTICE 'ok 12 Nachrücker im selben Speichern: je eine Nachricht pro Typ';
END $$;

\echo 'ALL SPARRING EDIT TESTS PASSED'
