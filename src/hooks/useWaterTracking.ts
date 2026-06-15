import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SharedGroupPreferences from 'react-native-shared-group-preferences';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import type { HydrationMode } from '../types/hydration';

const HYDRATION_MODE_KEY = 'hydration_mode_v1';
const DEFAULT_WATER_GOAL_ML = 3150;
const WATER_GOAL_POINTS = 5;

const APP_GROUP = 'group.com.kombat.app';

async function syncToWidget(amountMl: number, goalMl: number): Promise<void> {
  // Write current water state to the shared App Group container.
  // The iOS widget reads from this same container.
  try {
    await SharedGroupPreferences.setItem('water_amount_ml', amountMl, APP_GROUP);
    await SharedGroupPreferences.setItem('water_goal_ml', goalMl, APP_GROUP);
    await SharedGroupPreferences.setItem(
      'water_date',
      new Date().toISOString().split('T')[0],
      APP_GROUP,
    );
  } catch {
    // Widget sync is best-effort — never block the main flow
  }
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function roundToNearest50(value: number): number {
  return Math.round(value / 50) * 50;
}

function mlPerKgFor(ageYears: number | null, mode: HydrationMode): number {
  const isMinor = ageYears !== null && ageYears < 18;

  if (isMinor) {
    if (mode === 'everyday') return 25;
    if (mode === 'active') return 30;
    return 35;
  }

  if (mode === 'everyday') return 30;
  if (mode === 'active') return 35;
  return 40;
}

function calculateGoalMl(weightKg: number | null, ageYears: number | null, mode: HydrationMode): number {
  if (weightKg === null || weightKg <= 0) return DEFAULT_WATER_GOAL_ML;
  return roundToNearest50(weightKg * mlPerKgFor(ageYears, mode));
}

interface UseWaterTrackingResult {
  amountMl: number;
  goalMl: number;
  hydrationMode: HydrationMode;
  setHydrationMode: (mode: HydrationMode) => Promise<void>;
  addWater: (ml: number) => Promise<void>;
  loading: boolean;
}

type WaterTrackingSnapshot = { amountMl: number; goalMl: number; date: string };

export function useWaterTracking(onGoalReached?: () => void, refetchTrigger = 0): UseWaterTrackingResult {
  const { user } = useAuth();
  // Cache is date-scoped to avoid showing yesterday's intake today
  const today = todayIso();
  // Key is date-scoped (includes today), so any cached value is from today by construction.
  const cacheKey = user ? `useWaterTracking:${user.id}:${today}` : null;
  const cached = cacheKey ? getCached<WaterTrackingSnapshot>(cacheKey) : undefined;
  const [amountMl, setAmountMl] = useState(() => cached?.amountMl ?? 0);
  const [goalMl, setGoalMl] = useState(() => cached?.goalMl ?? DEFAULT_WATER_GOAL_ML);
  const [hydrationMode, setHydrationModeState] = useState<HydrationMode>('active');
  const [loading, setLoading] = useState(cached === undefined);

  // Mirror of amountMl that updates synchronously, so rapid taps and the
  // optimistic addWater path always build on the latest value.
  const amountRef = useRef(amountMl);
  const commitAmount = useCallback((value: number): void => {
    amountRef.current = value;
    setAmountMl(value);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTodayWater(): Promise<void> {
      if (user === null) {
        if (!cancelled) {
          commitAmount(0);
          setGoalMl(DEFAULT_WATER_GOAL_ML);
          setHydrationModeState('active');
          setLoading(false);
        }
        return;
      }

      const todayDate = todayIso();
      const [storedMode, waterResult, profileResult, weightResult] = await Promise.all([
        AsyncStorage.getItem(HYDRATION_MODE_KEY),
        supabase
          .from('water_logs')
          .select('amount_ml')
          .eq('user_id', user.id)
          .eq('date', todayDate)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('age_years')
          .eq('id', user.id)
          .single(),
        supabase
          .from('weight_logs')
          .select('weight_kg')
          .eq('user_id', user.id)
          .order('week_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const mode: HydrationMode = (
        storedMode === 'everyday' || storedMode === 'active' || storedMode === 'intense'
          ? storedMode
          : 'active'
      );

      const { data, error } = waterResult;
      if (error !== null) {
        reportNetworkError(error);
        if (!cancelled) {
          commitAmount(0);
          setHydrationModeState(mode);
          setGoalMl(DEFAULT_WATER_GOAL_ML);
          setLoading(false);
        }
        return;
      }
      reportNetworkSuccess();

      const ageYears = profileResult.error === null ? profileResult.data?.age_years ?? null : null;
      const weightKg = weightResult.error === null ? Number(weightResult.data?.weight_kg ?? 0) || null : null;
      const dynamicGoalMl = calculateGoalMl(weightKg, ageYears, mode);

      if (!cancelled) {
        commitAmount(data?.amount_ml ?? 0);
        setHydrationModeState(mode);
        setGoalMl(dynamicGoalMl);
        void syncToWidget(data?.amount_ml ?? 0, dynamicGoalMl);

        // Sync water that was added via the widget while the app was closed
        try {
          const rawPending = await SharedGroupPreferences.getItem(
            'water_pending_sync_ml',
            APP_GROUP,
          );
          const pendingMl = typeof rawPending === 'number' && rawPending > 0 ? rawPending : 0;

          if (pendingMl > 0 && user !== null) {
            // The widget already wrote the correct total — use it as source of truth
            const rawWidget = await SharedGroupPreferences.getItem('water_amount_ml', APP_GROUP);
            const widgetTotal =
              typeof rawWidget === 'number' && rawWidget > 0
                ? rawWidget
                : (data?.amount_ml ?? 0) + pendingMl;

            // Only sync if the widget value is higher than what Supabase has
            if (widgetTotal > (data?.amount_ml ?? 0)) {
              await supabase.from('water_logs').upsert(
                { user_id: user.id, date: todayDate, amount_ml: widgetTotal },
                { onConflict: 'user_id,date' },
              );

              // Award goal points if goal was crossed via widget
              const prevAmount = data?.amount_ml ?? 0;
              if (prevAmount < dynamicGoalMl && widgetTotal >= dynamicGoalMl) {
                await supabase.rpc('add_workout_points', {
                  p_user_id: user.id,
                  p_date: todayDate,
                  p_points: WATER_GOAL_POINTS,
                });
                onGoalReached?.();
              }

              if (!cancelled) {
                commitAmount(widgetTotal);
              }
            }

            // Clear the pending flag regardless
            await SharedGroupPreferences.setItem('water_pending_sync_ml', 0, APP_GROUP);
          }
        } catch {
          // Widget sync is best-effort — never block the main flow
        }

        if (cacheKey) setCached<WaterTrackingSnapshot>(cacheKey, { amountMl: data?.amount_ml ?? 0, goalMl: dynamicGoalMl, date: todayDate });
        setLoading(false);
      }
    }

    void loadTodayWater();

    return () => {
      cancelled = true;
    };
  }, [user, refetchTrigger]);

  const setHydrationMode = useCallback(async (mode: HydrationMode): Promise<void> => {
    setHydrationModeState(mode);
    await AsyncStorage.setItem(HYDRATION_MODE_KEY, mode);

    if (user === null) {
      setGoalMl(DEFAULT_WATER_GOAL_ML);
      return;
    }

    const [profileResult, weightResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('age_years')
        .eq('id', user.id)
        .single(),
      supabase
        .from('weight_logs')
        .select('weight_kg')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const ageYears = profileResult.error === null ? profileResult.data?.age_years ?? null : null;
    const weightKg = weightResult.error === null ? Number(weightResult.data?.weight_kg ?? 0) || null : null;
    setGoalMl(calculateGoalMl(weightKg, ageYears, mode));
  }, [user]);

  const addWater = useCallback(async (ml: number): Promise<void> => {
    if (user === null || ml <= 0) return;

    const today = todayIso();
    // Base the increment on the latest displayed value (ref updates synchronously,
    // so rapid taps stack correctly) instead of a blocking server read.
    const previousAmount = amountRef.current;
    const nextAmount = previousAmount + ml;
    const crossedGoal = previousAmount < goalMl && nextAmount >= goalMl;

    // Optimistic update: reflect the tap instantly, persist in the background.
    commitAmount(nextAmount);
    if (cacheKey) {
      setCached<WaterTrackingSnapshot>(cacheKey, { amountMl: nextAmount, goalMl, date: today });
    }
    void syncToWidget(nextAmount, goalMl);
    if (crossedGoal) onGoalReached?.();

    const { error: upsertError } = await supabase
      .from('water_logs')
      .upsert(
        {
          user_id: user.id,
          date: today,
          amount_ml: nextAmount,
        },
        { onConflict: 'user_id,date' },
      );

    if (upsertError !== null) {
      reportNetworkError(upsertError);
      // Roll back the optimistic update so the UI matches the server again.
      commitAmount(previousAmount);
      if (cacheKey) {
        setCached<WaterTrackingSnapshot>(cacheKey, { amountMl: previousAmount, goalMl, date: today });
      }
      void syncToWidget(previousAmount, goalMl);
      return;
    }
    reportNetworkSuccess();

    if (crossedGoal) {
      await supabase.rpc('add_workout_points', {
        p_user_id: user.id,
        p_date: today,
        p_points: WATER_GOAL_POINTS,
      });
    }
  }, [goalMl, onGoalReached, user, cacheKey, commitAmount]);

  return {
    amountMl,
    goalMl,
    hydrationMode,
    setHydrationMode,
    addWater,
    loading,
  };
}
