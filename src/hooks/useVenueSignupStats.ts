import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';

// One row per event of a venue: how many people signed up via Sparr.
export interface VenueEventSignupStat {
  eventId:     string;
  title:       string;
  scheduledAt: string;
  signupCount: number;
}

interface UseVenueSignupStatsResult {
  events:      VenueEventSignupStat[];
  totalSignups: number;
  loading:     boolean;
  refetch:     () => void;
}

type Snapshot = { events: VenueEventSignupStat[] };

export function useVenueSignupStats(
  venueId:        string,
  refetchTrigger = 0,
): UseVenueSignupStatsResult {
  const { user } = useAuth();
  const cacheKey = user ? `useVenueSignupStats:${user.id}:${venueId}` : null;
  const cached = cacheKey ? getCached<Snapshot>(cacheKey) : undefined;

  const [events,       setEvents]       = useState<VenueEventSignupStat[]>(() => cached?.events ?? []);
  const [loading,      setLoading]      = useState(cached === undefined);
  const [localTrigger, setLocalTrigger] = useState(0);
  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;
    let cancelled = false;
    const hasCache = cacheKey ? getCached<Snapshot>(cacheKey) !== undefined : false;
    if (!hasCache) setLoading(true);

    void (async () => {
      const { data, error } = await supabase.rpc('get_venue_signup_stats', { p_venue_id: venueId });
      if (cancelled) return;
      if (error !== null) { setLoading(false); return; }

      const rows: VenueEventSignupStat[] = (data ?? []).map((r) => ({
        eventId:     r.event_id,
        title:       r.title,
        scheduledAt: r.scheduled_at,
        signupCount: r.signup_count,
      }));
      setEvents(rows);
      if (cacheKey) setCached<Snapshot>(cacheKey, { events: rows });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [venueId, user, refetchTrigger, localTrigger, cacheKey]);

  const totalSignups = events.reduce((sum, e) => sum + e.signupCount, 0);

  return { events, totalSignups, loading, refetch };
}
