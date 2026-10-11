-- Intro after the onboarding (cards step + sparring step) replaces the coach
-- tour. Additive only: one progress record, the existing tour_status /
-- tour_station, now with a version that says which flow the station counts.
--
--   tour_version NULL / 1   old coach tour, tour_station 0-3
--                2         new intro, tour_station 0 (card) or 1 (sparring)
--
-- Client mapping (src/utils/intro.ts): an old 'in_progress' resumes at the
-- new card step and is saved as version 2 at once, so a restart never resets
-- a later new step. 'completed' / 'skipped' never auto-start again. No
-- status is set by this migration; name, birth date and place stay untouched.

ALTER TABLE public.profile_private
  ADD COLUMN IF NOT EXISTS tour_version smallint NULL
    CHECK (tour_version IN (1, 2));

-- Same name, one more argument with a default: builds that still call
-- set_my_tour_state(p_status, p_station) keep working and write version 1.
DROP FUNCTION IF EXISTS public.set_my_tour_state(text, integer);

CREATE OR REPLACE FUNCTION public.set_my_tour_state(p_status text, p_station integer, p_version integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ONBOARDING_NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('in_progress', 'completed', 'skipped') THEN
    RAISE EXCEPTION 'TOUR_INVALID_STATUS' USING ERRCODE = '22023';
  END IF;
  IF p_version IS NULL OR p_version NOT IN (1, 2) THEN
    RAISE EXCEPTION 'TOUR_INVALID_VERSION' USING ERRCODE = '22023';
  END IF;
  IF p_station IS NOT NULL
     AND (p_station < 0 OR p_station > CASE WHEN p_version = 2 THEN 1 ELSE 3 END) THEN
    RAISE EXCEPTION 'TOUR_INVALID_STATION' USING ERRCODE = '22023';
  END IF;

  -- Only the caller's own row; it exists once step 1 of the onboarding was saved.
  UPDATE public.profile_private
  SET tour_status  = p_status,
      tour_station = CASE WHEN p_status = 'in_progress' THEN p_station ELSE NULL END,
      tour_version = p_version,
      updated_at   = now()
  WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_INCOMPLETE' USING ERRCODE = '22023';
  END IF;
END;
$$;

-- Same shape as before plus tour_version (additive key).
CREATE OR REPLACE FUNCTION public.get_my_onboarding_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'name',                 p.name,
    'has_birth_date',       pp.birth_date IS NOT NULL AND public.onboarding_age_ok(pp.birth_date),
    'onboarding_completed', coalesce(p.onboarding_completed, false),
    'tour_status',          pp.tour_status,
    'tour_station',         pp.tour_station,
    'tour_version',         pp.tour_version
  )
  FROM public.profiles p
  LEFT JOIN public.profile_private pp ON pp.id = p.id
  WHERE p.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.set_my_tour_state(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_onboarding_state()                 FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_my_tour_state(text, integer, integer) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_my_onboarding_state()                 TO authenticated;
