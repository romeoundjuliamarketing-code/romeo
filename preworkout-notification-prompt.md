# Claude Code Prompt: Pre-Workout Reminders + Notification Varianz

## Kontext

Lies zuerst `src/hooks/useNotifications.ts` vollständig. Das ist die einzige Datei die Notifications scheduled. Lies außerdem `src/screens/SettingsScreen.tsx` und `src/screens/HomeScreen.tsx`.

---

## Was gebaut werden soll

### 1. Pre-Workout Reminder-System

Der User kann in den Einstellungen ein Toggle aktivieren: **"Vorbereitung vor Training"**. Wenn aktiv, bekommt er vor jeder Training-Session aus dem Stundenplan eine Kette von Notifications zur Vorbereitung.

**AsyncStorage-Key:** `preworkout_enabled` (`'true'` / `'false'`)

**Personalisierte Zahlen aus dem User-Profil**

Vor dem Schedulen der Notifications das User-Profil laden (`supabase.from('profiles').select('weight_kg').single()`).
Mit dem Gewicht eine interne Hilfsfunktion aufrufen:

```ts
function calcPreWorkoutValues(weightKg: number): {
  carbsGrams: number;       // T-2h Mahlzeit Kohlenhydrate
  proteinGrams: number;     // T-2h Mahlzeit Protein
  quickCarbsGrams: number;  // T-1h schnelle Carbs
  waterMl: number;          // T-1h Wassermenge
} {
  return {
    carbsGrams: Math.round(weightKg * 1.2),
    proteinGrams: Math.round(weightKg * 0.35),
    quickCarbsGrams: Math.round(weightKg * 0.5),
    waterMl: Math.round((weightKg * 6) / 50) * 50,
  };
}
```

Wenn `weight_kg` null ist (Profil unvollständig): Fallback auf 75 kg.

**Notification-Zeitkette pro Session** (basierend auf `session.start_time`):

| Offset | Identifier-Prefix | Titel | Body |
|--------|-------------------|-------|------|
| T-4h | `preworkout-4h-` | `"Heute Training: Ernährung"` | `"Letzte schwere Mahlzeit jetzt — ab jetzt keine Fette oder Ballaststoffe mehr."` |
| T-2h | `preworkout-2h-` | `"Trainingszeit nähert sich"` | `"Letzte Mahlzeit: ~${carbsGrams} g Kohlenhydrate + ~${proteinGrams} g Protein. Z.B. Reis + Hühnchen."` |
| T-1h | `preworkout-1h-` | `"1 Stunde bis Training"` | `"~${quickCarbsGrams} g schnelle Carbs jetzt (Banane, Reiswaffel). ${waterMl} ml Wasser mit Prise Salz."` |
| T-30min | `preworkout-30min-` | `"30 Minuten"` | `"Kein Essen mehr. Equipment packen, kurz dehnen, mental einstimmen."` |

**Wichtig:** Wenn `preworkout_enabled === 'true'`, ersetzt die T-1h Pre-Workout-Notification die bestehende `training-{id}` Notification (die 1h-Punkte-Erinnerung). D.h. bei aktivem Pre-Workout wird `training-{id}` für diese Session NICHT mehr geplant — stattdessen übernimmt `preworkout-1h-{id}` diesen Slot.

Notifications die in der Vergangenheit liegen (Trigger-Zeit <= now) werden übersprungen.

Beim erneuten Schedulen (Sessions ändern sich): alle `preworkout-*` Notifications zuerst canceln, dann neu planen.

---

### 2. Notification-Texte variieren (Wasser + Gewicht)

Die bestehenden statischen Nachrichten durch Zufalls-Pools ersetzen. Das Muster existiert schon bei den Training-Reminders (`pointsReminders`-Array + `Math.random()`).

**Wasser-Pool** (für alle drei Tageszeiten, wird random gepickt):
```
"Wasser trinken — dein Körper dankt es dir."
"Hydration-Check: Wann hast du zuletzt getrunken?"
"Kurze Pause. Glas Wasser. Weiter."
"Genug getrunken heute? Jetzt wäre ein guter Moment."
"Wasser ist kein Lifestyle, es ist Leistung."
"Trink jetzt — warte nicht bis du Durst hast."
"Ein Glas Wasser, direkt jetzt."
"Dein Fokus hängt auch davon ab, wie gut du hydriert bist."
```

Titel bleibt `"Wasser trinken"` für alle drei.

**Gewicht-Pool** (Montag-Reminder):
```
"Wöchentliches Wiegen — nur eine Zahl, aber sie zeigt den Trend."
"Montag, neues Gewicht. Kurz auf die Waage und eintragen."
"Check-in Zeit: Wie hat sich die Woche auf der Waage bemerkbar gemacht?"
"Gewicht eintragen — damit der Coach-Algorithmus für dich arbeiten kann."
"Eine Messung pro Woche reicht. Jetzt wäre der Moment."
```

Titel bleibt `"Wöchentliches Gewichts-Check-in"`.

---

### 3. SettingsScreen — Toggle

Füge in `SettingsScreen.tsx` einen neuen Abschnitt **"Training"** (oder in den bestehenden Notifications-Bereich) ein:

- Label: `"Vorbereitung vor Training"`
- Subtitle: `"Erinnerungen 4h, 2h, 1h und 30 Min vor jeder Session"`
- Komponente: `Switch` (React Native)
- State: aus AsyncStorage lesen beim Mount, beim Toggle schreiben + `scheduleTrainingReminders` neu aufrufen

Für den erneuten Aufruf von `scheduleTrainingReminders` nach dem Toggle brauchst du die aktuellen Sessions. Schau wie `HomeScreen.tsx` das macht und nutze denselben Ansatz oder übergib einen Callback.

---

### 4. Änderungen in `useNotifications.ts`

- `calcPreWorkoutValues(weightKg: number)` — interne Hilfsfunktion für die personalisierten Zahlen (siehe oben)
- `schedulePreWorkoutNotifications(sessions, weightKg)` — interne Hilfsfunktion, kein Export
- `scheduleTrainingReminders` bekommt einen zweiten Parameter: `preWorkoutEnabled: boolean`
- Beim Aufruf: wenn `preWorkoutEnabled === true`, Profil laden (weight_kg), dann `calcPreWorkoutValues` aufrufen, Notifications mit den echten Zahlen im Text schedulen
- T-1h `training-{id}` wird bei aktivem Pre-Workout NICHT geplant — `preworkout-1h-{id}` übernimmt diesen Slot
- Wenn `preWorkoutEnabled === false`: alles wie bisher + alle `preworkout-*` Notifications canceln

---

## Constraints

- Kein `any`, TypeScript strict
- Kein Inline-Styling, `StyleSheet.create` verwenden
- Farben aus `src/theme/colors.ts`
- UI-Texte Deutsch, Code-Kommentare Englisch
- Nur `@expo/vector-icons` für Icons, keine Emojis
- Nach den Änderungen: `npx tsc --noEmit` ausführen und Fehler beheben bevor fertig

## Dateien die geändert werden

1. `src/hooks/useNotifications.ts`
2. `src/screens/SettingsScreen.tsx`
3. `src/screens/HomeScreen.tsx` (Parameter-Übergabe anpassen)
