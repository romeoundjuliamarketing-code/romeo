import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { MembershipPlan } from '../types/database.types';

interface UseStudioMembershipPlansResult {
  plans:   MembershipPlan[];
  loading: boolean;
  refetch: () => void;
}

// Loads all active membership plans for a given studio (public read).
export function useStudioMembershipPlans(studioId: string): UseStudioMembershipPlansResult {
  const cacheKey = studioId.trim().length > 0 ? `useStudioMembershipPlans:${studioId}` : null;
  const cached = cacheKey ? getCached<MembershipPlan[]>(cacheKey) : undefined;
  const [plans, setPlans] = useState<MembershipPlan[]>(() => cached ?? []);
  // Only show the blocking spinner when there is no cached data to render.
  const [loading, setLoading] = useState(cached === undefined);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    // Stale-while-revalidate: serve cached data instantly, refetch in background.
    const hasCache = cacheKey ? getCached<MembershipPlan[]>(cacheKey) !== undefined : false;
    if (!hasCache) setLoading(true);

    void (async () => {
      const { data, error } = await supabase
        .from('studio_membership_plans')
        .select('*')
        .eq('studio_id', studioId)
        .eq('is_active', true)
        .order('price_cents', { ascending: true });

      if (cancelled) return;

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      reportNetworkSuccess();
      const result = (data ?? []) as MembershipPlan[];
      setPlans(result);
      if (cacheKey) setCached<MembershipPlan[]>(cacheKey, result);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [studioId, trigger, cacheKey]);

  return { plans, loading, refetch };
}
