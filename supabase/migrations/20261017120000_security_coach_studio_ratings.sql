-- Security fixes from the 2026-10-17 audit. Compatible with all store builds:
-- no build writes coach_nominations (only INSERT + RPCs), coach_votes (only via
-- cast_coach_vote) or studios (only via create_gym / create_studio_with_owner)
-- directly, and sparring_ratings is only read by signed-in users.

-- 1. coach_nominations: members could rewrite any nomination (all columns, no
--    WITH CHECK), e.g. switch nominee_id to themselves before a coach confirms.
--    Rejecting runs through reject_coach_nomination (SECURITY DEFINER).
DROP POLICY IF EXISTS update_coach_nominations ON public.coach_nominations;

-- 2. Self-nomination was only blocked in the client. Nominee must be in the team.
DROP POLICY IF EXISTS insert_coach_nominations ON public.coach_nominations;
CREATE POLICY insert_coach_nominations ON public.coach_nominations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = nominator_id
    AND nominee_id <> auth.uid()
    AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.profiles me
                WHERE me.id = auth.uid() AND me.studio_id = coach_nominations.team_id)
    AND EXISTS (SELECT 1 FROM public.profiles nominee
                WHERE nominee.id = coach_nominations.nominee_id
                  AND nominee.studio_id = coach_nominations.team_id)
  );

-- 3. Votes only through cast_coach_vote (SECURITY DEFINER, bypasses RLS).
DROP POLICY IF EXISTS insert_coach_votes ON public.coach_votes;

-- 4. cast_coach_vote:
--    - the nominee can never vote on their own nomination,
--    - team check NULL-safe (a user without a team passed `!=`),
--    - team without coaches: only the studio owner may confirm a promotion
--      (before: any member, so any member could make themselves coach).
CREATE OR REPLACE FUNCTION public.cast_coach_vote(p_nomination_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nom           coach_nominations%ROWTYPE;
  v_voter         profiles%ROWTYPE;
  v_coaches_exist boolean;
  v_is_owner      boolean;
  v_vote_count    integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Nicht eingeloggt');
  END IF;

  SELECT * INTO v_nom FROM coach_nominations WHERE id = p_nomination_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Nominierung nicht gefunden');
  END IF;
  IF v_nom.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'Nominierung ist bereits abgeschlossen');
  END IF;

  SELECT * INTO v_voter FROM profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profil nicht gefunden');
  END IF;
  IF v_voter.studio_id IS DISTINCT FROM v_nom.team_id THEN
    RETURN jsonb_build_object('error', 'Nicht im selben Team');
  END IF;

  IF auth.uid() = v_nom.nominee_id THEN
    IF v_nom.type = 'demote' THEN
      RETURN jsonb_build_object('error', 'Eigene Entfernung bitte über Selbst-Entfernung');
    END IF;
    RETURN jsonb_build_object('error', 'Eigene Nominierung kann nicht bestätigt werden');
  END IF;

  -- Are there any coaches in the team besides the nominee?
  SELECT EXISTS(
    SELECT 1 FROM profiles
    WHERE studio_id = v_nom.team_id
      AND is_coach = true
      AND id != v_nom.nominee_id
  ) INTO v_coaches_exist;

  SELECT EXISTS(
    SELECT 1 FROM studios WHERE id = v_nom.team_id AND owner_user_id = auth.uid()
  ) INTO v_is_owner;

  IF v_nom.type = 'promote' THEN
    IF v_coaches_exist AND NOT v_voter.is_coach THEN
      RETURN jsonb_build_object('error', 'Nur Trainer können neue Trainer bestätigen');
    END IF;
    IF NOT v_coaches_exist AND NOT v_is_owner THEN
      RETURN jsonb_build_object('error', 'Nur der Studio-Inhaber kann den ersten Trainer bestätigen');
    END IF;
  ELSIF v_nom.type = 'demote' THEN
    IF NOT v_voter.is_coach THEN
      RETURN jsonb_build_object('error', 'Nur Trainer können eine Entfernung bestätigen');
    END IF;
  END IF;

  INSERT INTO coach_votes (nomination_id, voter_id)
  VALUES (p_nomination_id, auth.uid())
  ON CONFLICT (nomination_id, voter_id) DO NOTHING;

  SELECT COUNT(*) INTO v_vote_count
  FROM coach_votes WHERE nomination_id = p_nomination_id;

  IF v_vote_count >= 1 THEN
    UPDATE coach_nominations SET status = 'confirmed' WHERE id = p_nomination_id;
    IF v_nom.type = 'promote' THEN
      UPDATE profiles SET is_coach = true  WHERE id = v_nom.nominee_id;
    ELSE
      UPDATE profiles SET is_coach = false WHERE id = v_nom.nominee_id;
      UPDATE coach_nominations SET status = 'rejected'
        WHERE nominee_id = v_nom.nominee_id
          AND status = 'pending'
          AND id != p_nomination_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.cast_coach_vote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_coach_vote(uuid) TO authenticated;

-- 5. reject_coach_nomination: same NULL-safe team check.
CREATE OR REPLACE FUNCTION public.reject_coach_nomination(p_nomination_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nom   coach_nominations%ROWTYPE;
  v_actor profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_nom FROM coach_nominations WHERE id = p_nomination_id;
  IF NOT FOUND OR v_nom.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'Nominierung nicht gefunden oder bereits abgeschlossen');
  END IF;

  SELECT * INTO v_actor FROM profiles WHERE id = auth.uid();
  IF NOT FOUND OR v_actor.studio_id IS DISTINCT FROM v_nom.team_id THEN
    RETURN jsonb_build_object('error', 'Nicht im selben Team');
  END IF;

  -- Nominator may cancel their own nomination
  IF auth.uid() = v_nom.nominator_id THEN
    UPDATE coach_nominations SET status = 'rejected' WHERE id = p_nomination_id;
    RETURN jsonb_build_object('success', true);
  END IF;

  -- Otherwise only coaches may reject
  IF NOT v_actor.is_coach THEN
    RETURN jsonb_build_object('error', 'Keine Berechtigung');
  END IF;

  UPDATE coach_nominations SET status = 'rejected' WHERE id = p_nomination_id;
  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_coach_nomination(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_coach_nomination(uuid) TO authenticated;

-- 6. studios: two INSERT policies with WITH CHECK true let anyone create a
--    studio in someone else's name (owner_user_id / created_by free).
DROP POLICY IF EXISTS "Authenticated users can create studios" ON public.studios;
DROP POLICY IF EXISTS studios_eintragen ON public.studios;
CREATE POLICY studios_insert_own ON public.studios
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (created_by IS NULL OR created_by = auth.uid())
  );

-- 7. sparring_ratings (who rated whom how) was readable without login.
ALTER POLICY "Ratings for user readable" ON public.sparring_ratings TO authenticated;
ALTER POLICY "Own ratings readable" ON public.sparring_ratings TO authenticated;
