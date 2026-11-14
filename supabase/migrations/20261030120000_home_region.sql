-- Home region (country + state/canton as ISO 3166-2) for internal statistics
-- on where the community lives. The app derives it OFFLINE on the device from
-- the chosen search location (point-in-polygon, src/utils/homeRegion.ts); no
-- coordinates, city or address are ever sent or stored.
--
-- Stored in profile_private (owner-only read, no write policies) because
-- profiles is readable by every authenticated user (policy profile_lesen).
--
-- Additive only: old app versions never call set_my_home_region and never
-- read these columns.
--
-- Existing users from before the onboarding (2026-10-11) often have no
-- profile_private row, so birth_date must allow NULL for a region-only row.
-- Safe: onboarding_age_ok(NULL) is false, so complete_onboarding and
-- get_my_onboarding_state behave exactly as before for such rows.

ALTER TABLE public.profile_private
  ALTER COLUMN birth_date DROP NOT NULL;

ALTER TABLE public.profile_private
  ADD COLUMN IF NOT EXISTS home_country           text,
  ADD COLUMN IF NOT EXISTS home_region            text,
  ADD COLUMN IF NOT EXISTS home_region_source     text,
  ADD COLUMN IF NOT EXISTS home_region_updated_at timestamptz;

ALTER TABLE public.profile_private
  DROP CONSTRAINT IF EXISTS profile_private_home_region_source_check;
ALTER TABLE public.profile_private
  ADD CONSTRAINT profile_private_home_region_source_check
  CHECK (home_region_source IS NULL OR home_region_source IN ('auto', 'manual', 'declined'));

-- Shape: no source = no values; declined = no values; a region always has its
-- country (outside DACH = 'auto' with both NULL).
ALTER TABLE public.profile_private
  DROP CONSTRAINT IF EXISTS profile_private_home_region_shape_check;
ALTER TABLE public.profile_private
  ADD CONSTRAINT profile_private_home_region_shape_check
  CHECK (
    (home_region_source IS NULL       AND home_country IS NULL AND home_region IS NULL)
    OR (home_region_source = 'declined' AND home_country IS NULL AND home_region IS NULL)
    OR (home_region_source IN ('auto', 'manual')
        AND (home_region IS NULL OR home_country IS NOT NULL))
  );

-- Fixed whitelist: 16 German states, 9 Austrian states, 26 Swiss cantons.
CREATE OR REPLACE FUNCTION public.home_region_valid(p_country text, p_region text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_country IS NULL THEN p_region IS NULL
    WHEN p_region IS NULL THEN false
    WHEN p_country = 'DE' THEN p_region = ANY (ARRAY[
      'DE-BW','DE-BY','DE-BE','DE-BB','DE-HB','DE-HH','DE-HE','DE-MV',
      'DE-NI','DE-NW','DE-RP','DE-SL','DE-SN','DE-ST','DE-SH','DE-TH'])
    WHEN p_country = 'AT' THEN p_region = ANY (ARRAY[
      'AT-1','AT-2','AT-3','AT-4','AT-5','AT-6','AT-7','AT-8','AT-9'])
    WHEN p_country = 'CH' THEN p_region = ANY (ARRAY[
      'CH-AG','CH-AI','CH-AR','CH-BE','CH-BL','CH-BS','CH-FR','CH-GE',
      'CH-GL','CH-GR','CH-JU','CH-LU','CH-NE','CH-NW','CH-OW','CH-SG',
      'CH-SH','CH-SO','CH-SZ','CH-TG','CH-TI','CH-UR','CH-VD','CH-VS',
      'CH-ZG','CH-ZH'])
    ELSE false
  END;
$$;

-- Sets the caller's home region.
--   'auto'     derived on the device; never overwrites 'manual' or 'declined'.
--              (country, region) both NULL = outside DACH.
--   'manual'   picked in the settings; country + region required.
--   'declined' "Keine Angabe"; values must be NULL.
-- Returns false when an 'auto' write was skipped, true when stored.
CREATE OR REPLACE FUNCTION public.set_my_home_region(
  p_country text,
  p_region  text,
  p_source  text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_current text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'HOME_REGION_NOT_SIGNED_IN' USING ERRCODE = '42501';
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('auto', 'manual', 'declined') THEN
    RAISE EXCEPTION 'HOME_REGION_INVALID_SOURCE' USING ERRCODE = '22023';
  END IF;
  IF p_source = 'declined' AND (p_country IS NOT NULL OR p_region IS NOT NULL) THEN
    RAISE EXCEPTION 'HOME_REGION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_source = 'manual' AND (p_country IS NULL OR p_region IS NULL) THEN
    RAISE EXCEPTION 'HOME_REGION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT public.home_region_valid(p_country, p_region) THEN
    RAISE EXCEPTION 'HOME_REGION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
    RAISE EXCEPTION 'HOME_REGION_NO_PROFILE' USING ERRCODE = 'P0002';
  END IF;

  SELECT home_region_source INTO v_current
  FROM public.profile_private
  WHERE id = v_uid
  FOR UPDATE;

  IF p_source = 'auto' AND v_current IN ('manual', 'declined') THEN
    RETURN false;
  END IF;

  INSERT INTO public.profile_private
    (id, home_country, home_region, home_region_source, home_region_updated_at, updated_at)
  VALUES
    (v_uid, p_country, p_region, p_source, now(), now())
  ON CONFLICT (id) DO UPDATE
    SET home_country           = EXCLUDED.home_country,
        home_region            = EXCLUDED.home_region,
        home_region_source     = EXCLUDED.home_region_source,
        home_region_updated_at = now(),
        updated_at             = now()
    -- Re-checked here against a concurrent manual/declined write.
    WHERE EXCLUDED.home_region_source <> 'auto'
       OR public.profile_private.home_region_source IS NULL
       OR public.profile_private.home_region_source = 'auto';

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.home_region_valid(text, text)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_my_home_region(text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_my_home_region(text, text, text) TO authenticated;
