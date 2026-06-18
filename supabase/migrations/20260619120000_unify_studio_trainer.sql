-- Unify trainer: appointment sets is_coach AND studio_coaches in one step.
-- Replaces the peer-voting flow for assigning trainers.

CREATE OR REPLACE FUNCTION public.appoint_studio_trainer(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid;
  v_caller uuid := auth.uid();
BEGIN
  -- Caller must be owner or existing coach of a studio.
  SELECT s.id INTO v_studio
  FROM public.studios s
  WHERE s.owner_user_id = v_caller
  LIMIT 1;

  IF v_studio IS NULL THEN
    SELECT p.studio_id INTO v_studio
    FROM public.profiles p
    WHERE p.id = v_caller AND p.is_coach = true AND p.studio_id IS NOT NULL;
  END IF;

  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Target must be a member of the caller's studio.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.studio_id = v_studio
  ) THEN
    RAISE EXCEPTION 'target is not a member of this studio';
  END IF;

  UPDATE public.profiles SET is_coach = true WHERE id = p_user_id;

  INSERT INTO public.studio_coaches (studio_id, user_id, role)
  VALUES (v_studio, p_user_id, NULL)
  ON CONFLICT (studio_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_studio_trainer(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid;
  v_caller uuid := auth.uid();
BEGIN
  SELECT s.id INTO v_studio
  FROM public.studios s
  WHERE s.owner_user_id = v_caller
  LIMIT 1;

  IF v_studio IS NULL THEN
    SELECT p.studio_id INTO v_studio
    FROM public.profiles p
    WHERE p.id = v_caller AND p.is_coach = true AND p.studio_id IS NOT NULL;
  END IF;

  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Owner cannot strip their own trainer rights here (stays manage-capable as owner).
  UPDATE public.profiles SET is_coach = false WHERE id = p_user_id AND studio_id = v_studio;
  DELETE FROM public.studio_coaches WHERE studio_id = v_studio AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.appoint_studio_trainer(uuid) FROM public;
REVOKE ALL ON FUNCTION public.remove_studio_trainer(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.appoint_studio_trainer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_studio_trainer(uuid) TO authenticated;
