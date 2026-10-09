-- Scenarios for process_sparring_notifications_at(p_now). Fixed clock:
-- T0 = 2026-11-10 12:00 Europe/Berlin (CET, +01). Each block raises on failure.

INSERT INTO profiles (id, name, language, expo_push_token, sparring_intro_version) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Orga',  'de', 'tok1', 1),   -- organizer
  ('00000000-0000-0000-0000-000000000002', 'P1',    'de', 'tok2', 1),   -- pending
  ('00000000-0000-0000-0000-000000000003', 'P2',    'en', 'tok3', 1),   -- confirmed, English
  ('00000000-0000-0000-0000-000000000004', 'P3',    'de', NULL,   1),   -- cancelled
  ('00000000-0000-0000-0000-000000000005', 'P4',    'de', NULL,   1),   -- waitlisted
  ('00000000-0000-0000-0000-000000000006', 'P5',    'de', NULL,   1),   -- late signup
  ('00000000-0000-0000-0000-000000000007', 'P6',    'de', NULL,   NULL),-- old build (no intro)
  ('00000000-0000-0000-0000-000000000008', 'F',     'de', NULL,   1),   -- notify fails
  ('00000000-0000-0000-0000-000000000009', 'P7',    'de', NULL,   1);   -- already answered

CREATE FUNCTION t_count(p_type text, p_sparring uuid, p_user uuid DEFAULT NULL) RETURNS int
LANGUAGE sql AS $$
  SELECT count(*)::int FROM notifications
   WHERE type = p_type AND data->>'sparring_id' = p_sparring::text
     AND (p_user IS NULL OR user_id = p_user)
$$;
CREATE FUNCTION t_run(p_now text) RETURNS jsonb
LANGUAGE sql AS $$ SELECT process_sparring_notifications_at(p_now::timestamptz) $$;

-- ════════════════════════ A. 3h reminder ════════════════════════

INSERT INTO open_sparrings (id, created_by, title, scheduled_at, duration_min, is_active) VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Boxen – Sparring', '2026-11-10 14:00+01', 90, true),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Später',           '2026-11-10 16:00+01', 90, true),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Schon begonnen',   '2026-11-10 11:50+01', 90, true),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Abgesagt',         '2026-11-10 13:00+01', 90, false),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
   'Ein sehr langer Sparringstitel, der deutlich über vierzig Zeichen hinausgeht', '2026-11-10 14:30+01', 90, true),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Nachts',           '2026-11-11 01:00+01', 90, true);

INSERT INTO sparring_signups (sparring_id, user_id, status, signed_up_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'pending',    '2026-11-08 10:00+01'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'confirmed',  '2026-11-08 10:00+01'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'cancelled',  '2026-11-08 10:00+01'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'waitlisted', '2026-11-08 10:00+01'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'pending',    '2026-11-10 11:30+01'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000008', 'pending',    '2026-11-08 10:00+01'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'pending',    '2026-11-08 10:00+01'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'pending',    '2026-11-08 10:00+01'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'pending',    '2026-11-08 10:00+01'),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'pending',    '2026-11-08 10:00+01'),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 'pending',    '2026-11-08 10:00+01');

-- A1: right recipients, texts, failure released for retry
SET test.fail_user = '00000000-0000-0000-0000-000000000008';
DO $$
DECLARE v jsonb; n record;
BEGIN
  v := t_run('2026-11-10 12:00+01');
  ASSERT (v->>'reminder_3h_failed')::int = 1, 'A1 one failure expected: ' || v;
  ASSERT t_count('sparring_reminder_3h', 'a0000000-0000-0000-0000-000000000001') = 2, 'A1 exactly P1 + P2';
  ASSERT t_count('sparring_reminder_3h', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006') = 0, 'A1 late signup skipped';
  ASSERT t_count('sparring_reminder_3h', 'a0000000-0000-0000-0000-000000000002') = 0, 'A1 4h before: not yet';
  ASSERT t_count('sparring_reminder_3h', 'a0000000-0000-0000-0000-000000000003') = 0, 'A1 already started: never';
  ASSERT t_count('sparring_reminder_3h', 'a0000000-0000-0000-0000-000000000004') = 0, 'A1 cancelled sparring: never';

  SELECT title, body INTO n FROM notifications
   WHERE type = 'sparring_reminder_3h' AND user_id = '00000000-0000-0000-0000-000000000002'
     AND data->>'sparring_id' = 'a0000000-0000-0000-0000-000000000001';
  ASSERT n.title = 'Sparring heute um 14:00 Uhr', 'A1 DE title: ' || n.title;
  ASSERT n.body = '„Boxen – Sparring“ – kannst du doch nicht? Sag bitte rechtzeitig ab.', 'A1 DE body: ' || n.body;

  SELECT title, body INTO n FROM notifications
   WHERE type = 'sparring_reminder_3h' AND user_id = '00000000-0000-0000-0000-000000000003';
  ASSERT n.title = 'Sparring today at 14:00', 'A1 EN title: ' || n.title;
  ASSERT n.body = '“Boxing – Sparring” — can’t make it? Please cancel in time.', 'A1 EN body: ' || n.body;

  ASSERT (SELECT reminder_3h_sent_at IS NULL FROM sparring_signups
           WHERE sparring_id = 'a0000000-0000-0000-0000-000000000001'
             AND user_id = '00000000-0000-0000-0000-000000000008'), 'A1 failed claim released';
  ASSERT (SELECT count(*) FROM test_push_log) >= 2, 'A1 push queued';
END $$;

-- A2: long title shortened to 40 chars incl. ellipsis, stored title unchanged
DO $$
DECLARE b text;
BEGIN
  SELECT body INTO b FROM notifications
   WHERE type = 'sparring_reminder_3h' AND data->>'sparring_id' = 'a0000000-0000-0000-0000-000000000005';
  ASSERT b = '„Ein sehr langer Sparringstitel, der deu…“ – kannst du doch nicht? Sag bitte rechtzeitig ab.', 'A2 body: ' || b;
  ASSERT char_length(notification_short_title((SELECT title FROM open_sparrings WHERE id = 'a0000000-0000-0000-0000-000000000005'), 'de')) = 40, 'A2 length 40';
  ASSERT (SELECT char_length(title) FROM open_sparrings WHERE id = 'a0000000-0000-0000-0000-000000000005') > 60, 'A2 stored title intact';
END $$;

-- A3: repeated run sends nothing twice; failure retried once fixed
RESET test.fail_user;
DO $$
DECLARE v jsonb;
BEGIN
  v := t_run('2026-11-10 12:10+01');
  ASSERT t_count('sparring_reminder_3h', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002') = 1, 'A3 P1 exactly once';
  ASSERT t_count('sparring_reminder_3h', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000008') = 1, 'A3 F retried';
  ASSERT (v->>'reminder_3h_sent')::int = 1, 'A3 only the retry: ' || v;
END $$;

-- A4: claimed by the old lifecycle job (same column) → no second message
UPDATE sparring_signups SET reminder_3h_sent_at = now()
 WHERE sparring_id = 'a0000000-0000-0000-0000-000000000002';
DO $$ BEGIN
  PERFORM t_run('2026-11-10 13:30+01');
  ASSERT t_count('sparring_reminder_3h', 'a0000000-0000-0000-0000-000000000002') = 0, 'A4 already claimed';
END $$;

-- A5: reschedule resets the claim; new reminder for the new time
UPDATE open_sparrings SET scheduled_at = '2026-11-12 18:00+01' WHERE id = 'a0000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM sparring_signups WHERE sparring_id = 'a0000000-0000-0000-0000-000000000001'
           AND status IN ('pending','confirmed') AND reminder_3h_sent_at IS NOT NULL) = 0, 'A5 trigger reset';
  PERFORM t_run('2026-11-10 12:20+01');
  ASSERT t_count('sparring_reminder_3h', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002') = 1, 'A5 nothing early';
  PERFORM t_run('2026-11-12 15:30+01');
  ASSERT t_count('sparring_reminder_3h', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002') = 2, 'A5 new reminder';
END $$;

-- A6: start after midnight → "morgen"
DO $$
DECLARE t text;
BEGIN
  PERFORM t_run('2026-11-10 22:30+01');
  SELECT title INTO t FROM notifications
   WHERE type = 'sparring_reminder_3h' AND data->>'sparring_id' = 'a0000000-0000-0000-0000-000000000006';
  ASSERT t = 'Sparring morgen um 01:00 Uhr', 'A6 title: ' || t;
END $$;

-- A7: switched off → nothing
UPDATE sparring_notification_jobs SET enabled = false WHERE job = 'reminder_3h';
INSERT INTO open_sparrings (id, created_by, title, scheduled_at) VALUES
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Aus', '2026-11-20 14:00+01');
INSERT INTO sparring_signups (sparring_id, user_id, status, signed_up_at) VALUES
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 'pending', '2026-11-08 10:00+01');
DO $$ BEGIN
  PERFORM t_run('2026-11-20 12:00+01');
  ASSERT t_count('sparring_reminder_3h', 'a0000000-0000-0000-0000-000000000007') = 0, 'A7 switch off';
END $$;
UPDATE sparring_notification_jobs SET enabled = true WHERE job = 'reminder_3h';

-- ════════════════════════ B. Feedback question ════════════════════════

-- B0: off by default
DO $$ BEGIN
  ASSERT NOT (SELECT enabled FROM sparring_notification_jobs WHERE job = 'feedback'), 'B0 feedback starts off';
  ASSERT (SELECT active_since FROM sparring_notification_jobs WHERE job = 'feedback') IS NULL, 'B0 no activation yet';
END $$;

INSERT INTO open_sparrings (id, created_by, title, scheduled_at, duration_min, is_active, deactivated_at) VALUES
  -- ends 11:00 → due 12:00
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Boxen – Sparring', '2026-11-10 10:00+01', 60, true, NULL),
  -- cancelled before its end
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Abgesagt', '2026-11-10 10:00+01', 60, false, '2026-11-10 09:00+01'),
  -- ended before activation (07:00)
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Historisch', '2026-11-10 06:00+01', 60, true, NULL),
  -- ends 21:30 → due 22:30 → moved to 09:00 next day
  ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Abends', '2026-11-10 20:30+01', 60, true, NULL),
  -- archived after its end (not a cancellation)
  ('b0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Archiviert', '2026-11-10 10:00+01', 60, false, '2026-11-10 11:30+01');

INSERT INTO sparring_signups (sparring_id, user_id, status, signed_up_at) VALUES
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'confirmed', '2026-11-08 10:00+01'), -- organizer also signed up
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'pending',   '2026-11-08 10:00+01'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'attended',  '2026-11-08 10:00+01'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'cancelled', '2026-11-08 10:00+01'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'waitlisted','2026-11-08 10:00+01'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007', 'confirmed', '2026-11-08 10:00+01'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000008', 'confirmed', '2026-11-08 10:00+01'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009', 'confirmed', '2026-11-08 10:00+01'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'pending',   '2026-11-08 10:00+01'),
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'pending',   '2026-11-08 10:00+01'),
  ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'pending',   '2026-11-08 10:00+01'),
  ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'confirmed', '2026-11-08 10:00+01'),
  ('b0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'pending',   '2026-11-08 10:00+01');
INSERT INTO sparring_meeting_feedback (sparring_id, user_id, answer) VALUES
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009', 'happened');

-- B1: nothing while switched off
DO $$ BEGIN
  PERFORM t_run('2026-11-10 12:00+01');
  ASSERT (SELECT count(*) FROM notifications WHERE type = 'sparring_feedback_due') = 0, 'B1 off sends nothing';
END $$;

-- Switch on; the trigger stamps active_since. Pin it to the test clock (08:00).
UPDATE sparring_notification_jobs SET enabled = true WHERE job = 'feedback';
DO $$ BEGIN
  ASSERT (SELECT active_since IS NOT NULL FROM sparring_notification_jobs WHERE job = 'feedback'), 'B activation stamped';
END $$;
UPDATE sparring_notification_jobs SET active_since = '2026-11-10 08:00+01' WHERE job = 'feedback';

-- B2: not before end + 1h
DO $$ BEGIN
  PERFORM t_run('2026-11-10 11:59+01');
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000001') = 0, 'B2 too early';
END $$;

-- B3: right recipients, organizer once, texts; failure kept for retry
SET test.fail_user = '00000000-0000-0000-0000-000000000008';
DO $$
DECLARE v jsonb; n record;
BEGIN
  v := t_run('2026-11-10 12:00+01');
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000001') = 3, 'B3 Orga + P1 + P2: ' || v;
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001') = 1, 'B3 organizer once';
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007') = 0, 'B3 old build skipped';
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009') = 0, 'B3 answered skipped';
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004') = 0, 'B3 cancelled signup skipped';
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005') = 0, 'B3 waitlisted skipped';
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000002') = 0, 'B3 cancelled sparring skipped';
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000003') = 0, 'B3 no historic wave';
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000005') = 2, 'B3 archived after end still asked (Orga + P1)';
  ASSERT (v->>'feedback_failed')::int = 1, 'B3 one failure: ' || v;
  ASSERT (SELECT sent_at IS NULL AND attempts = 1 FROM sparring_feedback_reminders
           WHERE sparring_id = 'b0000000-0000-0000-0000-000000000001'
             AND user_id = '00000000-0000-0000-0000-000000000008'), 'B3 failure not marked sent';

  SELECT title, body INTO n FROM notifications
   WHERE type = 'sparring_feedback_due' AND user_id = '00000000-0000-0000-0000-000000000002'
     AND data->>'sparring_id' = 'b0000000-0000-0000-0000-000000000001';
  ASSERT n.title = 'Hat euer Sparring stattgefunden?', 'B3 DE title';
  ASSERT n.body = 'Gib kurz Rückmeldung zu „Boxen – Sparring“.', 'B3 DE body: ' || n.body;
  SELECT title, body INTO n FROM notifications
   WHERE type = 'sparring_feedback_due' AND user_id = '00000000-0000-0000-0000-000000000003';
  ASSERT n.title = 'Did your sparring session take place?', 'B3 EN title';
  ASSERT n.body = 'Let us know about “Boxing – Sparring”.', 'B3 EN body: ' || n.body;
END $$;

-- B4: repeated runs: no duplicates; failure retried up to 5 attempts, then stop
DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..6 LOOP PERFORM t_run('2026-11-10 13:00+01'); END LOOP;
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000001') = 3, 'B4 no duplicates';
  ASSERT (SELECT attempts FROM sparring_feedback_reminders
           WHERE sparring_id = 'b0000000-0000-0000-0000-000000000001'
             AND user_id = '00000000-0000-0000-0000-000000000008') = 5, 'B4 capped at 5 attempts';
END $$;
RESET test.fail_user;
DO $$ BEGIN
  PERFORM t_run('2026-11-10 13:10+01');
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000008') = 0, 'B4 no retry after cap';
END $$;

-- B5: night → next morning; an answer before the morning cancels the message
DO $$ BEGIN
  ASSERT sparring_feedback_send_at('2026-11-10 21:30+01') = '2026-11-11 09:00+01', 'B5 22:30 → 09:00';
  ASSERT sparring_feedback_send_at('2026-11-11 07:00+01') = '2026-11-11 09:00+01', 'B5 08:00 → 09:00';
  ASSERT sparring_feedback_send_at('2026-11-11 11:00+01') = '2026-11-11 12:00+01', 'B5 day unchanged';
  ASSERT sparring_feedback_send_at('2026-07-10 21:00+02') = '2026-07-11 09:00+02', 'B5 summer DST';

  PERFORM t_run('2026-11-10 22:45+01');
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000004') = 0, 'B5 not at night';
  INSERT INTO sparring_meeting_feedback (sparring_id, user_id, answer)
  VALUES ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'cancelled');
  PERFORM t_run('2026-11-11 08:59+01');
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000004') = 0, 'B5 not before 09:00';
  PERFORM t_run('2026-11-11 09:00+01');
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002') = 0, 'B5 answered at night → no message';
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003') = 1, 'B5 morning message';
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001') = 1, 'B5 organizer morning message';
END $$;

-- B6: window closed after 72h → nothing for a late-joining eligible user
INSERT INTO sparring_signups (sparring_id, user_id, status, signed_up_at) VALUES
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'attended', '2026-11-08 10:00+01');
DO $$ BEGIN
  PERFORM t_run('2026-11-13 11:01+01');
  ASSERT t_count('sparring_feedback_due', 'b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006') = 0, 'B6 window closed';
END $$;

-- ════════════════════════ Rights ════════════════════════
DO $$ BEGIN
  ASSERT NOT has_function_privilege('authenticated', 'process_sparring_notifications()', 'execute'), 'R authenticated';
  ASSERT NOT has_function_privilege('anon', 'process_sparring_notifications_at(timestamptz)', 'execute'), 'R anon';
  ASSERT has_function_privilege('service_role', 'process_sparring_notifications()', 'execute'), 'R service_role';
  ASSERT NOT has_table_privilege('authenticated', 'sparring_feedback_reminders', 'select'), 'R table';
  ASSERT (SELECT count(*) FROM cron.job WHERE jobname = 'sparring-notifications') = 1, 'R cron job';
END $$;
