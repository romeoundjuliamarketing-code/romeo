-- Coach tour "Sparr kennenlernen" after the onboarding. Additive only.
--
-- Stored per account next to the onboarding data (profile_private, owner-only
-- read, writes via RPC). Independent of the onboarding itself:
--   tour_status NULL          never started
--               'in_progress' running, tour_station = current station (0-3)
--               'completed'   finished
--               'skipped'     skipped on purpose (never auto-started again)

ALTER TABLE public.profile_private
  ADD COLUMN IF NOT EXISTS tour_status  text     NULL
    CHECK (tour_status IN ('in_progress', 'completed', 'skipped')),
  ADD COLUMN IF NOT EXISTS tour_station smallint NULL
    CHECK (tour_station BETWEEN 0 AND 3);

CREATE OR REPLACE FUNCTION public.set_my_tour_state(p_status text, p_station integer)
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
  IF p_station IS NOT NULL AND (p_station < 0 OR p_station > 3) THEN
    RAISE EXCEPTION 'TOUR_INVALID_STATION' USING ERRCODE = '22023';
  END IF;

  -- The row exists once step 1 of the onboarding was saved, which every
  -- account in the app has passed.
  UPDATE public.profile_private
  SET tour_status  = p_status,
      tour_station = CASE WHEN p_status = 'in_progress' THEN p_station ELSE NULL END,
      updated_at   = now()
  WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_INCOMPLETE' USING ERRCODE = '22023';
  END IF;
END;
$$;

-- Same shape as before plus the tour fields (additive keys).
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
    'tour_station',         pp.tour_station
  )
  FROM public.profiles p
  LEFT JOIN public.profile_private pp ON pp.id = p.id
  WHERE p.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.set_my_tour_state(text, integer)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_onboarding_state()         FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_my_tour_state(text, integer)  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_my_onboarding_state()         TO authenticated;
