import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';

export interface StudioProfile {
  id: string;
  name: string;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  disciplines: string[];
  owner_user_id: string | null;
}

export function useStudioProfile(studioId: string): {
  studio: StudioProfile | null;
  loading: boolean;
  refetch: () => void;
} {
  const cacheKey = studioId.trim().length > 0 ? `useStudioProfile:${studioId}` : null;
  const cached = cacheKey ? getCached<StudioProfile>(cacheKey) : undefined;
  const [studio, setStudio] = useState<StudioProfile | null>(() => cached ?? null);
  // Only show the blocking spinner when there is no cached data to render.
  const [loading, setLoading] = useState(cached === undefined);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (studioId.trim().length === 0) return;

    let cancelled = false;
    // Stale-while-revalidate: serve cached data instantly, refetch in background.
    const hasCache = cacheKey ? getCached<StudioProfile>(cacheKey) !== undefined : false;
    if (!hasCache) setLoading(true);

    void (async () => {
      const { data } = await supabase
        .from('studios')
        .select('id, name, city, address, lat, lng, description, banner_url, avatar_url, disciplines, owner_user_id')
        .eq('id', studioId)
        .single();
      if (cancelled) return;
      setStudio(data ?? null);
      if (data !== null && cacheKey) setCached<StudioProfile>(cacheKey, data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [studioId, trigger, cacheKey]);

  return { studio, loading, refetch };
}
