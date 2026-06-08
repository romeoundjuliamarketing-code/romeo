import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

export function useAttendanceHistory(): {
  attendedDates: Set<string>;
  loading: boolean;
} {
  const { user } = useAuth();
  const [attendedDates, setAttendedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) return;

    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('workout_logs')
        .select('date')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('date', { ascending: false });

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      reportNetworkSuccess();
      setAttendedDates(
        new Set(
          (data ?? [])
            .filter((r) => r.date !== null)
            .map((r) => r.date as string),
        ),
      );
      setLoading(false);
    })();
  }, [user]);

  return { attendedDates, loading };
}
