-- Onboarding after sign-up (name + birth date, then search location).
-- Additive only: old app versions never call these RPCs and are unaffected.
--
-- The birth date must never be readable by other users. `profiles` is readable
-- by every authenticated user (policy profile_lesen), so it lives in its own
-- table that only the owner can read and only the RPCs below can write.

CREATE TABLE IF NOT EXISTS public.profile_private (
  id          uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  birth_date  date NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profile_private FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profile_private TO authenticated;

DROP POLICY IF EXISTS profile_private_own_read ON public.profile_private;
CREATE POLICY profile_private_own_read ON public.profile_private
  FOR SELECT TO authenticated
  USING (id = auth.uid());
-- No INSERT/UPDATE/DELETE policies: writes only via set_my_profile_basics.

-- Minimum age, checked against the earliest calendar date anywhere on earth
-- (UTC+14), so nobody is refused on their 16th birthday because the server
-- clock is still on the previous day. The app checks exactly in local time.
CREATE OR REPLACE FUNCTION public.onboarding_age_ok(p_birth_date date)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_birth_date IS NOT NULL
     AND (p_birth_date + interval '16 years')::date
         <= (now() AT TIME ZONE 'Pacific/Kiritimati')::date;
$$;

-- Saves name and birth date of the caller. Raises a machine code the app maps
-- to its own texts. An underage date is NOT stored.
CREATE OR REPLACE FUNCTION public.set_my_profile_basics(p_name text, p_birth_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'ONBOARDING_NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' OR char_length(v_name) > 40 THEN
    RAISE EXCEPTION 'ONBOARDING_INVALID_NAME' USING ERRCODE = '22023';
  END IF;
  IF p_birth_date IS NULL
     OR p_birth_date < DATE '1900-01-01'
     OR p_birth_date > (now() AT TIME ZONE 'Pacific/Kiritimati')::date THEN
    RAISE EXCEPTION 'ONBOARDING_INVALID_BIRTH_DATE' USING ERRCODE = '22023';
  END IF;
  IF NOT public.onboarding_age_ok(p_birth_date) THEN
    RAISE EXCEPTION 'ONBOARDING_UNDERAGE' USING ERRCODE = '22023';
  END IF;

  -- Content filter triggers on profiles still apply (CONTENT_FILTER_BLOCKED).
  UPDATE public.profiles SET name = v_name WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONBOARDING_NO_PROFILE' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.profile_private (id, birth_date, updated_at)
  VALUES (v_uid, p_birth_date, now())
  ON CONFLICT (id) DO UPDATE
    SET birth_date = EXCLUDED.birth_date, updated_at = now();
END;
$$;

-- Marks onboarding as done, but only with a name and a valid birth date.
-- Idempotent: a repeated call (double tap, retry) changes nothing.
CREATE OR REPLACE FUNCTION public.complete_onboarding()
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
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.profile_private pp ON pp.id = p.id
    WHERE p.id = v_uid
      AND btrim(coalesce(p.name, '')) <> ''
      AND public.onboarding_age_ok(pp.birth_date)
  ) THEN
    RAISE EXCEPTION 'ONBOARDING_INCOMPLETE' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles SET onboarding_completed = true
  WHERE id = v_uid AND onboarding_completed IS DISTINCT FROM true;
END;
$$;

-- Everything the app needs to decide its entry route, in one call.
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
    'onboarding_completed', coalesce(p.onboarding_completed, false)
  )
  FROM public.profiles p
  LEFT JOIN public.profile_private pp ON pp.id = p.id
  WHERE p.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.onboarding_age_ok(date)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_my_profile_basics(text, date)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_onboarding()                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_onboarding_state()              FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_my_profile_basics(text, date)      TO authenticated;
GRANT  EXECUTE ON FUNCTION public.complete_onboarding()                  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_my_onboarding_state()              TO authenticated;
