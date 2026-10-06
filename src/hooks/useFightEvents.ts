import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { FightEvent } from '../utils/fightEvents';

// Upcoming official fight nights (all promotions in one call) from the curated
// fight_events table via get_upcoming_fight_events. Loaded once, then at most
// hourly per app session — no polling, no scraping. 'unavailable' covers both a
// failed request and a missing table/RPC (migration not deployed yet).

export type FightEventsStatus = 'loading' | 'ready' | 'unavailable';

const CACHE_KEY = 'useFightEvents';
const REFRESH_MS = 60 * 60 * 1000;
let lastFetchAt = 0;

export function useFightEvents(enabled: boolean, refetchTrigger = 0): { events: FightEvent[]; status: FightEventsStatus } {
  const cached = getCached<FightEvent[]>(CACHE_KEY);
  const [events, setEvents] = useState<FightEvent[]>(() => cached ?? []);
  const [status, setStatus] = useState<FightEventsStatus>(() => (cached !== undefined ? 'ready' : 'loading'));

  useEffect(() => {
    if (!enabled) return;
    if (getCached<FightEvent[]>(CACHE_KEY) !== undefined && Date.now() - lastFetchAt < REFRESH_MS) return;
    lastFetchAt = Date.now();
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc('get_upcoming_fight_events');
      if (cancelled) return;
      if (error !== null) {
        lastFetchAt = 0;
        if (getCached<FightEvent[]>(CACHE_KEY) === undefined) setStatus('unavailable');
        return;
      }
      const next: FightEvent[] = (data ?? []).map((row) => ({
        id:         row.id,
        promotion:  row.promotion,
        name:       row.name,
        eventDate:  row.event_date,
        prelimsAt:  row.prelims_at,
        mainCardAt: row.main_card_at,
        endsAt:     row.ends_at,
        status:     row.status,
      }));
      setCached<FightEvent[]>(CACHE_KEY, next);
      setEvents(next);
      setStatus('ready');
    })();
    return () => { cancelled = true; };
  }, [enabled, refetchTrigger]);

  return { events, status };
}
