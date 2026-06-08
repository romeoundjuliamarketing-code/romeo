# Map-Boost-Badge — Design Spec

**Datum:** 2026-06-01  
**Status:** Zur Genehmigung  
**Autor:** Claude Code (Brainstorming-Session)

---

## Zusammenfassung

Nutzer können ein spezifisches eigenes Sparring-Event für 30 Tage auf der Karte hervorheben
(„Karten-Boost"). Der Boost kostet €12.99 (Consumable IAP) und nutzt den bestehenden
`FeaturedMarker` (Logo + „Sparr Pick"-Label). Die Aktivierung wird server-seitig über einen
RevenueCat-Webhook → Supabase Edge Function verifiziert.

---

## Bestandssituation

- `open_sparrings.is_featured` existiert bereits; aktuell nur per Admin (service role) setzbar.
- `FeaturedMarker` ist identisch in `.ios.tsx` und `.android.tsx` implementiert — kein neuer Marker nötig.
- RevenueCat ist bereits integriert (`react-native-purchases`, `loginRevenueCat`, `Purchases.purchasePackage`).
- Bestehende Product-IDs: `sparr_individual_monthly/yearly`, `sparr_studio_monthly/yearly`.
- `useOpenSparrings` fetcht `is_featured` als direktes DB-Feld (kein RPC).

---

## A. RevenueCat / Store Setup

### Neue Produkt-ID
`sparr_map_boost_30d`

### Produkt-Typ
Consumable (Apple: „Consumable In-App Purchase"; Google: „Managed Product").  
Der User kann es mehrfach kaufen — um nach Ablauf erneut zu boosten.

### Preis
€12.99

### In RevenueCat
- Neues Product `sparr_map_boost_30d` (iOS + Android) anlegen.
- Neue Offering: `map_boost`, Package-ID: `boost_30d`.
- Webhook-URL nach Edge Function Deployment eintragen.
- Webhook Secret generieren → in Supabase Edge Function Secrets als `REVENUECAT_WEBHOOK_SECRET`.

### Manuell durch Romeo (Claude Code kann das nicht)

**App Store Connect:**
1. App Store Connect → In-App-Purchases → `+` → Consumable
2. Product ID: `sparr_map_boost_30d`
3. Preis: nächster Tier zu €12.99 (~€12.99 Tier)
4. Lokalisierung DE: Name „Karten-Boost (30 Tage)", kurze Beschreibung
5. Screenshot für Review hochladen
6. Zur Review einreichen (wird zusammen mit nächstem App-Update oder separat approved)

**Google Play Console:**
1. Monetarisierung → In-App-Produkte → Managed Product
2. Produkt-ID: `sparr_map_boost_30d`
3. Preis: €12.99
4. Aktivieren

**RevenueCat Dashboard:**
1. Produkte anlegen (iOS + Android mit ID `sparr_map_boost_30d`)
2. Offering `map_boost` + Package `boost_30d` erstellen
3. Webhook-URL setzen (nach Edge Function Deployment): `https://<project-ref>.supabase.co/functions/v1/rc-boost-webhook`  
   *(project-ref = Supabase Projekt-URL, z.B. `abcdefghij.supabase.co`)*
4. Webhook Secret aus RC Dashboard kopieren → Supabase Project Settings → Edge Function Secrets → `REVENUECAT_WEBHOOK_SECRET`

**Supabase Edge Function Secrets** (Supabase Dashboard → Settings → Edge Functions):
- `REVENUECAT_WEBHOOK_SECRET` ← aus RC Dashboard
- `SUPABASE_SERVICE_ROLE_KEY` ← bereits unter Settings → API vorhanden, hier nochmals als Secret eintragen damit die Edge Function service-role Zugriff hat

---

## B. Datenbankschema

### Neue Tabelle `map_boosts`

```sql
CREATE TABLE map_boosts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sparring_id  uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  activated_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  is_active    boolean     NOT NULL DEFAULT true
);

ALTER TABLE map_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own boosts" ON map_boosts
  FOR SELECT USING (auth.uid() = user_id);
```

Alle Schreiboperationen gehen ausschließlich über SECURITY DEFINER RPCs.

### Expiry-Mechanismus (ohne pg_cron)

`open_sparrings.is_featured` bleibt der Admin-Pick-Flag und wird NICHT für User-Boosts verändert.  
`useOpenSparrings` ergänzt einen zweiten Query für aktive (noch nicht abgelaufene) Boosts und
OR-verknüpft: `effective_is_featured = dbRow.is_featured || boostedIds.has(sparring_id)`.  
Abgelaufene Boosts (`expires_at < now()`) verschwinden automatisch ohne Cron-Job.

### Migrations-Dateiname
`supabase/migrations/20260601120000_add_map_boosts.sql`

---

## C. Supabase RPCs

### `activate_map_boost(p_sparring_id uuid, p_user_id uuid, p_duration_days int)`

- `SECURITY DEFINER` — wird NUR von der Edge Function via service role aufgerufen
- Parameter `p_user_id` nötig, da Edge Function keinen `auth.uid()` Context hat
- Prüft: `p_user_id = open_sparrings.created_by`
- Prüft: `open_sparrings.is_active = true`
- Prüft: kein aktiver Boost (`NOT EXISTS WHERE sparring_id = p_sparring_id AND is_active AND expires_at > now()`)
- Insert in `map_boosts` mit `expires_at = now() + (p_duration_days || ' days')::interval`
- Return: `json` mit `{ success: true, expires_at: text }`

### `get_my_boost_status(p_sparring_id uuid)`

- `SECURITY DEFINER`
- Callable vom Client (nutzt `auth.uid()` als user_id filter)
- Return: `{ is_active: bool, expires_at: text | null, days_remaining: int | null }`

Beide RPCs werden in `src/types/database.types.ts` ergänzt.

---

## D. Edge Function `rc-boost-webhook`

**Datei:** `supabase/functions/rc-boost-webhook/index.ts`

**Ablauf:**
1. Empfängt POST von RevenueCat
2. Verifiziert Header `X-RevenueCat-Signature` gegen `REVENUECAT_WEBHOOK_SECRET`
3. Liest Event-Typ — verarbeitet nur `INITIAL_PURCHASE`
4. Liest `product_id` — muss `sparr_map_boost_30d` sein
5. Liest `app_user_id` (= Supabase User ID) und `sparring_id` aus RC Custom Attributes
6. Ruft `activate_map_boost(sparring_id, user_id, 30)` via Supabase service role client auf
7. Return 200 on success, 400 on bad signature, 422 on wrong product

**RC Custom Attributes:**  
Vor dem Kauf setzt der Client `Purchases.setAttributes({ sparring_id: '<uuid>' })`.  
RC überträgt diese Attribute im Webhook-Payload unter `event.subscriber_attributes`:
```json
{ "sparring_id": { "value": "<uuid>", "updated_at_ms": 1234567890 } }
```
Das Attribut MUSS vor `Purchases.purchasePackage()` gesetzt sein — die Edge Function liest es
aus dem Payload; ein späterer Aufruf würde im Webhook nicht mehr ankommen.

**Sicherheit:**
- Webhook Secret Validation verhindert Fake-Requests
- Edge Function hat keinen öffentlichen Endpunkt-Auth — nur RC kennt die URL + das Secret
- `SUPABASE_SERVICE_ROLE_KEY` als Edge Function Secret gespeichert (nie im Code)

---

## E. Client Hook `useMapBoostPurchase`

**Datei:** `src/hooks/useMapBoostPurchase.ts`

```ts
interface BoostStatus {
  isActive: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
}

interface UseMapBoostPurchase {
  purchase: (sparringId: string) => Promise<{ error: string | null }>;
  loadStatus: (sparringId: string) => Promise<void>;
  boostStatus: BoostStatus;
  purchasing: boolean;
  statusLoading: boolean;
}
```

**Purchase-Ablauf:**
1. `Purchases.setAttributes({ sparring_id })` — damit RC den Sparring-Kontext im Webhook kennt
2. Offering `map_boost` aus RC laden: `Purchases.getOfferings()`
3. `Purchases.purchasePackage(boostPackage)`
4. Bei Erfolg: sofort `loadStatus(sparringId)` pollen mit 1s Delay zwischen Versuchen
   (max. 3 Versuche / ~3 Sekunden), bis Boost aktiv. Zeigt währenddessen „Boost wird aktiviert…".
   Falls nach 3 Versuchen noch nicht aktiv: Toast/Alert „Dein Boost wird in Kürze aktiviert."
   (Webhook-Verzögerung) — kein Fehler
5. Bei `userCancelled`: still ignore (kein Alert)
6. Bei anderem Fehler: Alert mit `err.message`
7. Boost bereits aktiv: Alert „Dein Karten-Boost ist bereits aktiv bis [expiresAt]"

**`loadStatus`:** Ruft `get_my_boost_status(sparring_id)` RPC auf, schreibt in `boostStatus`.

---

## F. Map-Integration

### `useOpenSparrings` — Boost-Erweiterung

Nach dem Sparring-Fetch wird ein zweiter Query auf `map_boosts` ausgeführt:

```ts
const sparringIds = rows.map(r => r.id);
const now = new Date().toISOString();
const { data: activeBoosts } = await supabase
  .from('map_boosts')
  .select('sparring_id')
  .eq('is_active', true)
  .gt('expires_at', now)
  .in('sparring_id', sparringIds);

const boostedIds = new Set((activeBoosts ?? []).map(b => b.sparring_id));
```

Im Mapping: `is_featured: r.is_featured || boostedIds.has(r.id)`

**Keine Änderungen** an `SparringMapView.ios.tsx`, `.android.tsx` oder `SparringMapView.types.ts` nötig.

---

## G. UI — `MapBoostSheet`

**Datei:** `src/components/sparring/MapBoostSheet.tsx`

**Einstiegspunkt:** `SparringDetailSheet` — neuer Button/Row „Karten-Boost", sichtbar nur wenn  
`sparring.created_by === currentUserId`.

**Zustände:**
- **Preis wird geladen:** ActivityIndicator
- **Kein aktiver Boost:** Preis anzeigen, Kauf-Button „Karten-Boost aktivieren"
- **Aktiver Boost:** Icon + „Aktiv — noch X Tage" (kein Kauf-Button, stattdessen Info-Text)
- **Nach Kauf / Loading:** Spinner + „Boost wird aktiviert…" (Polling bis RC Webhook durchläuft)

**Design:** `StyleSheet.create`, `colors.ts`, Inter, 8px-Raster, keine Emojis, `@expo/vector-icons`.

---

## H. Dateien — vollständige Liste

### Neu angelegt

| Datei | Zweck |
|---|---|
| `supabase/migrations/20260601120000_add_map_boosts.sql` | Tabelle, RLS, RPCs |
| `supabase/functions/rc-boost-webhook/index.ts` | Webhook-Empfänger (Option B) |
| `src/hooks/useMapBoostPurchase.ts` | Purchase + Status Hook |
| `src/components/sparring/MapBoostSheet.tsx` | Kauf-UI |

### Geändert

| Datei | Änderung |
|---|---|
| `src/hooks/useOpenSparrings.ts` | Boost-Query ergänzen, `is_featured` OR-verknüpfen |
| `src/components/sparring/SparringDetailSheet.tsx` | „Karten-Boost"-Button für Creator |
| `src/types/database.types.ts` | `map_boosts`-Tabelle + neue RPCs |

---

## Nicht geändert

- `SparringMapView.ios.tsx` — `FeaturedMarker` existiert bereits
- `SparringMapView.android.tsx` — identisch
- `SparringMapView.types.ts`
- `src/lib/revenuecat.ts` — keine Änderung nötig
- `PaywallScreen.tsx` — separater Screen, kein Boost-Kontext
- `colors.ts` — kein neuer Farbwert nötig

---

## Sicherheitsüberlegungen

| Risiko | Mitigierung |
|---|---|
| Fake-Webhook-Calls | `X-RevenueCat-Signature` Verification mit HMAC-SHA256 |
| RPC ohne Zahlung aufrufbar | `activate_map_boost` ist nur von service role aufrufbar (Edge Function) |
| Doppelt-Aktivierung | RPC prüft existing active boost, blockt zweiten Insert |
| Boost auf fremdes Sparring | RPC prüft `p_user_id = open_sparrings.created_by` |
| Boost läuft nie ab (kein Cron) | Client-seitige `expires_at > now()` Filterung in `useOpenSparrings` |

---

## Offene manuelle Schritte (Romeo)

1. `sparr_map_boost_30d` in App Store Connect anlegen + zur Review einreichen
2. `sparr_map_boost_30d` in Google Play Console anlegen + aktivieren
3. Offering `map_boost` in RC Dashboard konfigurieren
4. Nach Deployment: Webhook-URL in RC eintragen + Secret in Supabase Secrets setzen
