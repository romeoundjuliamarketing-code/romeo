-- Security (release 1.2.7): event signups were readable without login
-- (policy for role public exposed user_ids of every active event).
--
-- 1. Counts come from a DEFINER RPC that returns numbers only.
-- 2. The SELECT policy is limited to signed-in users. Old app builds read
--    event_signups while logged in, so they keep working. A tighter policy
--    (own rows / organizer / fellow participants) follows once old builds
--    are gone.

CREATE OR REPLACE FUNCTION public.get_event_signup_counts(p_event_ids uuid[])
RETURNS TABLE (event_id uuid, signup_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF p_event_ids IS NULL OR cardinality(p_event_ids) = 0 THEN
    RETURN;
  END IF;
  IF cardinality(p_event_ids) > 200 THEN
    RAISE EXCEPTION 'too many events';
  END IF;

  -- Same visibility as the table policy: active events, or my own.
  RETURN QUERY
  SELECT e.id, count(s.id)::integer
  FROM public.events e
  LEFT JOIN public.event_signups s ON s.event_id = e.id
  WHERE e.id = ANY (p_event_ids)
    AND (e.is_active OR e.created_by = auth.uid())
  GROUP BY e.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_signup_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_signup_counts(uuid[]) TO authenticated;

DROP POLICY IF EXISTS "read signups of active events" ON public.event_signups;
CREATE POLICY "read signups of active events" ON public.event_signups
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND (e.is_active OR e.created_by = auth.uid())
    )
  );
