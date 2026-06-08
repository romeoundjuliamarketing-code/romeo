-- Security fix: revoke anon execute on all SECURITY DEFINER RPCs + enable RLS
-- on rpc_rate_limits + fix missing/null-unsafe auth checks in two functions.
--
-- Root cause: Supabase advisor flagged all SECURITY DEFINER functions as
-- callable by the anon role. The anon key is public (baked into the APK by
-- design), so any unauthenticated request could invoke these RPCs directly.
--
-- Fixes applied:
--   1. REVOKE EXECUTE FROM anon for every sensitive RPC.
--   2. Enable RLS on rpc_rate_limits (SECURITY DEFINER functions bypass RLS,
--      so internal usage is unaffected; direct REST access is now blocked).
--   3. Rewrite deduct_workout_points to enforce auth.uid() = p_user_id.
--   4. Rewrite log_daily_activity to use IS DISTINCT FROM (null-safe).

-- ── 1. Enable RLS on rpc_rate_limits ─────────────────────────────────────────
-- The table is only ever written by SECURITY DEFINER RPCs (which bypass RLS).
-- Direct REST access via the anon or authenticated role is now denied.
ALTER TABLE rpc_rate_limits ENABLE ROW LEVEL SECURITY;

-- ── 2. Revoke anon execute on all sensitive RPCs ──────────────────────────────
REVOKE EXECUTE ON FUNCTION public.add_workout_points(uuid, date, integer)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.deduct_workout_points(uuid, integer)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_attendance(uuid, uuid, date, integer)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.unmark_attendance(uuid, uuid, date)             FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_daily_activity(uuid, date, text, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_credits(uuid, integer)                FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_credits(uuid, integer)                FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_studio_invite(text)                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_studio_invite(uuid)                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_studio_with_owner(text, text)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.cast_coach_vote(uuid)                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_coach_nomination(uuid)                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.self_demote_coach()                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.deactivate_sparring(uuid)                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_my_account()                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_entitlement()                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_studio_id()                              FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_subscribed_studios()                        FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                               FROM anon;
REVOKE EXECUTE ON FUNCTION public.prune_old_rate_limits()                         FROM anon;

-- ── 3. Fix deduct_workout_points — add missing auth check ─────────────────────
CREATE OR REPLACE FUNCTION public.deduct_workout_points(
  p_user_id uuid,
  p_points  integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE profiles
  SET total_points = GREATEST(0, total_points - p_points)
  WHERE id = auth.uid();
END;
$$;

-- ── 4. Fix log_daily_activity — null-safe auth check ─────────────────────────
-- The original `auth.uid() != p_user_id` evaluates to NULL (not TRUE) when
-- auth.uid() is NULL (anon session), silently bypassing the guard.
-- IS DISTINCT FROM is always boolean and handles NULL correctly.
CREATE OR REPLACE FUNCTION public.log_daily_activity(
  p_user_id      uuid,
  p_date         date,
  p_title        text,
  p_training_type text,
  p_points       integer,
  p_duration_min integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calls integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('error', 'Nicht autorisiert');
  END IF;

  INSERT INTO rpc_rate_limits (user_id, rpc_date, rpc_name, call_count)
  VALUES (p_user_id, CURRENT_DATE, 'add_workout_points', 1)
  ON CONFLICT (user_id, rpc_date, rpc_name)
  DO UPDATE SET call_count = rpc_rate_limits.call_count + 1
  RETURNING call_count INTO v_calls;

  IF v_calls > 25 THEN
    RETURN jsonb_build_object('error', 'Tageslimit erreicht');
  END IF;

  INSERT INTO workout_logs (user_id, date, title, training_type, points, duration_min, completed, source)
  VALUES (p_user_id, p_date, p_title, p_training_type, p_points, p_duration_min, true, 'manual');

  UPDATE profiles
  SET total_points = GREATEST(0, total_points + p_points)
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
