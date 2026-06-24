import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { Venue } from '../types/database.types';

export function useVenueProfile(venueId: string): {
  venue: Venue | null;
  loading: boolean;
  refetch: () => void;
} {
  const cacheKey = venueId.trim().length > 0 ? `useVenueProfile:${venueId}` : null;
  const cached = cacheKey ? getCached<Venue>(cacheKey) : undefined;
  const [venue, setVenue] = useState<Venue | null>(() => cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [trigger, setTrigger] = useState(0);
  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (venueId.trim().length === 0) return;
    let cancelled = false;
    const hasCache = cacheKey ? getCached<Venue>(cacheKey) !== undefined : false;
    if (!hasCache) setLoading(true);
    void (async () => {
      const { data } = await supabase.from('venues').select('*').eq('id', venueId).single();
      if (cancelled) return;
      setVenue((data as Venue | null) ?? null);
      if (data !== null && cacheKey) setCached<Venue>(cacheKey, data as Venue);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [venueId, trigger, cacheKey]);

  return { venue, loading, refetch };
}
