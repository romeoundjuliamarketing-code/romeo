import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import { shortAddress } from '../utils/homeAgenda';
import type { HomeSparring } from '../utils/homeAgenda';

// Upcoming sparrings the user holds a slot for (pending/confirmed) or organizes,
// for Home's appointment card. Independent of any search radius. Waitlist,
// cancelled, expired and deactivated sparrings are excluded by the queries.
// Stale-while-revalidate: a cached result shows immediately ('ready'), the
// first load without cache reports 'loading' so Home never shows "no
// appointment" before it knows.

export type MyUpcomingStatus = 'loading' | 'ready' | 'error';

interface SparringFields {
  id:           string;
  title:        string;
  discipline:   string;
  scheduled_at: string;
  duration_min: number;
  address:      string;
  studios:      { name: string; city: string | null } | null;
  participants: {
    user_id:  string;
    status:   string;
    profiles: { name: string | null; avatar_url: string | null } | null;
  }[] | null;
}

// Slot holders only (same set the detail view counts as taking part).
const SLOT_STATUSES: ReadonlySet<string> = new Set(['pending', 'confirmed']);

function toHomeSparring(row: SparringFields, role: HomeSparring['role']): HomeSparring {
  return {
    id:            row.id,
    title:         row.title,
    discipline:    row.discipline,
    scheduledAt:   row.scheduled_at,
    durationMin:   row.duration_min,
    gymName:       row.studios?.name ?? null,
    locationLabel: row.studios?.city != null && row.studios.city.trim().length > 0
      ? row.studios.city
      : shortAddress(row.address),
    role,
    participants: (row.participants ?? [])
      .filter((p) => SLOT_STATUSES.has(p.status))
      .map((p) => ({ userId: p.user_id, name: p.profiles?.name ?? null, avatarUrl: p.profiles?.avatar_url ?? null })),
  };
}

// Participants come embedded in the same request — no per-sparring or per-avatar query.
const FIELDS = 'id, title, discipline, scheduled_at, duration_min, address, studios!studio_id(name, city), '
  + 'participants:sparring_signups!sparring_id(user_id, status, profiles!user_id(name, avatar_url))';

export function useMyUpcomingSparrings(userId: string | null, refetchTrigger = 0): {
  items:   HomeSparring[];
  status:  MyUpcomingStatus;
  refetch: () => void;
} {
  const cacheKey = userId !== null ? `useMyUpcomingSparrings:${userId}` : null;
  const cached = cacheKey ? getCached<HomeSparring[]>(cacheKey) : undefined;
  const [items, setItems] = useState<HomeSparring[]>(() => cached ?? []);
  const [status, setStatus] = useState<MyUpcomingStatus>(() => (cached !== undefined ? 'ready' : 'loading'));
  const [version, setVersion] = useState(0);
  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (userId === null || cacheKey === null) {
      setItems([]);
      setStatus('ready');
      return;
    }
    let cancelled = false;
    const nowIso = new Date().toISOString();

    void (async () => {
      const [signups, organized] = await Promise.all([
        supabase
          .from('sparring_signups')
          .select(`status, open_sparrings!inner(${FIELDS})`)
          .eq('user_id', userId)
          .in('status', ['pending', 'confirmed'])
          .eq('open_sparrings.is_active', true)
          .gt('open_sparrings.scheduled_at', nowIso)
          .limit(20),
        supabase
          .from('open_sparrings')
          .select(FIELDS)
          .eq('created_by', userId)
          .eq('is_active', true)
          .gt('scheduled_at', nowIso)
          .order('scheduled_at', { ascending: true })
          .limit(5),
      ]);
      if (cancelled) return;
      if (signups.error !== null || organized.error !== null) {
        // Keep what is on screen; only report the error when there is nothing.
        if (getCached<HomeSparring[]>(cacheKey) === undefined) setStatus('error');
        return;
      }

      const next: HomeSparring[] = [
        ...(organized.data as unknown as SparringFields[]).map((row) => toHomeSparring(row, 'organizer')),
        ...(signups.data as unknown as { status: 'pending' | 'confirmed'; open_sparrings: SparringFields }[])
          .map((row) => toHomeSparring(row.open_sparrings, row.status)),
      ];
      setCached<HomeSparring[]>(cacheKey, next);
      setItems(next);
      setStatus('ready');
    })();

    return () => { cancelled = true; };
  }, [userId, refetchTrigger, cacheKey, version]);

  return { items, status, refetch };
}
