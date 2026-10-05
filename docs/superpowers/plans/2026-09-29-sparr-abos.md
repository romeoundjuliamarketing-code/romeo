# Sparr-Abos (Ersteller, Karten, Paket) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drei Monatsabos (Ersteller 3,99 €, Karten 4,99 €, Paket 7,99 €); Sparrings erstellen wird serverseitig an das Ersteller-/Paket-Abo gebunden, per Schalter erst nach dem Release scharf.

**Architecture:** RevenueCat meldet Abo-Ereignisse an den bestehenden Edge-Function-Webhook `rc-boost-webhook`, der sie über die service_role-RPC `apply_store_entitlement` in die neue Tabelle `store_entitlements` spiegelt. Die INSERT-Policy für private Sparrings prüft `can_create_sparring()` (Schalter in `app_flags` + gültige `creator`-Zeile). Die App liest RevenueCat (sofort nach Kauf) plus `get_my_store_entitlements()` (Schalter, Server-Stand) über den neuen Hook `useStoreEntitlements` und schickt ohne Berechtigung auf die neu aufgebaute Paywall.

**Tech Stack:** React Native + Expo SDK 55, TypeScript strict, `react-native-purchases` (RevenueCat), Supabase (Postgres 17, RLS, Deno Edge Functions), Jest (babel), lokale Postgres-17-Szenariotests (`supabase/tests/`).

**Spec:** `docs/superpowers/specs/2026-09-29-sparr-abos-design.md`

## Global Constraints

- Preise: Ersteller 3,99 €/Monat, Karten 4,99 €/Monat, Paket 7,99 €/Monat — im Code **nie** hardcoded, immer `priceString`/`price` aus dem Store.
- Produkt-IDs: `sparr_creator_monthly`, `sparr_individual_monthly` (= Karten), `sparr_bundle_monthly`.
- RevenueCat-Berechtigungen: `Sparr Pro` (Kartenspiel, Identifier bleibt), `Sparr Creator` (Sparrings erstellen).
- Schalter: `app_flags.key = 'sparring_creation_requires_sub'`, Startwert `false`.
- Studio-Sparrings (Policy „coaches insert sparrings“) bleiben unverändert und frei.
- Nur Monatsabos. Events (Einmalkauf), Map-Boost, Studio-Stufen unverändert.
- TypeScript strict, `any` verboten. Keine Inline-Styles, nur `StyleSheet.create`; Abstände nur in 8er-Vielfachen; Farben nur aus `src/theme/colors.ts`.
- UI-Texte Deutsch mit echten Umlauten; Code-Kommentare Englisch; keine Emojis; Icons nur `@expo/vector-icons`.
- Test-Dateien: kein `import type` (Babel), stattdessen `as const`.
- Nach jeder Codeänderung `npx tsc --noEmit`. Nach Utils-Änderungen `npx jest`.
- Modal-Regel: vor `navigate` aus einem Sheet das Sheet schließen.
- Supabase-Prod: `apply_migration` und `deploy_edge_function` sind nach außen wirksam → **vor Ausführung Romeo fragen**.
- Commits nur nach Romeos Freigabe und nur mit den Dateien des Tasks (auf dem Branch liegen viele fremde, uncommittete Änderungen). Commit-Nachricht endet mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Webhook kommt verzögert, Schalter an:** RevenueCat sagt „erlaubt“, der Server lehnt den Insert ab → die App zeigt „Ersteller-Abo nötig“ mit „Abos ansehen“, nie den Postgres-Text; ein RLS-Fehler bei einem Studio-Insert wird **nicht** als Abo-Problem gemeldet. → Test in Task 1 (`sparringInsertErrorCode`).
2. **Kauf vor dem Login / anonymer RevenueCat-Nutzer** (`$RCAnonymousID:…`): Webhook überspringt mit 200 statt 500-Retry-Schleife. → Test in Task 2 (`isSupabaseUserId`).
3. **Wechsel mit Ereignissen in falscher Reihenfolge** (Paket → Karten, `EXPIRATION` des Pakets kommt nach `RENEWAL` der Karten): Karten bleiben aktiv, nur `creator` endet. → SQL-Szenario in Task 3.
4. **Erstattung vs. normale Kündigung:** `CANCELLATION` mit `CUSTOMER_SUPPORT` beendet sofort, normale Kündigung lässt Zugang bis Laufzeitende. → Test in Task 2.
5. **Produkt fehlt im Offering** (Paket noch nicht von Apple freigegeben) oder Android-ID mit Basistarif (`sparr_creator_monthly:monthly`): Karte zeigt „Derzeit nicht verfügbar“, Ersparnis-Hinweis entfällt, Zuordnung klappt trotz Suffix. → Tests in Task 1 (`planForProduct`, `bundleSavings`).

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `src/utils/subscriptionPlans.ts` (neu) | Reine Abo-Logik der App: Plan-Keys, RC-Berechtigungs-IDs, Produkt → Plan, Reihenfolge, Labels, Ersparnis, Insert-Fehler-Mapping |
| `src/utils/subscriptionPlans.test.ts` (neu) | Unit-Tests dazu |
| `supabase/functions/rc-boost-webhook/storeEntitlementEvents.ts` (neu) | Reine Webhook-Logik: RC-Event → Berechtigungsänderung (ohne Deno-Imports, damit Jest es testen kann) |
| `src/utils/storeEntitlementEvents.test.ts` (neu) | Jest-Tests dafür (importiert aus `supabase/functions/...`, weil Jest nur `src/utils/*.test.ts` sucht) |
| `supabase/migrations/20260929120000_store_entitlements.sql` (neu) | Tabellen, Funktionen, Policy |
| `supabase/tests/store_entitlements.sql` + `run_store_entitlements.sh` (neu) | SQL-Szenarien gegen Wegwerf-Postgres |
| `supabase/functions/rc-boost-webhook/index.ts` (ändern) | Abo-Ereignisse vor dem Boost-/Event-Pfad verarbeiten |
| `src/types/database.types.ts` (ändern) | RPC-Typ `get_my_store_entitlements` |
| `src/hooks/useStoreEntitlements.ts` (neu) | App-Sicht auf Ersteller/Karten |
| `src/hooks/useSparringActions.ts` (ändern) | `code: 'subscription_required'` bei RLS-Ablehnung privater Inserts |
| `src/screens/SparringMapScreen.tsx` (ändern) | Gate vor dem Erstellen-Sheet, Abo-Meldung |
| `src/components/paywall/PlanCard.tsx` (neu) | Plan-Karte (aus `PaywallScreen` herausgelöst) |
| `src/screens/PaywallScreen.tsx` (ändern) | Drei Pläne, `focus`, Ersparnis, Aktiv-Status |
| `src/navigation/types.ts` (ändern) | `Paywall: { focus?: 'creator' \| 'cards' } \| undefined` |
| `src/screens/CardsScreen.tsx`, `src/components/challenge/CardGameGate.tsx`, `src/components/challenge/CardsLanding.tsx` (ändern) | Einstieg mit `focus: 'cards'`, Paket-Hinweis |
| `src/screens/SettingsScreen.tsx` (ändern) | Plan-Label, „Abo verwalten“ |

---

### Task 1: App-Abo-Logik (`subscriptionPlans.ts`)

**Files:**
- Create: `src/utils/subscriptionPlans.ts`
- Test: `src/utils/subscriptionPlans.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces:
  - `type PlanKey = 'creator' | 'cards' | 'bundle'`
  - `type PlanFocus = 'creator' | 'cards'`
  - `const RC_ENTITLEMENT_CARDS = 'Sparr Pro'`, `const RC_ENTITLEMENT_CREATOR = 'Sparr Creator'`
  - `planForProduct(productId: string): PlanKey | null`
  - `orderPlans(focus: PlanFocus | undefined): PlanKey[]`
  - `activePlan(creator: boolean, cards: boolean): PlanKey | null`
  - `planLabel(creator: boolean, cards: boolean): string`
  - `bundleSavings(creator: number | null, cards: number | null, bundle: number | null): number | null`
  - `formatSavings(amount: number, currencyCode: string): string`
  - `sparringInsertErrorCode(pgCode: string | undefined, studioId: string | null): 'subscription_required' | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/subscriptionPlans.test.ts
import {
  activePlan, bundleSavings, formatSavings, orderPlans, planForProduct, planLabel, sparringInsertErrorCode,
} from './subscriptionPlans';

describe('planForProduct', () => {
  it('maps plain store ids', () => {
    expect(planForProduct('sparr_creator_monthly')).toBe('creator');
    expect(planForProduct('sparr_individual_monthly')).toBe('cards');
    expect(planForProduct('sparr_bundle_monthly')).toBe('bundle');
  });
  it('ignores reverse-DNS prefixes and Play base plans', () => {
    expect(planForProduct('com.deinebundle.sparr.sparr_individual_monthly')).toBe('cards');
    expect(planForProduct('sparr_creator_monthly:monthly')).toBe('creator');
  });
  it('does not treat the app bundle prefix as the bundle plan', () => {
    expect(planForProduct('com.deinebundle.sparr.mapbadge_30d')).toBeNull();
    expect(planForProduct('com.deinebundle.sparr.event_create')).toBeNull();
  });
  it('drops retired plans', () => {
    expect(planForProduct('sparr_individual_yearly')).toBeNull();
    expect(planForProduct('sparr_studio_monthly')).toBeNull();
  });
});

describe('orderPlans', () => {
  it('puts the focused plan first and the bundle second', () => {
    expect(orderPlans('cards')).toEqual(['cards', 'bundle', 'creator']);
    expect(orderPlans('creator')).toEqual(['creator', 'bundle', 'cards']);
    expect(orderPlans(undefined)).toEqual(['creator', 'bundle', 'cards']);
  });
});

describe('activePlan / planLabel', () => {
  it('derives the plan from the two entitlements', () => {
    expect(activePlan(true, true)).toBe('bundle');
    expect(activePlan(true, false)).toBe('creator');
    expect(activePlan(false, true)).toBe('cards');
    expect(activePlan(false, false)).toBeNull();
  });
  it('labels in German', () => {
    expect(planLabel(true, true)).toBe('Ersteller + Karten');
    expect(planLabel(true, false)).toBe('Ersteller');
    expect(planLabel(false, true)).toBe('Karten');
    expect(planLabel(false, false)).toBe('Kein aktives Abo');
  });
});

describe('bundleSavings / formatSavings', () => {
  it('computes the saving from live prices', () => {
    expect(bundleSavings(3.99, 2.99, 5.99)).toBe(0.99);
  });
  it('is null when a price is missing or there is no saving', () => {
    expect(bundleSavings(null, 2.99, 5.99)).toBeNull();
    expect(bundleSavings(3.99, 2.99, null)).toBeNull();
    expect(bundleSavings(2.99, 2.99, 5.99)).toBeNull();
  });
  it('formats as currency', () => {
    expect(formatSavings(0.99, 'EUR')).toMatch(/^0,99\s€$/);
  });
});

describe('sparringInsertErrorCode', () => {
  it('flags an RLS rejection of a private sparring', () => {
    expect(sparringInsertErrorCode('42501', null)).toBe('subscription_required');
  });
  it('does not blame the subscription for studio inserts or other errors', () => {
    expect(sparringInsertErrorCode('42501', 'studio-1')).toBeNull();
    expect(sparringInsertErrorCode('23505', null)).toBeNull();
    expect(sparringInsertErrorCode(undefined, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/subscriptionPlans.test.ts`
Expected: FAIL — `Cannot find module './subscriptionPlans'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/subscriptionPlans.ts
// Store subscription rules shared by paywall, settings and the sparring gate.
// Product matching mirrors supabase/functions/rc-boost-webhook/storeEntitlementEvents.ts —
// keep both in sync.

export type PlanKey = 'creator' | 'cards' | 'bundle';
export type PlanFocus = 'creator' | 'cards';

export const RC_ENTITLEMENT_CARDS = 'Sparr Pro';
export const RC_ENTITLEMENT_CREATOR = 'Sparr Creator';

// Last id segment without store prefix ("com.x.y.") or Play base plan (":monthly").
function productKey(productId: string): string {
  const withoutBasePlan = productId.split(':')[0];
  const segments = withoutBasePlan.split('.');
  return segments[segments.length - 1].toLowerCase();
}

const PLAN_BY_KEY: Record<string, PlanKey> = {
  sparr_creator_monthly: 'creator',
  sparr_individual_monthly: 'cards',
  sparr_bundle_monthly: 'bundle',
};

export function planForProduct(productId: string): PlanKey | null {
  return PLAN_BY_KEY[productKey(productId)] ?? null;
}

export function orderPlans(focus: PlanFocus | undefined): PlanKey[] {
  return focus === 'cards' ? ['cards', 'bundle', 'creator'] : ['creator', 'bundle', 'cards'];
}

export function activePlan(creator: boolean, cards: boolean): PlanKey | null {
  if (creator && cards) return 'bundle';
  if (creator) return 'creator';
  if (cards) return 'cards';
  return null;
}

export function planLabel(creator: boolean, cards: boolean): string {
  switch (activePlan(creator, cards)) {
    case 'bundle': return 'Ersteller + Karten';
    case 'creator': return 'Ersteller';
    case 'cards': return 'Karten';
    default: return 'Kein aktives Abo';
  }
}

export function bundleSavings(creator: number | null, cards: number | null, bundle: number | null): number | null {
  if (creator === null || cards === null || bundle === null) return null;
  const saving = Math.round((creator + cards - bundle) * 100) / 100;
  return saving > 0 ? saving : null;
}

export function formatSavings(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currencyCode }).format(amount);
}

// Postgres "insufficient_privilege" on a private insert means the RLS check
// can_create_sparring() failed — i.e. no creator subscription on the server.
export function sparringInsertErrorCode(
  pgCode: string | undefined,
  studioId: string | null,
): 'subscription_required' | null {
  return pgCode === '42501' && studioId === null ? 'subscription_required' : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/subscriptionPlans.test.ts && npx tsc --noEmit`
Expected: PASS, tsc ohne Ausgabe.

- [ ] **Step 5: Commit** (nach Freigabe)

```bash
git add src/utils/subscriptionPlans.ts src/utils/subscriptionPlans.test.ts
git commit -m "feat(abo): Abo-Logik fuer Ersteller, Karten und Paket"
```

---

### Task 2: Webhook-Logik (`storeEntitlementEvents.ts`)

**Files:**
- Create: `supabase/functions/rc-boost-webhook/storeEntitlementEvents.ts`
- Test: `src/utils/storeEntitlementEvents.test.ts`

**Interfaces:**
- Consumes: nichts (kein Import aus `src/` — Edge Functions bündeln nur ihren Ordner).
- Produces:
  - `type StoreEntitlement = 'creator' | 'cards'`
  - `interface RcSubscriptionEvent { type: string; product_id: string; new_product_id?: string | null; expiration_at_ms?: number | null; cancel_reason?: string | null }`
  - `type StoreEntitlementChange = { kind: 'grant'; entitlements: StoreEntitlement[]; productId: string; expiresAt: string } | { kind: 'expire'; entitlements: StoreEntitlement[]; productId: string } | { kind: 'ignore' }`
  - `entitlementsForProduct(productId: string): StoreEntitlement[]`
  - `subscriptionChange(event: RcSubscriptionEvent): StoreEntitlementChange`
  - `isSupabaseUserId(id: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/storeEntitlementEvents.test.ts
import {
  entitlementsForProduct, isSupabaseUserId, subscriptionChange,
} from '../../supabase/functions/rc-boost-webhook/storeEntitlementEvents';

const EXP = Date.UTC(2026, 10, 1, 12, 0, 0);

describe('entitlementsForProduct', () => {
  it('maps the three plans', () => {
    expect(entitlementsForProduct('sparr_bundle_monthly')).toEqual(['creator', 'cards']);
    expect(entitlementsForProduct('sparr_creator_monthly')).toEqual(['creator']);
    expect(entitlementsForProduct('com.deinebundle.sparr.sparr_individual_monthly')).toEqual(['cards']);
    expect(entitlementsForProduct('sparr_creator_monthly:monthly')).toEqual(['creator']);
  });
  it('ignores consumables and retired plans', () => {
    expect(entitlementsForProduct('com.deinebundle.sparr.mapbadge_30d')).toEqual([]);
    expect(entitlementsForProduct('sparr_studio_monthly')).toEqual([]);
  });
});

describe('subscriptionChange', () => {
  it('grants on purchase and renewal', () => {
    for (const type of ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION'] as const) {
      expect(subscriptionChange({ type, product_id: 'sparr_bundle_monthly', expiration_at_ms: EXP })).toEqual({
        kind: 'grant', entitlements: ['creator', 'cards'], productId: 'sparr_bundle_monthly', expiresAt: '2026-11-01T12:00:00.000Z',
      });
    }
  });
  it('grants the new product on a product change', () => {
    expect(subscriptionChange({
      type: 'PRODUCT_CHANGE', product_id: 'sparr_individual_monthly', new_product_id: 'sparr_bundle_monthly', expiration_at_ms: EXP,
    })).toEqual({
      kind: 'grant', entitlements: ['creator', 'cards'], productId: 'sparr_bundle_monthly', expiresAt: '2026-11-01T12:00:00.000Z',
    });
  });
  it('expires on expiration and on refunds', () => {
    expect(subscriptionChange({ type: 'EXPIRATION', product_id: 'sparr_creator_monthly' })).toEqual({
      kind: 'expire', entitlements: ['creator'], productId: 'sparr_creator_monthly',
    });
    expect(subscriptionChange({ type: 'CANCELLATION', product_id: 'sparr_creator_monthly', cancel_reason: 'CUSTOMER_SUPPORT' })).toEqual({
      kind: 'expire', entitlements: ['creator'], productId: 'sparr_creator_monthly',
    });
  });
  it('keeps access on a normal cancellation', () => {
    expect(subscriptionChange({ type: 'CANCELLATION', product_id: 'sparr_creator_monthly', cancel_reason: 'UNSUBSCRIBE' }))
      .toEqual({ kind: 'ignore' });
  });
  it('ignores consumables, unknown types and grants without expiry', () => {
    expect(subscriptionChange({ type: 'NON_RENEWING_PURCHASE', product_id: 'com.deinebundle.sparr.mapbadge_30d' })).toEqual({ kind: 'ignore' });
    expect(subscriptionChange({ type: 'BILLING_ISSUE', product_id: 'sparr_creator_monthly', expiration_at_ms: EXP })).toEqual({ kind: 'ignore' });
    expect(subscriptionChange({ type: 'RENEWAL', product_id: 'sparr_creator_monthly', expiration_at_ms: null })).toEqual({ kind: 'ignore' });
  });
});

describe('isSupabaseUserId', () => {
  it('accepts uuids only', () => {
    expect(isSupabaseUserId('0b9f7c1e-4a3d-4c2b-9d8e-1f2a3b4c5d6e')).toBe(true);
    expect(isSupabaseUserId('$RCAnonymousID:abc123')).toBe(false);
    expect(isSupabaseUserId('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/storeEntitlementEvents.test.ts`
Expected: FAIL — `Cannot find module '../../supabase/functions/rc-boost-webhook/storeEntitlementEvents'`

- [ ] **Step 3: Write minimal implementation**

```ts
// supabase/functions/rc-boost-webhook/storeEntitlementEvents.ts
// Pure mapping from RevenueCat subscription events to store entitlements.
// No Deno imports so Jest can test it (src/utils/storeEntitlementEvents.test.ts).
// Product matching mirrors src/utils/subscriptionPlans.ts — keep both in sync.

export type StoreEntitlement = 'creator' | 'cards';

export interface RcSubscriptionEvent {
  type:              string;
  product_id:        string;
  new_product_id?:   string | null;
  expiration_at_ms?: number | null;
  cancel_reason?:    string | null;
}

export type StoreEntitlementChange =
  | { kind: 'grant'; entitlements: StoreEntitlement[]; productId: string; expiresAt: string }
  | { kind: 'expire'; entitlements: StoreEntitlement[]; productId: string }
  | { kind: 'ignore' };

const ENTITLEMENTS_BY_KEY: Record<string, StoreEntitlement[]> = {
  sparr_bundle_monthly:     ['creator', 'cards'],
  sparr_creator_monthly:    ['creator'],
  sparr_individual_monthly: ['cards'],
};

const GRANT_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Last id segment without store prefix ("com.x.y.") or Play base plan (":monthly").
function productKey(productId: string): string {
  const segments = productId.split(':')[0].split('.');
  return segments[segments.length - 1].toLowerCase();
}

export function entitlementsForProduct(productId: string): StoreEntitlement[] {
  return ENTITLEMENTS_BY_KEY[productKey(productId)] ?? [];
}

export function isSupabaseUserId(id: string): boolean {
  return UUID_RE.test(id);
}

export function subscriptionChange(event: RcSubscriptionEvent): StoreEntitlementChange {
  const isRefund = event.type === 'CANCELLATION' && event.cancel_reason === 'CUSTOMER_SUPPORT';
  if (event.type === 'EXPIRATION' || isRefund) {
    const entitlements = entitlementsForProduct(event.product_id);
    return entitlements.length > 0
      ? { kind: 'expire', entitlements, productId: event.product_id }
      : { kind: 'ignore' };
  }
  if (!GRANT_TYPES.has(event.type)) return { kind: 'ignore' };

  const productId = event.type === 'PRODUCT_CHANGE' && event.new_product_id
    ? event.new_product_id
    : event.product_id;
  const entitlements = entitlementsForProduct(productId);
  if (entitlements.length === 0 || event.expiration_at_ms === undefined || event.expiration_at_ms === null) {
    return { kind: 'ignore' };
  }
  return { kind: 'grant', entitlements, productId, expiresAt: new Date(event.expiration_at_ms).toISOString() };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/storeEntitlementEvents.test.ts && npx tsc --noEmit`
Expected: PASS, tsc ohne Ausgabe.

- [ ] **Step 5: Commit** (nach Freigabe)

```bash
git add supabase/functions/rc-boost-webhook/storeEntitlementEvents.ts src/utils/storeEntitlementEvents.test.ts
git commit -m "feat(abo): RevenueCat-Abo-Ereignisse auf Berechtigungen abbilden"
```

---

### Task 3: Datenbank — Migration + SQL-Szenarien

**Files:**
- Create: `supabase/migrations/20260929120000_store_entitlements.sql`
- Create: `supabase/tests/store_entitlements.sql`
- Create: `supabase/tests/run_store_entitlements.sh`
- Reuse: `supabase/tests/base.sql` (enthält `open_sparrings`, `profiles`, Prod-Policy „users insert own sparrings“, `auth.uid()`-Stub über `request.jwt.claim.sub`)

**Interfaces:**
- Consumes: nichts aus früheren Tasks.
- Produces (SQL, alle in `public`):
  - Tabelle `store_entitlements(user_id uuid, entitlement text, product_id text, expires_at timestamptz, updated_at timestamptz)`, PK `(user_id, entitlement)`
  - Tabelle `app_flags(key text PK, enabled boolean)`
  - `can_create_sparring() returns boolean` (EXECUTE: authenticated)
  - `get_my_store_entitlements() returns table(can_create_sparring boolean, creator_active boolean, cards_active boolean, creation_requires_sub boolean)` (EXECUTE: authenticated)
  - `apply_store_entitlement(p_user_id uuid, p_entitlements text[], p_product_id text, p_expires_at timestamptz) returns void` (EXECUTE: nur service_role; `p_expires_at` NULL = Ablauf)

- [ ] **Step 1: Write the failing scenario tests**

```sql
-- supabase/tests/store_entitlements.sql
-- Scenario tests for store entitlements (spec 2026-09-29-sparr-abos-design.md, section 2).
-- Run via supabase/tests/run_store_entitlements.sh against a throwaway local DB.

\set ON_ERROR_STOP 1
SET client_min_messages = notice;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');
INSERT INTO profiles (id, name) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Anna'),
  ('00000000-0000-0000-0000-0000000000b2', 'Ben');

CREATE FUNCTION t_a() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-0000000000a1'::uuid $$;
CREATE FUNCTION t_b() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-0000000000b2'::uuid $$;

CREATE FUNCTION t_as(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), false)
$$;

-- Tries a private sparring insert as p_uid through RLS; true = allowed.
CREATE FUNCTION t_try_insert(p_uid uuid) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  PERFORM t_as(p_uid);
  SET LOCAL ROLE authenticated;
  INSERT INTO open_sparrings (created_by, title, discipline, address, lat, lng, scheduled_at)
  VALUES (p_uid, 'Test', 'Boxen', 'Hauptstr. 1, 28195 Bremen', 53.08, 8.80, now() + interval '2 days');
  RESET ROLE;
  RETURN true;
EXCEPTION WHEN insufficient_privilege THEN
  RESET ROLE;
  RETURN false;
END $$;

CREATE FUNCTION t_flag(p_on boolean) RETURNS void LANGUAGE sql AS $$
  UPDATE app_flags SET enabled = p_on WHERE key = 'sparring_creation_requires_sub'
$$;

DO $$ BEGIN
  ASSERT (SELECT NOT enabled FROM app_flags WHERE key = 'sparring_creation_requires_sub'), 'flag starts off';
  ASSERT t_try_insert(t_a()), 'flag off: insert without subscription allowed';
  RAISE NOTICE 'ok 1 Schalter aus: Erstellen ohne Abo erlaubt';
END $$;

DO $$ BEGIN
  PERFORM t_flag(true);
  ASSERT NOT t_try_insert(t_a()), 'flag on: insert without subscription denied';
  RAISE NOTICE 'ok 2 Schalter an: Erstellen ohne Abo abgelehnt';
END $$;

DO $$ BEGIN
  PERFORM apply_store_entitlement(t_a(), ARRAY['creator'], 'sparr_creator_monthly', now() + interval '30 days');
  ASSERT t_try_insert(t_a()), 'valid creator allowed';
  ASSERT NOT t_try_insert(t_b()), 'other user still denied';
  RAISE NOTICE 'ok 3 Gültiges Ersteller-Abo: Erstellen erlaubt';
END $$;

DO $$ BEGIN
  -- An older grant must never shorten access.
  PERFORM apply_store_entitlement(t_a(), ARRAY['creator'], 'sparr_creator_monthly', now() + interval '1 day');
  ASSERT (SELECT expires_at > now() + interval '29 days' FROM store_entitlements WHERE user_id = t_a() AND entitlement = 'creator'), 'not shortened';
  PERFORM apply_store_entitlement(t_a(), ARRAY['creator'], 'sparr_creator_monthly', NULL);
  ASSERT NOT t_try_insert(t_a()), 'expired creator denied';
  RAISE NOTICE 'ok 4 Ablauf beendet, ältere Verlängerung verkürzt nicht';
END $$;

DO $$
DECLARE r record;
BEGIN
  -- Downgrade bundle -> cards with the bundle EXPIRATION arriving after the cards RENEWAL.
  PERFORM apply_store_entitlement(t_b(), ARRAY['creator', 'cards'], 'sparr_bundle_monthly', now() + interval '10 days');
  PERFORM apply_store_entitlement(t_b(), ARRAY['cards'], 'sparr_individual_monthly', now() + interval '40 days');
  PERFORM apply_store_entitlement(t_b(), ARRAY['creator', 'cards'], 'sparr_bundle_monthly', NULL);
  PERFORM t_as(t_b());
  SELECT * INTO r FROM get_my_store_entitlements();
  ASSERT NOT r.creator_active, 'bundle creator ended';
  ASSERT r.cards_active, 'cards now owned by the cards product stay active';
  ASSERT NOT r.can_create_sparring, 'no creator -> cannot create';
  ASSERT r.creation_requires_sub, 'flag reported';
  RAISE NOTICE 'ok 5 Wechsel mit vertauschter Reihenfolge: Karten bleiben';
END $$;

DO $$
DECLARE denied integer := 0; visible integer;
BEGIN
  PERFORM t_as(t_b());
  SET LOCAL ROLE authenticated;
  BEGIN INSERT INTO store_entitlements (user_id, entitlement, product_id, expires_at)
        VALUES (t_b(), 'creator', 'x', now() + interval '1 year');
  EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
  BEGIN PERFORM apply_store_entitlement(t_b(), ARRAY['creator'], 'x', now() + interval '1 year');
  EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
  BEGIN UPDATE app_flags SET enabled = false;
  EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
  SELECT count(*) INTO visible FROM store_entitlements;  -- only own rows
  RESET ROLE;
  ASSERT denied = 3, format('denied %s of 3', denied);
  ASSERT visible = 2, format('user b sees %s rows, expected own 2 (creator expired, cards)', visible);
  RAISE NOTICE 'ok 6 Nutzer kann Abos und Schalter nicht selbst schreiben, sieht nur eigene Zeilen';
END $$;

\echo 'ALL STORE ENTITLEMENT TESTS PASSED'
```

```bash
# supabase/tests/run_store_entitlements.sh
#!/usr/bin/env bash
# Runs the store-entitlement scenario tests against a throwaway local Postgres.
# Needs postgresql@17 from Homebrew. Nothing touches the Supabase project.
#
#   supabase/tests/run_store_entitlements.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sparr-pgtest.XXXXXX")"
PORT="${PGTEST_PORT:-54330}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust --locale=C -E UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

{
  cat "$HERE/base.sql"
  cat <<'SQL'
-- Supabase pieces the migration references but base.sql does not stub.
CREATE TABLE auth.users (id uuid PRIMARY KEY);
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
SQL
} | "${PSQL[@]}"

"${PSQL[@]}" -f "$HERE/../migrations/20260929120000_store_entitlements.sql"
"${PSQL[@]}" -f "$HERE/store_entitlements.sql"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `chmod +x supabase/tests/run_store_entitlements.sh && supabase/tests/run_store_entitlements.sh`
Expected: FAIL — `psql: ... 20260929120000_store_entitlements.sql: No such file or directory`

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260929120000_store_entitlements.sql
-- Store subscriptions (RevenueCat) mirrored into Postgres so RLS can enforce
-- "creating a private sparring needs the creator subscription".
-- Spec: docs/superpowers/specs/2026-09-29-sparr-abos-design.md
-- The enforcement stays off until app_flags.sparring_creation_requires_sub is
-- switched on after the new build is live in both stores.

CREATE TABLE IF NOT EXISTS public.store_entitlements (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entitlement text        NOT NULL CHECK (entitlement IN ('creator', 'cards')),
  product_id  text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entitlement)
);

ALTER TABLE public.store_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_entitlements FROM anon, authenticated;
GRANT SELECT ON public.store_entitlements TO authenticated;
DROP POLICY IF EXISTS "read own store entitlements" ON public.store_entitlements;
CREATE POLICY "read own store entitlements" ON public.store_entitlements
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.app_flags (
  key     text    PRIMARY KEY,
  enabled boolean NOT NULL
);

ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_flags FROM anon, authenticated;
GRANT SELECT ON public.app_flags TO authenticated;
DROP POLICY IF EXISTS "read app flags" ON public.app_flags;
CREATE POLICY "read app flags" ON public.app_flags
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.app_flags (key, enabled)
VALUES ('sparring_creation_requires_sub', false)
ON CONFLICT (key) DO NOTHING;

-- True when the switch is off or the caller holds a live creator entitlement.
CREATE OR REPLACE FUNCTION public.can_create_sparring()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT COALESCE((SELECT enabled FROM app_flags WHERE key = 'sparring_creation_requires_sub'), false)
      OR EXISTS (
        SELECT 1 FROM store_entitlements
        WHERE user_id = auth.uid() AND entitlement = 'creator' AND expires_at > now()
      )
$$;
REVOKE ALL ON FUNCTION public.can_create_sparring() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_sparring() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_store_entitlements()
RETURNS TABLE (
  can_create_sparring   boolean,
  creator_active        boolean,
  cards_active          boolean,
  creation_requires_sub boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_create_sparring(),
         EXISTS (SELECT 1 FROM store_entitlements
                 WHERE user_id = auth.uid() AND entitlement = 'creator' AND expires_at > now()),
         EXISTS (SELECT 1 FROM store_entitlements
                 WHERE user_id = auth.uid() AND entitlement = 'cards' AND expires_at > now()),
         COALESCE((SELECT enabled FROM app_flags WHERE key = 'sparring_creation_requires_sub'), false)
$$;
REVOKE ALL ON FUNCTION public.get_my_store_entitlements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_store_entitlements() TO authenticated;

-- Webhook only. p_expires_at set: grant/extend (never shortens).
-- p_expires_at NULL: expire, but only rows still owned by p_product_id, so a
-- late EXPIRATION of an old product cannot end access a newer product granted.
CREATE OR REPLACE FUNCTION public.apply_store_entitlement(
  p_user_id      uuid,
  p_entitlements text[],
  p_product_id   text,
  p_expires_at   timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_expires_at IS NULL THEN
    UPDATE store_entitlements
       SET expires_at = LEAST(expires_at, now()),
           updated_at = now()
     WHERE user_id = p_user_id
       AND entitlement = ANY (p_entitlements)
       AND product_id = p_product_id;
  ELSE
    INSERT INTO store_entitlements (user_id, entitlement, product_id, expires_at)
    SELECT p_user_id, e, p_product_id, p_expires_at
      FROM unnest(p_entitlements) AS e
    ON CONFLICT (user_id, entitlement) DO UPDATE
       SET product_id = EXCLUDED.product_id,
           expires_at = GREATEST(store_entitlements.expires_at, EXCLUDED.expires_at),
           updated_at = now();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_store_entitlement(uuid, text[], text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_store_entitlement(uuid, text[], text, timestamptz) TO service_role;

-- Private sparrings (studio_id IS NULL) need can_create_sparring(); the coach
-- policy for studio sparrings stays untouched (studio sparrings are free).
-- Recreated from the live prod definition (read 2026-09-29) plus the new check.
DROP POLICY IF EXISTS "users insert own sparrings" ON public.open_sparrings;
CREATE POLICY "users insert own sparrings" ON public.open_sparrings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND studio_id IS NULL
    AND NOT is_featured
    AND public.can_create_sparring()
  );
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `supabase/tests/run_store_entitlements.sh`
Expected: `ok 1` … `ok 6` und `ALL STORE ENTITLEMENT TESTS PASSED`.

- [ ] **Step 5: Apply to prod (nur nach Romeos OK)**

1. Live-Policy erneut prüfen (darf sich seit 2026-09-29 nicht geändert haben):
   `select policyname, with_check from pg_policies where tablename = 'open_sparrings' and cmd = 'INSERT';` über `mcp__claude_ai_Supabase__execute_sql` (Projekt `lkgrnuwtnifnmghthbog`). Erwartet: „users insert own sparrings“ = `((auth.uid() = created_by) AND (studio_id IS NULL) AND (NOT is_featured))`. Weicht es ab → stoppen, Romeo fragen.
2. `mcp__claude_ai_Supabase__apply_migration` mit Name `store_entitlements` und dem Dateiinhalt.
3. Kontrolle: `select * from app_flags;` → eine Zeile, `enabled = false`. `select public.can_create_sparring();` als service → `true`.

- [ ] **Step 6: Commit** (nach Freigabe)

```bash
git add supabase/migrations/20260929120000_store_entitlements.sql supabase/tests/store_entitlements.sql supabase/tests/run_store_entitlements.sh
git commit -m "feat(abo): Store-Berechtigungen und Abo-Pflicht fuer private Sparrings (Schalter aus)"
```

(`supabase/tests/base.sql` ist noch unversioniert und gehört zu einer anderen Session — nicht mitcommitten; falls es beim Commit fehlt, Romeo fragen.)

---

### Task 4: Webhook verdrahten + deployen

**Files:**
- Modify: `supabase/functions/rc-boost-webhook/index.ts`

**Interfaces:**
- Consumes: `subscriptionChange`, `isSupabaseUserId`, `RcSubscriptionEvent` (Task 2); RPC `apply_store_entitlement` (Task 3).
- Produces: Webhook schreibt `store_entitlements`. Boost-/Event-Pfad unverändert.

- [ ] **Step 1: Import und Event-Typ erweitern**

Am Dateianfang nach den bestehenden Imports:

```ts
import { isSupabaseUserId, subscriptionChange } from './storeEntitlementEvents.ts';
```

`RcEvent` erweitern:

```ts
interface RcEvent {
  type:                  string;
  product_id:            string;
  app_user_id:           string;
  new_product_id?:       string | null;
  expiration_at_ms?:     number | null;
  cancel_reason?:        string | null;
  subscriber_attributes?: Record<string, RcSubscriberAttribute>;
}
```

- [ ] **Step 2: Abo-Pfad vor dem „non-purchase“-Filter einfügen**

Direkt nach `const event = payload.event;` und **vor** dem Block `// Ignore non-purchase events silently.` einfügen:

```ts
  // ── Subscriptions: mirror creator / cards entitlements into Postgres ───────
  const change = subscriptionChange(event);
  if (change.kind !== 'ignore') {
    if (!isSupabaseUserId(event.app_user_id)) {
      // Anonymous RC user (purchase before login): nothing to attach it to.
      console.warn('[rc-boost-webhook] subscription event for non-uuid user', event.app_user_id);
      return new Response(JSON.stringify({ skipped: true, reason: 'anonymous user' }), {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const subClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: subError } = await subClient.rpc('apply_store_entitlement', {
      p_user_id:      event.app_user_id,
      p_entitlements: change.entitlements,
      p_product_id:   change.productId,
      p_expires_at:   change.kind === 'grant' ? change.expiresAt : null,
    });
    if (subError !== null) {
      console.error('[rc-boost-webhook] apply_store_entitlement error', subError.message);
      // 500 so RevenueCat retries: a missed grant would lock a paying user out.
      return new Response('Internal Server Error', { status: 500 });
    }
    console.log('[rc-boost-webhook] store entitlement', change.kind, change.entitlements, event.app_user_id);
    return new Response(JSON.stringify({ ok: true, change: change.kind }), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
```

Kopfkommentar der Datei ergänzen (Zeile 2): `// Receives RevenueCat webhooks: subscription entitlements (store_entitlements), map boosts and event unlocks.`

- [ ] **Step 3: Lokal prüfen**

Run: `npx jest src/utils/storeEntitlementEvents.test.ts` (Logik) und, falls Deno installiert ist, `deno check supabase/functions/rc-boost-webhook/index.ts`.
Expected: PASS; `deno check` ohne Fehler (fehlt Deno: Schritt überspringen und im Bericht erwähnen).

- [ ] **Step 4: Deploy (nur nach Romeos OK und nach Task 3 Step 5)**

1. `mcp__claude_ai_Supabase__get_edge_function` für `rc-boost-webhook` → aktuelles `verify_jwt` notieren (RevenueCat schickt kein Supabase-JWT; erwartet `false`).
2. `mcp__claude_ai_Supabase__deploy_edge_function` mit `name: rc-boost-webhook`, `entrypoint_path: index.ts`, `verify_jwt` wie notiert, Dateien `index.ts` und `storeEntitlementEvents.ts` (Inhalt aus dem Repo).
3. `mcp__claude_ai_Supabase__get_logs` bzw. `query_logs` (service `edge-function`) nach dem ersten Test-Event aus RevenueCat („Send test event“) prüfen: Antwort 200 `skipped` (Test-Events haben anonyme User-IDs).

- [ ] **Step 5: Commit** (nach Freigabe)

```bash
git add supabase/functions/rc-boost-webhook/index.ts
git commit -m "feat(abo): Webhook spiegelt Abo-Ereignisse in store_entitlements"
```

---

### Task 5: App-Datenzugriff — Typen, Hook, Insert-Fehler

**Files:**
- Modify: `src/types/database.types.ts` (Block `Functions: {`, neben `get_my_entitlement` ~Zeile 1972)
- Create: `src/hooks/useStoreEntitlements.ts`
- Modify: `src/hooks/useSparringActions.ts` (`createSparring`, ~Zeilen 120–200)

**Interfaces:**
- Consumes: `RC_ENTITLEMENT_CARDS`, `RC_ENTITLEMENT_CREATOR`, `sparringInsertErrorCode` (Task 1); RPC `get_my_store_entitlements` (Task 3).
- Produces:
  - `interface StoreEntitlements { canCreateSparring: boolean; creatorActive: boolean; cardsActive: boolean }`
  - `useStoreEntitlements(refetchTrigger?: number): { entitlements: StoreEntitlements; loading: boolean; refetch: () => Promise<void> }`
  - `createSparring(...)` liefert zusätzlich `code?: 'subscription_required'`

- [ ] **Step 1: RPC-Typ ergänzen**

In `src/types/database.types.ts` direkt nach dem `get_my_entitlement`-Eintrag:

```ts
      get_my_store_entitlements: {
        Args: Record<string, never>
        Returns: {
          can_create_sparring: boolean
          creator_active: boolean
          cards_active: boolean
          creation_requires_sub: boolean
        }[]
      }
```

- [ ] **Step 2: Hook schreiben**

```ts
// src/hooks/useStoreEntitlements.ts
import { useCallback, useEffect, useState } from 'react';
import Purchases from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import { loginRevenueCat } from '../lib/revenuecat';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import { RC_ENTITLEMENT_CARDS, RC_ENTITLEMENT_CREATOR } from '../utils/subscriptionPlans';

export interface StoreEntitlements {
  canCreateSparring: boolean;
  creatorActive: boolean;
  cardsActive: boolean;
}

const NONE: StoreEntitlements = { canCreateSparring: false, creatorActive: false, cardsActive: false };

// RevenueCat is right immediately after a purchase; the server knows the
// switch and what the webhook recorded. Either one granting is enough here —
// the insert policy has the final say.
export function useStoreEntitlements(refetchTrigger = 0): {
  entitlements: StoreEntitlements;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const cacheKey = userId === null ? null : `useStoreEntitlements:${userId}`;
  const cached = cacheKey ? getCached<StoreEntitlements>(cacheKey) : undefined;
  const [entitlements, setEntitlements] = useState<StoreEntitlements>(() => cached ?? NONE);
  const [loading, setLoading] = useState(cached === undefined);

  const refetch = useCallback(async (): Promise<void> => {
    if (userId === null) {
      setEntitlements(NONE);
      setLoading(false);
      return;
    }
    await loginRevenueCat(userId).catch(() => undefined);
    const [rcInfo, dbResult] = await Promise.all([
      Purchases.getCustomerInfo().catch(() => null),
      supabase.rpc('get_my_store_entitlements'),
    ]);
    const rcCreator = rcInfo !== null && rcInfo.entitlements.active[RC_ENTITLEMENT_CREATOR] !== undefined;
    const rcCards = rcInfo !== null && rcInfo.entitlements.active[RC_ENTITLEMENT_CARDS] !== undefined;

    if (dbResult.error !== null) reportNetworkError(dbResult.error);
    else reportNetworkSuccess();
    const row = dbResult.data?.[0];

    const next: StoreEntitlements = {
      // Unknown server state: let the insert policy decide instead of blocking.
      canCreateSparring: rcCreator || (row !== undefined ? row.can_create_sparring : true),
      creatorActive: rcCreator || row?.creator_active === true,
      cardsActive: rcCards || row?.cards_active === true,
    };
    setEntitlements(next);
    if (cacheKey && row !== undefined) setCached<StoreEntitlements>(cacheKey, next);
    setLoading(false);
  }, [userId, cacheKey]);

  useEffect(() => {
    void refetch();
  }, [refetch, refetchTrigger]);

  return { entitlements, loading, refetch };
}
```

- [ ] **Step 3: `createSparring` meldet Abo-Ablehnung**

In `src/hooks/useSparringActions.ts`:

Import ergänzen: `import { sparringInsertErrorCode } from '../utils/subscriptionPlans';`

Rückgabetyp der Callback-Signatur ändern:

```ts
  const createSparring = useCallback(async (params: CreateSparringInput): Promise<{ error: string | null; sparringId?: string; code?: 'subscription_required' }> => {
```

Den Ausdruck für `studio_id` vor dem Insert in eine Konstante ziehen und im Insert verwenden:

```ts
    const insertStudioId = params.studioId !== undefined ? studioId : (params.isAtStudio === true ? (params.atStudioId ?? null) : null);
```

```ts
        studio_id:     insertStudioId,
```

Fehlerzweig ersetzen:

```ts
    if (error !== null || newSparring === null) {
      if (sparringInsertErrorCode(error?.code, insertStudioId) === 'subscription_required') {
        return { error: 'Zum Erstellen eines Sparrings brauchst du das Ersteller-Abo.', code: 'subscription_required' };
      }
      return { error: error?.message ?? 'Sparring konnte nicht erstellt werden.' };
    }
```

(`studioId` ist die bestehende lokale Variable darüber — beim Umsetzen den genauen Namen in der Datei prüfen.)

- [ ] **Step 4: Prüfen**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc ohne Ausgabe, alle Tests grün.

- [ ] **Step 5: Commit** (nach Freigabe)

```bash
git add src/types/database.types.ts src/hooks/useStoreEntitlements.ts src/hooks/useSparringActions.ts
git commit -m "feat(abo): Hook fuer Store-Berechtigungen, Abo-Fehler beim Erstellen"
```

---

### Task 6: Gate vor „Sparring erstellen“

**Files:**
- Modify: `src/navigation/types.ts:55`
- Modify: `src/screens/SparringMapScreen.tsx` (Zeilen ~331–349, ~702, ~791–797, ~890–906)

**Interfaces:**
- Consumes: `useStoreEntitlements` (Task 5), `createSparring(...).code` (Task 5).
- Produces: Route `Paywall` mit optionalem `focus`.

- [ ] **Step 1: Route-Typ**

`src/navigation/types.ts` Zeile `Paywall: undefined;` ersetzen durch:

```ts
  Paywall: { focus?: 'creator' | 'cards' } | undefined;
```

- [ ] **Step 2: Hook + Gate in `SparringMapScreen`**

Import ergänzen: `import { useStoreEntitlements } from '../hooks/useStoreEntitlements';`

Bei den anderen Hooks (nach `useFocusRefetch(refetchVerification);`, ~Zeile 102):

```ts
  const { entitlements: storeEntitlements, refetch: refetchStoreEntitlements } = useStoreEntitlements();
  useFocusRefetch(() => { void refetchStoreEntitlements(); });
```

Direkt nach `requireVerified()` (~Zeile 342):

```ts
  // Private sparrings need the creator subscription. Members of a studio may
  // still open the sheet: studio sparrings stay free and the server decides.
  function requireCreator(): boolean {
    if (storeEntitlements.canCreateSparring || coachStudio !== null) return true;
    navigation.navigate('Paywall', { focus: 'creator' });
    return false;
  }
```

`coachStudio` wird erst ~Zeile 172 definiert — `requireCreator` steht darunter und ist eine Funktion, also kein Problem mit der Reihenfolge.

Drei Aufrufstellen umstellen:

```ts
    if (requireVerified() && requireCreator()) setCreateSheetVisible(true);
```
(openCreate-Effekt, ~Zeile 348)

```ts
            onCreate={() => { if (requireVerified() && requireCreator()) setCreateSheetVisible(true); }}
```
(~Zeile 702)

```ts
          onPrimary={() => {
            if (!requireVerified()) return;
            if (mapMode === 'sparrings') {
              if (requireCreator()) setCreateSheetVisible(true);
            } else {
              setCreateEventVisible(true);
            }
          }}
```
(~Zeile 791)

- [ ] **Step 3: Abo-Meldung beim Serverabweis**

Im `onCreate` des Erstellen-Sheets (~Zeile 895):

```ts
        onCreate={async (params) => {
          const { error, sparringId, code } = await createSparring(params);
          if (code === 'subscription_required') {
            // Close the sheet first so the paywall opens above the content.
            setCreateSheetVisible(false);
            Alert.alert('Ersteller-Abo nötig', 'Zum Erstellen eines Sparrings brauchst du das Ersteller-Abo.', [
              { text: 'Abbrechen', style: 'cancel' },
              { text: 'Abos ansehen', onPress: () => navigation.navigate('Paywall', { focus: 'creator' }) },
            ]);
            return;
          }
          if (error !== null) {
            Alert.alert('Fehler', error);
            return;
          }
          refetchSparrings();
          if (sparringId !== undefined) {
            boostTimerRef.current = setTimeout(() => setBoostSparringId(sparringId), 400);
          }
        }}
```

- [ ] **Step 4: Prüfen**

Run: `npx tsc --noEmit`
Expected: ohne Ausgabe.

- [ ] **Step 5: Commit** (nach Freigabe)

```bash
git add src/navigation/types.ts src/screens/SparringMapScreen.tsx
git commit -m "feat(abo): Sparring erstellen nur mit Ersteller-Abo (Studio frei)"
```

---

### Task 7: Paywall mit drei Plänen

**Files:**
- Create: `src/components/paywall/PlanCard.tsx`
- Modify: `src/screens/PaywallScreen.tsx` (weitgehend neu, bestehende Header-/Restore-/Rechtliches-Blöcke und deren Styles bleiben)
- Modify: `src/screens/CardsScreen.tsx:114`, `src/components/challenge/CardGameGate.tsx:39`, `src/components/challenge/CardsLanding.tsx:110`

**Interfaces:**
- Consumes: `PlanKey`, `PlanFocus`, `planForProduct`, `orderPlans`, `activePlan`, `bundleSavings`, `formatSavings`, `RC_ENTITLEMENT_CARDS`, `RC_ENTITLEMENT_CREATOR` (Task 1); `useStoreEntitlements` (Task 5); Route-Param `focus` (Task 6).
- Produces: `PlanCard` (`src/components/paywall/PlanCard.tsx`) mit Props `{ title; subtitle; price; details: string[]; badge?: string; active: boolean; available: boolean; highlighted?: boolean; loading?: boolean; onPress: () => void }`.

- [ ] **Step 1: `PlanCard` herauslösen**

`src/components/paywall/PlanCard.tsx` anlegen: die bestehende `PlanCard`-Funktion aus `PaywallScreen.tsx` (Zeilen ~56–109) **samt** den von ihr genutzten Styles (`planCard`, `planCardHighlighted`, `planTitle`, `planSubtitle`, `planPrice`, `detailList`, `detailRow`, `detailText`, `planButton`, `planButtonHighlighted`, `planButtonLabel`, `planButtonLabelHighlighted`) unverändert hierher verschieben und um `badge` und `active` erweitern:

```tsx
// src/components/paywall/PlanCard.tsx
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export interface PlanCardProps {
  title: string;
  subtitle: string;
  price: string;
  details: string[];
  badge?: string;
  active: boolean;
  available: boolean;
  highlighted?: boolean;
  loading?: boolean;
  onPress: () => void;
}

export default function PlanCard({
  title, subtitle, price, details, badge, active, available, highlighted = false, loading = false, onPress,
}: PlanCardProps): React.ReactElement {
  const label = active ? 'Aktiv' : available ? 'Abo auswählen' : 'Derzeit nicht verfügbar';
  return (
    <View style={[styles.planCard, highlighted && styles.planCardHighlighted]}>
      {badge !== undefined && <Text style={styles.badge}>{badge}</Text>}
      <Text style={styles.planTitle}>{title}</Text>
      <Text style={styles.planSubtitle}>{subtitle}</Text>
      <Text style={styles.planPrice}>{price}</Text>

      <View style={styles.detailList}>
        {details.map((item) => (
          <View key={item} style={styles.detailRow}>
            <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.accentBlue} />
            <Text style={styles.detailText}>{item}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.planButton, highlighted && styles.planButtonHighlighted]}
        onPress={onPress}
        disabled={loading || active || !available}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator size="small" color={highlighted ? colors.card : colors.accentBlue} />
        ) : (
          <Text style={[styles.planButtonLabel, highlighted && styles.planButtonLabelHighlighted]}>{label}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // ← hier die verschobenen Styles aus PaywallScreen unverändert einfügen, plus:
  badge: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentBlue,
    marginBottom: 8,
  },
});
```

(Die verschobenen Style-Einträge sind vorhandener Code und werden 1:1 kopiert — keine Werte ändern.)

- [ ] **Step 2: `PaywallScreen` umbauen**

Entfernen: `BillingCycle`, `PlanKey`-Typ, `PACKAGE_IDS`, `findPackageFuzzy`, lokale `PlanCard`, `priceLabel(pkg, billingCycle)`, State `billingCycle`, den ganzen Monat/Jahr-Block (`cycleCard` …) samt `cycle*`-Styles, alle `console.log`s und den Debug-`Alert` „RC Debug: keine Pakete“, die alte `handlePlanSelect`.

Neu (oberhalb der Komponente):

```tsx
import PlanCard from '../components/paywall/PlanCard';
import { useStoreEntitlements } from '../hooks/useStoreEntitlements';
import {
  activePlan, bundleSavings, formatSavings, orderPlans, planForProduct,
  RC_ENTITLEMENT_CARDS, RC_ENTITLEMENT_CREATOR, type PlanKey,
} from '../utils/subscriptionPlans';

const PLAN_COPY: Record<PlanKey, { title: string; subtitle: string; details: string[] }> = {
  creator: {
    title: 'Ersteller',
    subtitle: 'Eigene Sparrings erstellen',
    details: ['Sparrings anlegen und auf der Karte zeigen', 'Beitreten bleibt für alle kostenlos'],
  },
  cards: {
    title: 'Karten',
    subtitle: 'Kartenspiel für Kickboxen / K1',
    details: ['Alle verfügbaren Karten für Kickboxen / K1', 'Karten ziehen und im Sparring umsetzen'],
  },
  bundle: {
    title: 'Ersteller + Karten',
    subtitle: 'Beides in einem Abo',
    details: ['Sparrings erstellen', 'Komplettes Kartenspiel'],
  },
};

function priceLabel(pkg: PurchasesPackage | undefined): string {
  return pkg === undefined ? 'Preis derzeit nicht verfügbar' : `${pkg.product.priceString} / Monat`;
}
```

Komponente:

```tsx
export default function PaywallScreen({ navigation, route }: Props): React.ReactElement {
  const focus = route.params?.focus;
  const { entitlements, refetch } = useStoreEntitlements();
  const [packages, setPackages] = useState<Partial<Record<PlanKey, PurchasesPackage>>>({});
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [offeringsLoading, setOfferingsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadOfferings(): Promise<void> {
      try {
        const offerings = await Purchases.getOfferings();
        const source = offerings.current ?? Object.values(offerings.all)[0];
        const map: Partial<Record<PlanKey, PurchasesPackage>> = {};
        for (const pkg of source?.availablePackages ?? []) {
          const plan = planForProduct(pkg.product.identifier);
          if (plan !== null && map[plan] === undefined) map[plan] = pkg;
        }
        if (active) setPackages(map);
      } catch {
        // Offerings unavailable (e.g. simulator without StoreKit config): cards show "not available".
      } finally {
        if (active) setOfferingsLoading(false);
      }
    }
    void loadOfferings();
    return () => { active = false; };
  }, []);

  async function handlePurchase(plan: PlanKey): Promise<void> {
    const pkg = packages[plan];
    if (pkg === undefined) return;
    setPendingPlan(plan);
    try {
      await Purchases.purchasePackage(pkg);
      await refetch();
      navigation.goBack();
    } catch (err: unknown) {
      const isCancelled =
        typeof err === 'object' && err !== null && 'userCancelled' in err &&
        (err as { userCancelled: boolean }).userCancelled;
      if (!isCancelled) {
        Alert.alert('Kauf fehlgeschlagen', err instanceof Error ? err.message : 'Bitte versuche es erneut.');
      }
    } finally {
      setPendingPlan(null);
    }
  }

  async function handleRestorePurchases(): Promise<void> {
    try {
      const info = await Purchases.restorePurchases();
      const restored =
        info.entitlements.active[RC_ENTITLEMENT_CARDS] !== undefined ||
        info.entitlements.active[RC_ENTITLEMENT_CREATOR] !== undefined;
      if (restored) {
        await refetch();
        Alert.alert('Käufe wiederhergestellt', 'Dein Zugang ist wieder aktiv.');
        navigation.goBack();
      } else {
        Alert.alert('Keine Käufe gefunden', 'Für dieses Konto wurde kein aktives Abo gefunden.');
      }
    } catch (error: unknown) {
      Alert.alert('Wiederherstellung fehlgeschlagen', error instanceof Error ? error.message : 'Bitte versuche es erneut.');
    }
  }

  const current = activePlan(entitlements.creatorActive, entitlements.cardsActive);
  const saving = bundleSavings(
    packages.creator?.product.price ?? null,
    packages.cards?.product.price ?? null,
    packages.bundle?.product.price ?? null,
  );
  const bundleBadge = saving !== null && packages.bundle !== undefined
    ? `Beides – du sparst ${formatSavings(saving, packages.bundle.product.currencyCode)}`
    : undefined;
```

JSX-Inhalt im `ScrollView` → `content` (Header, Restore, Rechtliches bleiben wie bisher):

```tsx
        <Text style={styles.title}>Wähle dein Abo</Text>
        <Text style={styles.subtitle}>Beitreten ist kostenlos. Mit einem Abo erstellst du eigene Sparrings, spielst das Kartenspiel – oder beides.</Text>

        {offeringsLoading ? (
          <ActivityIndicator style={styles.loadingIndicator} color={colors.accentBlue} />
        ) : (
          orderPlans(focus).map((plan) => (
            <PlanCard
              key={plan}
              title={PLAN_COPY[plan].title}
              subtitle={PLAN_COPY[plan].subtitle}
              price={priceLabel(packages[plan])}
              details={PLAN_COPY[plan].details}
              badge={plan === 'bundle' ? bundleBadge : undefined}
              active={current === plan}
              available={packages[plan] !== undefined}
              highlighted={plan === 'bundle'}
              loading={pendingPlan === plan}
              onPress={() => { void handlePurchase(plan); }}
            />
          ))
        )}
```

Nicht mehr genutzte Imports (`useState` bleibt; ggf. `Linking` bleibt für Rechtliches) nach tsc bereinigen. Datei danach < 250 Zeilen; der Rest sind Styles.

- [ ] **Step 3: Einstiege ins Kartenspiel mit `focus: 'cards'`**

`src/screens/CardsScreen.tsx:114`: `onOpen={() => navigation.navigate('Paywall', { focus: 'cards' })}`
`src/components/challenge/CardGameGate.tsx:39`: `onPress={() => navigation.navigate('Paywall', { focus: 'cards' })}`
`src/components/challenge/CardsLanding.tsx:110` Text ersetzen durch:
`Mit dem Karten-Abo erhältst du Zugang zum Kartenspiel. Wer auch eigene Sparrings erstellen will, nimmt das Paket. Die derzeit verfügbaren Karten sind für Kickboxen / K1.`

`CardsScreen` lädt den Preis bisher über einen Filter auf `'individual'` — auf `planForProduct(pkg.product.identifier) === 'cards'` umstellen (Import aus `../utils/subscriptionPlans`).

- [ ] **Step 4: Prüfen**

Run: `npx tsc --noEmit && npx jest`
Expected: ohne Fehler, alle Tests grün.

- [ ] **Step 5: Commit** (nach Freigabe)

```bash
git add src/components/paywall/PlanCard.tsx src/screens/PaywallScreen.tsx src/screens/CardsScreen.tsx src/components/challenge/CardGameGate.tsx src/components/challenge/CardsLanding.tsx
git commit -m "feat(abo): Paywall mit Ersteller, Karten und Paket"
```

---

### Task 8: Einstellungen — Plan und „Abo verwalten“

**Files:**
- Modify: `src/screens/SettingsScreen.tsx` (Imports ~Zeile 2–21, `planLabel` ~Zeile 198–204, Abo-Block ~Zeile 296–316)

**Interfaces:**
- Consumes: `planLabel` (Task 1), `useStoreEntitlements` (Task 5).
- Produces: —

- [ ] **Step 1: Label aus beiden Quellen**

Imports: `Platform` zum bestehenden `react-native`-Import hinzufügen; `import { useStoreEntitlements } from '../hooks/useStoreEntitlements';` und `import { planLabel } from '../utils/subscriptionPlans';`.

Nach `const { entitlement } = useEntitlement();`:

```ts
  const { entitlements: storeEntitlements } = useStoreEntitlements();
```

Die bestehende Konstante `planLabel` umbenennen und ersetzen (Namenskonflikt mit dem Import):

```ts
  const activePlanLabel = entitlement.tier === 'studio_suite'
    ? 'Studio Suite'
    : entitlement.tier === 'studio_visibility'
      ? 'Studio Sichtbarkeit'
      : planLabel(storeEntitlements.creatorActive, storeEntitlements.cardsActive || entitlement.hasAccess);
```

und im JSX `value={planLabel}` → `value={activePlanLabel}`.

- [ ] **Step 2: „Abo verwalten“**

Im Abo-Block nach der Zeile „Aktiver Plan“ (vor dem `seatsLabel`-Block):

```tsx
          <View style={styles.divider} />
          <SettingsRow
            icon="open-in-new"
            label="Abo verwalten"
            onPress={() => {
              void Linking.openURL(
                Platform.OS === 'ios'
                  ? 'https://apps.apple.com/account/subscriptions'
                  : 'https://play.google.com/store/account/subscriptions',
              );
            }}
          />
```

Und „Aktiver Plan“ führt zur Paywall statt ins Leere: `onPress={() => { (navigation as unknown as { navigate: (s: string) => void }).navigate('Paywall'); }}` (gleiches Muster wie die Impressum-Zeile in derselben Datei).

- [ ] **Step 3: Prüfen**

Run: `npx tsc --noEmit`
Expected: ohne Ausgabe.

- [ ] **Step 4: Commit** (nach Freigabe)

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat(abo): Einstellungen zeigen Ersteller/Karten und Abo verwalten"
```

---

### Task 9: Store-Checkliste, Doku, Abschlussprüfung

**Files:**
- Modify (Vault, per Bash): `Abo-System.md`, `Offene-Punkte.md`, `Funktionen.md`, `Dev-Log/2026-09-29.md` unter `/Users/romeogeorgiadis/Documents/Obsidian Vault/02 Projekte/Sparr/`
- Modify (Vault): `Supabase-Contract (Shared).md` — neue Tabellen/RPCs/Policy-Änderung eintragen (CLAUDE.md-Pflicht, Website teilt das Backend)

**Interfaces:** —

- [ ] **Step 1: Store-Checkliste in `Abo-System.md`** (Abschnitt „Karten-Abo statt …“ ersetzen durch „Drei Abos (2026-09-29)“):

```markdown
## Drei Abos: Ersteller, Karten, Paket (2026-09-29)

Spec: docs/superpowers/specs/2026-09-29-sparr-abos-design.md · Plan: docs/superpowers/plans/2026-09-29-sparr-abos.md

| Abo | Produkt-ID | Preis | RC-Berechtigung |
|---|---|---|---|
| Ersteller | sparr_creator_monthly (neu) | 3,99 €/Monat | Sparr Creator |
| Karten | sparr_individual_monthly (umgewidmet) | 4,99 €/Monat | Sparr Pro |
| Paket | sparr_bundle_monthly (neu) | 7,99 €/Monat | Sparr Creator + Sparr Pro |

### Checkliste (Romeo)
- [ ] App Store Connect: Gruppe „Sparr Abonnements“ — Stufe 1 Paket, Stufe 2 Ersteller + Karten
- [ ] `sparr_individual_monthly`: Anzeigename „Karten“, Beschreibung Kartenspiel, Preis 4,99 € (Preissenkung gilt für Bestandskunden)
- [ ] `sparr_creator_monthly` und `sparr_bundle_monthly` anlegen (Preis, Lokalisierung DE/EN, Review-Screenshot der Paywall)
- [ ] `sparr_individual_yearly`, `sparr_studio_monthly`, `sparr_studio_yearly` nicht einreichen / vom Verkauf nehmen
- [ ] Play Console: dieselben drei Abos (Basistarif monatlich)
- [ ] RevenueCat: Berechtigung `Sparr Creator` anlegen; Produkte zuordnen (Tabelle oben); Offering „Default“ = genau die drei Pakete; Studio-Pakete entfernen
- [ ] RevenueCat: Tatsächliche Produkt-IDs prüfen — müssen im letzten Segment `sparr_creator_monthly` / `sparr_individual_monthly` / `sparr_bundle_monthly` heißen (sonst `planForProduct` + Webhook-Map anpassen)
- [ ] RevenueCat → Webhook (bestehend, rc-boost-webhook): Abo-Ereignisse aktiv (Initial Purchase, Renewal, Product Change, Cancellation, Uncancellation, Expiration)
- [ ] Neue Produkte mit dem nächsten Build zur Prüfung einreichen
- [ ] Nach Live-Gang iOS + Android: `update app_flags set enabled = true where key = 'sparring_creation_requires_sub';`
```

- [ ] **Step 2: `Offene-Punkte.md`** — Punkte „Karten-Abo (2026-09-29)“ und „Studio-Abo-Bestand prüfen“ durch „Drei Abos: siehe Checkliste in [[Abo-System]]; Sandbox-Tests iOS + Android (Spec Abschnitt 5); Schalter nach Live-Gang einschalten“ ersetzen.

- [ ] **Step 3: `Funktionen.md`** — Abschnitt „Abos: nur noch Karten-Abo“ ersetzen durch „Abos: Ersteller / Karten / Paket (2026-09-29, lokal, nicht committet)“ mit zwei Sätzen und Link `[[Abo-System]]`.

- [ ] **Step 4: `Supabase-Contract (Shared).md`** — neue Tabellen `store_entitlements`, `app_flags`, RPCs `can_create_sparring`, `get_my_store_entitlements`, `apply_store_entitlement` (service_role), geänderte Policy „users insert own sparrings“. Hinweis: Website liest/schreibt diese nicht.

- [ ] **Step 5: Dev-Log** `Dev-Log/2026-09-29.md` — Eintrag mit `---`-Trenner nach Vorlage (Was / Warum / Offene Probleme / Nächste Schritte).

- [ ] **Step 6: Abschlussprüfung**

Run: `npx tsc --noEmit && npx jest && supabase/tests/run_store_entitlements.sh`
Expected: alles grün. Danach Bericht an Romeo: was deployt ist (Migration/Webhook, Schalter aus), was lokal/uncommittet ist, was auf Gerät noch zu testen ist (Spec Abschnitt 5, iOS + Android), und dass ohne Store-/RC-Einrichtung die Paywall „Derzeit nicht verfügbar“ zeigt.
