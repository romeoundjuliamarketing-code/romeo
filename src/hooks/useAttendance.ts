import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { AttendanceLog } from '../types/database.types';

interface UseAttendanceResult {
  // IDs of users marked present on today's session_date
  presentUserIds: Set<string>;
  loading: boolean;
  markPresent: (userId: string) => Promise<{ error: string | null }>;
  unmarkPresent: (userId: string) => Promise<{ error: string | null }>;
}

export function useAttendance(
  studioId: string | null,
  sessionDate?: string,
): UseAttendanceResult {
  const date = sessionDate ?? new Date().toISOString().split('T')[0];
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (studioId === null) { setLoading(false); return; }
    setLoading(true);

    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('studio_id', studioId)
      .eq('session_date', date);

    if (error !== null) {
      reportNetworkError(error);
    } else {
      reportNetworkSuccess();
    }
    setLogs(data ?? []);
    setLoading(false);
  }, [studioId, date]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  const presentUserIds = new Set(logs.map((l) => l.user_id));

  const markPresent = useCallback(async (userId: string): Promise<{ error: string | null }> => {
    if (studioId === null) return { error: 'Kein Team beigetreten' };

    const { data, error } = await supabase.rpc('mark_attendance', {
      p_studio_id: studioId,
      p_user_id: userId,
      p_session_date: date,
    });

    if (error !== null) return { error: error.message };
    const result = data as { error: string | null };
    if (result.error !== null) return result;

    void fetchLogs();
    return { error: null };
  }, [studioId, date, fetchLogs]);

  const unmarkPresent = useCallback(async (userId: string): Promise<{ error: string | null }> => {
    if (studioId === null) return { error: 'Kein Team beigetreten' };

    const { data, error } = await supabase.rpc('unmark_attendance', {
      p_studio_id: studioId,
      p_user_id: userId,
      p_session_date: date,
    });

    if (error !== null) return { error: error.message };
    const result = data as { error: string | null };
    if (result.error !== null) return result;

    void fetchLogs();
    return { error: null };
  }, [studioId, date, fetchLogs]);

  return { presentUserIds, loading, markPresent, unmarkPresent };
}
