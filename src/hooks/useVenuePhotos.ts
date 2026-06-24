import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { VenuePhoto } from '../types/database.types';

type Snapshot = { photos: VenuePhoto[] };

export function useVenuePhotos(venueId: string): {
  photos: VenuePhoto[];
  loading: boolean;
  refetch: () => void;
} {
  const cacheKey = venueId.trim().length > 0 ? `useVenuePhotos:${venueId}` : null;
  const cached = cacheKey ? getCached<Snapshot>(cacheKey) : undefined;
  const [photos, setPhotos] = useState<VenuePhoto[]>(() => cached?.photos ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [trigger, setTrigger] = useState(0);
  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (venueId.trim().length === 0) return;
    let cancelled = false;
    const hasCache = cacheKey ? getCached<Snapshot>(cacheKey) !== undefined : false;
    if (!hasCache) setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from('venue_photos').select('*').eq('venue_id', venueId)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      const rows = (data as VenuePhoto[] | null) ?? [];
      setPhotos(rows);
      if (cacheKey) setCached<Snapshot>(cacheKey, { photos: rows });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [venueId, trigger, cacheKey]);

  return { photos, loading, refetch };
}
