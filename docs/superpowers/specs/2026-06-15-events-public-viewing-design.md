# Design: Events / Public Viewing auf der Map

Datum: 2026-06-15
Status: Genehmigt (Brainstorming abgeschlossen)

## Ziel

Nutzer sollen auf der Map nicht nur Sparrings und Studios sehen, sondern auch
**Events** anmelden und finden — primär **Public Viewing** von Kampfsport-
Übertragungen (z.B. "UFC 320 gemeinsam schauen"). Jeder verifizierte Nutzer kann
ein Event anlegen; die Erstellung kostet eine **Pflichtgebühr von 9,99 €** (IAP).

## Entscheidungen (aus Brainstorming)

- **Ersteller:** jeder verifizierte Nutzer (wie Sparrings).
- **Teilnahme:** Anmeldung wie Sparring (RSVP, Slots, Teilnehmerliste) **inkl.
  Gruppenchat**.
- **Darstellung:** eigener Marker-Typ + Filter, separat von Sparrings/Studios.
- **Event-Typ:** Fokus Public Viewing, Freitextfeld "Was wird gezeigt".
- **Gebühr:** 9,99 € pro Event-Erstellung (Consumable-IAP via RevenueCat).
- **Architektur:** Ansatz A — eigenes, paralleles Event-System (kein Eingriff in
  die bestehende, funktionierende Sparring-Logik).

## Map-Layout (UX)

- **Oben mittig:** Modus-Umschalter `Sparrings | Events` (Segment). Bestimmt,
  welcher Marker-Typ sichtbar ist — so lassen sich beide trennen.
  - Sparrings-Modus: Sparring-Marker + Studio-Dots (wie bisher).
  - Events-Modus: nur Event-Marker.
- **Links am Screen, vertikal untereinander:** Zeit-Filter `Alle / Jetzt /
  Demnächst / Bald`. Das ist der heutige Filter, neu angeordnet (links vertikal
  statt oben horizontal). Wirkt auf den aktuell gewählten Modus (beide haben
  `scheduled_at`, beide nutzen `getTimeWindow`).
- **FAB unten rechts:** passt sich dem Modus an — "Sparring anmelden" bzw.
  "Event anmelden".

## Datenbank (neue Migration)

Neue Migration unter `supabase/migrations/` (Namensschema: Datum + Beschreibung).

### Tabelle `events`
- `id uuid PK`, `created_by uuid NOT NULL → auth.users`
- `title text NOT NULL`
- `event_type text NOT NULL DEFAULT 'public_viewing'`
- `fight_card text` — Freitext "Was wird gezeigt" (z.B. "UFC 320 – Jones vs. Aspinall")
- `venue_name text` — optional (Restaurant/Bar)
- `address text`, `lat double precision`, `lng double precision`
- `scheduled_at timestamptz NOT NULL`, `duration_min int`, `max_slots int`
- `notes text`
- `is_active boolean NOT NULL DEFAULT false` — erst nach Zahlung true
- `is_paid boolean NOT NULL DEFAULT false`
- `created_at timestamptz NOT NULL DEFAULT now()`
- RLS analog zu Sparrings: jeder liest aktive Events; Schreibzugriff nur über RPCs.

### Tabelle `event_signups`
- `event_id uuid → events ON DELETE CASCADE`, `user_id uuid → auth.users`
- `UNIQUE (event_id, user_id)`, `created_at`
- RLS: Nutzer liest eigene + Anmeldungen sichtbarer Events; Schreiben via RPC.

### Tabelle `event_messages` (Gruppenchat)
- Gespiegelt von `sparring_messages` / Migration `20260602140000_add_sparring_group_chat.sql`.
- `event_id`, `user_id`, `body`, `created_at`; RLS: nur angemeldete Teilnehmer.

### RPCs (alle `SECURITY DEFINER`, `search_path = public`)
- `create_event(...)` → `uuid` — Insert mit `is_active=false`, prüft Verifizierung
  des Erstellers; gibt `event_id` zurück.
- `activate_event(p_event_id uuid, p_user_id uuid)` — **nur `service_role`**
  (vom Webhook), setzt `is_active=true, is_paid=true` für das Event des Erstellers.
- `signup_event(p_event_id)` / `cancel_event_signup(p_event_id)`.
- `deactivate_event(p_event_id)` — nur Ersteller, setzt `is_active=false`.
- Chat-RPCs analog Sparring-Chat.

## Bezahlung (9,99 € pro Event)

Spiegelt das bestehende Map-Boost-Muster (`useMapBoostPurchase` +
`rc-boost-webhook` + `activate_map_boost`):

1. `CreateEventSheet` absenden → `create_event` legt **inaktives** Event an,
   gibt `event_id` zurück.
2. `EventPaymentSheet` (gespiegelt von `MapBoostSheet`) öffnet sich. Neues
   Consumable-IAP-Produkt **`sparr_event_create`** (9,99 €), RC-Offering-ID z.B.
   `event-create`. RC-Attribut `event_id` setzen → `Purchases.purchasePackage`.
3. RevenueCat-Webhook → Edge Function → `activate_event` RPC (service_role) →
   Event wird `is_active=true`.
4. Client pollt `is_active`-Status (wie Boost), dann erscheint das Event auf der
   Map.

- Nur aktive/bezahlte Events werden je angezeigt → keine Gratis-Events.
- **Edge Function:** Bestehende `rc-boost-webhook` erweitern (Verzweigung nach
  `subscriber_attributes`: `event_id` → `activate_event`, `sparring_id` →
  `activate_map_boost`) ODER neue Function `rc-event-webhook`. Entscheidung im
  Plan.
- **Caveat (im Plan verifizieren):** echte Consumables feuern in RevenueCat
  i.d.R. `NON_RENEWING_PURCHASE`, nicht `INITIAL_PURCHASE` — Event-Typ-Filter
  im Webhook entsprechend setzen.

## Hooks (gespiegelt, mit queryCache/stale-while-revalidate)

- `useOpenEvents(refetchTrigger)` — Analogon zu `useOpenSparrings`: lädt aktive
  Events + eigene/alle Signups. Liefert `EventWithMeta[]`.
- `useEventActions` — `createEvent`, `signUp`, `cancelSignup`, `deactivateEvent`.
- `useEventCreatePurchase` — Analogon zu `useMapBoostPurchase`.
- `useEventGroupChat` — Analogon zu `useSparringGroupChat`.

## UI-Komponenten

- **`SparringMapView` (.ios/.android/.types):** zusätzlicher `events`-Prop +
  Event-Marker mit eigenem Icon/Farbe (aus `colors.ts`). Modus steuert, welche
  Marker gerendert werden.
- **`EventDetailSheet`** — gespiegelt von `SparringDetailSheet`: Titel, "Was wird
  gezeigt", Venue, Zeit, Teilnehmerliste, Anmelden/Abmelden, Chat-Einstieg;
  Ersteller kann absagen.
- **`CreateEventSheet`** — gespiegelt von `CreateSparringSheet`: Titel, "Was wird
  gezeigt", Venue-Name, Standort-Picker (`LocationPickerModal` wiederverwenden),
  Datum/Zeit, Slots, Notizen; Submit → `EventPaymentSheet`.
- **`EventPaymentSheet`** — gespiegelt von `MapBoostSheet`, zeigt 9,99 €-Kauf.
- **`SparringMapScreen`** — Modus-Umschalter oben, vertikaler Zeit-Filter links,
  modusabhängiger FAB, Event-Sheets eingebunden. Falls der Screen >150 Zeilen
  wächst (CLAUDE.md): in Teilkomponenten zerlegen (z.B. Map-Controls auslagern).

## Chat-Integration

- Event-Gruppenchat spiegelt den Sparring-Gruppenchat.
- In der bestehenden **`SparringChatList`** öffnet sich pro Event ein eigener
  Chat, **benannt nach dem Event-Titel**. Sparring- und Event-Chats teilen die
  Liste, intern über einen Typ-Discriminator unterschieden. Genaue Umsetzung
  (gemeinsame Liste vs. separate Sektion) im Plan.

## Verifizierung

Wie bei Sparrings: nur verifizierte Nutzer können Events anlegen oder teilnehmen
(`requireVerified()`-Gate wiederverwenden).

## Tests

- Reine Logik/Utilities bekommen Unit-Tests (CLAUDE.md). Falls Event-spezifische
  Hilfsfunktionen entstehen (z.B. Zeit-Window-Mapping bereits in
  `sparringTimeWindow.ts` vorhanden → wiederverwenden). Keine UI-Screen-Tests.

## Nicht im Scope (YAGNI)

- Kein Boost für Events (die Erstellung ist bereits kostenpflichtig).
- Keine Venue-/Business-Rollen (jeder verifizierte Nutzer reicht).
- Keine weiteren Event-Kategorien über Public Viewing hinaus (Freitext genügt).
- Keine Bezahlung/Geldfluss zwischen Nutzern.
