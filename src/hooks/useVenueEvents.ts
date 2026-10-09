import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { EventWithMeta } from './useOpenEvents';

type Snapshot = { events: EventWithMeta[] };

export function useVenueEvents(venueId: string): {
  events: EventWithMeta[];
  loading: boolean;
  refetch: () => void;
} {
  const cacheKey = venueId.trim().length > 0 ? `useVenueEvents:${venueId}` : null;
  const cached = cacheKey ? getCached<Snapshot>(cacheKey) : undefined;
  const [events, setEvents] = useState<EventWithMeta[]>(() => cached?.events ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [trigger, setTrigger] = useState(0);
  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (venueId.trim().length === 0) return;
    let cancelled = false;
    const hasCache = cacheKey ? getCached<Snapshot>(cacheKey) !== undefined : false;
    if (!hasCache) setLoading(true);
    void (async () => {
      const now = new Date().toISOString();
      const { data: rows } = await supabase
        .from('events')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true });
      if (cancelled) return;
      const ids = (rows ?? []).map((r) => r.id);
      const { data: signups } = ids.length > 0
        ? await supabase.rpc('get_event_signup_counts', { p_event_ids: ids })
        : { data: [] as Array<{ event_id: string; signup_count: number }> };
      if (cancelled) return;
      const countMap: Record<string, number> = {};
      for (const s of signups ?? []) countMap[s.event_id] = s.signup_count;
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
        is_signed_up: false,
        venue_id:     r.venue_id ?? null,
      }));
      setEvents(result);
      if (cacheKey) setCached<Snapshot>(cacheKey, { events: result });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [venueId, trigger, cacheKey]);

  return { events, loading, refetch };
}
