-- Security (release 1.2.7): invite codes (6 hex chars) could be brute-forced.
--
-- accept_studio_invite_v2 counts failed attempts per user and locks after
-- 5 failures within an hour. It returns a status instead of raising: a RAISE
-- would roll back the attempt row and the counter would never grow.
-- The old accept_studio_invite stays untouched for old app builds and is
-- revoked once they are gone.

CREATE TABLE IF NOT EXISTS public.studio_invite_attempts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studio_invite_attempts_user_time_idx
  ON public.studio_invite_attempts (user_id, created_at);

-- Only the DEFINER function touches this table.
ALTER TABLE public.studio_invite_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.studio_invite_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_studio_invite_v2(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_failures        integer;
  v_studio_id       uuid;
  v_subscription_id uuid;
  v_owner_tier      text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_signed_in');
  END IF;

  -- Serialize attempts of the same user so parallel calls can't skip the limit.
  PERFORM pg_advisory_xact_lock(hashtext('studio_invite_attempts'), hashtext(v_uid::text));

  SELECT count(*) INTO v_failures
  FROM public.studio_invite_attempts
  WHERE user_id = v_uid AND created_at > now() - interval '1 hour';

  IF v_failures >= 5 THEN
    RETURN jsonb_build_object('status', 'locked');
  END IF;

  SELECT studio_id INTO v_studio_id
  FROM public.studio_invite_codes
  WHERE upper(code) = upper(trim(coalesce(p_code, ''))) AND expires_at > now();

  IF v_studio_id IS NULL THEN
    INSERT INTO public.studio_invite_attempts (user_id) VALUES (v_uid);
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  -- Same rules as accept_studio_invite: the owner needs an active plan that
  -- allows inviting members.
  SELECT sub.id, sub.tier
  INTO v_subscription_id, v_owner_tier
  FROM public.subscriptions sub
  JOIN public.studios s ON s.owner_user_id = sub.user_id
  WHERE s.id = v_studio_id
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
  LIMIT 1;

  IF v_subscription_id IS NULL OR NOT entitlement_allows(v_owner_tier, 'invite_members') THEN
    RETURN jsonb_build_object('status', 'no_subscription');
  END IF;

  INSERT INTO public.studio_memberships (subscription_id, user_id)
  VALUES (v_subscription_id, v_uid)
  ON CONFLICT (subscription_id, user_id) DO NOTHING;

  UPDATE public.profiles
  SET studio_id = v_studio_id
  WHERE id = v_uid;

  RETURN jsonb_build_object('status', 'ok', 'studio_id', v_studio_id);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_studio_invite_v2(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_studio_invite_v2(text) TO authenticated;
