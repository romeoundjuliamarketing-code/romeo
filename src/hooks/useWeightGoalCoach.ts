import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { mondayOfWeek, type WeightEntry } from './useWeight';
import {
  calculateNutrition,
  type NutritionInput,
  type NutritionPlan,
  type PlanMode,
  type UIMessages,
} from '../utils/nutritionEngine';

const GOAL_STORAGE_KEY = 'weight_goal_plan_v2';

// Small trend adjustment applied on top of all plans after ≥ 2 weekly weigh-ins.
// Keeps the engine plans stable and only nudges them after real feedback.
const TREND_NUDGE_KCAL     = 100; // step size for each nudge
const TREND_NUDGE_MAX_KCAL = 150; // maximum single adjustment

type StoredGoalPlan = {
  targetWeightKg: number;
  startWeightKg:  number;
  startWeek:      string;
  targetDateIso:  string | null;
};

interface WeightGoalCoachParams {
  engineInput:         NutritionInput | null;
  maintenanceCalories: number | null;
  currentWeight:       number | null;
  weightHistory:       WeightEntry[];
}

interface WeightGoalCoachResult {
  targetWeightKg:     number | null;
  startWeightKg:      number | null;
  targetDateIso:      string | null;
  recommendedDateIso: string | null;
  isSaving:           boolean;
  setTargetWeight:    (kg: number, targetDateIso: string | null) => Promise<void>;
  clearTargetWeight:  () => Promise<void>;
  plans:              NutritionPlan[];
  selectedMode:       PlanMode;
  setSelectedMode:    (mode: PlanMode) => void;
  selectedPlan:       NutritionPlan | null;
  trendDeltaKcal:     number; // live nudge applied on top of selected plan
  uiMessages:         UIMessages | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function diffWeeks(fromIso: string, toIso: string): number {
  const ms = parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime();
  return Math.max(0, ms / (7 * 86_400_000));
}

function addWeeks(isoDate: string, weeks: number): string {
  const ms = parseIsoDate(isoDate).getTime() + Math.ceil(weeks) * 7 * 86_400_000;
  const d  = new Date(ms);
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isValidIsoDate(value: string | null): boolean {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(parseIsoDate(value).getTime());
}

function deserializePlan(raw: string | null): StoredGoalPlan | null {
  if (raw === null) return null;
  try {
    const p = JSON.parse(raw) as StoredGoalPlan;
    if (
      typeof p.targetWeightKg !== 'number' ||
      typeof p.startWeightKg  !== 'number' ||
      typeof p.startWeek      !== 'string'
    ) return null;
    return { ...p, targetDateIso: p.targetDateIso ?? null };
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWeightGoalCoach({
  engineInput,
  maintenanceCalories,
  currentWeight,
  weightHistory,
}: WeightGoalCoachParams): WeightGoalCoachResult {
  const { user } = useAuth();
  const [plan,         setPlan]         = useState<StoredGoalPlan | null>(null);
  const [isSaving,     setIsSaving]     = useState(false);
  const [selectedMode, setSelectedMode] = useState<PlanMode>('recommended');

  useEffect(() => {
    let cancelled = false;
    async function loadPlan(): Promise<void> {
      if (user === null) { if (!cancelled) setPlan(null); return; }
      const raw = await AsyncStorage.getItem(`${GOAL_STORAGE_KEY}:${user.id}`);
      if (!cancelled) setPlan(deserializePlan(raw));
    }
    void loadPlan();
    return () => { cancelled = true; };
  }, [user]);

  const setTargetWeight = useCallback(
    async (kg: number, targetDateIso: string | null): Promise<void> => {
      if (user === null || currentWeight === null) return;
      const next: StoredGoalPlan = {
        targetWeightKg: Math.round(kg * 10) / 10,
        startWeightKg:  currentWeight,
        startWeek:      mondayOfWeek(),
        targetDateIso:  isValidIsoDate(targetDateIso) ? targetDateIso : null,
      };
      setIsSaving(true);
      await AsyncStorage.setItem(`${GOAL_STORAGE_KEY}:${user.id}`, JSON.stringify(next));
      setPlan(next);
      setIsSaving(false);
    },
    [currentWeight, user],
  );

  const clearTargetWeight = useCallback(async (): Promise<void> => {
    if (user === null) return;
    setIsSaving(true);
    await AsyncStorage.removeItem(`${GOAL_STORAGE_KEY}:${user.id}`);
    setPlan(null);
    setSelectedMode('recommended');
    setIsSaving(false);
  }, [user]);

  // Derive plans from the engine whenever the stored goal or engine input changes
  const { plans, recommendedDateIso, uiMessages, autoSelectMode } = useMemo(() => {
    if (plan === null || engineInput === null || currentWeight === null) {
      return { plans: [], recommendedDateIso: null, uiMessages: null, autoSelectMode: null };
    }

    const deltaKg   = plan.targetWeightKg - currentWeight;
    if (Math.abs(deltaKg) < 0.5) {
      return { plans: [], recommendedDateIso: null, uiMessages: null, autoSelectMode: null };
    }

    // Calculate duration from stored target date if present, else use recommended rate estimate
    const weeksToDate = isValidIsoDate(plan.targetDateIso)
      ? Math.max(1, Math.round(diffWeeks(mondayOfWeek(), plan.targetDateIso as string)))
      : null;

    const goalInput: NutritionInput = {
      ...engineInput,
      currentWeightKg: currentWeight,
      targetWeightKg:  plan.targetWeightKg,
      durationWeeks:   weeksToDate ?? undefined,
    };

    const result = calculateNutrition(goalInput);

    // Recommended date: based on the recommended plan's estimated time, ignoring any stored deadline
    const recPlan = result.plans.find(p => p.mode === 'recommended');
    const recWeeks = recPlan?.estimatedTimeToGoalWeeks ?? null;
    const recDateIso = recWeeks !== null ? addWeeks(plan.startWeek, recWeeks) : null;

    return {
      plans:              result.plans,
      recommendedDateIso: recDateIso,
      uiMessages:         result.uiMessages,
      autoSelectMode:     result.autoSelectMode,
    };
  }, [plan, engineInput, currentWeight]);

  // Stable key that changes only when the user saves a new goal (weight, date, or start week).
  // Used to gate auto-selection so a manual tab tap is never overridden mid-session.
  const planKey = useMemo(
    () => plan !== null
      ? `${plan.targetWeightKg}:${plan.startWeek}:${plan.targetDateIso ?? ''}`
      : '',
    [plan],
  );

  // Auto-select the matching mode when the user saves a new goal.
  const prevPlanKeyRef = useRef<string>('');
  useEffect(() => {
    if (planKey === prevPlanKeyRef.current) return;
    prevPlanKeyRef.current = planKey;
    if (autoSelectMode !== null) {
      setSelectedMode(autoSelectMode);
    }
  }, [planKey, autoSelectMode]);

  // 14-day trend nudge — applied on top of the selected plan's base kcal.
  // Only kicks in after ≥ 2 weekly weight entries exist.
  const trendDeltaKcal = useMemo((): number => {
    if (plan === null || weightHistory.length < 2) return 0;
    const latest   = weightHistory[weightHistory.length - 1];
    const previous = weightHistory[weightHistory.length - 2];
    const weeksBetween   = Math.max(diffWeeks(previous.weekStart, latest.weekStart), 1);
    const actualWeeklyKg = (latest.weightKg - previous.weightKg) / weeksBetween;

    const direction = plan.targetWeightKg > (currentWeight ?? plan.startWeightKg) ? 'gain' : 'loss';

    let nudge = 0;
    if (direction === 'loss') {
      if (actualWeeklyKg >= 0)     nudge = -TREND_NUDGE_KCAL;  // gaining weight on a cut
      else if (Math.abs(actualWeeklyKg) < 0.2) nudge = -TREND_NUDGE_KCAL; // too slow
      else if (Math.abs(actualWeeklyKg) > 1.2) nudge = TREND_NUDGE_KCAL;  // too fast
    } else {
      if (actualWeeklyKg <= 0)     nudge = TREND_NUDGE_KCAL;   // losing weight on a bulk
      else if (actualWeeklyKg < 0.2) nudge = TREND_NUDGE_KCAL; // too slow
      else if (actualWeeklyKg > 1.0) nudge = -TREND_NUDGE_KCAL; // too fast
    }

    return Math.max(-TREND_NUDGE_MAX_KCAL, Math.min(nudge, TREND_NUDGE_MAX_KCAL));
  }, [plan, weightHistory, currentWeight]);

  // Ensure selectedMode resets to 'recommended' if no plans are available
  useEffect(() => {
    if (plans.length > 0 && !plans.some(p => p.mode === selectedMode)) {
      setSelectedMode('recommended');
    }
  }, [plans, selectedMode]);

  const selectedPlan = plans.find(p => p.mode === selectedMode) ?? null;

  return {
    targetWeightKg:    plan?.targetWeightKg ?? null,
    startWeightKg:     plan?.startWeightKg  ?? null,
    targetDateIso:     plan?.targetDateIso  ?? null,
    recommendedDateIso,
    isSaving,
    setTargetWeight,
    clearTargetWeight,
    plans,
    selectedMode,
    setSelectedMode,
    selectedPlan,
    trendDeltaKcal,
    uiMessages,
  };
}
