-- Public read-only view for sharing a single sparring on the web.
-- Exposes ONLY non-sensitive fields, never the exact street address or lat/lng,
-- only active, non-verified_only sparrings.

CREATE OR REPLACE VIEW public.public_sparrings
WITH (security_invoker = false) AS
SELECT
  os.id,
  os.title,
  os.discipline,
  os.scheduled_at,
  os.duration_min,
  os.max_slots,
  GREATEST(
    0,
    os.max_slots - (
      SELECT count(*) FROM sparring_signups ss WHERE ss.sparring_id = os.id
    )
  )::int AS slots_left,
  -- Coarse location: studio name when at a studio, otherwise only the city part
  -- of the address (segment after the last comma), never the exact street.
  CASE
    WHEN os.is_at_studio AND st.name IS NOT NULL THEN st.name
    WHEN position(',' IN os.address) > 0
      THEN btrim(split_part(os.address, ',', -1))
    ELSE 'Ort in der App'
  END AS area_label,
  p.name          AS host_name,
  p.avatar_url    AS host_avatar_url
FROM open_sparrings os
LEFT JOIN studios  st ON st.id = os.studio_id
LEFT JOIN profiles p  ON p.id = os.created_by
WHERE os.is_active = true
  AND os.verified_only = false;

-- View runs with the definer's rights (postgres), so anon can read exactly the
-- exposed columns without direct access to the base tables.
GRANT SELECT ON public.public_sparrings TO anon, authenticated;
