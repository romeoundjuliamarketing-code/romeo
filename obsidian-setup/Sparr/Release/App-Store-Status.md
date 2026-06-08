# App Store Status

> Zuletzt aktualisiert: 2026-05-04

---

## Gesamtstatus: LIVE im App Store seit 2026-05-04 ✅

---

## Phase 1 – Zahlungen

| Aufgabe | Status |
|---|---|
| RevenueCat eingerichtet | Erledigt |
| 4 Produkte in App Store Connect | Erledigt |
| RevenueCat Offerings konfiguriert | Erledigt |
| Paywall auf RevenueCat umgebaut | Erledigt |
| Sandbox-Kauf testen | Erledigt ✅ (2026-04-27) |

## Phase 2 – Security

| Aufgabe | Status |
|---|---|
| RLS auf allen Tabellen | Erledigt |
| Kein service_role Key im Client | Erledigt |
| Error Handling auf Supabase Calls | Erledigt |
| Rate Limiting auf kritischen RPCs | Erledigt ✅ (max. 25/Tag via Migration) |

## Phase 3 – Apple Pflicht-Features

| Aufgabe | Status |
|---|---|
| Account löschen | Erledigt |
| Subscription-Bedingungen in Paywall | Erledigt |
| Offline-Fehlermeldung | Verschoben → v1.1 (native Module erfordert neuen Build) |
| PlanScreen bereinigen | Erledigt ✅ (aus Navigation entfernt) |

## Phase 4 – App-Konfiguration

| Aufgabe | Status |
|---|---|
| app.json vollständig | Erledigt |
| EAS Build konfiguriert | Erledigt |
| EAS Secrets hinterlegt | Erledigt |
| Bundle ID korrigiert (com.kombat.app) | Erledigt ✅ (2026-04-22) |

## Phase 5 – Store-Seite

| Aufgabe | Status |
|---|---|
| App-Icon 1024×1024px | Erledigt ✅ |
| Screenshots (5 Screens mit Pinguin-Maskottchen) | Erledigt ✅ |
| App-Beschreibung Deutsch | Erledigt ✅ |
| App-Beschreibung Englisch | Erledigt ✅ |
| Keywords (100 Zeichen Deutsch) | Erledigt ✅ |
| Kategorie: Health & Fitness | Erledigt ✅ |
| Altersfreigabe | Erledigt ✅ |

## Phase 6 – Legal

| Aufgabe | Status |
|---|---|
| Datenschutzerklärung (öffentliche URL) | Erledigt ✅ |
| Privacy Nutrition Label | Erledigt ✅ |

## Phase 7 – Testing

| Aufgabe | Status |
|---|---|
| Onboarding überarbeiten | Erledigt ✅ |
| Abo-Flow testen (Paywall → Kauf → Entitlement) | Erledigt ✅ (Sandbox erfolgreich) |
| Testaccount für Apple Review anlegen | Erledigt ✅ |
| iPad-Kompatibilität (supportsTablet: true + responsive Layouts) | Erledigt ✅ (2026-05-02, nach erstem Rejection) |

## Phase 8 – Code-Qualität (vor Release)

> Befunde aus Code-Review 2026-04-22. Kein Blocker einzeln — zusammen erhöhen sie das Risiko für stille Bugs in Produktion.

| Aufgabe | Priorität | Status |
|---|---|---|
| Security-Audit Supabase: RLS + alle RPCs manuell prüfen | Hoch | Ausstehend |
| Error-Logging einbauen (z.B. Sentry) — stille Supabase-Fehler werden aktuell verschluckt | Hoch | Ausstehend |
| `todayIso()` in 10+ Dateien dupliziert → `src/utils/date.ts` Shared Utility | Mittel | Ausstehend |
| `FitnessGroup` / `GROUP_LABELS` / `TRAINING_TYPE_TO_GROUP` doppelt in `useRecommendedWorkout` + `useFitnessRatings` | Mittel | Ausstehend |
| `ProfilScreen.tsx` ist >1000 Zeilen — aufteilen in Teilkomponenten (Pflicht wenn neue Features dazukommen) | Mittel | Ausstehend |
| `calculatePoints()` Formel divergiert zwischen `src/utils/points.ts` und Inline-Stellen (6 Stellen) | Niedrig | Ausstehend |

---

## Phase 9 – Submission

| Aufgabe | Status |
|---|---|
| Production Build (Build 2) | Erledigt ✅ (2026-04-27) |
| Erster Submit | Erledigt ✅ (2026-04-27) |
| Erster Rejection (iPad-Layout) | 2026-04-28 |
| iPad-Fix + neuer Build (Build 3) | Erledigt ✅ (2026-05-02) |
| Zweiter Submit | Erledigt ✅ (2026-05-02) |
| **Status: Warten auf Apple Review** | 🟡 In Prüfung |
| Apple Approval | Erledigt ✅ (2026-05-04) |
| **App Store LIVE** | ✅ 2026-05-04 |

---

## Nächste Schritte

App ist live. Fokus auf v1.1 und Marketing.

---

## v1.1 Geplant (nach Release)

| Feature | Aufwand | Notiz |
|---|---|---|
| Offline-Banner | Klein | netinfo native Module — braucht Dev Build |
| Sparringsessions-Map | Gross | react-native-maps, Geo-Tabellen in Supabase, Location Permissions |
| iPad Screenshots sauber ausarbeiten | Mittel | Aktuell flüchtig erstellt für Submit — müssen mit Maskottchen, korrektem Layout und Canva-Design nachgearbeitet werden (2048×2732px) |
