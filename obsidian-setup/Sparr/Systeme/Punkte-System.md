# Punkte-System

## Grundprinzip

Punkte werden in `profiles.total_points` akkumuliert. Zwei Quellen:
1. **Workout-Logs** — via `add_workout_points` / `deduct_workout_points` RPCs
2. **Anwesenheits-Bestätigung** — via `mark_attendance` / `unmark_attendance` RPCs

## Berechnung

```
Punkte = Math.max(1, Math.floor(durationMin / 30)) * pointsPer30Min
```

### Intensitätsstufen (Kampfsport-Kategorien)

Intensität wird über das **Work Ratio** bestimmt:
```
workRatio = roundDuration / (roundDuration + pauseDuration)
```

| Work Ratio | Intensität | Punkte pro 30min |
|---|---|---|
| < 0.50 | leicht | 15 |
| 0.50 – 0.74 | mittel | 25 |
| >= 0.75 | intensiv | 35 |

### Extra-Aktivitäten (Schwimmen, Sauna, etc.)

Gleiche Punkte-Logik wie reguläre Workouts — keine separate Behandlung.

## Sicherheit

Alle Punkte-Operationen laufen in `SECURITY DEFINER` RPCs auf Postgres — nie direkt im Client. Verhindert Manipulation.

## Bonus-Punkte

- Wasserziel erreicht → +5 XP via `add_workout_points` RPC

## Wichtige Dateien

- `src/utils/points.ts` — Berechnungslogik
- `src/utils/points.test.ts` — Unit-Tests
