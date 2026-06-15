# Events / Public Viewing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verifizierte Nutzer können Events (Public Viewing von Kampfsport-Übertragungen) auf der Map anlegen — gegen eine 9,99 €-Pflichtgebühr — und andere können sich anmelden, chatten und teilnehmen.

**Architecture:** Eigenes, paralleles Event-System neben dem Sparring-System (kein Eingriff in funktionierende Sparring-Logik). DB-Tabellen `events` / `event_signups` / `event_messages` mit SECURITY-DEFINER-RPCs. Bezahlung via Consumable-IAP → RevenueCat-Webhook → `activate_event` RPC (exakt das Map-Boost-Muster). UI spiegelt die Sparring-Komponenten; die Map bekommt oben einen Modus-Umschalter `Sparrings | Events` und links einen vertikalen Zeit-Filter.

**Tech Stack:** React Native + Expo SDK 55, Supabase (Postgres/RPC/RLS), RevenueCat (`react-native-purchases`), Deno Edge Functions, TypeScript strict.

**Referenz-Dateien zum Spiegeln (Implementierer liest diese und passt an):**
- DB-Muster: `supabase/migrations/20260602140000_add_sparring_group_chat.sql`, `20260601120000_add_map_boosts.sql`
- Hooks: `src/hooks/useOpenSparrings.ts`, `useSparringActions.ts`, `useMapBoostPurchase.ts`, `useSparringGroupChat.ts`
- UI: `src/components/sparring/SparringDetailSheet.tsx`, `CreateSparringSheet.tsx`, `MapBoostSheet.tsx`, `SparringMapView.ios.tsx`/`.android.tsx`/`.tsx`/`.types.ts`, `src/screens/SparringMapScreen.tsx`
- Chat: `src/hooks/useSparringChatList.ts`, `src/screens/SparringChatListScreen.tsx`, `SparringGroupChatScreen.tsx`
- Edge Function: `supabase/functions/rc-boost-webhook/index.ts`

**Projekt-Regeln (CLAUDE.md):** Keine Emojis. Icons nur `@expo/vector-icons`. Farben nur aus `src/theme/colors.ts`. Kein Inline-Style, nur `StyleSheet.create`. Abstände in 8er-Vielfachen. TS strict, kein `any`. UI-Texte Deutsch, Umlaute echt (ä/ö/ü). Nach jeder Codeänderung `npx tsc --noEmit`. Komponenten >150 Zeilen aufteilen.

---

## Task 1: Migration — Tabellen `events`, `event_signups`, `event_messages` + RPCs

**Files:**
- Create: `supabase/migrations/20260615120000_add_events.sql`

- [ ] **Step 1: Schema + RLS + RPCs schreiben**

Spiegle die Muster aus `20260601120000_add_map_boosts.sql` (RLS + DEFINER-RPCs, service_role-Gate) und `20260602140000_add_sparring_group_chat.sql` (Chat-RLS). Inhalt:

```sql
-- events: paid public-viewing events on the map. Created inactive; activated
-- after a 9.99 EUR consumable IAP via the RevenueCat webhook -> activate_event.
CREATE TABLE events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  event_type   text NOT NULL DEFAULT 'public_viewing',
  fight_card   text,                 -- "Was wird gezeigt"
  venue_name   text,
  address      text,
  lat          double precision,
  lng          double precision,
  scheduled_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 120,
  max_slots    int NOT NULL DEFAULT 20,
  notes        text,
  is_active    boolean NOT NULL DEFAULT false,
  is_paid      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_active_time_idx ON events (scheduled_at) WHERE is_active = true;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active events" ON events
  FOR SELECT USING (is_active = true);
CREATE POLICY "creator reads own events" ON events
  FOR SELECT USING (auth.uid() = created_by);
-- All writes via SECURITY DEFINER RPCs only.

CREATE TABLE event_signups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
ALTER TABLE event_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read signups of active events" ON event_signups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND (e.is_active OR e.created_by = auth.uid()))
  );

CREATE TABLE event_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;
-- Only signed-up participants (or creator) read/write; mirror sparring_messages policies.
CREATE POLICY "participants read event messages" ON event_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM event_signups s WHERE s.event_id = event_messages.event_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_messages.event_id AND e.created_by = auth.uid())
  );
CREATE POLICY "participants write event messages" ON event_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND (
      EXISTS (SELECT 1 FROM event_signups s WHERE s.event_id = event_messages.event_id AND s.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_messages.event_id AND e.created_by = auth.uid())
    )
  );
```

RPCs (alle `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`):

```sql
-- create_event: insert inactive event, return id. Requires verified creator.
CREATE OR REPLACE FUNCTION create_event(
  p_title text, p_fight_card text, p_venue_name text, p_address text,
  p_lat double precision, p_lng double precision, p_scheduled_at timestamptz,
  p_duration_min int, p_max_slots int, p_notes text
) RETURNS uuid AS $$
DECLARE v_id uuid; v_tier text;
BEGIN
  SELECT verification_tier INTO v_tier FROM profiles WHERE id = auth.uid();
  IF v_tier IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'verification required';
  END IF;
  INSERT INTO events (created_by, title, fight_card, venue_name, address, lat, lng,
                      scheduled_at, duration_min, max_slots, notes)
  VALUES (auth.uid(), p_title, p_fight_card, p_venue_name, p_address, p_lat, p_lng,
          p_scheduled_at, p_duration_min, p_max_slots, p_notes)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- activate_event: service_role only (RC webhook). Activates the creator's event.
CREATE OR REPLACE FUNCTION activate_event(p_event_id uuid, p_user_id uuid)
RETURNS json AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE events SET is_active = true, is_paid = true
   WHERE id = p_event_id AND created_by = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found or not owned by user'; END IF;
  RETURN json_build_object('success', true);
END; $$;

-- signup / cancel
CREATE OR REPLACE FUNCTION signup_event(p_event_id uuid) RETURNS void AS $$
BEGIN
  INSERT INTO event_signups (event_id, user_id) VALUES (p_event_id, auth.uid())
  ON CONFLICT (event_id, user_id) DO NOTHING;
END; $$;
CREATE OR REPLACE FUNCTION cancel_event_signup(p_event_id uuid) RETURNS void AS $$
BEGIN
  DELETE FROM event_signups WHERE event_id = p_event_id AND user_id = auth.uid();
END; $$;

-- deactivate: creator only
CREATE OR REPLACE FUNCTION deactivate_event(p_event_id uuid) RETURNS void AS $$
BEGIN
  UPDATE events SET is_active = false
   WHERE id = p_event_id AND created_by = auth.uid();
END; $$;
```

> **Hinweis Implementierer:** Spaltenname für Verifizierung in `profiles` gegen das Schema prüfen (siehe `useVerification.ts` / Migration `20260606143200_add_user_verification.sql`) — ggf. `verification_tier` anpassen. Chat-RPCs (`get_event_messages`, `send_event_message`) nach Vorbild des Sparring-Chats ergänzen, falls dort RPCs statt direkter Table-Inserts genutzt werden — sonst direkte Inserts über RLS.

- [ ] **Step 2: TypeScript-Typen ergänzen**

In `src/types/database.types.ts` Einträge für `events`, `event_signups`, `event_messages` + neue RPCs nach bestehendem manuellem Muster ergänzen.

- [ ] **Step 3: Migration anwenden + tsc**

Run: `npx tsc --noEmit`
Expected: keine Fehler.
Migration via Supabase MCP `apply_migration` oder Dashboard (User bestätigt das Deployment separat — kostenpflichtige/Remote-Aktion).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260615120000_add_events.sql src/types/database.types.ts
git commit -m "feat(events): add events/signups/messages tables and RPCs"
```

---

## Task 2: Edge Function — Event-Aktivierung im RC-Webhook

**Files:**
- Modify: `supabase/functions/rc-boost-webhook/index.ts`

- [ ] **Step 1: Webhook um Event-Verzweigung erweitern**

In `index.ts`: nach dem Auslesen von `subscriber_attributes` verzweigen:
- Wenn `event_id` gesetzt **und** `product_id === EVENT_PRODUCT_ID` → `supabase.rpc('activate_event', { p_event_id, p_user_id: userId })`.
- Sonst bestehender Boost-Pfad (`sparring_id` → `activate_map_boost`).

Konstante ergänzen: `const EVENT_PRODUCT_ID = 'com.deinebundle.sparr.event_create';` (finalen Produkt-Identifier mit User abstimmen).

> **Caveat:** Consumables feuern in RC typischerweise `NON_RENEWING_PURCHASE`, nicht `INITIAL_PURCHASE`. Den Event-Typ-Filter so erweitern, dass auch `NON_RENEWING_PURCHASE` akzeptiert wird (für beide Produkte verifizieren).

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/rc-boost-webhook/index.ts
git commit -m "feat(events): activate paid events via RC webhook"
```

> Deployment der Edge Function ist eine Remote-/Kostenaktion → User bestätigt separat.

---

## Task 3: Hook `useOpenEvents`

**Files:**
- Create: `src/hooks/useOpenEvents.ts`

- [ ] **Step 1: Hook nach Vorbild `useOpenSparrings.ts` schreiben**

Spiegle `src/hooks/useOpenSparrings.ts` 1:1, mit diesen Deltas:
- Exportiere `interface EventWithMeta` mit Feldern: `id, created_by, title, fight_card (string|null), venue_name (string|null), address, lat, lng, scheduled_at, duration_min, max_slots, notes, is_active, created_at, signup_count, is_signed_up`.
- Query: `supabase.from('events').select('*').eq('is_active', true).gte('scheduled_at', now).order('scheduled_at')`.
- Signups aus `event_signups` (Felder `event_id`) statt `sparring_signups`.
- queryCache-Key: `useOpenEvents:${user.id}`.
- Kein Boost-/Studio-Join nötig.

- [ ] **Step 2: tsc**

Run: `npx tsc --noEmit` → keine Fehler.

- [ ] **Step 3: Commit** `git commit -m "feat(events): useOpenEvents hook"`

---

## Task 4: Hook `useEventActions`

**Files:**
- Create: `src/hooks/useEventActions.ts`

- [ ] **Step 1: Nach Vorbild `useSparringActions.ts`**

Methoden: `createEvent(params) -> { error, eventId }` (ruft `create_event` RPC), `signUp(eventId)`, `cancelSignup(eventId)`, `deactivateEvent(eventId)`. `params`-Typ exportieren: `{ title, fightCard, venueName, address, lat, lng, scheduledAt, durationMin, maxSlots, notes }`. Fehlertexte Deutsch.

- [ ] **Step 2: tsc** → keine Fehler.
- [ ] **Step 3: Commit** `git commit -m "feat(events): useEventActions hook"`

---

## Task 5: Hook `useEventCreatePurchase`

**Files:**
- Create: `src/hooks/useEventCreatePurchase.ts`

- [ ] **Step 1: Nach Vorbild `useMapBoostPurchase.ts`**

Deltas:
- `EVENT_OFFERING_ID = 'event-create'`.
- `purchase(eventId)`: `Purchases.setAttributes({ event_id: eventId })` (nicht `sparring_id`), dann `purchasePackage`.
- Status-Poll prüft `is_active` des Events: per `supabase.from('events').select('is_active').eq('id', eventId).single()` statt `get_my_boost_status`.
- Rückgabe: `purchase`, `loadPackage`, `eventPackage`, `purchasing`, `activating`, `packageLoading`.

- [ ] **Step 2: tsc** → keine Fehler.
- [ ] **Step 3: Commit** `git commit -m "feat(events): useEventCreatePurchase hook"`

---

## Task 6: Hook `useEventGroupChat`

**Files:**
- Create: `src/hooks/useEventGroupChat.ts`

- [ ] **Step 1: Nach Vorbild `useSparringGroupChat.ts`**

Gleiche Signatur/Realtime-Logik, aber Tabelle `event_messages` (Spalte `event_id`). Parameter `eventId` statt `sparringId`.

- [ ] **Step 2: tsc** → keine Fehler.
- [ ] **Step 3: Commit** `git commit -m "feat(events): useEventGroupChat hook"`

---

## Task 7: Map-View um Event-Marker erweitern

**Files:**
- Modify: `src/components/sparring/SparringMapView.types.ts`
- Modify: `src/components/sparring/SparringMapView.ios.tsx`
- Modify: `src/components/sparring/SparringMapView.android.tsx`
- Modify: `src/components/sparring/SparringMapView.tsx` (Stub)

- [ ] **Step 1: Props-Typ erweitern**

In `SparringMapView.types.ts`: optionale Props `events?: EventWithMeta[]` und `onEventPress?: (e: EventWithMeta) => void` ergänzen (Import `EventWithMeta` aus `../../hooks/useOpenEvents`).

- [ ] **Step 2: Event-Marker rendern (iOS + Android)**

In beiden Plattform-Dateien: über `events` mappen und Marker mit eigenem Icon/Farbe rendern (Farbe aus `colors.ts`, z.B. `colors.accentBlue`-Abgrenzung — eigene Marker-Form/Icon `@expo/vector-icons`, z.B. `tv-outline` für Public Viewing). `onEventPress` beim Tap aufrufen. Sparring-/Studio-Marker-Rendering unverändert lassen.

- [ ] **Step 3: tsc** → keine Fehler.
- [ ] **Step 4: Commit** `git commit -m "feat(events): render event markers on map view"`

---

## Task 8: `CreateEventSheet` + `EventPaymentSheet`

**Files:**
- Create: `src/components/sparring/CreateEventSheet.tsx`
- Create: `src/components/sparring/EventPaymentSheet.tsx`

- [ ] **Step 1: `CreateEventSheet` nach Vorbild `CreateSparringSheet.tsx`**

Felder: Titel, "Was wird gezeigt" (`fightCard`), Venue-Name (optional), Standort (`LocationPickerModal` wiederverwenden), Datum/Zeit, Slots, Notizen. Submit ruft `onCreate(params)`. Hinweis-Text, dass die Erstellung 9,99 € kostet. Keine `discipline`/`verified_only`-Felder.

- [ ] **Step 2: `EventPaymentSheet` nach Vorbild `MapBoostSheet.tsx`**

Zeigt 9,99 €-Kauf via `useEventCreatePurchase`, Polling bis `is_active`. Props: `eventId`, `visible`, `onClose`, `onActivated`.

- [ ] **Step 3: tsc** → keine Fehler.
- [ ] **Step 4: Commit** `git commit -m "feat(events): create + payment sheets"`

---

## Task 9: `EventDetailSheet`

**Files:**
- Create: `src/components/sparring/EventDetailSheet.tsx`

- [ ] **Step 1: Nach Vorbild `SparringDetailSheet.tsx`**

Zeigt Titel, "Was wird gezeigt", Venue, Adresse, Zeit, Teilnehmerliste (`SparringParticipantsList` wiederverwenden, falls generisch genug — sonst analoge Liste), Anmelden/Abmelden-Button, Button "Zum Chat", Ersteller sieht "Event absagen". Reanimated-Drag wie Referenz (siehe Memory `project_reanimated_sheets`).

- [ ] **Step 2: tsc** → keine Fehler.
- [ ] **Step 3: Commit** `git commit -m "feat(events): event detail sheet"`

---

## Task 10: `SparringMapScreen` — Modus-Umschalter + vertikaler Zeit-Filter + Event-Flow

**Files:**
- Modify: `src/screens/SparringMapScreen.tsx`
- ggf. Create: `src/components/sparring/MapModeToggle.tsx`, `src/components/sparring/MapTimeFilter.tsx` (Auslagerung, falls Screen >150 Zeilen wächst)

- [ ] **Step 1: State + Daten**

`mapMode: 'sparrings' | 'events'` State (default `'sparrings'`). `useOpenEvents` + `useEventActions` einbinden. Zeit-Filter (`timeFilter`) bleibt, wirkt jetzt je nach Modus auf `sparrings` oder `events` (beide via `getTimeWindow(scheduled_at)`).

- [ ] **Step 2: UI-Layout umbauen**

- Oben mittig: Segment `Sparrings | Events` (neuer `MapModeToggle`).
- Links vertikal: Zeit-Filter `Alle / Jetzt / Demnächst / Bald` (bisheriger horizontaler Filter → vertikal links umpositionieren; Styles anpassen, 8er-Abstände).
- `SparringMapView`: im Events-Modus `events={filteredEvents}` + `onEventPress`, `sparrings={[]}`; im Sparrings-Modus wie bisher.
- FAB-Text/Action je Modus ("Sparring anmelden" / "Event anmelden"). Event-FAB öffnet `CreateEventSheet`.

- [ ] **Step 3: Event-Erstellungs-Flow verdrahten**

`CreateEventSheet.onCreate` → `createEvent` → bei Erfolg `EventPaymentSheet` mit `eventId` öffnen (analog Boost-Flow mit `setTimeout`-Defer gegen Doppel-Modal auf iOS) → nach Aktivierung `refetchEvents()`. `EventDetailSheet` einbinden (signup/cancel/deactivate). `requireVerified()` für Event-FAB wiederverwenden.

- [ ] **Step 4: tsc** → keine Fehler.
- [ ] **Step 5: Commit** `git commit -m "feat(events): map mode toggle, vertical time filter, event flow"`

---

## Task 11: Chat-Liste — Event-Chats integrieren

**Files:**
- Modify: `src/hooks/useSparringChatList.ts`
- Modify: `src/screens/SparringChatListScreen.tsx`
- Modify/Reuse: `src/screens/SparringGroupChatScreen.tsx`
- Modify: `src/navigation/types.ts` (Route-Param für Event-Chat)

- [ ] **Step 1: Chat-Liste um Event-Chats erweitern**

In `useSparringChatList.ts`: zusätzlich Events laden, bei denen der Nutzer angemeldet ist (oder Ersteller) und die `event_messages` haben — als Listeneinträge mit `type: 'event'` und `title = events.title`. Bestehende Sparring-Einträge `type: 'sparring'`. Gemeinsamer Item-Typ mit `type`-Discriminator.

- [ ] **Step 2: Liste rendert beide Typen**

`SparringChatListScreen`: bei Tap auf Event-Chat zum Gruppenchat navigieren mit Event-Kontext; Chat-Titel = Event-Name.

- [ ] **Step 3: GroupChat-Screen für Events**

`SparringGroupChatScreen` generisch machen (akzeptiert `sparringId` ODER `eventId` über Route-Param + Typ) und intern `useEventGroupChat` bzw. `useSparringGroupChat` wählen. Header zeigt Event-/Sparring-Titel. Route-Param-Typ in `navigation/types.ts` erweitern.

- [ ] **Step 4: tsc** → keine Fehler.
- [ ] **Step 5: Commit** `git commit -m "feat(events): event chats in chat list and group chat"`

---

## Task 12: Verifikation gesamt + Abschluss

- [ ] **Step 1: Full tsc** — Run: `npx tsc --noEmit` → keine Fehler.
- [ ] **Step 2: Tests** — Run: `npx jest` → grün (nur falls Event-Utilities mit Logik entstanden; reine UI nicht testen).
- [ ] **Step 3: Manuelle Smoke-Checkliste** (Dev-Build, kein Expo Go — siehe Memory `project_build_workflow`): Modus-Umschalter wechselt Marker; Zeit-Filter links filtert; Event anlegen → Zahlung → erscheint auf Map; Anmelden/Abmelden; Chat öffnet sich mit Event-Namen.
- [ ] **Step 4: Obsidian-Update** — `Funktionen.md` (neues Feature Events/Public Viewing), `Abo-System.md` (neues IAP-Produkt 9,99 €), Dev-Log `02 Projekte/Sparr/Dev-Log/2026-06-15.md`.

---

## Offene Punkte (vor/bei Umsetzung klären)
- Finaler IAP-Produkt-Identifier + Anlage in App Store Connect/RevenueCat (User).
- Verifizierungs-Spaltenname in `profiles` gegen echtes Schema prüfen.
- RC-Event-Typ für Consumable (`NON_RENEWING_PURCHASE`) im Webhook verifizieren.
- Marker-Icon/Farbe für Events final festlegen (innerhalb Designsystem).
