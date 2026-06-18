import { useMemo } from 'react';
import { useProfile } from './useProfile';
import { useWeight, type WeightEntry } from './useWeight';
import {
  calculateNutrition,
  type ActivityLevel,
  type NutritionInput,
  type NutritionPlan,
} from '../utils/nutritionEngine';
import type { Profile } from '../types/database.types';

// Sparr is exclusively a combat-sports app — training type is fixed.
const TRAINING_TYPE = 'combat' as const;

// Average session duration for combat sports (more realistic than the previous 60 min default).
const DEFAULT_AVG_DURATION_MIN = 75;

// Training frequency tiers — maps the user's profile setting to engine parameters.
type FrequencyTier = 'low' | 'medium' | 'high';

const FREQUENCY_MAP: Record<FrequencyTier, { activityLevel: ActivityLevel; sessionsPerWeek: number }> = {
  low:    { activityLevel: 'moderately_active',  sessionsPerWeek: 3  },
  medium: { activityLevel: 'very_active',         sessionsPerWeek: 5  },
  high:   { activityLevel: 'extremely_active',    sessionsPerWeek: 10 },
};

interface NutritionTargetsResult {
  maintenanceCalories: number | null;
  maintenancePlan:     NutritionPlan | null;
  engineInput:         NutritionInput | null; // passed to useWeightGoalCoach for goal plans
  currentWeight:       number | null;
  weightHistory:       WeightEntry[];
  ageYears:            number | null;
  loading:             boolean;
  missingProfileData:  string[];
  profile:             Profile | null; // exposed so callers can avoid a second useProfile call
}


export function useNutritionTargets(refetchTrigger = 0): NutritionTargetsResult {
  const { profile, loading: profileLoading } = useProfile(refetchTrigger);
  const { currentWeight, history, loading: weightLoading } = useWeight();

  const missingProfileData = useMemo(() => {
    const missing: string[] = [];
    if (currentWeight === null)      missing.push('Gewicht');
    if (profile?.height_cm == null)  missing.push('Körpergrösse');
    if (profile?.age_years == null)  missing.push('Alter');
    return missing;
  }, [currentWeight, profile?.age_years, profile?.height_cm]);

  const { maintenanceCalories, maintenancePlan, engineInput } = useMemo(() => {
    if (
      currentWeight === null ||
      profile?.height_cm == null ||
      profile?.age_years == null
    ) {
      return { maintenanceCalories: null, maintenancePlan: null, engineInput: null };
    }

    // Resolve training frequency tier; fall back to 'low' when not yet set.
    const tier = (profile.training_frequency ?? 'low') as FrequencyTier;
    const { activityLevel, sessionsPerWeek } = FREQUENCY_MAP[tier] ?? FREQUENCY_MAP.low;

    const input: NutritionInput = {
      ageYears:                   profile.age_years,
      heightCm:                   profile.height_cm,
      currentWeightKg:            currentWeight,
      activityLevel,
      trainingSessionsPerWeek:    sessionsPerWeek,
      trainingType:               TRAINING_TYPE,
      avgTrainingDurationMinutes: DEFAULT_AVG_DURATION_MIN,
      // Sex: map profile gender string to engine type
      sex: profile.gender === 'male' || profile.gender === 'female'
        ? (profile.gender as 'male' | 'female')
        : undefined,
    };

    const result = calculateNutrition(input);

    return {
      maintenanceCalories: result.maintenanceCalories,
      maintenancePlan:     result.plans[0] ?? null,
      engineInput:         input,
    };
  }, [
    currentWeight,
    profile?.age_years,
    profile?.gender,
    profile?.height_cm,
    profile?.training_frequency,
  ]);

  return {
    maintenanceCalories,
    maintenancePlan,
    engineInput,
    currentWeight,
    weightHistory: history,
    ageYears: profile?.age_years ?? null,
    loading: profileLoading || weightLoading,
    missingProfileData,
    profile: profile ?? null,
  };
}
