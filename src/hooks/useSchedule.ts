import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { StudioSchedule } from '../types/database.types';

interface UseScheduleResult {
  schedule: StudioSchedule[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// dayOfWeek: 0=Mon … 6=Sun (optional — omit to load all days)
// studioId: filter by studio. Pass null when user has no studio (returns empty).
//           Pass undefined to skip the filter (backward compat for callers that own their context).
export function useSchedule(dayOfWeek?: number, studioId?: string | null): UseScheduleResult {
  const [schedule, setSchedule] = useState<StudioSchedule[]>([]);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
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
        setSchedule(data ?? []);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [dayOfWeek, studioId, trigger]);

  return { schedule, loading, error, refetch };
}
