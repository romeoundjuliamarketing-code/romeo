import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';

export interface StudioSparring {
  id: string;
  title: string;
  discipline: string;
  scheduled_at: string;
  max_slots: number;
  signup_count: number;
  is_active: boolean;
}

export function useStudioSparrings(studioId: string): {
  sparrings: StudioSparring[];
  loading: boolean;
  refetch: () => void;
} {
  const cacheKey = studioId !== '' ? `useStudioSparrings:${studioId}` : null;
  const cached = cacheKey ? getCached<StudioSparring[]>(cacheKey) : undefined;
  const [sparrings, setSparrings] = useState<StudioSparring[]>(() => cached ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Keep showing cached data while revalidating — don't flash a spinner.
      if (cacheKey && getCached<StudioSparring[]>(cacheKey) === undefined) {
        setLoading(true);
      }
      const now = new Date().toISOString();

      const { data: rows } = await supabase
        .from('open_sparrings')
        .select('id, title, discipline, scheduled_at, max_slots, is_active')
        .eq('studio_id', studioId)
        .eq('is_active', true)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true });

      if (cancelled) return;

      if (rows === null || rows.length === 0) {
        setSparrings([]);
        if (cacheKey) setCached<StudioSparring[]>(cacheKey, []);
        setLoading(false);
        return;
      }

      const { data: signups } = await supabase
        .from('sparring_signups')
        .select('sparring_id')
        .in('sparring_id', rows.map((r) => r.id));

      if (cancelled) return;

      const countMap: Record<string, number> = {};
      for (const s of signups ?? []) {
        countMap[s.sparring_id] = (countMap[s.sparring_id] ?? 0) + 1;
      }

      const mapped: StudioSparring[] = rows.map((r) => ({
        id: r.id,
        title: r.title,
        discipline: r.discipline,
        scheduled_at: r.scheduled_at,
        max_slots: r.max_slots,
        signup_count: countMap[r.id] ?? 0,
        is_active: r.is_active,
      }));
      setSparrings(mapped);
      if (cacheKey) setCached<StudioSparring[]>(cacheKey, mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [studioId, trigger, cacheKey]);

  return { sparrings, loading, refetch };
}
