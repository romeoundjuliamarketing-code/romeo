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
export function useSchedule(dayOfWeek?: number): UseScheduleResult {
  const [schedule, setSchedule] = useState<StudioSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
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
  }, [dayOfWeek, trigger]);

  return { schedule, loading, error, refetch };
}
