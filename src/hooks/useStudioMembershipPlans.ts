import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { MembershipPlan } from '../types/database.types';

interface UseStudioMembershipPlansResult {
  plans:   MembershipPlan[];
  loading: boolean;
  refetch: () => void;
}

// Loads all active membership plans for a given studio (public read).
export function useStudioMembershipPlans(studioId: string): UseStudioMembershipPlansResult {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

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
      setPlans((data ?? []) as MembershipPlan[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [studioId, trigger]);

  return { plans, loading, refetch };
}
