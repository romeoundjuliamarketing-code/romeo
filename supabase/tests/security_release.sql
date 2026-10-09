-- Scenarios for 20261009130000_event_signup_counts + 20261009130100_accept_studio_invite_v2.
-- Each block raises on failure (psql runs with ON_ERROR_STOP).

-- Fixtures
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-00000000000a'),  -- organizer / studio owner
  ('00000000-0000-0000-0000-00000000000b'),  -- participant / invitee
  ('00000000-0000-0000-0000-00000000000c');  -- second invitee
INSERT INTO profiles (id) SELECT id FROM auth.users;

INSERT INTO events (id, created_by, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', false),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', true);
INSERT INTO event_signups (event_id, user_id) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b');

INSERT INTO studios (id, owner_user_id) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c');
INSERT INTO subscriptions (user_id, tier, status) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'studio', 'active');
INSERT INTO studio_invite_codes (studio_id, code, expires_at, created_by) VALUES
  ('20000000-0000-0000-0000-000000000001', 'ABC123', now() + interval '1 day', '00000000-0000-0000-0000-00000000000a'),
  ('20000000-0000-0000-0000-000000000001', 'OLD999', now() - interval '1 day', '00000000-0000-0000-0000-00000000000a'),
  ('20000000-0000-0000-0000-000000000002', 'NOSUB1', now() + interval '1 day', '00000000-0000-0000-0000-00000000000c');

-- 1. anon cannot read event_signups any more
SET ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM event_signups) <> 0 THEN
    RAISE EXCEPTION 'FAIL 1: anon still reads event_signups';
  END IF;
END $$;
RESET ROLE;

-- 2. anon cannot execute the new RPCs
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM get_event_signup_counts(ARRAY['10000000-0000-0000-0000-000000000001'::uuid]);
    RAISE EXCEPTION 'FAIL 2a: anon executed get_event_signup_counts';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM accept_studio_invite_v2('ABC123');
    RAISE EXCEPTION 'FAIL 2b: anon executed accept_studio_invite_v2';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

-- 3. signed-in user still reads signups of active events (old builds) and gets counts
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
DO $$
DECLARE r record; n int := 0;
BEGIN
  IF (SELECT count(*) FROM event_signups) <> 2 THEN
    RAISE EXCEPTION 'FAIL 3a: authenticated should see 2 signups of the active event';
  END IF;
  FOR r IN SELECT * FROM get_event_signup_counts(ARRAY[
      '10000000-0000-0000-0000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000002'::uuid,
      '10000000-0000-0000-0000-000000000003'::uuid]) LOOP
    n := n + 1;
    IF r.event_id = '10000000-0000-0000-0000-000000000001' AND r.signup_count <> 2 THEN
      RAISE EXCEPTION 'FAIL 3b: active event count %', r.signup_count; END IF;
    IF r.event_id = '10000000-0000-0000-0000-000000000003' AND r.signup_count <> 0 THEN
      RAISE EXCEPTION 'FAIL 3c: empty event count %', r.signup_count; END IF;
    IF r.event_id = '10000000-0000-0000-0000-000000000002' THEN
      RAISE EXCEPTION 'FAIL 3d: inactive foreign event visible'; END IF;
  END LOOP;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL 3e: expected 2 rows, got %', n; END IF;
END $$;

-- 4. organizer also sees counts of the own inactive event
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
DO $$ BEGIN
  IF (SELECT signup_count FROM get_event_signup_counts(ARRAY['10000000-0000-0000-0000-000000000002'::uuid])) <> 1 THEN
    RAISE EXCEPTION 'FAIL 4: organizer count of own inactive event';
  END IF;
END $$;

-- 5. invite: wrong, expired, no subscription, ok
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
DO $$ BEGIN
  IF accept_studio_invite_v2('WRONG1')->>'status' <> 'invalid' THEN RAISE EXCEPTION 'FAIL 5a'; END IF;
  IF accept_studio_invite_v2('OLD999')->>'status' <> 'invalid' THEN RAISE EXCEPTION 'FAIL 5b: expired'; END IF;
  IF accept_studio_invite_v2('NOSUB1')->>'status' <> 'no_subscription' THEN RAISE EXCEPTION 'FAIL 5c'; END IF;
  IF accept_studio_invite_v2(' abc123 ')->>'status' <> 'ok' THEN RAISE EXCEPTION 'FAIL 5d: ok (case/trim)'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT studio_id FROM profiles WHERE id = '00000000-0000-0000-0000-00000000000b')
     IS DISTINCT FROM '20000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'FAIL 5e: studio_id not set'; END IF;
  IF (SELECT count(*) FROM studio_memberships WHERE user_id = '00000000-0000-0000-0000-00000000000b') <> 1 THEN
    RAISE EXCEPTION 'FAIL 5f: membership missing'; END IF;
  -- failed attempts were kept (no rollback): WRONG1 + OLD999
  IF (SELECT count(*) FROM studio_invite_attempts WHERE user_id = '00000000-0000-0000-0000-00000000000b') <> 2 THEN
    RAISE EXCEPTION 'FAIL 5g: attempts not counted'; END IF;
END $$;

-- 6. lockout after 5 failures, even with the right code; other users unaffected
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
DO $$ DECLARE i int; BEGIN
  FOR i IN 1..5 LOOP
    IF accept_studio_invite_v2('BAD00' || i)->>'status' <> 'invalid' THEN
      RAISE EXCEPTION 'FAIL 6a: attempt % not invalid', i; END IF;
  END LOOP;
  IF accept_studio_invite_v2('ABC123')->>'status' <> 'locked' THEN
    RAISE EXCEPTION 'FAIL 6b: not locked after 5 failures'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
DO $$ BEGIN
  IF accept_studio_invite_v2('ABC123')->>'status' <> 'ok' THEN
    RAISE EXCEPTION 'FAIL 6c: other user affected by lock'; END IF;
END $$;

-- 7. attempts table is not readable by clients
DO $$ BEGIN
  BEGIN
    PERFORM count(*) FROM studio_invite_attempts;
    RAISE EXCEPTION 'FAIL 7: authenticated reads studio_invite_attempts';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

-- 8. lock expires after an hour
UPDATE studio_invite_attempts SET created_at = now() - interval '61 minutes'
WHERE user_id = '00000000-0000-0000-0000-00000000000c';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
DO $$ BEGIN
  IF accept_studio_invite_v2('WRONG2')->>'status' <> 'invalid' THEN
    RAISE EXCEPTION 'FAIL 8: still locked after an hour'; END IF;
END $$;
RESET ROLE;
