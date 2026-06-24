import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';

export interface VenueMapMarker {
  id:         string;
  name:       string;
  venue_type: string;
  lat:        number;
  lng:        number;
}

type Snapshot = { venues: VenueMapMarker[] };

export function useVenueMapMarkers(refetchTrigger = 0): {
  venues:  VenueMapMarker[];
  loading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const cacheKey = user ? `useVenueMapMarkers:${user.id}` : null;
  const cached = cacheKey ? getCached<Snapshot>(cacheKey) : undefined;
  const [venues,       setVenues]       = useState<VenueMapMarker[]>(() => cached?.venues ?? []);
  const [loading,      setLoading]      = useState(cached === undefined);
  const [localTrigger, setLocalTrigger] = useState(0);
  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    const hasCache = cacheKey ? getCached<Snapshot>(cacheKey) !== undefined : false;
    if (!hasCache) setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('venues')
        .select('id, name, venue_type, lat, lng')
        .eq('is_active', true)
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (cancelled) return;
      if (error !== null) { reportNetworkError(error); setLoading(false); return; }
      reportNetworkSuccess();
      const markers = (data ?? []) as VenueMapMarker[];
      setVenues(markers);
      if (cacheKey) setCached<Snapshot>(cacheKey, { venues: markers });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, refetchTrigger, localTrigger, cacheKey]);

  return { venues, loading, refetch };
}
