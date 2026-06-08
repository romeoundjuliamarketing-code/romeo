-- Add is_at_studio flag to open_sparrings
ALTER TABLE open_sparrings
  ADD COLUMN IF NOT EXISTS is_at_studio boolean NOT NULL DEFAULT false;

-- RPC: studios with active studio subscription that have coordinates
CREATE OR REPLACE FUNCTION get_subscribed_studios()
RETURNS TABLE (
  id        uuid,
  name      text,
  city      text,
  address   text,
  lat       double precision,
  lng       double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.city, s.address, s.lat, s.lng
  FROM studios s
  JOIN subscriptions sub ON sub.user_id = s.owner_user_id
  WHERE sub.tier = 'studio'
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
    AND s.lat IS NOT NULL
    AND s.lng IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION get_subscribed_studios() TO authenticated;
