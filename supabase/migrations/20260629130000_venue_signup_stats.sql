-- B2B attribution: let a bar partner see how many people signed up via Sparr
-- for the events at their venue. Aggregated counts only (no names) — DSGVO-light
-- and enough as a sales proof. SECURITY DEFINER because event_signups RLS does
-- not let a venue owner aggregate over other users' signups.

CREATE OR REPLACE FUNCTION get_venue_signup_stats(p_venue_id uuid)
RETURNS TABLE (
  event_id     uuid,
  title        text,
  scheduled_at timestamptz,
  signup_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT owner_user_id INTO v_owner FROM venues WHERE id = p_venue_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'venue_not_found';
  END IF;

  -- Only the venue owner or the global venue admin may read these stats.
  IF NOT (v_owner = v_uid OR is_venue_admin()) THEN
    RAISE EXCEPTION 'not_venue_owner';
  END IF;

  RETURN QUERY
  SELECT e.id,
         e.title,
         e.scheduled_at,
         count(s.id) AS signup_count
  FROM events e
  LEFT JOIN event_signups s ON s.event_id = e.id
  WHERE e.venue_id = p_venue_id
  GROUP BY e.id, e.title, e.scheduled_at
  ORDER BY e.scheduled_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_venue_signup_stats(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_venue_signup_stats(uuid) TO authenticated;
