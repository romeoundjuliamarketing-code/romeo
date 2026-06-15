import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';

export interface StudioMapMarker {
  id: string;
  name: string;
  city: string;
  address: string | null;
  lat: number;
  lng: number;
}

type StudioMapMarkersSnapshot = { studios: StudioMapMarker[] };

export function useStudioMapMarkers(refetchTrigger = 0): {
  studios: StudioMapMarker[];
  loading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const cacheKey = user ? `useStudioMapMarkers:${user.id}` : null;
  const cached = cacheKey ? getCached<StudioMapMarkersSnapshot>(cacheKey) : undefined;
  const [studios, setStudios] = useState<StudioMapMarker[]>(() => cached?.studios ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [localTrigger, setLocalTrigger] = useState(0);

  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;

    void (async () => {
      const { data, error } = await supabase.rpc('get_subscribed_studios');

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      reportNetworkSuccess();
      const markers = (data ?? []) as StudioMapMarker[];
      setStudios(markers);
      if (cacheKey) setCached<StudioMapMarkersSnapshot>(cacheKey, { studios: markers });
      setLoading(false);
    })();
  }, [user, refetchTrigger, localTrigger]);

  return { studios, loading, refetch };
}
