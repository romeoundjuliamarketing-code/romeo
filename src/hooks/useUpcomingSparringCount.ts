import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';

// Number of upcoming sparrings a user holds a slot for (pending/confirmed —
// the "holds a slot" set of the commitment migration, same filter as
// useOpenSparrings). Future dates are shown as planned, never as reliability.
// Stale-while-revalidate like useSparringReliability: a re-focus shows the
// cached count immediately and refreshes in the background.
export function useUpcomingSparringCount(userId: string | null, refetchTrigger = 0): number {
  const cacheKey = userId !== null ? `useUpcomingSparringCount:${userId}` : null;
  const [count, setCount] = useState<number>(() => (cacheKey ? getCached<number>(cacheKey) ?? 0 : 0));

  useEffect(() => {
    if (userId === null || cacheKey === null) {
      setCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { count: result, error } = await supabase
        .from('sparring_signups')
        .select('sparring_id, open_sparrings!inner(scheduled_at)', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['pending', 'confirmed'])
        .gt('open_sparrings.scheduled_at', new Date().toISOString());
      if (cancelled || error !== null) return;
      const next = result ?? 0;
      setCached<number>(cacheKey, next);
      setCount(next);
    })();
    return () => { cancelled = true; };
  }, [userId, refetchTrigger, cacheKey]);

  return count;
}
