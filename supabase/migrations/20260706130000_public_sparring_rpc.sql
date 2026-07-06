-- Replace the public_sparrings VIEW with a by-id SECURITY DEFINER RPC.
--
-- Why: a publicly-readable view lets anyone with the (bundle-embedded) anon key
-- enumerate every public sparring. The web showcase only ever needs ONE sparring
-- by id, so a by-id definer function is a smaller, safer surface and matches the
-- project's established "business logic in SECURITY DEFINER RPCs" convention. It
-- also clears the `security_definer_view` advisor.
--
-- Exposes ONLY non-sensitive fields, never the exact street/lat/lng, and only for
-- active, non-verified_only sparrings.

DROP VIEW IF EXISTS public.public_sparrings;

CREATE OR REPLACE FUNCTION public.get_public_sparring(p_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'id',              os.id,
    'title',           os.title,
    'discipline',      os.discipline,
    'scheduled_at',    os.scheduled_at,
    'duration_min',    os.duration_min,
    'max_slots',       os.max_slots,
    'slots_left',      GREATEST(
                         0,
                         os.max_slots - (
                           SELECT count(*) FROM sparring_signups ss WHERE ss.sparring_id = os.id
                         )
                       )::int,
    -- Coarse location: studio name when at a studio, else a German "PLZ Stadt"
    -- label extracted from the address. Never emits raw coordinates (lat/lng
    -- pairs have no "<5-digit> <city>" match) or house numbers (digits terminate
    -- the city character class); falls back to a generic label otherwise.
    'area_label',      CASE
                         WHEN os.is_at_studio AND st.name IS NOT NULL THEN st.name
                         ELSE COALESCE(
                           NULLIF(
                             btrim(substring(os.address from '(?:^|\s)(\d{5}\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .-]*)')),
                             ''
                           ),
                           'Ort in der App'
                         )
                       END,
    'host_name',       p.name,
    'host_avatar_url', p.avatar_url
  )
  FROM open_sparrings os
  LEFT JOIN studios  st ON st.id = os.studio_id
  LEFT JOIN profiles p  ON p.id = os.created_by
  WHERE os.id = p_id
    AND os.is_active = true
    AND os.verified_only = false;
$$;

REVOKE ALL     ON FUNCTION public.get_public_sparring(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_public_sparring(uuid) TO anon, authenticated;
