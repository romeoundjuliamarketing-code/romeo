# RevenueCat Subscriptions Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subscriptions im App Store funktionsfähig machen — Preise sichtbar, Kauf möglich.

**Architecture:** Drei unabhängige Schichten müssen alle korrekt sein: (1) nativer Build mit RevenueCat-Plugin, (2) SDK-Initialisierung mit gültigem API-Key, (3) korrekte Konfiguration in RevenueCat-Dashboard und App Store Connect.

**Tech Stack:** React Native / Expo SDK 55, react-native-purchases ^10, EAS Build, RevenueCat, App Store Connect

---

## Root Cause (dokumentiert)

```
EXPO_PUBLIC_REVENUECAT_API_KEY leer im EAS-Build
→ configureRevenueCat() gibt sofort zurück (revenuecat.ts:6)
→ Purchases.getOfferings() schlägt still fehl (catch ohne Log)
→ packages bleibt {}
→ Nutzer tippt "Abo auswählen" → Alert: "Dieses Abo-Paket ist derzeit nicht verfügbar."
```

Zweites Problem: `react-native-purchases` fehlt in `app.json` plugins → nativer Framework-Link fehlt im EAS-Build.

---

## Task 1: app.json — RevenueCat Plugin hinzufügen

**Files:**
- Modify: `app.json`

- [ ] **Schritt 1: Plugin hinzufügen**

In `app.json`, `plugins`-Array erweitern:

```json
"plugins": [
  "expo-secure-store",
  "@react-native-community/datetimepicker",
  "react-native-purchases"
]
```

- [ ] **Schritt 2: Commit**

```bash
git add app.json
git commit -m "fix(iap): add react-native-purchases expo plugin"
```

---

## Task 2: EAS Secret — EXPO_PUBLIC_REVENUECAT_API_KEY

**Wo findest du den Key:**
RevenueCat Dashboard → linkes Menü → **Project Settings** → **API Keys** → Sektion **Public app-specific keys** → iOS-Key kopieren (beginnt mit `appl_`)

- [ ] **Schritt 1: EAS Secret setzen**

```bash
eas secret:create \
  --scope project \
  --name EXPO_PUBLIC_REVENUECAT_API_KEY \
  --value appl_DEIN_KEY_HIER
```

Erwartete Ausgabe: `✅ Created a new secret "EXPO_PUBLIC_REVENUECAT_API_KEY" on the current project.`

- [ ] **Schritt 2: Prüfen ob Secret gesetzt ist**

```bash
eas secret:list
```

Erwartete Ausgabe: Liste mit `EXPO_PUBLIC_REVENUECAT_API_KEY` und `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

> **Hinweis:** Wenn Supabase-Keys noch nicht als EAS Secrets gesetzt sind, jetzt ebenfalls setzen:
> ```bash
> eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://XXXX.supabase.co
> eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJXXXX
> ```

---

## Task 3: RevenueCat Dashboard — Offerings & Packages prüfen

**URL:** https://app.revenuecat.com → dein Projekt → **Monetization** → **Offerings**

- [ ] **Schritt 1: Produkte anlegen (falls nicht vorhanden)**

Unter **Monetization → Products**:  
Alle 4 Produkte müssen eingetragen sein, mit exakt diesen IDs (wie in App Store Connect):

| Identifier | Typ |
|---|---|
| `sparr_individual_monthly` | Auto-Renewable Subscription |
| `sparr_individual_yearly` | Auto-Renewable Subscription |
| `sparr_studio_monthly` | Auto-Renewable Subscription |
| `sparr_studio_yearly` | Auto-Renewable Subscription |

- [ ] **Schritt 2: Offering anlegen (falls kein "Current" vorhanden)**

Unter **Monetization → Offerings**:
- "Add Offering" → Name: `default`
- Als **"Current Offering"** markieren (Stern-Button)

- [ ] **Schritt 3: Packages dem Offering zuweisen**

Im "default" Offering → **Add Package** → je ein Package für jeden der 4 Identifier:

| Package Identifier | Produkt |
|---|---|
| `sparr_individual_monthly` | → `sparr_individual_monthly` |
| `sparr_individual_yearly` | → `sparr_individual_yearly` |
| `sparr_studio_monthly` | → `sparr_studio_monthly` |
| `sparr_studio_yearly` | → `sparr_studio_yearly` |

- [ ] **Schritt 4: App Store Connect App verknüpfen**

Unter **Project Settings → Apps**: sicherstellen dass die iOS-App mit Bundle ID `com.kombat.app` verknüpft ist.

---

## Task 4: App Store Connect — Produkte & Agreements prüfen

**URL:** https://appstoreconnect.apple.com

- [ ] **Schritt 1: Paid Applications Agreement prüfen**

→ **Agreements, Tax, and Banking** → Prüfen ob unter "Paid Applications" der Status **"Active"** ist.  
Falls nicht aktiv: alle fehlenden Felder ausfüllen (Bankverbindung, Steuerinfo, Adresse).  
Ohne aktiven Agreement können IAPs nicht verarbeitet werden.

- [ ] **Schritt 2: In-App-Käufe prüfen**

→ Deine App → **Monetization** → **Subscriptions**

Alle 4 Produkte müssen im Status **"Ready for Sale"** sein:

| Produkt-ID | Erwarteter Status |
|---|---|
| `sparr_individual_monthly` | Ready for Sale |
| `sparr_individual_yearly` | Ready for Sale |
| `sparr_studio_monthly` | Ready for Sale |
| `sparr_studio_yearly` | Ready for Sale |

Falls Status "Missing Metadata": Preis, Lokalisierung (Name + Beschreibung auf Deutsch) und Review-Screenshot fehlen.

- [ ] **Schritt 3: Subscription Group prüfen**

Alle 4 Abos müssen in einer gemeinsamen **Subscription Group** sein (z.B. "Sparr Premium").  
Ein Nutzer kann immer nur 1 Abo aus einer Gruppe aktiv haben.

---

## Task 5: EAS Production Build + Submit

Erst starten wenn Task 1–4 abgeschlossen sind.

- [ ] **Schritt 1: Sicherstellen dass EAS CLI aktuell ist**

```bash
npm install -g eas-cli
eas --version
```

Erwartete Ausgabe: Version >= 18.7.0

- [ ] **Schritt 2: Production Build starten**

```bash
eas build --platform ios --profile production
```

Der Build läuft in der Cloud (~15–20 Min). EAS öffnet automatisch eine URL zum Verfolgen.

- [ ] **Schritt 3: Build-Log auf Fehler prüfen**

Im Build-Log nach diesen Zeilen Ausschau halten — sie bestätigen dass RevenueCat korrekt eingebunden ist:
```
Installing pods...
RevenueCat (X.X.X)
```

- [ ] **Schritt 4: App einreichen**

```bash
eas submit --platform ios --latest
```

Oder im EAS-Dashboard: Build → "Submit to App Store".

- [ ] **Schritt 5: In App Store Connect freigeben**

→ App Store Connect → deine App → **TestFlight** oder **App Store** → neue Version mit dem eingereichten Build verknüpfen → Review einreichen.
