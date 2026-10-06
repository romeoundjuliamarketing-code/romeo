-- Security hardening (audit 2026-10-05). Server-only; compatible with installed app versions.

-- Credit RPCs are unused by the client and had no caller check: server-only.
REVOKE EXECUTE ON FUNCTION public.increment_credits(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_credits(uuid, integer) FROM PUBLIC, anon, authenticated;

-- Privileged profile columns may only change via SECURITY DEFINER RPCs/triggers
-- (those run as the function owner, so current_user is not 'authenticated').
CREATE OR REPLACE FUNCTION public.guard_profiles_privileged()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_coach IS TRUE
       OR NEW.coach_verified_at IS NOT NULL
       OR NEW.coach_verified_by IS NOT NULL
       OR NEW.phone_verified_at IS NOT NULL
       OR NEW.is_professional IS TRUE THEN
      RAISE EXCEPTION 'Dieses Feld kann nicht direkt gesetzt werden.' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.id                IS DISTINCT FROM OLD.id
     OR NEW.email             IS DISTINCT FROM OLD.email
     OR NEW.is_coach          IS DISTINCT FROM OLD.is_coach
     OR NEW.coach_verified_at IS DISTINCT FROM OLD.coach_verified_at
     OR NEW.coach_verified_by IS DISTINCT FROM OLD.coach_verified_by
     OR NEW.phone_verified_at IS DISTINCT FROM OLD.phone_verified_at
     OR NEW.is_professional   IS DISTINCT FROM OLD.is_professional
     OR NEW.credits           IS DISTINCT FROM OLD.credits
     OR NEW.total_points      IS DISTINCT FROM OLD.total_points
     OR NEW.streak_days       IS DISTINCT FROM OLD.streak_days
     OR NEW.profile_code      IS DISTINCT FROM OLD.profile_code
     OR NEW.created_at        IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Dieses Feld kann nicht direkt geändert werden.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_privileged ON public.profiles;
CREATE TRIGGER trg_guard_profiles_privileged
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_privileged();

-- studio-assets: only the uploader may overwrite (was: any authenticated user).
DROP POLICY IF EXISTS studio_assets_update ON storage.objects;
CREATE POLICY studio_assets_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'studio-assets' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'studio-assets' AND owner = auth.uid());

-- Public image buckets: images only, bounded size (blocks HTML/SVG hosting).
UPDATE storage.buckets
   SET file_size_limit    = 10485760,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id IN ('studio-assets', 'venues');
