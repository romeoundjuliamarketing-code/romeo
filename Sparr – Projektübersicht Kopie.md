# Sparr – Projektübersicht

> Kampfsport-Tracking App für iOS · Stand: April 2026

---

## Was ist Sparr?

Sparr ist eine React Native App für Kampfsportler und Studios. Der Kerngedanke: **Fortschritt messbar machen** – kein Coach-Ersatz, sondern eine Hilfestellung. Nutzer sammeln Punkte für Trainingseinheiten, verfolgen Ernährung und Gewicht, und Studios können Teams verwalten.

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Framework | React Native + Expo SDK 55 |
| Navigation | React Navigation (kein Expo Router) |
| Backend | Supabase (Auth, Postgres, Storage, RPCs) |
| Sprache | TypeScript strict |
| Payments | RevenueCat + StoreKit (iOS IAP) |
| Build | EAS (Expo Application Services) |

---

## Features

### Kern-Features
- **Punkte-System** – Punkte für Workouts und Anwesenheit (`profiles.total_points`)
- **Trainingsbereich** – Workout-Logs, Timer, Kampfsport-Kategorien mit Intensitätsstufen
- **Ernährung** – BMR/TDEE-Berechnung (Mifflin-St Jeor), 3 Plan-Modi, Gewichtstracking, Wassertracking
- **Team/Studio** – Coach-System mit Peer-Vouching, Einladungscodes, Seat-Verwaltung

### Subscription-Modell
| Plan | Preis | Inhalt |
|---|---|---|
| Einzel monatlich | 11,99 €/Monat | Vollzugriff für 1 Person |
| Einzel jährlich | 99,00 €/Jahr | Vollzugriff für 1 Person |
| Studio monatlich | 79,00 €/Monat | 1 Betreiber + 8 Schüler |
| Studio jährlich | 790,00 €/Jahr | 1 Betreiber + 8 Schüler |

Apple nimmt 15% im ersten Jahr (unter 1M$ Umsatz), danach 30%.

---

## Architektur

### Datenfluss
- Kein globaler State-Manager
- Jeder Screen nutzt dedizierte Hooks in `src/hooks/`
- Business-Logik läuft in `SECURITY DEFINER` RPCs auf Postgres
- Keine sensiblen Operationen im Client

### Wichtige Dateien
```
src/
  screens/          # Alle Screens (PaywallScreen, HomeScreen, etc.)
  components/       # Wiederverwendbare Komponenten
  hooks/            # Datenzugriff (useEntitlement, useNutritionTargets, etc.)
  lib/              # supabase.ts, revenuecat.ts
  navigation/       # RootNavigator, TabNavigator
  theme/            # colors.ts, Designsystem
  utils/            # nutritionEngine.ts (62 Unit-Tests)
  types/            # database.types.ts (manuell gepflegt)
```

### Designsystem
| Token | Wert |
|---|---|
| Hintergrund | `#F7F5F0` |
| Text | `#141414` |
| Akzentblau | `#4A90D9` |
| Dark/Hero | `#0A0A0A` |
| Font | Inter |

---

## App Store Release – Status

### Erledigt ✅
- RevenueCat komplett eingerichtet (Offerings, Packages, Entitlement "Sparr Pro")
- Stripe entfernt, PaywallScreen auf RevenueCat umgebaut
- Bundle ID: `com.kombat.app`
- Account-löschen Flow (Apple Pflicht)
- Subscription-Bedingungen in Paywall
- Supabase RLS auf allen Tabellen
- W-8BEN Steuerformular eingereicht (Aktiv)
- Bankkonto in App Store Connect hinterlegt
- DSA Compliance eingereicht

### Ausstehend 🔴 Blocker
- [ ] Sandbox-Kauf testen (nach Aktivierung Paid Apps Agreement)
- [ ] App-Icon 1024×1024px
- [ ] Screenshots (min. 3, empfohlen 5–6)
- [ ] App-Beschreibung Deutsch
- [ ] Datenschutzerklärung als öffentliche URL
- [ ] App Store Privacy Nutrition Label
- [ ] Onboarding überarbeiten
- [ ] Produktions-Build + Einreichung

### Ausstehend 🟡 Wichtig
- [ ] AGB als öffentliche URL (Notion)
- [ ] Rate Limiting auf Supabase RPCs
- [ ] Offline-Fehlermeldung
- [ ] PlanScreen befüllen oder entfernen
- [ ] App-Beschreibung Englisch

---

## Wichtige Konfiguration

```
Bundle ID:        com.kombat.app
EAS Project ID:   9811826e-5835-47ff-9c96-8fb7a14cdab3
RevenueCat Key:   EXPO_PUBLIC_REVENUECAT_API_KEY (in .env)
Supabase:         EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
```

---

## Migrations-Übersicht (Supabase)

| Datei | Inhalt |
|---|---|
| `20260408152000_add_subscription_and_entitlements.sql` | Subscriptions, Studio-Memberships |
| `20260410200000_add_studio_invite_rpcs.sql` | Einladungscode-RPCs |
| `20260410120000_add_training_frequency_to_profiles.sql` | Trainingspensum |
| `20260417100000_add_delete_my_account_rpc.sql` | Account-löschen RPC |

---

## Offene Fragen / Entscheidungen

- AGB und Datenschutzerklärung → Notion.site oder eigene Website?
- Onboarding-Redesign → Scope noch offen
- PlanScreen → entfernen oder befüllen?
