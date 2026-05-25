# 2026-04-17 – RevenueCat statt Stripe

## Problem

Apple verlangt für digitale Abonnements im App Store zwingend In-App Purchase (StoreKit). Stripe funktioniert nicht für digitale Inhalte im App Store — Apple würde die App ablehnen.

## Optionen

| Option | Pro | Contra |
|---|---|---|
| Stripe behalten | Bereits implementiert | Apple-Richtlinien verletzt → Ablehnung |
| Natives StoreKit | Keine Abhängigkeit | Sehr komplex zu implementieren |
| RevenueCat | Einfache API, kostenlos bis 2.500$/Monat | Zusätzliche Abhängigkeit |

## Entscheidung

**RevenueCat** als Schicht über StoreKit.

## Umsetzung

- `react-native-purchases` installiert
- `PaywallScreen.tsx` komplett auf RevenueCat umgebaut
- `useEntitlement.ts` prüft RevenueCat + Supabase parallel
- Stripe-Code deaktiviert (Edge Functions + Webhooks)
- 4 Produkte in App Store Connect angelegt und in RevenueCat importiert
