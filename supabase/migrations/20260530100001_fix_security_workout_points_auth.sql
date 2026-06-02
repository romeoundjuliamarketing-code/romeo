-- Security fix: add auth.uid() check to add_workout_points.
-- Previously any authenticated user could pass any p_user_id and
-- award/deduct arbitrary points for any user (IDOR).
-- Rate limit counter now also keys on auth.uid() so the caller's
-- own quota is consumed regardless of the p_user_id they supply.

CREATE OR REPLACE FUNCTION add_workout_points(
  p_user_id uuid,
  p_date    date,
  p_points  integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calls integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO rpc_rate_limits (user_id, rpc_date, rpc_name, call_count)
  VALUES (auth.uid(), CURRENT_DATE, 'add_workout_points', 1)
  ON CONFLICT (user_id, rpc_date, rpc_name)
  DO UPDATE SET call_count = rpc_rate_limits.call_count + 1
  RETURNING call_count INTO v_calls;

  IF v_calls > 25 THEN
    RAISE EXCEPTION 'rate_limit_exceeded'
      USING DETAIL = 'add_workout_points called more than 25 times today';
  END IF;

  UPDATE profiles
  SET total_points = GREATEST(0, total_points + p_points)
  WHERE id = auth.uid();
END;
$$;
