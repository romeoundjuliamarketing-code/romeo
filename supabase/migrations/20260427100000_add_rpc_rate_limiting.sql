-- Rate limiting for add_workout_points RPC.
-- Tracks daily call counts per user in a lightweight table and rejects
-- requests beyond 25 per day (real maximum for an active user is ~18).

-- ── Rate limit tracking table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rpc_rate_limits (
  user_id    uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rpc_date   date    NOT NULL DEFAULT CURRENT_DATE,
  rpc_name   text    NOT NULL,
  call_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, rpc_date, rpc_name)
);

-- No RLS needed: only accessible via SECURITY DEFINER functions below.
ALTER TABLE rpc_rate_limits DISABLE ROW LEVEL SECURITY;

-- Auto-prune rows older than 7 days to keep the table small.
CREATE OR REPLACE FUNCTION prune_old_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rpc_rate_limits WHERE rpc_date < CURRENT_DATE - INTERVAL '7 days';
$$;

-- ── add_workout_points with rate limit ────────────────────────────────────────

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
  INSERT INTO rpc_rate_limits (user_id, rpc_date, rpc_name, call_count)
  VALUES (p_user_id, CURRENT_DATE, 'add_workout_points', 1)
  ON CONFLICT (user_id, rpc_date, rpc_name)
  DO UPDATE SET call_count = rpc_rate_limits.call_count + 1
  RETURNING call_count INTO v_calls;

  IF v_calls > 25 THEN
    RAISE EXCEPTION 'rate_limit_exceeded'
      USING DETAIL = 'add_workout_points called more than 25 times today';
  END IF;

  UPDATE profiles
  SET total_points = GREATEST(0, total_points + p_points)
  WHERE id = p_user_id;
END;
$$;
