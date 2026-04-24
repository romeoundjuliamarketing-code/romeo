/**
 * Nutrition Engine — rule-based calorie and macro planner.
 *
 * Pure TypeScript, no React, fully unit-testable.
 *
 * Architecture:
 *   1. Input normalisation
 *   2. BMR / TDEE calculation
 *   3. Goal analysis
 *   4. Multi-plan generation (recommended / faster / aggressive)
 *   5. Macro calculation per plan
 *   6. UI-text generation
 *   7. Main export: calculateNutrition()
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Sex            = 'male' | 'female';
export type ActivityLevel  = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
export type TrainingType   = 'none' | 'cardio' | 'strength' | 'combat' | 'mixed';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type GoalDirection  = 'loss' | 'gain' | 'maintain';
export type PlanMode       = 'recommended' | 'faster' | 'aggressive';
export type RiskLevel      = 'low' | 'medium' | 'high';

export interface NutritionInput {
  // Required
  ageYears:               number;
  heightCm:               number;
  currentWeightKg:        number;
  activityLevel:          ActivityLevel;
  trainingSessionsPerWeek: number;
  trainingType:           TrainingType;
  // Optional
  sex?:                   Sex;
  targetWeightKg?:        number;
  durationWeeks?:         number;
  averageStepsPerDay?:    number;
  avgTrainingDurationMinutes?: number;
  experienceLevel?:       ExperienceLevel;
}

export interface MacroSet {
  kcalPerDay:   number;
  proteinGrams: number;
  fatGrams:     number;
  carbsGrams:   number;
}

export interface NutritionPlan extends MacroSet {
  mode:                     PlanMode;
  label:                    string;
  expectedWeeklyChangeKg:   number;
  expectedWeeklyChangePercent: number;
  estimatedTimeToGoalWeeks: number | null;
  riskLevel:                RiskLevel;
  shortExplanation:         string;
  warningText:              string | null;
}

export interface GoalSummary {
  direction:                GoalDirection;
  deltaWeightKg:            number | null;
  durationWeeks:            number | null;
  desiredWeeklyRatePercent: number | null;
  isDesiredRateAggressive:  boolean;
}

export interface UIMessages {
  headline:       string;
  subline:        string;
  warning:        string | null;
  adjustmentHint: string;
}

export interface NutritionResult {
  maintenanceCalories: number;
  goalSummary:         GoalSummary;
  plans:               NutritionPlan[];
  uiMessages:          UIMessages;
  autoSelectMode:      PlanMode | null; // null in Scenario A or maintain
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Approximate kcal equivalence per kg of weight change (mixed tissue, not pure fat).
// Pure fat ≈ 9000 kcal/kg, but real-world weight change includes water, glycogen, lean mass.
const KCAL_PER_KG_TISSUE = 7_700;

// Output rounding steps — avoids false precision.
const ROUND_KCAL    = 50;
const ROUND_MACRO_G =  5;

// Mifflin-St Jeor sex offsets.
const BMR_OFFSET_MALE   =    5;
const BMR_OFFSET_FEMALE = -161;

// Base TDEE multiplier for each activity level.
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary:         1.20,
  lightly_active:    1.375,
  moderately_active: 1.55,
  very_active:       1.725,
  extremely_active:  1.90,
};

// Additional TDEE factor added per training session per week, by type.
// Combat sports raise TDEE more than light cardio.
const TRAINING_BONUS_PER_SESSION: Record<TrainingType, number> = {
  none:     0.000,
  cardio:   0.010,
  strength: 0.018,
  combat:   0.025,
  mixed:    0.020,
};

// Protein targets (g / kg body weight) per direction and user profile.
const PROTEIN_TARGETS: Record<GoalDirection, { general: number; sport: number; aggressive: number }> = {
  gain:     { general: 1.9, sport: 2.0, aggressive: 2.2 },
  maintain: { general: 1.7, sport: 1.8, aggressive: 2.0 },
  loss:     { general: 2.0, sport: 2.2, aggressive: 2.4 },
};

// Fat targets (g / kg body weight).
const FAT_G_PER_KG_STANDARD   = 0.80;
const FAT_G_PER_KG_AGGRESSIVE = 0.70; // reduced on aggressive cut, but above floor
const FAT_G_PER_KG_FLOOR      = 0.60; // hard minimum — hormonal / health floor

// Weekly rate bands as % of body weight.
// Format: [lowerBound, midpoint, upperBound] — plans use the midpoint.
const WEEKLY_RATE_BANDS: Record<Exclude<GoalDirection, 'maintain'>, Record<PlanMode, readonly [number, number, number]>> = {
  loss: {
    recommended: [0.50, 0.625, 0.75],
    faster:      [0.75, 0.875, 1.00],
    aggressive:  [1.00, 1.125, 1.25],
  },
  gain: {
    recommended: [0.25, 0.375, 0.50],
    faster:      [0.50, 0.625, 0.75],
    aggressive:  [0.75, 0.875, 1.00],
  },
};

// Absolute kcal/day guard rails relative to maintenance.
// These cap the computed delta regardless of what the rate formula yields.
const DEFICIT_MIN_KCAL = 200;   // minimum meaningful deficit
const DEFICIT_MAX_KCAL = 1_050; // hard ceiling — below this risks muscle loss / metabolic damage
const SURPLUS_MIN_KCAL = 150;   // minimum meaningful surplus
const SURPLUS_MAX_KCAL = 900;   // hard ceiling — above this drives mostly fat gain

// ─── Rate-to-mode mapping ─────────────────────────────────────────────────────

/**
 * Maps a required weekly rate (as % of body weight) to the plan mode whose
 * band contains it, and whether the actual rate should override the midpoint.
 *
 * Boundary rule: upper bound of each band belongs to the lower band.
 * E.g. 0.75% on loss → recommended (not faster).
 *
 * Below rec lower bound   → recommended, useActualRate=false (goal is far away)
 * Above aggr upper bound  → aggressive,  useActualRate=false (guard rails clamp anyway)
 */
export function findModeForRate(
  ratePct: number,
  direction: Exclude<GoalDirection, 'maintain'>,
): { mode: PlanMode; useActualRate: boolean } {
  const bands     = WEEKLY_RATE_BANDS[direction];
  const recLower  = bands.recommended[0];
  const recUpper  = bands.recommended[2];
  const fastUpper = bands.faster[2];
  const aggrUpper = bands.aggressive[2];

  if (ratePct < recLower)   return { mode: 'recommended', useActualRate: false };
  if (ratePct <= recUpper)  return { mode: 'recommended', useActualRate: true  };
  if (ratePct <= fastUpper) return { mode: 'faster',      useActualRate: true  };
  if (ratePct <= aggrUpper) return { mode: 'aggressive',  useActualRate: true  };
  return                           { mode: 'aggressive',  useActualRate: false };
}

// ─── Rounding helpers ────────────────────────────────────────────────────────

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── 1. Input normalisation ──────────────────────────────────────────────────

/**
 * Returns true if the user qualifies as "sportive" for the purpose of
 * setting higher protein targets.
 *
 * Criteria: trains ≥3 sessions/week with strength, combat, or mixed type;
 * OR is an intermediate/advanced athlete regardless of frequency.
 */
export function isSportiveUser(input: NutritionInput): boolean {
  const activeSport =
    input.trainingType === 'combat' ||
    input.trainingType === 'strength' ||
    input.trainingType === 'mixed';
  const frequentTraining = input.trainingSessionsPerWeek >= 3;
  const experienced =
    input.experienceLevel === 'intermediate' ||
    input.experienceLevel === 'advanced';
  return (activeSport && frequentTraining) || experienced;
}

// ─── 2. BMR / TDEE ───────────────────────────────────────────────────────────

/** Mifflin-St Jeor BMR. Unknown sex → average of male/female estimates. */
export function calculateBMR(input: NutritionInput): number {
  const base = 10 * input.currentWeightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  if (input.sex === 'male')   return base + BMR_OFFSET_MALE;
  if (input.sex === 'female') return base + BMR_OFFSET_FEMALE;
  return base + (BMR_OFFSET_MALE + BMR_OFFSET_FEMALE) / 2;
}

/**
 * TDEE = BMR × activity factor, refined by training type/frequency,
 * session duration, and optional step count.
 */
export function calculateTDEE(bmr: number, input: NutritionInput): number {
  let factor = ACTIVITY_FACTORS[input.activityLevel];

  // Training sessions add extra demand proportional to type and frequency
  factor += TRAINING_BONUS_PER_SESSION[input.trainingType] * input.trainingSessionsPerWeek;

  // Longer sessions (avg > 75 min) add additional demand
  const avgDuration = input.avgTrainingDurationMinutes ?? 60;
  if      (avgDuration > 90) factor += 0.050;
  else if (avgDuration > 75) factor += 0.025;

  // Daily step count refines the sedentary/active picture
  if (input.averageStepsPerDay !== undefined) {
    const steps = input.averageStepsPerDay;
    if      (steps < 5_000)  factor -= 0.05;
    else if (steps > 12_000) factor += 0.05;
    else if (steps > 8_000)  factor += 0.025;
  }

  // Clamp to a realistic physiological range
  const safeFactor = clamp(factor, 1.20, 2.20);
  return bmr * safeFactor;
}

// ─── 3. Goal analysis ────────────────────────────────────────────────────────

function resolveDirection(input: NutritionInput): GoalDirection {
  if (input.targetWeightKg === undefined) return 'maintain';
  const delta = input.targetWeightKg - input.currentWeightKg;
  if (Math.abs(delta) < 0.5) return 'maintain'; // within 0.5 kg → treat as maintain
  return delta > 0 ? 'gain' : 'loss';
}

export function analyzeGoal(input: NutritionInput): GoalSummary {
  const direction = resolveDirection(input);

  if (
    input.targetWeightKg === undefined ||
    input.durationWeeks  === undefined ||
    direction === 'maintain'
  ) {
    return {
      direction,
      deltaWeightKg:            null,
      durationWeeks:            null,
      desiredWeeklyRatePercent: null,
      isDesiredRateAggressive:  false,
    };
  }

  const deltaWeightKg = input.targetWeightKg - input.currentWeightKg;
  const weeklyRateKg  = Math.abs(deltaWeightKg) / input.durationWeeks;
  const weeklyRatePct = (weeklyRateKg / input.currentWeightKg) * 100;

  // "Aggressive" = beyond the upper bound of the "faster" band
  const fasterMax = WEEKLY_RATE_BANDS[direction].faster[2];
  const isDesiredRateAggressive = weeklyRatePct > fasterMax;

  return {
    direction,
    deltaWeightKg,
    durationWeeks:            input.durationWeeks,
    desiredWeeklyRatePercent: Math.round(weeklyRatePct * 100) / 100,
    isDesiredRateAggressive,
  };
}

// ─── 4–5. Plan + macro generation ────────────────────────────────────────────

function proteinGramsForPlan(
  weightKg: number,
  direction: GoalDirection,
  mode: PlanMode,
  sportive: boolean,
): number {
  const cfg = PROTEIN_TARGETS[direction];
  let gPerKg: number;
  if (mode === 'aggressive') {
    gPerKg = cfg.aggressive;
  } else if (sportive) {
    gPerKg = cfg.sport;
  } else {
    gPerKg = cfg.general;
  }
  return roundTo(weightKg * gPerKg, ROUND_MACRO_G);
}

function fatGramsForPlan(
  weightKg: number,
  direction: GoalDirection,
  mode: PlanMode,
): number {
  let gPerKg: number;
  if (mode === 'aggressive' && direction === 'loss') {
    gPerKg = FAT_G_PER_KG_AGGRESSIVE;
  } else {
    gPerKg = FAT_G_PER_KG_STANDARD;
  }
  // Hard floor — never below hormonal minimum
  gPerKg = Math.max(gPerKg, FAT_G_PER_KG_FLOOR);
  return roundTo(weightKg * gPerKg, ROUND_MACRO_G);
}

function carbsGramsFromRemainder(kcal: number, proteinG: number, fatG: number): number {
  const remaining = kcal - proteinG * 4 - fatG * 9;
  return roundTo(Math.max(0, remaining / 4), ROUND_MACRO_G);
}

// ─── 6. Plan text generation ──────────────────────────────────────────────────

interface PlanTexts {
  label:            string;
  shortExplanation: string;
  warningText:      string | null;
}

function getPlanTexts(mode: PlanMode, direction: GoalDirection): PlanTexts {
  if (direction === 'maintain') {
    return {
      label:            'Erhaltung',
      shortExplanation: 'Kalorien zum Halten deines Gewichts bei deinem Aktivitätsniveau.',
      warningText:      null,
    };
  }

  if (direction === 'gain') {
    switch (mode) {
      case 'recommended':
        return {
          label:            'Empfohlen',
          shortExplanation: 'Sauberer Aufbau mit minimalem Fett- und Wasserzuwachs.',
          warningText:      null,
        };
      case 'faster':
        return {
          label:            'Schneller',
          shortExplanation: 'Schnellerer Aufbau — Fett- und Wassereinlagerungen wahrscheinlicher.',
          warningText:      'Ein schnellerer Aufbau erhöht die Wahrscheinlichkeit für Fett- und Wassereinlagerungen.',
        };
      case 'aggressive':
        return {
          label:            'Aggressiv',
          shortExplanation: 'Maximaler Überschuss für sehr schnelles Zunehmen.',
          warningText:      'Deutlich mehr Fett- und Wassereinlagerungen wahrscheinlich. Nur für kurze Phasen sinnvoll.',
        };
    }
  }

  // direction === 'loss'
  switch (mode) {
    case 'recommended':
      return {
        label:            'Empfohlen',
        shortExplanation: 'Nachhaltiger Fettverlust bei guter Performance und Muskelerhalt.',
        warningText:      null,
      };
    case 'faster':
      return {
        label:            'Schneller',
        shortExplanation: 'Schnellerer Fettverlust — Leistung und Regeneration können leiden.',
        warningText:      'Höheres Defizit kann Schlaf, Regeneration und Trainingsqualität verschlechtern.',
      };
    case 'aggressive':
      return {
        label:            'Aggressiv',
        shortExplanation: 'Maximales Defizit — nur kurzfristig und mit Plan.',
        warningText:      'Hohes Risiko für Muskelabbau, Hunger und schlechtere Trainingsqualität. Nicht dauerhaft empfohlen.',
      };
  }
}

function buildPlan(
  mode: PlanMode,
  direction: GoalDirection,
  maintenanceKcal: number,
  input: NutritionInput,
  goalSummary: GoalSummary,
  sportive: boolean,
  overrideRateKgPerWeek?: number,
): NutritionPlan {
  const w = input.currentWeightKg;

  // Maintenance plan has no calorie delta
  if (direction === 'maintain') {
    const protein = proteinGramsForPlan(w, 'maintain', 'recommended', sportive);
    const fat     = fatGramsForPlan(w, 'maintain', 'recommended');
    const carbs   = carbsGramsFromRemainder(maintenanceKcal, protein, fat);
    const { label, shortExplanation, warningText } = getPlanTexts('recommended', 'maintain');
    return {
      mode: 'recommended', label, kcalPerDay: maintenanceKcal,
      proteinGrams: protein, fatGrams: fat, carbsGrams: carbs,
      expectedWeeklyChangeKg: 0, expectedWeeklyChangePercent: 0,
      estimatedTimeToGoalWeeks: null, riskLevel: 'low',
      shortExplanation, warningText,
    };
  }

  // Rate midpoint for this mode, or actual required rate if overridden (Scenario B)
  const band             = WEEKLY_RATE_BANDS[direction][mode];
  const bandMidpointPct  = band[1]; // midpoint
  const weeklyChangeKg   = overrideRateKgPerWeek !== undefined
    ? overrideRateKgPerWeek
    : (w * bandMidpointPct) / 100;
  const dailyDeltaFromRate = (weeklyChangeKg * KCAL_PER_KG_TISSUE) / 7;

  // Apply guard-rail bounds on top of the rate-derived delta
  let kcalPerDay: number;
  if (direction === 'loss') {
    const clampedDeficit = clamp(dailyDeltaFromRate, DEFICIT_MIN_KCAL, DEFICIT_MAX_KCAL);
    kcalPerDay = maintenanceKcal - clampedDeficit;
  } else {
    const clampedSurplus = clamp(dailyDeltaFromRate, SURPLUS_MIN_KCAL, SURPLUS_MAX_KCAL);
    kcalPerDay = maintenanceKcal + clampedSurplus;
  }
  kcalPerDay = roundTo(kcalPerDay, ROUND_KCAL);

  const protein = proteinGramsForPlan(w, direction, mode, sportive);
  const fat     = fatGramsForPlan(w, direction, mode);
  const carbs   = carbsGramsFromRemainder(kcalPerDay, protein, fat);

  const estimatedTimeToGoalWeeks =
    goalSummary.deltaWeightKg !== null && weeklyChangeKg > 0
      ? Math.ceil(Math.abs(goalSummary.deltaWeightKg) / weeklyChangeKg)
      : null;

  const riskLevel: RiskLevel =
    mode === 'recommended' ? 'low' : mode === 'faster' ? 'medium' : 'high';

  const sign                 = direction === 'loss' ? -1 : 1;
  const { label, shortExplanation, warningText } = getPlanTexts(mode, direction);

  return {
    mode, label, kcalPerDay,
    proteinGrams: protein, fatGrams: fat, carbsGrams: carbs,
    expectedWeeklyChangeKg:      Math.round(sign * weeklyChangeKg * 100) / 100,
    expectedWeeklyChangePercent: Math.round(sign * bandMidpointPct * 10) / 10,
    estimatedTimeToGoalWeeks,
    riskLevel, shortExplanation, warningText,
  };
}

function generatePlans(
  direction: GoalDirection,
  maintenanceKcal: number,
  input: NutritionInput,
  goalSummary: GoalSummary,
  sportive: boolean,
): { plans: NutritionPlan[]; autoSelectMode: PlanMode | null } {
  if (direction === 'maintain') {
    return {
      plans: [buildPlan('recommended', 'maintain', maintenanceKcal, input, goalSummary, sportive)],
      autoSelectMode: null,
    };
  }

  const modes: PlanMode[] = ['recommended', 'faster', 'aggressive'];

  // Scenario A — no deadline: all plans use their band midpoints
  if (goalSummary.durationWeeks === null || goalSummary.deltaWeightKg === null) {
    return {
      plans: modes.map(mode =>
        buildPlan(mode, direction, maintenanceKcal, input, goalSummary, sportive),
      ),
      autoSelectMode: null,
    };
  }

  // Scenario B — deadline set: find which mode matches the required rate
  const requiredRateKgPerWeek =
    Math.abs(goalSummary.deltaWeightKg) / goalSummary.durationWeeks;
  const requiredRatePct =
    (requiredRateKgPerWeek / input.currentWeightKg) * 100;

  const { mode: matchingMode, useActualRate } = findModeForRate(
    requiredRatePct,
    direction as Exclude<GoalDirection, 'maintain'>, // safe: maintain returned early
  );

  const plans = modes.map(mode => {
    const overrideRateKgPerWeek =
      mode === matchingMode && useActualRate ? requiredRateKgPerWeek : undefined;
    return buildPlan(
      mode, direction, maintenanceKcal, input, goalSummary, sportive, overrideRateKgPerWeek,
    );
  });

  return { plans, autoSelectMode: matchingMode };
}

// ─── 6. UI messages ───────────────────────────────────────────────────────────

export function generateUIMessages(
  goalSummary: GoalSummary,
  plans: NutritionPlan[],
): UIMessages {
  const { direction, deltaWeightKg, isDesiredRateAggressive } = goalSummary;
  const adjustmentHint = 'Gewicht wöchentlich eintragen — nach 2 Wochen passt das System bei Bedarf an.';

  if (direction === 'maintain') {
    return {
      headline:       'Dein Erhaltungsbedarf',
      subline:        'Diese Kalorien halten dein Gewicht bei deinem aktuellen Aktivitätsniveau stabil.',
      warning:        null,
      adjustmentHint,
    };
  }

  const recPlan       = plans.find(p => p.mode === 'recommended');
  const weeksRec      = recPlan?.estimatedTimeToGoalWeeks ?? null;
  const timeHint      = weeksRec !== null ? ` — empfohlene Route: ca. ${weeksRec} Wochen` : '';
  const kgAbs         = Math.abs(deltaWeightKg ?? 0).toFixed(1);

  if (direction === 'gain') {
    return {
      headline: 'Dein Aufbauplan',
      subline:  deltaWeightKg !== null
        ? `${kgAbs} kg zunehmen${timeHint}.`
        : 'Kalorien und Makros für deinen Aufbau.',
      warning: isDesiredRateAggressive
        ? 'Dein Wunschzeitraum ist sehr ambitioniert. Die empfohlene Variante ist realistischer.'
        : null,
      adjustmentHint,
    };
  }

  return {
    headline: 'Dein Abnahmeplan',
    subline:  deltaWeightKg !== null
      ? `${kgAbs} kg abnehmen${timeHint}.`
      : 'Kalorien und Makros für deine Abnahme.',
    warning: isDesiredRateAggressive
      ? 'Dein Wunschzeitraum ist sehr sportlich. Die empfohlene Option ist nachhaltiger — schnellere Varianten sind verfügbar.'
      : null,
    adjustmentHint,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function calculateNutrition(input: NutritionInput): NutritionResult {
  const bmr                = calculateBMR(input);
  const tdee               = calculateTDEE(bmr, input);
  const maintenanceCalories = roundTo(tdee, ROUND_KCAL);
  const goalSummary        = analyzeGoal(input);
  const sportive           = isSportiveUser(input);
  const { plans, autoSelectMode } = generatePlans(
    goalSummary.direction, maintenanceCalories, input, goalSummary, sportive,
  );
  const uiMessages = generateUIMessages(goalSummary, plans);

  return { maintenanceCalories, goalSummary, plans, uiMessages, autoSelectMode };
}
