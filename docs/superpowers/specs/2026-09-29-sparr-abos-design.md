# Sparr-Abos: Ersteller, Karten, Paket — Design

Stand: 2026-09-29 (Preise aktualisiert 2026-10-05) · Status: Entwurf zur Prüfung

## Ziel

Drei Monatsabos statt der bisherigen Einzel-/Studio-Abos:

| Abo | Preis | Schaltet frei |
|---|---|---|
| Ersteller | 3,99 €/Monat | Sparrings erstellen |
| Karten | 4,99 €/Monat | Kartenspiel |
| Paket | 7,99 €/Monat | Sparrings erstellen + Kartenspiel |

Beitreten zu Sparrings bleibt für alle kostenlos. Das Paket ist der Rabatt-Weg (0,99 € günstiger als beide einzeln).

**Erfolg:** Wer kein Ersteller- oder Paket-Abo hat, kann nach der Freigabe kein privates Sparring anlegen — auch nicht mit altem Build oder direktem DB-Zugriff. Kauf, Wechsel und Ablauf wirken ohne manuelles Eingreifen.

## Entscheidungen

- Ersteller-Abo gilt **nur für Sparrings**. Events bleiben Einmalkauf (8,99 €), Map-Boost unverändert.
- **Studio-Sparrings sind frei:** Wer ein Sparring im Namen eines Studios anlegt, das er verwalten darf, braucht kein Ersteller-Abo (Studio zahlt B2B-Stufe).
- Nur **Monatsabos**, keine Jahresabos.
- Das bestehende **Einzel-Abo wird zum Karten-Abo** umgewidmet (Produkt-ID und RC-Berechtigung bleiben).
- Server-Durchsetzung über **RevenueCat-Webhook → DB** (Ansatz A). Kein externer Call beim Erstellen.
- Die Serversperre greift erst per **Schalter**, wenn der neue Build in beiden Stores live ist.

## 1. Produkte und Berechtigungen

**Stores (App Store Connect + Play), eine Abo-Gruppe „Sparr Abonnements“:**

| Gruppenstufe | Produkt-ID | Preis | Status |
|---|---|---|---|
| 1 (höchste) | `sparr_bundle_monthly` | 7,99 € | neu |
| 2 | `sparr_creator_monthly` | 3,99 € | neu |
| 2 | `sparr_individual_monthly` | 4,99 € | bestehend, Name/Beschreibung → Kartenspiel, Preis 12,99 € → 4,99 € |

- Innerhalb einer Gruppe hat ein Nutzer höchstens ein aktives Abo; Wechsel Karten/Ersteller → Paket ist ein Upgrade (sofort, anteilig), zurück ein Downgrade (zum Laufzeitende).
- `sparr_individual_yearly`, `sparr_studio_monthly`, `sparr_studio_yearly` werden nicht eingereicht bzw. vom Verkauf genommen.
- Bestandskunden des Einzel-Abos zahlen nach der Preissenkung automatisch 4,99 €.

**RevenueCat:**

| Berechtigung | Bedeutung | Produkte |
|---|---|---|
| `Sparr Pro` (Identifier bleibt) | Kartenspiel | `sparr_individual_monthly`, `sparr_bundle_monthly` |
| `Sparr Creator` (neu) | Sparrings erstellen | `sparr_creator_monthly`, `sparr_bundle_monthly` |

Offering „Default“ enthält genau die drei Pakete. Play-Produkte hängen an denselben Berechtigungen.

## 2. Server (Supabase)

### Tabelle `store_entitlements`

| Spalte | Typ | Hinweis |
|---|---|---|
| `user_id` | uuid | FK `auth.users`, on delete cascade |
| `entitlement` | text | `creator` \| `cards` (CHECK) |
| `product_id` | text | letztes auslösendes Produkt |
| `expires_at` | timestamptz | Ablauf laut RevenueCat |
| `updated_at` | timestamptz | default now() |

PK `(user_id, entitlement)`. RLS: SELECT nur eigene Zeilen; kein INSERT/UPDATE/DELETE für `authenticated` (nur service_role).

### Tabelle `app_flags`

`key text primary key, enabled boolean not null`. Startwert: `('sparring_creation_requires_sub', false)`. RLS: SELECT für `authenticated`, Schreiben nur service_role/SQL-Editor.

### Webhook `rc-boost-webhook` (erweitert)

Produkt → Berechtigungen:

```
sparr_bundle_monthly     → creator, cards
sparr_creator_monthly    → creator
sparr_individual_monthly → cards
```

- `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `UNCANCELLATION`: Upsert je Berechtigung mit `expires_at = expiration_at_ms`.
- `PRODUCT_CHANGE`: Berechtigungen, die das neue Produkt nicht mehr enthält, laufen zum Laufzeitende aus — die Zeile behält ihr bisheriges `expires_at` und wird nicht verlängert.
- `EXPIRATION`: `expires_at = now()` für die Berechtigungen des Produkts.
- `CANCELLATION`: keine Änderung (gilt bis Laufzeitende) — außer `cancel_reason = CUSTOMER_SUPPORT` (Erstattung): sofortiger Ablauf.
- `app_user_id` ohne UUID-Form (anonymer RC-Nutzer): überspringen, 200.
- `TRANSFER` (z. B. Wiederherstellen auf anderem Konto): `transfer_store_entitlements(p_from uuid[], p_to uuid)` (nur service_role) verschiebt laufende Zeilen auf den neuen Nutzer, Ablauf bleibt.
- Produkt → Berechtigung über das letzte Segment der Produkt-ID (nach `.`, vor `:`), damit Store-Präfixe und Play-Basistarife passen.
- Unbekannte Produkte / bestehende Einmalkäufe (Map-Boost, Event): bisheriges Verhalten unverändert.
- Signaturprüfung wie bisher; `app_user_id` = Supabase-User-ID (via `loginRevenueCat`).

### Funktion `can_create_sparring() returns boolean`

`SECURITY DEFINER`, `STABLE`, `search_path` fixiert. True, wenn `app_flags.sparring_creation_requires_sub` false ist **oder** es `store_entitlements` mit `user_id = auth.uid()`, `entitlement = 'creator'`, `expires_at > now()` gibt.

### Durchsetzung

Live-Policies auf Prod (ausgelesen 2026-09-29):

- „coaches insert sparrings“: `auth.uid() = created_by AND studio_id IS NOT NULL AND NOT is_featured AND` Coach dieses Studios → **bleibt unverändert** (Studio-Sparrings frei).
- „users insert own sparrings“: `auth.uid() = created_by AND studio_id IS NULL AND NOT is_featured` → wird neu angelegt mit zusätzlich `AND public.can_create_sparring()`.
- Bearbeiten (`update_sparring`), Absagen, Beitreten: unverändert.

### Funktion `get_my_store_entitlements()`

Liefert eine Zeile `(can_create_sparring boolean, creator_active boolean, cards_active boolean, creation_requires_sub boolean)` für den Aufrufer.

### Funktion `apply_store_entitlement(p_user_id, p_entitlements text[], p_product_id, p_expires_at)`

Nur `service_role` (Webhook). `p_expires_at` gesetzt → Upsert, `expires_at` wird nie verkürzt (`GREATEST`). `p_expires_at` NULL → Ablauf: beendet nur Zeilen, deren `product_id` noch dem abgelaufenen Produkt gehört (schützt vor Reihenfolge-Problemen beim Wechsel).

### Tests

SQL-Tests unter `supabase/tests/`: Schalter aus → Insert ohne Abo erlaubt; Schalter an → Insert ohne Abo abgelehnt; gültiges `creator` → erlaubt; abgelaufenes `creator` → abgelehnt; Ablauf eines alten Produkts beendet keine Berechtigung, die inzwischen einem anderen Produkt gehört; Nutzer kann `store_entitlements` nicht selbst schreiben und `apply_store_entitlement` nicht aufrufen. (Die Coach-Policy wird nicht angefasst.)

## 3. App

### Hook `useStoreEntitlements(refetchTrigger = 0)`

- Rückgabe: `{ canCreateSparring, cardsActive, loading, refetch }`.
- `canCreateSparring` = RC-Berechtigung `Sparr Creator` aktiv **oder** `get_my_store_entitlements().can_create_sparring`. RevenueCat macht den Zugang direkt nach dem Kauf sichtbar; die DB deckt Schalter und Studio-Ausnahme ab.
- Muster wie `useEntitlement` (Deps auf `user?.id`, `queryCache`).
- Kartenspiel (`CardGameGate`, `CardsScreen`) bleibt bei `useEntitlement` / `Sparr Pro` — keine Änderung.

### Sparring erstellen

- Einstiege: `SparringMapScreen` („Sparring erstellen“, „Sparring anbieten“ in `SparringListView`), Home `NearbySparringsCard` (navigiert mit `openCreate: true` zur Karte). Das Gate sitzt an der einen Stelle in `SparringMapScreen`, die das Sheet öffnet — damit sind alle Einstiege inklusive `openCreate` abgedeckt.
- Ohne `canCreateSparring`: Knopf öffnet `Paywall` mit `focus: 'creator'` statt `CreateSparringSheet`.
- Serverablehnung beim Insert (RLS-Fehler) → Meldung „Zum Erstellen brauchst du das Ersteller-Abo.“ mit Aktion „Abos ansehen“; kein Postgres-Text. Sheet vorher schließen (Modal-Regel), dann navigieren.
- `StudioOwnerBar` (Studio-Sparrings): unverändert, frei.

### Paywall (`PaywallScreen`)

- Route-Param `focus?: 'creator' | 'cards'` (in `navigation/types.ts`).
- Drei Karten: Ersteller, Karten, Paket. Reihenfolge: fokussiertes Einzel-Abo zuerst, Paket immer hervorgehoben mit „Beides – du sparst 0,99 €“ (Ersparnis aus Live-Preisen berechnet; Hinweis entfällt, wenn Preise fehlen).
- Kein Monat/Jahr-Umschalter mehr.
- Preise live aus dem Store (`priceString`), nichts hardcoded.
- Aktives Abo: Karte zeigt „Aktiv“, Kauf-Knopf deaktiviert.
- Wechsel zwischen Einzel-Abos bzw. vom Paket auf ein Einzel-Abo: vorher Hinweis „ersetzt dein …“ mit Bestätigung. Android übergibt beim Wechsel das bisherige Produkt (`googleProductChangeInfo`), damit kein zweites Abo entsteht. Vor jedem Kauf `loginRevenueCat(user.id)`, nie anonym kaufen.
- Sperre vor dem Erstellen-Sheet greift erst, wenn die Berechtigungen geladen sind. Lehnt der Server ab, obwohl RevenueCat das Ersteller-Abo kennt: „Abo wird aktiviert – bitte gleich erneut versuchen“ statt Paywall.
- RC-Debug-`Alert`s und `console.log`s entfernen.
- „Käufe wiederherstellen“ prüft `Sparr Pro` **oder** `Sparr Creator`.
- Einstieg aus Kartenspiel (`CardsLanding`, `CardGameGate`): `focus: 'cards'`.

### Einstellungen → Abo

- „Aktiver Plan“: „Ersteller“, „Karten“, „Ersteller + Karten“ oder „Kein aktives Abo“ (Studio-Stufen-Labels bleiben wie bisher, wenn vorhanden).
- Neue Zeile „Abo verwalten“ → Store-Abo-Verwaltung (`https://apps.apple.com/account/subscriptions` bzw. `https://play.google.com/store/account/subscriptions`).

### Hilfsfunktionen + Tests

`src/utils/subscriptionPlans.ts` (+ `subscriptionPlans.test.ts`):
- `planLabel(creator: boolean, cards: boolean): string`
- `orderPlans(focus: 'creator' | 'cards' | undefined): PlanKey[]`
- `bundleSavings(creatorPrice, cardsPrice, bundlePrice): number | null`

## 4. Einführung

1. Server-Migration + Webhook deployen (Schalter aus → keine Auswirkung).
2. Stores + RevenueCat einrichten (Romeo, Checkliste): Produkte, Gruppenstufen, Preise, Lokalisierung, RC-Berechtigungen, Offering, Webhook-Ereignisse für Abos aktiv.
3. App-Build iOS + Android nach Release-Checkliste (Version hochziehen); neue Produkte mit dem Build zur Prüfung einreichen.
4. Nach Live-Gang in beiden Stores: `update app_flags set enabled = true where key = 'sparring_creation_requires_sub';`

## 5. Prüfung

- Sandbox iOS + Android: Ersteller → Sparring anlegen; Karten → Kartenspiel; Paket → beides; Wechsel Karten → Paket; Ablauf (Sandbox-Kurzlaufzeit) → Erstellen gesperrt.
- Wiederherstellen, zweites Gerät.
- Alter Build bei Schalter aus: Erstellen geht.
- Studio-Sparring ohne Abo: geht.
- Android-Back auf Paywall; Sheet → Paywall erscheint über dem Inhalt.
- `tsc`, `jest`, SQL-Tests grün.

## Risiken

- **Preissenkung** des Einzel-Abos gilt für Bestandskunden.
- **Webhook-Verzögerung/-Ausfall:** RC sagt „erlaubt“, Server lehnt ab → verständliche Meldung, erneuter Versuch; in RevenueCat lässt sich ein Event erneut senden.
- **Policy-Drift** zwischen lokalen Migrationen und Prod → vor Änderung live auslesen.

## Nicht im Umfang

Jahresabos, Events im Abo, serverseitige Sperre des Kartenspiels, Änderungen an Map-Boost/Event-Kauf/Studio-Stufen.
