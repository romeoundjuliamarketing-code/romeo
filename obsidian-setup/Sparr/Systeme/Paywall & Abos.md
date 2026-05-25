# Paywall & Abos

## Wie es funktioniert

Nutzer sehen die Paywall (`PaywallScreen.tsx`) wenn sie auf gesperrte Features zugreifen. Der Kauf läuft über Apple StoreKit via RevenueCat. Nach dem Kauf wird das Entitlement in RevenueCat gesetzt und die App entsperrt alle Features.

## Produkte (App Store Connect)

| Produkt-ID | Typ | Preis |
|---|---|---|
| `sparr_individual_monthly` | Einzel monatlich | 11,99 €/Monat |
| `sparr_individual_yearly` | Einzel jährlich | 99,00 €/Jahr |
| `sparr_studio_monthly` | Studio monatlich | 79,00 €/Monat |
| `sparr_studio_yearly` | Studio jährlich | 790,00 €/Jahr |

## RevenueCat

- Entitlement: **Sparr Pro**
- Offering: **Default** (enthält alle 4 Packages)
- Package-IDs entsprechen exakt den Produkt-IDs oben

## Entitlement-Prüfung im Code

`src/hooks/useEntitlement.ts` prüft zwei Quellen parallel:
1. RevenueCat (`Purchases.getCustomerInfo()`) — für direkte Käufe
2. Supabase RPC `get_my_entitlement()` — für Studio-Mitglieder (die selbst kein Abo haben, aber über ein Studio-Abo Zugang bekommen)

`hasAccess = rcHasAccess || dbHasAccess`

## Subscription-Typen

- **individual** — 1 Person, Vollzugriff
- **studio** — 1 Betreiber + 8 Schüler, inkl. Team-Verwaltung

## Wichtige Dateien

- `src/screens/PaywallScreen.tsx` — UI
- `src/hooks/useEntitlement.ts` — Zugriffsprüfung
- `src/lib/revenuecat.ts` — Konfiguration
- `supabase/migrations/20260408152000_add_subscription_and_entitlements.sql`

---

## Status: Vollständig funktionsfähig (2026-05-23)

Alle vier Produkte getestet und bestätigt. RevenueCat + StoreKit (iOS) funktioniert end-to-end:
- Kauf → RevenueCat-Entitlement → `useEntitlement` entsperrt Features
- Studio-Invite-Flow (Code generieren + einlösen) läuft durch
- `get_my_entitlement()` RPC gibt korrektes Tier zurück
