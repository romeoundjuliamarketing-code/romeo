import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getCached, setCached } from '../lib/queryCache';

type Snapshot = { venueId: string | null };

export function useMyVenue(refetchTrigger = 0): {
  venueId: string | null;
  loading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const cacheKey = user ? `useMyVenue:${user.id}` : null;
  const cached = cacheKey ? getCached<Snapshot>(cacheKey) : undefined;
  const [venueId, setVenueId] = useState<string | null>(() => cached?.venueId ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [localTrigger, setLocalTrigger] = useState(0);
  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;
    void (async () => {
      const { data } = await supabase
        .from('venues').select('id').eq('owner_user_id', user.id).maybeSingle();
      const id = (data as { id: string } | null)?.id ?? null;
      setVenueId(id);
      if (cacheKey) setCached<Snapshot>(cacheKey, { venueId: id });
      setLoading(false);
    })();
  }, [user, refetchTrigger, localTrigger]);

  return { venueId, loading, refetch };
}
