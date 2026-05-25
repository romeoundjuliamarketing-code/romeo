# Ernährung

## Nutrition Engine

Gesamte Logik in `src/utils/nutritionEngine.ts` (pure TypeScript, kein React, 62 Unit-Tests).

### Berechnung

1. **BMR** — Mifflin-St Jeor Formel
2. **TDEE** — BMR × Aktivitätslevel + Trainingstyp-Bonus
3. **Plan** — Ziel (Abnehmen/Aufbauen) + Modus → Makros

### Plan-Modi

| Modus | Verlust/Woche | Aufbau/Woche |
|---|---|---|
| recommended | 0.50–0.75% KG | 0.25–0.50% KG |
| faster | 0.75–1.00% KG | 0.50–0.75% KG |
| aggressive | 1.00–1.25% KG | 0.75–1.00% KG |

Guard rails: Defizit 200–1050 kcal, Surplus 150–900 kcal.

### Trainingspensum (beeinflusst TDEE)

| Wert | Aktivitätslevel | Frequenz |
|---|---|---|
| `low` | moderately_active | 3×/Woche |
| `medium` | very_active | 5×/Woche |
| `high` | extremely_active | 10×/Woche |

## Wassertracking

Ziel: dynamisch aus Gewicht + Alter + Modus (30/35/40 ml/kg).
Bonus: +5 XP bei Zielerreichung.

## Wichtige Dateien

- `src/utils/nutritionEngine.ts` — Kern-Logik
- `src/hooks/useNutritionTargets.ts` — Datenzugriff
- `src/hooks/useWeightGoalCoach.ts` — Ziel + Engine → Pläne
- AsyncStorage-Key für Ziel: `weight_goal_plan_v2`
