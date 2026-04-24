import { Alert } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { UserSchedule, UserScheduleInsert, StudioSchedule } from '../types/database.types';

interface UseUserScheduleResult {
  schedule: UserSchedule[];
  hasPersonalSchedule: boolean;
  loading: boolean;
  initFromStudio: (studioSessions: StudioSchedule[]) => Promise<void>;
  addEntry: (entry: Omit<UserScheduleInsert, 'user_id'>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  refetch: () => void;
}

export function useUserSchedule(): UseUserScheduleResult {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<UserSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('user_schedule')
      .select('*')
      .eq('user_id', user.id)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error !== null) {
          reportNetworkError(error);
          console.warn('useUserSchedule fetch failed', error.message);
        } else {
          reportNetworkSuccess();
        }
        setSchedule(data ?? []);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, trigger]);

  // Copies all studio sessions into the user's personal schedule as a starting point
  const initFromStudio = useCallback(
    async (studioSessions: StudioSchedule[]): Promise<void> => {
      if (user === null || studioSessions.length === 0) return;

      const inserts: UserScheduleInsert[] = studioSessions.map((s) => ({
        user_id: user.id,
        day_of_week: s.day_of_week,
        training_name: s.training_name,
        start_time: s.start_time,
        duration_min: s.duration_min,
        coach_name: s.coach_name,
        points_per_30min: s.points_per_30min,
      }));

      const { error } = await supabase.from('user_schedule').insert(inserts);
      if (error !== null) {
        Alert.alert('Fehler', 'Bitte versuche es erneut.');
        return;
      }
      refetch();
    },
    [user, refetch],
  );

  const addEntry = useCallback(
    async (entry: Omit<UserScheduleInsert, 'user_id'>): Promise<void> => {
      if (user === null) return;
      const { error } = await supabase.from('user_schedule').insert({ ...entry, user_id: user.id });
      if (error !== null) {
        Alert.alert('Fehler', 'Bitte versuche es erneut.');
        return;
      }
      refetch();
    },
    [user, refetch],
  );

  const deleteEntry = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await supabase.from('user_schedule').delete().eq('id', id);
      if (error !== null) {
        Alert.alert('Fehler', 'Bitte versuche es erneut.');
        return;
      }
      refetch();
    },
    [refetch],
  );

  return {
    schedule,
    hasPersonalSchedule: !loading && schedule.length > 0,
    loading,
    initFromStudio,
    addEntry,
    deleteEntry,
    refetch,
  };
}
