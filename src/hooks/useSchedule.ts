import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import type { StudioSchedule } from '../types/database.types';

interface UseScheduleResult {
  schedule: StudioSchedule[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Stable cache key per studio + day. studioId is never null here — callers pass
// null only to disable caching (cacheKey stays null); undefined means "all
// studios" (filter skipped).
function scheduleCacheKey(dayOfWeek?: number, studioId?: string): string {
  return `useSchedule:${studioId ?? 'all'}:${dayOfWeek ?? 'all'}`;
}

// dayOfWeek: 0=Mon … 6=Sun (optional — omit to load all days)
// studioId: filter by studio. Pass null when user has no studio (returns empty).
//           Pass undefined to skip the filter (backward compat for callers that own their context).
export function useSchedule(dayOfWeek?: number, studioId?: string | null): UseScheduleResult {
  const cacheKey = studioId === null ? null : scheduleCacheKey(dayOfWeek, studioId);
  const cached = cacheKey ? getCached<StudioSchedule[]>(cacheKey) : undefined;
  const [schedule, setSchedule] = useState<StudioSchedule[]>(() => cached ?? []);
  // Only show a spinner on a genuine cold load. With a cached value we render
  // it instantly and revalidate in the background (stale-while-revalidate).
  const [loading, setLoading] = useState(cached === undefined && studioId !== null);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (studioId === null) {
      setSchedule([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Keep showing cached data while revalidating — don't flip back to a spinner.
    if (cacheKey && getCached<StudioSchedule[]>(cacheKey) === undefined) {
      setLoading(true);
    }
    setError(null);

    let query = supabase
      .from('studio_schedule')
      .select('*')
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (dayOfWeek !== undefined) {
      query = query.eq('day_of_week', dayOfWeek);
    }

    if (studioId !== undefined) {
      query = query.eq('studio_id', studioId);
    }

    query.then(({ data, error: err }) => {
      if (cancelled) return;
      if (err !== null) {
        reportNetworkError(err);
        setError(err.message);
      } else {
        reportNetworkSuccess();
        const rows = data ?? [];
        setSchedule(rows);
        if (cacheKey) setCached<StudioSchedule[]>(cacheKey, rows);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [dayOfWeek, studioId, trigger, cacheKey]);

  return { schedule, loading, error, refetch };
}
