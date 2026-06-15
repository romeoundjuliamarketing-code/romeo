import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';

export interface EventWithMeta {
  id: string;
  created_by: string;
  title: string;
  fight_card: string | null;
  venue_name: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  scheduled_at: string;
  duration_min: number;
  max_slots: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  signup_count: number;
  is_signed_up: boolean;
}

type OpenEventsSnapshot = { events: EventWithMeta[] };

export function useOpenEvents(refetchTrigger = 0): {
  events: EventWithMeta[];
  loading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const cacheKey = user ? `useOpenEvents:${user.id}` : null;
  const cached = cacheKey ? getCached<OpenEventsSnapshot>(cacheKey) : undefined;
  const [events, setEvents] = useState<EventWithMeta[]>(() => cached?.events ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [localTrigger, setLocalTrigger] = useState(0);

  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;

    void (async () => {
      const now = new Date().toISOString();

      const { data: rows, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true });

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      const eventIds = (rows ?? []).map((r) => r.id);

      const [{ data: mySignups }, { data: allSignups }] = await Promise.all([
        supabase.from('event_signups').select('event_id').eq('user_id', user.id),
        eventIds.length > 0
          ? supabase.from('event_signups').select('event_id').in('event_id', eventIds)
          : Promise.resolve({ data: [] as Array<{ event_id: string }>, error: null }),
      ]);

      const signedUpIds = new Set((mySignups ?? []).map((s) => s.event_id));
      const countMap: Record<string, number> = {};
      for (const s of allSignups ?? []) {
        countMap[s.event_id] = (countMap[s.event_id] ?? 0) + 1;
      }

      const result: EventWithMeta[] = (rows ?? []).map((r) => ({
        id:           r.id,
        created_by:   r.created_by,
        title:        r.title,
        fight_card:   r.fight_card,
        venue_name:   r.venue_name,
        address:      r.address ?? '',
        lat:          r.lat,
        lng:          r.lng,
        scheduled_at: r.scheduled_at,
        duration_min: r.duration_min,
        max_slots:    r.max_slots,
        notes:        r.notes,
        is_active:    r.is_active,
        created_at:   r.created_at,
        signup_count: countMap[r.id] ?? 0,
        is_signed_up: signedUpIds.has(r.id),
      }));

      reportNetworkSuccess();
      setEvents(result);
      if (cacheKey) setCached<OpenEventsSnapshot>(cacheKey, { events: result });
      setLoading(false);
    })();
  }, [user, refetchTrigger, localTrigger]);

  return { events, loading, refetch };
}
