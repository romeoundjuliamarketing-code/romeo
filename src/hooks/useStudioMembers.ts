import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface StudioMember {
  id: string;
  name: string | null;
  total_points: number;
  is_coach: boolean;
}

export function useStudioMembers(studioId: string): {
  members: StudioMember[];
  loading: boolean;
  refetch: () => void;
} {
  const [members, setMembers] = useState<StudioMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (studioId.trim().length === 0) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, total_points, is_coach')
        .eq('studio_id', studioId);

      if (cancelled) return;

      const mapped: StudioMember[] = (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string | null,
        total_points: (row.total_points as number) ?? 0,
        is_coach: (row.is_coach as boolean) ?? false,
      }));

      setMembers(mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [studioId, trigger]);

  return { members, loading, refetch };
}
