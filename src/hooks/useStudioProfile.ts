import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
  const [studio, setStudio] = useState<StudioProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (studioId.trim().length === 0) return;

    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('studios')
        .select('id, name, city, address, lat, lng, description, banner_url, avatar_url, disciplines, owner_user_id')
        .eq('id', studioId)
        .single();
      setStudio(data ?? null);
      setLoading(false);
    })();
  }, [studioId, trigger]);

  return { studio, loading, refetch };
}
