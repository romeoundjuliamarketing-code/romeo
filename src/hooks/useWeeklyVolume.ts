import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';

export interface WeeklyVolume {
  sessions: number;
  minutes: number;
  points: number;
}

// Returns ISO date strings for Mon–Sun of the current week
function currentWeekDates(): { start: string; end: string } {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

type WeeklyVolumeSnapshot = { volume: WeeklyVolume };

export function useWeeklyVolume(refetchTrigger = 0): WeeklyVolume {
  const { user } = useAuth();
  const cacheKey = user ? `useWeeklyVolume:${user.id}` : null;
  const cached = cacheKey ? getCached<WeeklyVolumeSnapshot>(cacheKey) : undefined;
  const [volume, setVolume] = useState<WeeklyVolume>(() => cached?.volume ?? { sessions: 0, minutes: 0, points: 0 });

  const load = useCallback(async () => {
    if (user === null) return;
    const { start, end } = currentWeekDates();

    const { data, error } = await supabase
      .from('workout_logs')
      .select('duration_min, points')
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('date', start)
      .lte('date', end);

    if (error !== null) { reportNetworkError(error); return; }
    if (data === null) return;
    reportNetworkSuccess();

    const sessions = data.length;
    const minutes = data.reduce((sum, row) => sum + (row.duration_min ?? 0), 0);
    const points = data.reduce((sum, row) => sum + (row.points ?? 0), 0);

    const newVolume: WeeklyVolume = { sessions, minutes, points };
    setVolume(newVolume);
    if (cacheKey) setCached<WeeklyVolumeSnapshot>(cacheKey, { volume: newVolume });
  }, [user, refetchTrigger, cacheKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return volume;
}
