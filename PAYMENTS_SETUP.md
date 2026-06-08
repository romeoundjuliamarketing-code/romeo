# Payments Setup (Stripe + Supabase)

Stand: 08.04.2026

## Ziel

Dieses Runbook beschreibt den sicheren Weg:

1. alles kostenlos im Stripe Test Mode testen  
2. danach optional Live schalten

## iOS In-App Purchase (StoreKit)

Für iOS wird die Paywall über Apple In-App Purchases abgewickelt (kein Stripe-Checkout in der iOS-App).

### 1. App Store Connect vorbereiten

- Paid Apps Agreement unterschreiben
- Steuer/Bankdaten in App Store Connect hinterlegen
- Subscription Group anlegen
- 4 Auto-Renewable Produkte anlegen:
  - `individual_monthly`
  - `individual_yearly`
  - `studio_monthly`
  - `studio_yearly`

### 2. App-Konfiguration (Client)

In `.env` (nur lokal, nicht committen):

- `EXPO_PUBLIC_IAP_PRODUCT_INDIVIDUAL_MONTHLY`
- `EXPO_PUBLIC_IAP_PRODUCT_INDIVIDUAL_YEARLY`
- `EXPO_PUBLIC_IAP_PRODUCT_STUDIO_MONTHLY`
- `EXPO_PUBLIC_IAP_PRODUCT_STUDIO_YEARLY`
- `EXPO_PUBLIC_PRIVACY_URL`
- `EXPO_PUBLIC_TERMS_URL`

Hinweis: Für native IAP ist ein Development Build erforderlich (kein Expo Go).

### 3. Supabase Function für Receipt-Validierung deployen

Neue Function:

- `verify-ios-receipt`

Benötigte Secrets:

- `APPLE_IAP_SHARED_SECRET`
- `APPLE_IAP_PRODUCT_INDIVIDUAL_MONTHLY`
- `APPLE_IAP_PRODUCT_INDIVIDUAL_YEARLY`
- `APPLE_IAP_PRODUCT_STUDIO_MONTHLY`
- `APPLE_IAP_PRODUCT_STUDIO_YEARLY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Flow:

- App sendet iOS-Receipt an `verify-ios-receipt`
- Function validiert Receipt bei Apple (`verifyReceipt`)
- Function upsertet `subscriptions`
- `get_my_entitlement()` liefert danach `has_access=true`

## Bereits im Code integriert

- Fullscreen-Paywall: `src/screens/PaywallScreen.tsx`
- Inline-Paywall CTA: `src/components/common/PaywallCard.tsx`
- Entitlement RPC: `get_my_entitlement()`
- Studio-Create Gate RPC: `create_studio_with_owner(p_name, p_city)`
- Stripe Functions:
  - `supabase/functions/create-checkout-session`
  - `supabase/functions/stripe-webhook`

## Migrationen

Vor Deploy sicherstellen:

- `supabase/migrations/20260408152000_add_subscription_and_entitlements.sql`
- `supabase/migrations/20260408164500_add_stripe_ids_to_subscriptions.sql`

## A) Kostenfrei testen (empfohlen)

### 1. Stripe Testprodukte anlegen

In Stripe Test Mode diese 4 Preise erstellen:

- `individual_monthly`
- `individual_yearly`
- `studio_monthly`
- `studio_yearly`

### 2. Supabase Secrets setzen (Testwerte)

Benötigte Secrets:

- `STRIPE_SECRET_KEY` (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
- `STRIPE_PRICE_INDIVIDUAL_MONTHLY` (`price_...`)
- `STRIPE_PRICE_INDIVIDUAL_YEARLY` (`price_...`)
- `STRIPE_PRICE_STUDIO_MONTHLY` (`price_...`)
- `STRIPE_PRICE_STUDIO_YEARLY` (`price_...`)
- `SUPABASE_SERVICE_ROLE_KEY`
- optional `APP_SCHEME` (`kombat`)

### 3. Functions deployen

- `create-checkout-session`
- `stripe-webhook`

### 4. Stripe Webhook auf Supabase Function URL richten

Events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.paid`

### 5. End-to-End Test

In der App:

- Paywall öffnen
- Plan wählen
- Checkout mit Stripe-Testkarte `4242 4242 4242 4242`
- prüfen, ob `subscriptions` aktualisiert wurde
- prüfen, ob `get_my_entitlement()` `has_access=true` liefert

## B) Live schalten (kostenpflichtig)

Erst ausführen, wenn explizit freigegeben:

1. Live-Stripe-Preise anlegen  
2. Secrets von `sk_test_/price_test` auf Livewerte umstellen  
3. Live-Webhooks setzen  
4. Live-Test mit kleinem Betrag durchführen

## Hinweise zu Kosten

- Stripe Test Mode: keine echten Zahlungen, keine Stripe-Gebühren.
- Live Mode: Stripe-Gebühren pro erfolgreicher Zahlung.
- Infrastrukturkosten (z. B. Supabase) hängen von Nutzung ab, nicht nur von zahlenden Nutzern.
