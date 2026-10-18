-- Home address, phone and push token were readable by every signed-in user
-- (profiles SELECT policy + column grants). Move them into profile_secrets:
-- RLS on, no policies, no grants -> only SECURITY DEFINER functions and
-- service_role can read them. Compatible with all builds:
-- - no build reads these columns of its own profile (only writes them),
-- - a trigger redirects writes of old builds (address/phone from the old
--   verification screen, push token from useNotifications) into the new table,
-- - the profiles columns stay (always NULL) so select('*') keeps working.
-- Side effect: builds before 2026-10-04 sent team announcement pushes from the
-- client by reading members' push tokens; those reads now return NULL.

CREATE TABLE public.profile_secrets (
  id              uuid PRIMARY KEY
                  REFERENCES public.profiles(id) ON DELETE CASCADE
                  DEFERRABLE INITIALLY DEFERRED,
  address         text,
  address_lat     double precision,
  address_lng     double precision,
  phone           text,
  expo_push_token text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_secrets FROM PUBLIC, anon, authenticated;

INSERT INTO public.profile_secrets (id, address, address_lat, address_lng, phone, expo_push_token)
SELECT id, address, address_lat, address_lng, phone, expo_push_token
FROM public.profiles
WHERE address IS NOT NULL OR address_lat IS NOT NULL OR address_lng IS NOT NULL
   OR phone IS NOT NULL OR expo_push_token IS NOT NULL;

-- Redirect writes. Only non-NULL values are taken over: the profiles columns
-- are always NULL afterwards, so an explicit NULL cannot be told apart from
-- "column not touched" (no build clears these values).
CREATE OR REPLACE FUNCTION public.redirect_profile_secrets()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.address IS NOT NULL OR NEW.address_lat IS NOT NULL OR NEW.address_lng IS NOT NULL THEN
    INSERT INTO profile_secrets (id, address, address_lat, address_lng)
    VALUES (NEW.id, NEW.address, NEW.address_lat, NEW.address_lng)
    ON CONFLICT (id) DO UPDATE
      SET address = EXCLUDED.address, address_lat = EXCLUDED.address_lat,
          address_lng = EXCLUDED.address_lng, updated_at = now();
    NEW.address := NULL; NEW.address_lat := NULL; NEW.address_lng := NULL;
  END IF;
  IF NEW.phone IS NOT NULL THEN
    INSERT INTO profile_secrets (id, phone) VALUES (NEW.id, NEW.phone)
    ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, updated_at = now();
    NEW.phone := NULL;
  END IF;
  IF NEW.expo_push_token IS NOT NULL THEN
    INSERT INTO profile_secrets (id, expo_push_token) VALUES (NEW.id, NEW.expo_push_token)
    ON CONFLICT (id) DO UPDATE SET expo_push_token = EXCLUDED.expo_push_token, updated_at = now();
    NEW.expo_push_token := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.redirect_profile_secrets() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_redirect_profile_secrets
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.redirect_profile_secrets();

UPDATE public.profiles
   SET address = NULL, address_lat = NULL, address_lng = NULL, phone = NULL, expo_push_token = NULL
 WHERE address IS NOT NULL OR address_lat IS NOT NULL OR address_lng IS NOT NULL
    OR phone IS NOT NULL OR expo_push_token IS NOT NULL;

-- Readers: same behaviour, data from profile_secrets.
CREATE OR REPLACE FUNCTION public.get_my_verification()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid             uuid := auth.uid();
  v_email_verified  boolean;
  v_address_verified boolean;
  v_studio_verified boolean;
  v_coach_vouched   boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT (email_confirmed_at IS NOT NULL)
    INTO v_email_verified
    FROM auth.users WHERE id = v_uid;

  SELECT EXISTS (SELECT 1 FROM profile_secrets s WHERE s.id = v_uid AND s.address_lat IS NOT NULL)
    INTO v_address_verified;

  SELECT (coach_verified_at IS NOT NULL)
    INTO v_coach_vouched
    FROM profiles WHERE id = v_uid;

  SELECT EXISTS (
    SELECT 1 FROM studio_memberships
    WHERE user_id = v_uid AND status = 'active'
  ) INTO v_studio_verified;

  RETURN json_build_object(
    'email_verified',   COALESCE(v_email_verified, false),
    'address_verified', COALESCE(v_address_verified, false),
    'studio_verified',  COALESCE(v_studio_verified, false),
    'coach_vouched',    COALESCE(v_coach_vouched, false),
    'phone_verified',   false
  );
END;
$function$;

-- is_user_verified: only replaced while it still uses the address rule, so a
-- previously applied 20261015120000_remove_verification is never undone.
DO $do$
BEGIN
  IF (SELECT prosrc ~ 'address_lat' FROM pg_proc
       WHERE oid = 'public.is_user_verified(uuid)'::regprocedure) THEN
    EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.is_user_verified(p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $body$
  SELECT
    EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_uid AND u.email_confirmed_at IS NOT NULL)
    AND (
      EXISTS (SELECT 1 FROM profile_secrets s WHERE s.id = p_uid AND s.address_lat IS NOT NULL)
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = p_uid AND p.coach_verified_at IS NOT NULL)
      OR EXISTS (SELECT 1 FROM studio_memberships sm WHERE sm.user_id = p_uid AND sm.status = 'active')
    );
$body$
$fn$;
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION public.send_push_notification(p_user_id uuid, p_title text, p_body text, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
  v_badge int;
BEGIN
  SELECT expo_push_token INTO v_token
  FROM profile_secrets
  WHERE id = p_user_id;

  IF v_token IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_badge
  FROM notifications
  WHERE user_id = p_user_id
    AND read_at IS NULL;

  PERFORM net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    body    := jsonb_build_object(
                 'to',    v_token,
                 'title', p_title,
                 'body',  p_body,
                 'badge', v_badge,
                 'data',  COALESCE(p_data, '{}'::jsonb)
               ),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$function$;
