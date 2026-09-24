-- Fix: profiles.streak_days was never written; last_training_date only in the
-- studio-schedule path. This trigger keeps both fields current from the single
-- source of truth (workout_logs), for ALL logging paths. Water XP is unaffected
-- because it never inserts into workout_logs.

CREATE OR REPLACE FUNCTION public.sync_training_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_last   date;
  v_streak integer := 0;
  v_prev   date := NULL;
  v_day    date;
BEGIN
  SELECT MAX(date) INTO v_last
  FROM workout_logs WHERE user_id = v_uid AND completed = true;

  FOR v_day IN
    SELECT DISTINCT date FROM workout_logs
    WHERE user_id = v_uid AND completed = true
    ORDER BY date DESC
  LOOP
    IF v_prev IS NULL THEN
      v_streak := 1;
    ELSIF v_prev - v_day = 1 THEN
      v_streak := v_streak + 1;
    ELSE
      EXIT;
    END IF;
    v_prev := v_day;
  END LOOP;

  UPDATE profiles
  SET last_training_date = v_last,
      streak_days        = v_streak
  WHERE id = v_uid;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_training_streak ON workout_logs;
CREATE TRIGGER trg_sync_training_streak
AFTER INSERT OR DELETE ON workout_logs
FOR EACH ROW EXECUTE FUNCTION public.sync_training_streak();

-- One-time backfill for existing profiles (gaps-and-islands: consecutive dates
-- share (date - row_number) as a group key; the run ending on the latest day is
-- the current streak).
WITH days AS (
  SELECT user_id, date::date AS d
  FROM workout_logs WHERE completed = true
  GROUP BY user_id, date::date
),
ranked AS (
  SELECT user_id, d,
         d - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d))::int AS grp
  FROM days
),
runs AS (
  SELECT user_id, grp, COUNT(*) AS len, MAX(d) AS run_end
  FROM ranked GROUP BY user_id, grp
),
latest AS (
  SELECT user_id, MAX(d) AS last_day FROM days GROUP BY user_id
),
current_run AS (
  SELECT r.user_id, r.len
  FROM runs r JOIN latest l ON l.user_id = r.user_id AND r.run_end = l.last_day
)
UPDATE profiles p
SET last_training_date = l.last_day,
    streak_days        = COALESCE(c.len, 0)
FROM latest l
LEFT JOIN current_run c ON c.user_id = l.user_id
WHERE p.id = l.user_id;
