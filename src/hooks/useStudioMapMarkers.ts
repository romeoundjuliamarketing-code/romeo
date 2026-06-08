import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

export interface StudioMapMarker {
  id: string;
  name: string;
  city: string;
  address: string | null;
  lat: number;
  lng: number;
}

export function useStudioMapMarkers(refetchTrigger = 0): {
  studios: StudioMapMarker[];
  loading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const [studios, setStudios] = useState<StudioMapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [localTrigger, setLocalTrigger] = useState(0);

  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;

    void (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_subscribed_studios');

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      reportNetworkSuccess();
      setStudios((data ?? []) as StudioMapMarker[]);
      setLoading(false);
    })();
  }, [user, refetchTrigger, localTrigger]);

  return { studios, loading, refetch };
}
