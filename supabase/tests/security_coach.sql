-- Scenarios for 20261017120000_security_coach_studio_ratings.
-- Each block raises on failure (psql runs with ON_ERROR_STOP).

-- Fixtures: team T1 (owner O, members M + N, no coach), team T2 (coach C, member D),
-- user X without a team.
INSERT INTO profiles (id, studio_id, is_coach) VALUES
  ('00000000-0000-0000-0000-00000000000f', NULL, false),  -- O (studio_id set below)
  ('00000000-0000-0000-0000-00000000000a', NULL, false),  -- M
  ('00000000-0000-0000-0000-00000000000b', NULL, false),  -- N
  ('00000000-0000-0000-0000-00000000000c', NULL, true),   -- C
  ('00000000-0000-0000-0000-00000000000d', NULL, false),  -- D
  ('00000000-0000-0000-0000-00000000000e', NULL, false);  -- X (no team)
INSERT INTO studios (id, owner_user_id) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000f'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c');
UPDATE profiles SET studio_id = '20000000-0000-0000-0000-000000000001'
  WHERE id IN ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000000a',
               '00000000-0000-0000-0000-00000000000b');
UPDATE profiles SET studio_id = '20000000-0000-0000-0000-000000000002'
  WHERE id IN ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d');
INSERT INTO sparring_ratings (rater_id, rated_user_id, stars) VALUES
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 5);

-- 1. Self-nomination is rejected by RLS.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
DO $$ BEGIN
  BEGIN
    INSERT INTO coach_nominations (team_id, nominator_id, nominee_id)
    VALUES ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
            '00000000-0000-0000-0000-00000000000a');
    RAISE EXCEPTION 'FAIL 1: self-nomination accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- 2. Nominating someone outside the team is rejected.
DO $$ BEGIN
  BEGIN
    INSERT INTO coach_nominations (team_id, nominator_id, nominee_id)
    VALUES ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
            '00000000-0000-0000-0000-00000000000e');
    RAISE EXCEPTION 'FAIL 2: nominee outside team accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- 3. M nominates N: allowed.
INSERT INTO coach_nominations (id, team_id, nominator_id, nominee_id)
VALUES ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

-- 4. M cannot rewrite the nomination (no UPDATE policy) nor insert votes directly.
DO $$
DECLARE n int;
BEGIN
  UPDATE coach_nominations SET nominee_id = '00000000-0000-0000-0000-00000000000a'
   WHERE id = '30000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL 4a: member rewrote nomination'; END IF;
  BEGIN
    INSERT INTO coach_votes (nomination_id, voter_id)
    VALUES ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a');
    RAISE EXCEPTION 'FAIL 4b: direct vote insert accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- 5. Team without coaches: plain member M cannot confirm.
DO $$ BEGIN
  IF (cast_coach_vote('30000000-0000-0000-0000-000000000001') ->> 'error') IS NULL THEN
    RAISE EXCEPTION 'FAIL 5: member confirmed first coach';
  END IF;
END $$;

-- 6. Nominee N cannot confirm their own nomination.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
DO $$ BEGIN
  IF (cast_coach_vote('30000000-0000-0000-0000-000000000001') ->> 'error') IS NULL THEN
    RAISE EXCEPTION 'FAIL 6: nominee confirmed own nomination';
  END IF;
END $$;

-- 7. User without team cannot vote (NULL team check).
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
DO $$ BEGIN
  IF (cast_coach_vote('30000000-0000-0000-0000-000000000001') ->> 'error') IS DISTINCT FROM 'Nicht im selben Team' THEN
    RAISE EXCEPTION 'FAIL 7: user without team passed team check';
  END IF;
  IF (reject_coach_nomination('30000000-0000-0000-0000-000000000001') ->> 'error') IS DISTINCT FROM 'Nicht im selben Team' THEN
    RAISE EXCEPTION 'FAIL 7b: user without team passed reject team check';
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT is_coach FROM profiles WHERE id = '00000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'FAIL 5-7: N became coach';
  END IF;
END $$;

-- 8. Studio owner O confirms: N becomes coach.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
DO $$ BEGIN
  IF (cast_coach_vote('30000000-0000-0000-0000-000000000001') ->> 'success') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'FAIL 8: owner could not confirm';
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT (SELECT is_coach FROM profiles WHERE id = '00000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'FAIL 8b: N not coach after owner vote';
  END IF;
END $$;

-- 9. Team with coach: coach C confirms D (existing flow unchanged).
INSERT INTO coach_nominations (id, team_id, nominator_id, nominee_id)
VALUES ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
DO $$ BEGIN
  IF (cast_coach_vote('30000000-0000-0000-0000-000000000002') ->> 'success') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'FAIL 9: coach could not confirm';
  END IF;
END $$;

-- 10. Studio insert: own studio ok, foreign owner / created_by rejected.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
INSERT INTO studios (owner_user_id, created_by)
VALUES ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000e');
DO $$ BEGIN
  BEGIN
    INSERT INTO studios (owner_user_id) VALUES ('00000000-0000-0000-0000-00000000000a');
    RAISE EXCEPTION 'FAIL 10a: studio in foreign name accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO studios (owner_user_id, created_by)
    VALUES ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000a');
    RAISE EXCEPTION 'FAIL 10b: foreign created_by accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- 11. sparring_ratings: signed-in reads, anon does not.
DO $$ BEGIN
  IF (SELECT count(*) FROM sparring_ratings) <> 1 THEN
    RAISE EXCEPTION 'FAIL 11a: authenticated cannot read ratings';
  END IF;
END $$;
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
DO $$ BEGIN
  IF (SELECT count(*) FROM sparring_ratings) <> 0 THEN
    RAISE EXCEPTION 'FAIL 11b: anon still reads ratings';
  END IF;
  BEGIN
    PERFORM cast_coach_vote('30000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FAIL 11c: anon executed cast_coach_vote';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
