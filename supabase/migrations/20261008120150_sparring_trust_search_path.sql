-- Reliable sparrings: pin search_path on the helper functions of
-- 20261008120000/120100 (Supabase advisor "function_search_path_mutable").
-- No behaviour change.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND (p.proname LIKE 'sparring\_trust\_%'
            OR p.proname IN ('geo_distance_m','sparring_within_radius','sparring_end_at',
                             'sparring_is_cancelled','sparring_user_lock_key','sparring_user_lock',
                             'sparring_position_problem','trg_open_sparring_deactivated_at'))
       AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', f);
  END LOOP;
END $$;
