# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Befehle

```bash
# App starten (Expo Go / Simulator)
npx expo start
npx expo start --ios
npx expo start --android

# TypeScript-Fehler prüfen (nach jeder Codeänderung pflicht)
npx tsc --noEmit

# Tests ausführen
npx jest
npx jest src/utils/nutritionEngine.test.ts   # einzelner Test
npx jest src/utils/points.test.ts
```

Kein separater Build-Schritt. Kein Linter konfiguriert.

Test-Setup: `babel.config.js` + `jest.config.js` vorhanden. Die Config ist
environment-aware: im `test`-Env läuft `@babel/preset-typescript` +
`@babel/plugin-transform-modules-commonjs`; im App/Metro-Kontext läuft
`babel-preset-expo`. In Test-Dateien kein `import type` verwenden — Babel kann
das nicht parsen. Stattdessen `as const` auf String-Literale nutzen, damit
TypeScript die Typen narrowt.

---

## Architektur

### Stack
- **React Native + Expo SDK 55** (kein Expo Router — React Navigation)
- **Supabase** als Backend: Auth, Postgres, Storage, RPCs
- **TypeScript strict**

### Navigation
Zwei getrennte Stacks in `src/navigation/RootNavigator.tsx`:
- `AuthStack` (Login / Register) — wenn keine Session
- `AppStack` → `TabNavigator` (Home, Training, Ernährung, Profil) + modale Stacks (Team, Workout, Timer)

Tab-Screens sind persistent; alle anderen Screens sind NativeStack-Modals.

### Datenzugriff
Kein globaler State-Manager. Jeder Screen/Komponente nutzt dedizierte Hooks in `src/hooks/`. Hooks folgen dem Muster:
```ts
export function useXxx(refetchTrigger = 0) {
  // refetchTrigger: Zahl aus useFocusEffect → löst useEffect neu aus
}
```
`refetch`-Callbacks werden von Hooks zurückgegeben und nach Mutationen explizit aufgerufen.

### Supabase-Besonderheiten
- Typen leben in `src/types/database.types.ts` — manuell gepflegt (kein codegen).
- Auth-Session wird über `SecureStore` (< 1800 Bytes) oder `AsyncStorage` (größere JWTs) persistiert — Logik in `src/lib/supabase.ts`.
- Business-Logik (Punkte, Coach-Beförderung, Anwesenheit) läuft in `SECURITY DEFINER` RPCs auf Postgres, nicht im Client.
- Rekursive RLS-Policies vermeiden: Subqueries auf dieselbe Tabelle als `SECURITY DEFINER`-Funktion auslagern (Beispiel: `get_my_studio_id()`).

### Punkte-System
Punkte werden in `profiles.total_points` akkumuliert. Zwei Quellen:
1. Workout-Logs (`workout_logs`): via `add_workout_points` / `deduct_workout_points` RPCs
2. Anwesenheits-Bestätigung (`attendance_logs`): via `mark_attendance` / `unmark_attendance` RPCs
Berechnung: `Math.max(1, Math.floor(durationMin / 30)) * pointsPer30Min`

### Coach-System
Peer-Vouching über `coach_nominations` + `coach_votes`:
- Nominierung → mindestens 1 Bestätigung nötig
- Wenn noch kein Coach im Team: jedes Mitglied darf bestätigen
- Wenn Coach(es) vorhanden: nur Coaches dürfen bestätigen
- Selbst-Demotion: sofort via `self_demote_coach` RPC (kein Vote nötig)
- Selbst-Nominierung ist clientseitig blockiert

### Subscription / Paywall
- Entitlement-Quelle: `get_my_entitlement()` RPC (Supabase, `SECURITY DEFINER`)
- Pläne: `individual` und `studio` (funktional identisch; Studio zusätzlich mit Seats/Team-Owner-Rechten)
- Tabellen:
  - `subscriptions` (Plan, Status, Laufzeit, inklusive/zusätzliche Seats)
  - `studio_memberships` (aktive Seat-Zuweisungen; UNIQUE auf `(subscription_id, user_id)`)
  - `studio_invites` (email-basierte Einladungen — Legacy-Schema, derzeit nicht aktiv genutzt)
  - `studio_invite_codes` (ein aktiver 6-stelliger Code pro Studio, 7 Tage Laufzeit)
- Team-Erstellung ist serverseitig geschützt über `create_studio_with_owner(p_name, p_city)` RPC:
  - nur mit aktivem `studio`-Plan
  - setzt `studios.owner_user_id`
- App-Gates:
  - Punkte/Stats nur bei aktivem Entitlement (`entitlement.hasAccess`)
  - Studio erstellen nur bei `entitlement.canCreateStudio`
- Paywall-UI:
  - Fullscreen-Screen `src/screens/PaywallScreen.tsx` (Einzel/Studio, monatlich/jährlich)
  - Inline-Teaser `src/components/common/PaywallCard.tsx` mit CTA auf `Paywall`
- IAP: RevenueCat + StoreKit (iOS), Stripe entfernt
- Migrationen:
  - `20260408152000_add_subscription_and_entitlements.sql`
  - `20260410200000_add_studio_invite_rpcs.sql`

### Studio-Einladungscode
Studio-Owner kann einen 6-stelligen Code generieren, den Mitglieder einlösen können.
Einlösen → `studio_memberships`-Eintrag (Premium-Zugang) + `profiles.studio_id` wird gesetzt.
- RPCs: `create_studio_invite(p_studio_id)` → `text` (Code), `accept_studio_invite(p_code)` → `uuid` (studio_id)
- Hook: `src/hooks/useStudioInvite.ts` — `createInvite(studioId)` + `acceptInvite(code)`
- UI Coach-Seite: `TeamScreen` — Karte "Einladungscode" nur wenn `isCoach && entitlement.tier === 'studio'`; zeigt Code + Teilen + Neu-erstellen
- UI Mitglied: `TeamPickerCard` — `onRedeemCode?`-Prop; Eingabefeld im Such-Modal unterhalb der Ergebnisliste
- `ProfilScreen` verbindet `acceptInvite` + `joinStudio` in `handleRedeemCode` → lokale Studiostate wird sofort aktualisiert

### Avatar-Upload
`expo-file-system` + `base64-arraybuffer` → direkter Upload in Supabase Storage (`avatars`-Bucket). **Nicht** `fetch().blob()` verwenden — funktioniert nicht im Expo-Kontext.

### Ernährung / Nutrition Engine
Gesamte Berechnungslogik liegt in `src/utils/nutritionEngine.ts` (pure TypeScript, kein React).
- BMR: Mifflin-St Jeor, TDEE via Aktivitätslevel + Trainingstyp-Bonus
- 3 Plan-Modi: `recommended` / `faster` / `aggressive`
- Wochenraten (% Körpergewicht): Verlust rec=[0.50–0.75]%, faster=[0.75–1.00]%, aggressive=[1.00–1.25]%; Aufbau rec=[0.25–0.50]%, faster=[0.50–0.75]%, aggressive=[0.75–1.00]%
- Protein nach Zielrichtung (1.7–2.4 g/kg), Fett-Floor 0.6 g/kg, Carbs als Rest
- Guard rails: Deficit 200–1050 kcal, Surplus 150–900 kcal
- **Zwei Berechnungs-Szenarien:**
  - Szenario A (kein Datum): Bandmitte der gewählten Rate → normale Planberechnung
  - Szenario B (mit Datum): Benötigte Rate aus Gewichtsdifferenz + verbleibenden Wochen berechnet → `findModeForRate()` wählt passenden Modus, tatsächliche Rate überschreibt Bandmitte (`overrideRateKgPerWeek`)
- `findModeForRate(ratePct, direction)` — exported helper, mappt tatsächliche Rate auf Plan-Modus
- `autoSelectMode: PlanMode | null` wird von `calculateNutrition()` zurückgegeben und von `useWeightGoalCoach` verwendet, um beim Speichern eines Ziels mit Deadline automatisch den richtigen Tab zu wählen
- Hooks: `useNutritionTargets(refetchTrigger)` + `useWeightGoalCoach` (Ziel + Engine → Pläne)
- `useNutritionTargets` gibt `profile: Profile | null` zurück — kein separater `useProfile`-Aufruf im Screen nötig
- AsyncStorage-Key für gespeichertes Ziel: `weight_goal_plan_v2`
- 62 Unit-Tests in `src/utils/nutritionEngine.test.ts`

### Trainingspensum (Training Frequency)
Nutzer wählt sein wöchentliches Trainingspensum; beeinflusst TDEE-Berechnung.
- DB-Spalte: `profiles.training_frequency` (`text`, nullable) — Werte: `'low'` / `'medium'` / `'high'`
- Mapping in `useNutritionTargets`:
  - `low`    → `moderately_active`, 3×/Woche
  - `medium` → `very_active`, 5×/Woche
  - `high`   → `extremely_active`, 10×/Woche (2× täglich)
- Fallback: `null` → `'low'`
- Onboarding: letzter Schritt `StepTrainingFrequency` (`src/components/onboarding/StepTrainingFrequency.tsx`)
- ErnährungScreen: `TrainingFrequencySelector` (`src/components/ernaehrung/TrainingFrequencySelector.tsx`) als Radio-Liste mit sofortigem Supabase-Update
- Migration: `20260410120000_add_training_frequency_to_profiles.sql`

### Wassertracking
- Tabelle: `water_logs` (Spalten: `user_id`, `date`, `amount_ml`), UNIQUE auf `(user_id, date)`
- Hook: `useWaterTracking(onGoalReached?: () => void, refetchTrigger = 0)`
- Wasserziel: dynamisch aus Gewicht + Alter + Modus
  - Erwachsene: `30/35/40 ml pro kg` (`Alltag`/`Aktiv`/`Intensiv`)
  - Unter 18: `25/30/35 ml pro kg`
  - Bonus 5 XP bei Erreichen via `add_workout_points` RPC
- `refetchTrigger` (aus `useFocusEffect`) sorgt für Sync zwischen HomeScreen und ErnährungScreen
- Konfetti-Animation (`ConfettiOverlay`) wird in beiden Screens ausgelöst wenn Ziel erreicht wird

### Konfetti-Animation
`src/components/ernaehrung/ConfettiOverlay.tsx` — wiederverwendbar in allen Screens.
- Props: `visible: boolean`, `onComplete: () => void`
- 28 Partikel, `useNativeDriver: true`, `pointerEvents="none"`
- Auslöser: Wasserziel erreicht (Home + Ernährung), Ernährungsplan bestätigt (Ernährung)

### Wöchentliches Gewichts-Check-in
`src/components/home/WeightCheckInModal.tsx` — Waage.png-Maskottchen-Modal.
- Öffnet sich montags beim App-Öffnen, wenn `isNewWeek` true + nicht bereits heute dismissed
- AsyncStorage-Key: `weight_checkin_dismissed` → hält heutiges Datum (Format: ISO-Datum)
- Animationssequenz: Overlay-Fade → Maskottchen springt von rechts rein → Sprechblase poppt auf
- "Eintragen" disabled bis Eingabe 30–300 kg valid; "Später eintragen" schreibt Dismiss-Datum

### Ernährungs-Anpassungsmodal
`src/components/ernaehrung/NutritionAdjustmentModal.tsx` — gleiche Animationsstruktur wie WeightCheckInModal.
- Props: `visible`, `adjustmentKcal: number`, `isGain: boolean`, `onConfirm`, `onDecline`
- Trigger: **nur montags** (`new Date().getDay() === 1`) + nach ≥ 2 wöchentlichen Einträgen + `trendDeltaKcal ≠ 0` + kein bestätigter Adj + nicht diese Woche dismissed
- AsyncStorage-Keys pro User: `nutrition_adj_accepted:<uid>` + `nutrition_adj_dismissed_week:<uid>`
- Bestätigter Wert wird in `displayedPlan` addiert: `kcalPerDay + acceptedAdj`, `carbsGrams + Math.round(acceptedAdj/4)`

### Coach Studio-Plan-Editor
Coaches können den Studio-Stundenplan direkt in der App bearbeiten:
- Hook: `src/hooks/useStudioScheduleEditor.ts` — `addSession(studioId, entry)` + `deleteSession(id)` (setzt `is_active=false`)
- `ScheduleEntrySheet` hat `showCoachFields?: boolean` → zeigt zusätzlich "Trainingsart" (required) + "Coach" (optional)
- `StundenplanSection` bekommt Props `isCoach`, `studioId`, `onStudioRefetch` → zeigt "Studio"-Button (calendar-edit Icon) wenn `isCoach && studioId !== null`
- Im `coachEditMode` zeigt der Plan immer `studioSchedule` (nicht den persönlichen Plan)
- Änderungen triggern `onStudioRefetch()` → `useSchedule.refetch()` in `TrainingScreen`

---

# Projektregeln

## Kosten
- Keine Änderungen, die kostenpflichtige Dienste aktivieren oder Kosten verursachen könnten (z.B. Supabase Pro, Edge Functions mit externen API-Calls, bezahlte Drittanbieter).
- Kostenpflichtige Features müssen explizit vom User angefragt und bestätigt werden, bevor sie implementiert werden.

## Emojis
- Keine Emojis in der App – weder in UI-Komponenten, Screens, Buttons, Labels noch in Kommentaren, die als Text angezeigt werden.

## Icons
- Icons werden ausschliesslich über die Bibliothek `@expo/vector-icons` umgesetzt. Keine Emoji-Icons, keine Unicode-Symbole als Icons.

## Designsystem
Immer einhalten:

| Token           | Wert        | colors.ts-Key     |
|-----------------|-------------|-------------------|
| Hintergrund     | `#F7F5F0`   | `colors.background` |
| Text            | `#141414`   | `colors.text`       |
| Primärer Akzent | `#4A90D9`   | `colors.accentBlue` |
| Dunkel / Hero   | `#0A0A0A`   | `colors.dark`       |
| Font            | Inter       | —                   |

- Keine abweichenden Farben ohne explizite Genehmigung.
- Font `Inter` konsequent verwenden – keine anderen Schriften.
- Farben ausschliesslich aus `src/theme/colors.ts` importieren – keine Hardcoded-Hex-Werte im Code.

## Styling
- Kein Inline-Styling (`style={{ ... }}` direkt im JSX) – immer `StyleSheet.create` verwenden.
- Abstände ausschliesslich in Vielfachen von 8px: `8, 16, 24, 32, 40, 48, ...`

## TypeScript
- Strict-Modus aktiv – `any` ist verboten. Typen immer explizit angeben.

## Sprache
- UI-Texte (Labels, Buttons, Fehlermeldungen, Platzhalter): Deutsch.
- Code-Kommentare: Englisch.
- Umlaute **immer** als Ä, Ö, Ü, ä, ö, ü schreiben — niemals als Ae, Oe, Ue, ae, oe, ue ersetzen.

## Komponentenstruktur
- Wiederverwendbare Komponenten gehoeren in `src/components/`.
- Screens, die laenger als 150 Zeilen sind, in kleinere Teilkomponenten aufteilen.

## Tool-Nutzung
- Update TodoWrite only at major milestones (not after every single tool call).
- ALWAYS use Edit for existing files, never Write/overwrite.
- Read files with offset+limit when only a specific section is needed.
- Do NOT write plan files or summaries to disk unless explicitly asked.
- Do NOT spawn sub-agents for simple file reads — use Read and Grep directly.

## Planungspflicht
- Bei Aufgaben, die mehr als 2 Dateien betreffen oder eine neue Feature-Struktur einführen:
  zuerst einen kurzen Implementierungsplan im Chat skizzieren und auf Genehmigung warten,
  bevor Code geschrieben wird.
- Keine Überraschungsarchitektur – Claude entscheidet keine Struktur-Entscheidungen eigenständig.

## Sub-Agents / Task-Tool
- Sub-Agents nur dann spawnen, wenn die Aufgabe wirklich parallelisierbar ist
  (z.B. unabhängige Recherchen).
- Niemals Sub-Agents für einfache Datei-Reads, Grep-Suchen oder einzelne Codeänderungen.
- Kein Agent darf Dateien schreiben, ohne dass der übergeordnete Plan genehmigt wurde.

## Fehlermanagement
- Nach jeder Codeänderung TypeScript-Fehler prüfen (tsc --noEmit) bevor die Aufgabe
  als erledigt gilt.
- Wenn ein Ansatz nach 2 Versuchen nicht funktioniert: stoppen, Problem erklären,
  Alternativen vorschlagen – nicht blind weiterprobieren.
- Niemals funktionierende Logik refactoren, wenn die Aufgabe das nicht explizit verlangt.

## Funktionalität vor Ästhetik
- Alle Features werden zuerst funktionell gebaut — keine visuellen Extras, keine Animationen,
  kein Styling-Aufwand über das Minimum hinaus, solange nicht explizit anders angefragt.
- Erst wenn die Logik korrekt funktioniert, darf auf Wunsch des Users poliert werden.

## Scope-Disziplin
- Claude aendert ausschliesslich, was explizit angefragt wurde.
- Kein opportunistisches Refactoring, Umbenennen oder "Aufräumen" ohne Auftrag.
- Bestehende Komponenten nicht umstrukturieren, solange die Aufgabe das nicht erfordert.

## Sicherheit
- Keine API-Keys, Tokens oder Secrets im Code – ausschliesslich über .env und
  expo-constants/config.
- .env niemals committen, niemals Inhalte davon in Chat-Antworten ausgeben.

## Tests
- Neue Utility-Funktionen (src/utils/) bekommen einen Unit-Test.
- Test-Dateien liegen neben der Quelldatei: ComponentName.test.tsx.
- Keine Tests für reine UI-Screens – Fokus auf Logik und Hooks.

## Obsidian Vault
Vault-Pfad: /Users/romeogeorgiadis/Documents/Obsidian Vault/
Sparr-Pfad: /Users/romeogeorgiadis/Documents/Obsidian Vault/02 Projekte/Sparr/
System-Datei: /Users/romeogeorgiadis/Documents/Obsidian Vault/02 Projekte/Sparr/_VAULT_SYSTEM.md
Kein MCP — direkt mit Bash (VM-Pfad: /sessions/busy-keen-ride/mnt/obsidian/) auf den Vault zugreifen.

### Pflichtregeln

Vor jedem Vault-Update: _VAULT_SYSTEM.md lesen um zu wissen was wohin gehört.
Prüfe zuerst ob die Ziel-Note existiert (Read via Bash), dann append — sonst neu anlegen.
Lege fehlende Ordner automatisch an (mkdir -p via Bash).
Niemals eine bestehende Note überschreiben — immer append.
Keine täglichen Logs mehr — direkt in thematische Dateien schreiben.

### Thematische Dateien (kein täglicher Log)

- Funktionen.md — neue oder geänderte Features
- Abo-System.md — RevenueCat, Preise, Apple-Status
- App-Store.md — Versionen, Submissions, Review-Status
- Architektur.md — Tech-Stack, DB, Navigation, Designsystem
- Offene-Punkte.md — Bugs, Tech Debt, offene TODOs
- Archiv/ — alte Logs, verworfene Ideen

### Update-Pflicht nach jeder Session

Neues Feature → Funktionen.md | Abo/Preis-Änderung → Abo-System.md | App eingereicht → App-Store.md | Bug entdeckt → Offene-Punkte.md

### Dev-Log
Wann: Nach jeder Session oder nach einer bedeutenden Änderung.
Dateiname: 02 Projekte/Sparr/Dev-Log/YYYY-MM-DD.md (heutiges Datum, ISO-Format)
Exaktes Format:
markdown# Dev-Log – 2026-04-27

## Was wurde gebaut / geändert
- Login-Flow mit Supabase Auth implementiert
- Komponente `UserCard.tsx` erstellt

## Warum
- Supabase gewählt weil bereits im Stack, kein extra Service nötig
- UserCard ausgelagert weil sie in 3 Views gebraucht wird

## Offene Probleme
- Token-Refresh funktioniert noch nicht bei App-Neustart (Tech Debt)

## Nächste Schritte
- Passwort-Reset-Flow bauen
- UserCard responsiv machen
Wenn am selben Tag bereits ein Eintrag existiert: append mit --- als Trennlinie.
### Architekturentscheid
Wann: Bei jeder nicht-trivialen technischen Wahl (DB, Auth, State, API-Struktur, Hosting).
Dateiname: Architektur/ADR-001-supabase-auth.md (Nummer aufsteigend, Titel als Kebab-Case)
Exaktes Format:
markdown# ADR-001: Supabase Auth

## Status
Entschieden

## Kontext
Brauchen Auth-Lösung, die sich schnell integrieren lässt.

## Entscheidung
Supabase Auth — weil Supabase bereits als DB im Stack ist.

## Alternativen verworfen
- Firebase Auth: extra Vendor, mehr Kosten
- Custom JWT: zu viel Eigenaufwand

## Konsequenzen
Supabase bleibt fester Bestandteil des Stacks. Kein einfacher Wechsel mehr.
### API-Endpunkt
Wann: Bei jedem neuen oder geänderten Endpunkt.
Dateiname: API/Endpunkte.md (immer dieselbe Datei, append)
Exaktes Format:
markdown## POST /api/login – 2026-04-27

**Was:** User einloggen, JWT zurückgeben
**Auth erforderlich:** Nein
**Request:** { "email": "string", "password": "string" }
**Response:** { "token": "string", "user": { "id": "string" } }
**Besonderheiten:** Token läuft nach 1h ab
### Bug / Tech Debt
Wann: Sobald ein Bug entdeckt wird, der nicht sofort gefixt wird.
Dateiname: Bugs-und-TechDebt.md (immer dieselbe Datei, append)
Exaktes Format:
markdown## [OFFEN] Token-Refresh schlägt fehl bei App-Neustart – 2026-04-27

**Beschreibung:** Nach App-Neustart wird der gespeicherte Token nicht automatisch erneuert.
**Reproduzierbar:** Ja – App schließen, neu öffnen, API-Call schlägt fehl.
**Priorität:** Hoch
**Notiz:** Vermutlich fehlt `onAuthStateChange` Listener im Root-Component.
### Nicht dokumentieren

Typo-Fixes, Formatierung, Umbenennung von Variablen
Code der direkt verworfen wird
Wenn ich explizit schreibe: „kein Obsidian"