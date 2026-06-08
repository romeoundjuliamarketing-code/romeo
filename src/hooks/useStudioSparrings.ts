import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
  const [sparrings, setSparrings] = useState<StudioSparring[]>([]);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const now = new Date().toISOString();

      const { data: rows } = await supabase
        .from('open_sparrings')
        .select('id, title, discipline, scheduled_at, max_slots, is_active')
        .eq('studio_id', studioId)
        .eq('is_active', true)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true });

      if (rows === null || rows.length === 0) {
        setSparrings([]);
        setLoading(false);
        return;
      }

      const { data: signups } = await supabase
        .from('sparring_signups')
        .select('sparring_id')
        .in('sparring_id', rows.map((r) => r.id));

      const countMap: Record<string, number> = {};
      for (const s of signups ?? []) {
        countMap[s.sparring_id] = (countMap[s.sparring_id] ?? 0) + 1;
      }

      setSparrings(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          discipline: r.discipline,
          scheduled_at: r.scheduled_at,
          max_slots: r.max_slots,
          signup_count: countMap[r.id] ?? 0,
          is_active: r.is_active,
        })),
      );
      setLoading(false);
    })();
  }, [studioId, trigger]);

  return { sparrings, loading, refetch };
}
