import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

export interface SparringWithMeta {
  id: string;
  studio_id: string | null;
  created_by: string;
  title: string;
  discipline: string;
  address: string;
  lat: number | null;
  lng: number | null;
  scheduled_at: string;
  duration_min: number;
  max_slots: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  studio_name: string;
  studio_city: string;
  signup_count: number;
  is_signed_up: boolean;
}

export function useOpenSparrings(refetchTrigger = 0): {
  sparrings: SparringWithMeta[];
  loading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const [sparrings, setSparrings] = useState<SparringWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [localTrigger, setLocalTrigger] = useState(0);

  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;

    void (async () => {
      setLoading(true);
      const now = new Date().toISOString();

      const { data: rows, error } = await supabase
        .from('open_sparrings')
        .select('*, studios!studio_id(name, city)')
        .eq('is_active', true)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true });

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      const [{ data: mySignups }, { data: allSignups }] = await Promise.all([
        supabase.from('sparring_signups').select('sparring_id').eq('user_id', user.id),
        supabase.from('sparring_signups').select('sparring_id'),
      ]);

      const signedUpIds = new Set((mySignups ?? []).map((s) => s.sparring_id));
      const countMap: Record<string, number> = {};
      for (const s of allSignups ?? []) {
        countMap[s.sparring_id] = (countMap[s.sparring_id] ?? 0) + 1;
      }

      type StudioJoin = { name: string; city: string } | null;

      const result: SparringWithMeta[] = (rows ?? []).map((r) => {
        const studio = r.studios as StudioJoin;
        return {
          id: r.id,
          studio_id: r.studio_id,
          created_by: r.created_by,
          title: r.title,
          discipline: r.discipline,
          address: r.address,
          lat: r.lat,
          lng: r.lng,
          scheduled_at: r.scheduled_at,
          duration_min: r.duration_min,
          max_slots: r.max_slots,
          notes: r.notes,
          is_active: r.is_active,
          created_at: r.created_at,
          studio_name: studio?.name ?? 'Privat',
          studio_city: studio?.city ?? '',
          signup_count: countMap[r.id] ?? 0,
          is_signed_up: signedUpIds.has(r.id),
        };
      });

      reportNetworkSuccess();
      setSparrings(result);
      setLoading(false);
    })();
  }, [user, refetchTrigger, localTrigger]);

  return { sparrings, loading, refetch };
}
