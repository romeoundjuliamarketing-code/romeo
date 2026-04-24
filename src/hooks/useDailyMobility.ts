import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

const MOBILITY_POINTS = 10;
const URGENCY_HOUR_BERLIN = 17;
const STORAGE_KEY = 'daily_mobility_done_v1';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function currentHourBerlin(): number {
  const formatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(formatter.format(new Date()), 10);
}

interface UseDailyMobilityResult {
  isDone: boolean;
  isUrgent: boolean;
  loading: boolean;
  logMobility: () => Promise<void>;
}

export function useDailyMobility(): UseDailyMobilityResult {
  const { user } = useAuth();
  const [isDone, setIsDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const isUrgent = !isDone && currentHourBerlin() >= URGENCY_HOUR_BERLIN;

  useEffect(() => {
    const key = `${STORAGE_KEY}:${todayIso()}`;
    AsyncStorage.getItem(key)
      .then((val) => {
        setIsDone(val === 'true');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const logMobility = useCallback(async (): Promise<void> => {
    if (user === null || isDone) return;

    const today = todayIso();
    const key = `${STORAGE_KEY}:${today}`;

    setIsDone(true);
    await AsyncStorage.setItem(key, 'true');

    const [logResult, pointsResult] = await Promise.all([
      supabase.from('workout_logs').insert({
        user_id: user.id,
        date: today,
        source: 'manual',
        completed: true,
        points: MOBILITY_POINTS,
        duration_min: 14,
        title: 'Hüfte & Mobilität',
        category: 'Recovery',
      }),
      supabase.rpc('add_workout_points', {
        p_user_id: user.id,
        p_date: today,
        p_points: MOBILITY_POINTS,
      }),
    ]);
    if (logResult.error !== null) { reportNetworkError(logResult.error); console.warn('logMobility insert failed', logResult.error.message); }
    else if (pointsResult.error !== null) { reportNetworkError(pointsResult.error); console.warn('logMobility points failed', pointsResult.error.message); }
    else { reportNetworkSuccess(); }
  }, [user, isDone]);

  return { isDone, isUrgent, loading, logMobility };
}
