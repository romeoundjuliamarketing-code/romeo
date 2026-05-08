import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

const STRETCH_POINTS = 10;
const URGENCY_HOUR_BERLIN = 17;
const STORAGE_KEY = 'daily_stretch_done_v1';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

// Returns the current hour in German local time (CET/CEST)
function currentHourBerlin(): number {
  const formatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(formatter.format(new Date()), 10);
}

interface UseDailyStretchResult {
  isDone: boolean;
  isUrgent: boolean;
  loading: boolean;
  logStretch: () => Promise<void>;
}

export function useDailyStretch(): UseDailyStretchResult {
  const { user } = useAuth();
  const [isDone, setIsDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const isUrgent = !isDone && currentHourBerlin() >= URGENCY_HOUR_BERLIN;

  // Load stretch state from AsyncStorage — key includes today's date so it resets daily
  useEffect(() => {
    const key = `${STORAGE_KEY}:${todayIso()}`;
    AsyncStorage.getItem(key)
      .then((val) => {
        setIsDone(val === 'true');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const logStretch = useCallback(async (): Promise<void> => {
    if (user === null || isDone) return;

    const today = todayIso();
    const key = `${STORAGE_KEY}:${today}`;

    // Optimistic update
    setIsDone(true);
    await AsyncStorage.setItem(key, 'true');

    // Persist workout log and credit profile points atomically
    const [stretchLog, stretchPoints] = await Promise.all([
      supabase.from('workout_logs').insert({
        user_id: user.id,
        date: today,
        source: 'manual',
        completed: true,
        points: STRETCH_POINTS,
        duration_min: 15,
        title: 'Tägliches Dehnen',
        category: 'Recovery',
        training_type: 'mobilitaet',
      }),
      supabase.rpc('add_workout_points', {
        p_user_id: user.id,
        p_date: today,
        p_points: STRETCH_POINTS,
      }),
    ]);
    if (stretchLog.error !== null) { reportNetworkError(stretchLog.error); }
    else if (stretchPoints.error !== null) { reportNetworkError(stretchPoints.error); }
    else { reportNetworkSuccess(); }
  }, [user, isDone]);

  return { isDone, isUrgent, loading, logStretch };
}
