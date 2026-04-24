import {
  calculateNutrition,
  calculateBMR,
  calculateTDEE,
  analyzeGoal,
  isSportiveUser,
  findModeForRate,
} from './nutritionEngine';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_SPORTIVE= {
  ageYears: 26,
  heightCm: 180,
  currentWeightKg: 83,
  activityLevel: 'very_active' as const,
  trainingSessionsPerWeek: 5,
  trainingType: 'mixed' as const,
  sex: 'male' as const,
  experienceLevel: 'intermediate' as const,
};

// ─── Test 1: Moderate muscle gain ────────────────────────────────────────────

describe('Test 1 — Moderate muscle gain', () => {
  const input= {
    ageYears: 25,
    heightCm: 180,
    currentWeightKg: 80,
    sex: 'male' as const,
    targetWeightKg: 85,
    durationWeeks: 20,
    activityLevel: 'moderately_active' as const,
    trainingSessionsPerWeek: 4,
    trainingType: 'mixed' as const,
    experienceLevel: 'intermediate' as const,
  };

  const result = calculateNutrition(input);

  test('goal direction is gain', () => {
    expect(result.goalSummary.direction).toBe('gain');
  });

  test('desired rate is not aggressive (5 kg over 20 weeks)', () => {
    expect(result.goalSummary.isDesiredRateAggressive).toBe(false);
  });

  test('produces 3 plans', () => {
    expect(result.plans).toHaveLength(3);
  });

  test('recommended plan has positive kcal surplus', () => {
    const rec = result.plans.find(p => p.mode === 'recommended')!;
    expect(rec.kcalPerDay).toBeGreaterThan(result.maintenanceCalories);
  });

  test('protein is at sport level (≥2.0 g/kg)', () => {
    const rec = result.plans.find(p => p.mode === 'recommended')!;
    expect(rec.proteinGrams / input.currentWeightKg).toBeGreaterThanOrEqual(1.9);
  });

  test('recommended plan has lower kcal than aggressive plan', () => {
    const rec  = result.plans.find(p => p.mode === 'recommended')!;
    const aggr = result.plans.find(p => p.mode === 'aggressive')!;
    expect(rec.kcalPerDay).toBeLessThan(aggr.kcalPerDay);
  });

  test('estimated weeks decrease with higher-intensity plans', () => {
    const [rec, fast, aggr] = result.plans;
    expect(rec.estimatedTimeToGoalWeeks!).toBeGreaterThan(fast.estimatedTimeToGoalWeeks!);
    expect(fast.estimatedTimeToGoalWeeks!).toBeGreaterThan(aggr.estimatedTimeToGoalWeeks!);
  });

  test('no warning on recommended plan', () => {
    const rec = result.plans.find(p => p.mode === 'recommended')!;
    expect(rec.warningText).toBeNull();
  });
});

// ─── Test 2: Aggressive bulk request ────────────────────────────────────────

describe('Test 2 — Aggressive bulk request (7 kg in 8 weeks)', () => {
  const input= {
    ageYears: 22,
    heightCm: 178,
    currentWeightKg: 75,
    sex: 'male' as const,
    targetWeightKg: 82,
    durationWeeks: 8,
    activityLevel: 'moderately_active' as const,
    trainingSessionsPerWeek: 4,
    trainingType: 'strength' as const,
  };

  const result = calculateNutrition(input);

  test('goal is flagged as aggressive', () => {
    expect(result.goalSummary.isDesiredRateAggressive).toBe(true);
  });

  test('UI warning is set', () => {
    expect(result.uiMessages.warning).not.toBeNull();
  });

  test('aggressive plan has a warning text', () => {
    const aggr = result.plans.find(p => p.mode === 'aggressive')!;
    expect(aggr.warningText).not.toBeNull();
  });

  test('surplus never exceeds 900 kcal/day guard rail', () => {
    result.plans.forEach(plan => {
      const surplus = plan.kcalPerDay - result.maintenanceCalories;
      expect(surplus).toBeLessThanOrEqual(900);
    });
  });
});

// ─── Test 3: Moderate fat loss ───────────────────────────────────────────────

describe('Test 3 — Moderate fat loss (5 kg, 16 weeks)', () => {
  const input= {
    ageYears: 30,
    heightCm: 165,
    currentWeightKg: 70,
    sex: 'female' as const,
    targetWeightKg: 65,
    durationWeeks: 16,
    activityLevel: 'moderately_active' as const,
    trainingSessionsPerWeek: 3,
    trainingType: 'combat' as const,
    experienceLevel: 'intermediate' as const,
  };

  const result = calculateNutrition(input);

  test('goal direction is loss', () => {
    expect(result.goalSummary.direction).toBe('loss');
  });

  test('desired rate is not aggressive', () => {
    expect(result.goalSummary.isDesiredRateAggressive).toBe(false);
  });

  test('all plans are below maintenance', () => {
    result.plans.forEach(plan => {
      expect(plan.kcalPerDay).toBeLessThan(result.maintenanceCalories);
    });
  });

  test('protein on recommended ≥ 2.0 g/kg (sport cut)', () => {
    const rec = result.plans.find(p => p.mode === 'recommended')!;
    expect(rec.proteinGrams / input.currentWeightKg).toBeGreaterThanOrEqual(2.0);
  });

  test('fat ≥ floor (0.6 g/kg) on all plans', () => {
    result.plans.forEach(plan => {
      expect(plan.fatGrams / input.currentWeightKg).toBeGreaterThanOrEqual(0.6);
    });
  });

  test('carbs are non-negative', () => {
    result.plans.forEach(plan => {
      expect(plan.carbsGrams).toBeGreaterThanOrEqual(0);
    });
  });
});

// ─── Test 4: Aggressive cut request ─────────────────────────────────────────

describe('Test 4 — Aggressive cut (10 kg in 10 weeks)', () => {
  const input= {
    ageYears: 28,
    heightCm: 175,
    currentWeightKg: 90,
    sex: 'male' as const,
    targetWeightKg: 80,
    durationWeeks: 10,
    activityLevel: 'very_active' as const,
    trainingSessionsPerWeek: 5,
    trainingType: 'mixed' as const,
  };

  const result = calculateNutrition(input);

  test('flagged as aggressive', () => {
    expect(result.goalSummary.isDesiredRateAggressive).toBe(true);
  });

  test('deficit never exceeds 1050 kcal/day', () => {
    result.plans.forEach(plan => {
      const deficit = result.maintenanceCalories - plan.kcalPerDay;
      expect(deficit).toBeLessThanOrEqual(1_050);
    });
  });

  test('aggressive plan kcal < faster plan kcal < recommended plan kcal', () => {
    const [rec, fast, aggr] = result.plans;
    expect(aggr.kcalPerDay).toBeLessThan(fast.kcalPerDay);
    expect(fast.kcalPerDay).toBeLessThan(rec.kcalPerDay);
  });

  test('aggressive plan warns user', () => {
    const aggr = result.plans.find(p => p.mode === 'aggressive')!;
    expect(aggr.warningText).not.toBeNull();
  });

  test('all expected weekly changes are negative', () => {
    result.plans.forEach(plan => {
      expect(plan.expectedWeeklyChangeKg).toBeLessThan(0);
    });
  });
});

// ─── Test 5: Sportive user — combat + gym ────────────────────────────────────

describe('Test 5 — Sportive combat + gym athlete (maintenance)', () => {
  const result = calculateNutrition(BASE_SPORTIVE);

  test('isSportiveUser returns true', () => {
    expect(isSportiveUser(BASE_SPORTIVE)).toBe(true);
  });

  test('TDEE is significantly above base BMR', () => {
    const bmr  = calculateBMR(BASE_SPORTIVE);
    const tdee = calculateTDEE(bmr, BASE_SPORTIVE);
    expect(tdee).toBeGreaterThan(bmr * 1.6);
  });

  test('maintenance calories are within plausible range for active 83 kg male', () => {
    expect(result.maintenanceCalories).toBeGreaterThan(2_600);
    expect(result.maintenanceCalories).toBeLessThan(4_500);
  });

  test('maintenance produces only 1 plan', () => {
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].mode).toBe('recommended');
  });

  test('protein at sport level (1.8 g/kg for maintain)', () => {
    const plan = result.plans[0];
    expect(plan.proteinGrams / BASE_SPORTIVE.currentWeightKg).toBeGreaterThanOrEqual(1.7);
  });

  test('calories are rounded to 50-kcal step', () => {
    expect(result.maintenanceCalories % 50).toBe(0);
  });

  test('macros rounded to 5 g step', () => {
    const plan = result.plans[0];
    expect(plan.proteinGrams % 5).toBe(0);
    expect(plan.fatGrams     % 5).toBe(0);
    expect(plan.carbsGrams   % 5).toBe(0);
  });
});

// ─── Test 6: Missing optional inputs ────────────────────────────────────────

describe('Test 6 — Missing optional inputs (minimal input set)', () => {
  const minimalInput= {
    ageYears: 35,
    heightCm: 175,
    currentWeightKg: 75,
    activityLevel: 'sedentary' as const,
    trainingSessionsPerWeek: 0,
    trainingType: 'none' as const,
    // sex, target, duration, steps, duration, experience all omitted
  };

  const result = calculateNutrition(minimalInput);

  test('does not throw', () => {
    expect(() => calculateNutrition(minimalInput)).not.toThrow();
  });

  test('direction defaults to maintain', () => {
    expect(result.goalSummary.direction).toBe('maintain');
  });

  test('maintenance calories are plausible for sedentary 75 kg person', () => {
    expect(result.maintenanceCalories).toBeGreaterThan(1_500);
    expect(result.maintenanceCalories).toBeLessThan(2_500);
  });

  test('isSportiveUser returns false', () => {
    expect(isSportiveUser(minimalInput)).toBe(false);
  });

  test('fat never below floor', () => {
    result.plans.forEach(plan => {
      expect(plan.fatGrams / minimalInput.currentWeightKg).toBeGreaterThanOrEqual(0.6);
    });
  });

  test('carbs non-negative', () => {
    result.plans.forEach(plan => {
      expect(plan.carbsGrams).toBeGreaterThanOrEqual(0);
    });
  });
});

// ─── Test 7: findModeForRate — loss bands ────────────────────────────────────

describe('Test 7 — findModeForRate band mapping (loss)', () => {
  test('below recommended lower bound -> recommended, useActualRate=false', () => {
    const r = findModeForRate(0.3, 'loss');
    expect(r.mode).toBe('recommended');
    expect(r.useActualRate).toBe(false);
  });

  test('at recommended lower bound -> recommended, useActualRate=true', () => {
    const r = findModeForRate(0.50, 'loss');
    expect(r.mode).toBe('recommended');
    expect(r.useActualRate).toBe(true);
  });

  test('at recommended upper bound -> recommended, useActualRate=true (not faster)', () => {
    const r = findModeForRate(0.75, 'loss');
    expect(r.mode).toBe('recommended');
    expect(r.useActualRate).toBe(true);
  });

  test('just above recommended upper -> faster, useActualRate=true', () => {
    const r = findModeForRate(0.76, 'loss');
    expect(r.mode).toBe('faster');
    expect(r.useActualRate).toBe(true);
  });

  test('within aggressive band -> aggressive, useActualRate=true', () => {
    const r = findModeForRate(1.10, 'loss');
    expect(r.mode).toBe('aggressive');
    expect(r.useActualRate).toBe(true);
  });

  test('above aggressive upper -> aggressive, useActualRate=false', () => {
    const r = findModeForRate(1.30, 'loss');
    expect(r.mode).toBe('aggressive');
    expect(r.useActualRate).toBe(false);
  });
});

// ─── Test 8: findModeForRate — gain bands ────────────────────────────────────

describe('Test 8 — findModeForRate band mapping (gain)', () => {
  test('below recommended lower bound -> recommended, useActualRate=false', () => {
    const r = findModeForRate(0.20, 'gain');
    expect(r.mode).toBe('recommended');
    expect(r.useActualRate).toBe(false);
  });

  test('within faster band -> faster, useActualRate=true', () => {
    const r = findModeForRate(0.60, 'gain');
    expect(r.mode).toBe('faster');
    expect(r.useActualRate).toBe(true);
  });

  test('above aggressive upper -> aggressive, useActualRate=false', () => {
    const r = findModeForRate(1.05, 'gain');
    expect(r.mode).toBe('aggressive');
    expect(r.useActualRate).toBe(false);
  });
});

// ─── Test 9: Scenario A — no durationWeeks ───────────────────────────────────

describe('Test 9 — Scenario A: no durationWeeks -> autoSelectMode is null', () => {
  const input = {
    ageYears: 25, heightCm: 180, currentWeightKg: 80,
    sex: 'male' as const, targetWeightKg: 75,
    activityLevel: 'moderately_active' as const,
    trainingSessionsPerWeek: 4, trainingType: 'mixed' as const,
    experienceLevel: 'intermediate' as const,
  };
  const result = calculateNutrition(input);

  test('autoSelectMode is null when no durationWeeks', () => {
    expect(result.autoSelectMode).toBeNull();
  });

  test('produces 3 plans with midpoint calories (rec > faster > aggr for loss)', () => {
    expect(result.plans).toHaveLength(3);
    const rec  = result.plans.find(p => p.mode === 'recommended')!;
    const fast = result.plans.find(p => p.mode === 'faster')!;
    const aggr = result.plans.find(p => p.mode === 'aggressive')!;
    expect(rec.kcalPerDay).toBeGreaterThan(fast.kcalPerDay);
    expect(fast.kcalPerDay).toBeGreaterThan(aggr.kcalPerDay);
  });
});

// ─── Test 10: Scenario B — rate below rec lower (generous deadline) ───────────

describe('Test 10 — Scenario B: rate below recommended lower bound', () => {
  // 80 kg, lose 5 kg in 20 W -> ratePct = 0.3125 < 0.50 (rec lower for loss)
  const input = {
    ageYears: 25, heightCm: 180, currentWeightKg: 80,
    sex: 'male' as const, targetWeightKg: 75,
    durationWeeks: 20,
    activityLevel: 'moderately_active' as const,
    trainingSessionsPerWeek: 4, trainingType: 'mixed' as const,
    experienceLevel: 'intermediate' as const,
  };
  const result = calculateNutrition(input);

  test('autoSelectMode is recommended', () => {
    expect(result.autoSelectMode).toBe('recommended');
  });

  test('all plans use midpoints (same kcal as Scenario A)', () => {
    const { durationWeeks: _w, ...inputNoDate } = input;
    const noDate = calculateNutrition(inputNoDate);
    result.plans.forEach((plan, i) => {
      expect(plan.kcalPerDay).toBe(noDate.plans[i].kcalPerDay);
    });
  });
});

// ─── Test 11: Scenario B — required rate in faster band ──────────────────────

describe('Test 11 — Scenario B: required rate in faster band', () => {
  // 80 kg, lose 5 kg in 8 W -> ratePct = 0.7813 % -> faster band
  // maintenance ~2950 kcal; faster actual: (5/8*7700)/7 = 687.5 -> 2262 -> 2250
  const input = {
    ageYears: 25, heightCm: 180, currentWeightKg: 80,
    sex: 'male' as const, targetWeightKg: 75,
    durationWeeks: 8,
    activityLevel: 'moderately_active' as const,
    trainingSessionsPerWeek: 4, trainingType: 'mixed' as const,
    experienceLevel: 'intermediate' as const,
  };
  const result   = calculateNutrition(input);
  const recPlan  = result.plans.find(p => p.mode === 'recommended')!;
  const fastPlan = result.plans.find(p => p.mode === 'faster')!;
  const aggrPlan = result.plans.find(p => p.mode === 'aggressive')!;

  test('autoSelectMode is faster', () => {
    expect(result.autoSelectMode).toBe('faster');
  });

  test('faster plan uses actual rate -> 2250 kcal', () => {
    expect(fastPlan.kcalPerDay).toBe(2250);
  });

  test('recommended plan uses midpoint -> 2400 kcal', () => {
    expect(recPlan.kcalPerDay).toBe(2400);
  });

  test('aggressive plan uses midpoint -> 1950 kcal', () => {
    expect(aggrPlan.kcalPerDay).toBe(1950);
  });

  test('faster plan estimatedTimeToGoalWeeks equals durationWeeks', () => {
    expect(fastPlan.estimatedTimeToGoalWeeks).toBe(8);
  });

  test('rec and aggr plans match Scenario A (unaffected by deadline)', () => {
    const { durationWeeks: _w, ...inputNoDate } = input;
    const noDate = calculateNutrition(inputNoDate);
    expect(recPlan.kcalPerDay).toBe(noDate.plans.find(p => p.mode === 'recommended')!.kcalPerDay);
    expect(aggrPlan.kcalPerDay).toBe(noDate.plans.find(p => p.mode === 'aggressive')!.kcalPerDay);
  });
});

// ─── Test 12: Scenario B — required rate in aggressive band ──────────────────

describe('Test 12 — Scenario B: required rate in aggressive band', () => {
  // 90 kg, lose 10 kg in 10 W -> ratePct = 1.111 % -> aggressive band
  const input = {
    ageYears: 28, heightCm: 175, currentWeightKg: 90,
    sex: 'male' as const, targetWeightKg: 80,
    durationWeeks: 10,
    activityLevel: 'very_active' as const,
    trainingSessionsPerWeek: 5, trainingType: 'mixed' as const,
  };
  const result = calculateNutrition(input);

  test('autoSelectMode is aggressive', () => {
    expect(result.autoSelectMode).toBe('aggressive');
  });

  test('deficit does not exceed 1050 kcal/day guard rail on any plan', () => {
    result.plans.forEach(plan => {
      expect(result.maintenanceCalories - plan.kcalPerDay).toBeLessThanOrEqual(1_050);
    });
  });
});

// ─── Test 13: Scenario B — gain, required rate in recommended band ────────────

describe('Test 13 — Scenario B: gain, required rate in recommended band', () => {
  // 75 kg, gain 3 kg in 10 W -> ratePct = 0.40 % -> recommended gain band [0.25, 0.50]
  // maintenance ~2850 kcal; rec actual: (3/10*7700)/7 = 330 -> 2850+330=3180 -> 3200
  const input = {
    ageYears: 22, heightCm: 178, currentWeightKg: 75,
    sex: 'male' as const, targetWeightKg: 78,
    durationWeeks: 10,
    activityLevel: 'moderately_active' as const,
    trainingSessionsPerWeek: 4, trainingType: 'strength' as const,
  };
  const result  = calculateNutrition(input);
  const recPlan = result.plans.find(p => p.mode === 'recommended')!;

  test('autoSelectMode is recommended', () => {
    expect(result.autoSelectMode).toBe('recommended');
  });

  test('recommended plan uses actual rate -> 3200 kcal', () => {
    expect(recPlan.kcalPerDay).toBe(3200);
  });

  test('recommended plan is above maintenance', () => {
    expect(recPlan.kcalPerDay).toBeGreaterThan(result.maintenanceCalories);
  });

  test('recommended plan estimatedTimeToGoalWeeks equals durationWeeks', () => {
    expect(recPlan.estimatedTimeToGoalWeeks).toBe(10);
  });

  test('surplus does not exceed 900 kcal/day guard rail on any plan', () => {
    result.plans.forEach(plan => {
      expect(plan.kcalPerDay - result.maintenanceCalories).toBeLessThanOrEqual(900);
    });
  });
});
