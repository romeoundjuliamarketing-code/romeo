# Partner-Venues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bars/Locations bekommen persistente, B2B-freigeschaltete Profile (Foto-Galerie, Eckdaten, Events, Bewertungen) analog zu Studios, und ihre Events hängen am Profil.

**Architecture:** Paralleles Venue-System (eigene Tabellen `venues`/`venue_photos`/`venue_ratings`, eigene RPCs/Hooks/Screen), `events.venue_id` als optionaler FK. Bestehende Studio- und Event-Logik wird nicht angefasst. Foto-Upload-Helfer wird als gemeinsame Util extrahiert.

**Tech Stack:** React Native + Expo SDK 55, React Navigation, Supabase (Postgres/Storage/RLS/SECURITY-DEFINER-RPCs), TypeScript strict, Jest.

## Global Constraints

- Nach JEDER Codeänderung `npx tsc --noEmit` (Pflicht). `npx jest` muss grün bleiben.
- `any` verboten, Typen explizit. Strict TypeScript.
- Keine Emojis/Unicode-Symbole; Icons nur `@expo/vector-icons` (Ionicons).
- Farben nur aus `src/theme/colors.ts` — keine Hardcoded-Hex. Kein Inline-`style={{}}`, immer `StyleSheet.create`. Abstände in 8px-Vielfachen.
- UI-Texte Deutsch (Umlaute als ä/ö/ü, nie ae/oe/ue); Code-Kommentare Englisch.
- Avatar/Foto-Upload IMMER via `expo-file-system/legacy` + `base64-arraybuffer`, NIE `fetch().blob()`.
- Business-Logik in SECURITY-DEFINER-RPCs; RPCs `SET search_path = public`, REVOKE PUBLIC/anon, GRANT nur `authenticated` (Ausnahme: service-role-RPCs ohne Grant).
- Hooks folgen dem Muster `useXxx(refetchTrigger = 0)` mit `queryCache` (getCached/setCached) + stale-while-revalidate.
- iOS + Android: neue Map-Marker auf beiden Implementierungen (`.ios`/`.android`); SafeArea/Edge-to-Edge; Hardware-Back in Screen/Sheets abfangen.
- Keine kostenpflichtigen Dienste aktivieren. Storage-Bucket `venues` (kostenlos, gleiche Supabase-Instanz).
- Migrationen nach `supabase/migrations/<UTC-Datum>_<beschreibung>.sql`. Manuell auf Remote anwenden (kein lokales Supabase) — Verifizierung per `execute_sql`/Dashboard.

---

### Task 1: DB-Migration — Tabellen, RLS, FK

**Files:**
- Create: `supabase/migrations/20260623120000_add_partner_venues.sql`

**Interfaces:**
- Produces: Tabellen `venues`, `venue_photos`, `venue_ratings`; Spalte `events.venue_id`. Diese Namen/Spalten nutzen alle folgenden Tasks.

- [ ] **Step 1: Migrationsdatei mit Tabellen + RLS + FK schreiben**

```sql
-- Partner-Venues: persistent profiles for bars/locations hosting events.
-- B2B activation only (grant_venue_partner, service_role). No IAP.

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------
CREATE TABLE venues (
  id            uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text             NOT NULL,
  venue_type    text             NOT NULL DEFAULT 'bar',  -- bar/restaurant/lounge/sportsbar
  city          text,
  address       text,
  lat           double precision,
  lng           double precision,
  description   text,
  capacity      int,
  opening_hours jsonb,
  avatar_url    text,
  banner_url    text,
  instagram     text,
  tags          text[],
  is_active     boolean          NOT NULL DEFAULT false,
  created_at    timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX venues_active_idx ON venues (id) WHERE is_active = true;
CREATE INDEX venues_owner_idx  ON venues (owner_user_id);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads active venues" ON venues
  FOR SELECT USING (is_active = true);

CREATE POLICY "owner reads own venue" ON venues
  FOR SELECT USING (owner_user_id = auth.uid());

-- Owner may edit profile fields. is_active is guarded by a trigger (Step 2)
-- so the client cannot self-activate.
CREATE POLICY "owner updates own venue" ON venues
  FOR UPDATE USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- venue_photos
-- ---------------------------------------------------------------------------
CREATE TABLE venue_photos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  url        text        NOT NULL,
  sort_order int         NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX venue_photos_venue_idx ON venue_photos (venue_id, sort_order);

ALTER TABLE venue_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read photos of active venues" ON venue_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM venues v
      WHERE v.id = venue_id AND (v.is_active OR v.owner_user_id = auth.uid())
    )
  );

CREATE POLICY "owner inserts venue photos" ON venue_photos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = auth.uid())
  );

CREATE POLICY "owner deletes venue photos" ON venue_photos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = auth.uid())
  );

CREATE POLICY "owner updates venue photos" ON venue_photos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- venue_ratings (mirrors studio_ratings)
-- ---------------------------------------------------------------------------
CREATE TABLE venue_ratings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars      int         NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, user_id)
);

CREATE INDEX venue_ratings_venue_idx ON venue_ratings (venue_id);

ALTER TABLE venue_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read ratings of active venues" ON venue_ratings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.is_active)
  );

CREATE POLICY "user writes own venue rating" ON venue_ratings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user updates own venue rating" ON venue_ratings
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user deletes own venue rating" ON venue_ratings
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- events.venue_id
-- ---------------------------------------------------------------------------
ALTER TABLE events ADD COLUMN venue_id uuid NULL REFERENCES venues(id) ON DELETE SET NULL;
CREATE INDEX events_venue_idx ON events (venue_id) WHERE venue_id IS NOT NULL;
```

- [ ] **Step 2: is_active-Guard-Trigger anhängen (Client darf nicht selbst aktivieren)**

An dieselbe Datei anhängen:

```sql
-- ---------------------------------------------------------------------------
-- Guard: a normal client UPDATE must not flip is_active. Only SECURITY DEFINER
-- functions (which run as the table owner / bypass this via the role check)
-- may change it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION venues_guard_is_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (grant_venue_partner) may change anything.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- For everyone else, preserve the existing is_active value.
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER venues_guard_is_active_trg
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION venues_guard_is_active();
```

- [ ] **Step 3: Auf Remote anwenden + verifizieren**

Migration auf Remote anwenden (Supabase MCP `apply_migration` oder Dashboard SQL-Editor).
Run (Verifizierung): 
```sql
SELECT column_name FROM information_schema.columns WHERE table_name='events' AND column_name='venue_id';
SELECT tablename FROM pg_tables WHERE tablename IN ('venues','venue_photos','venue_ratings');
```
Expected: `venue_id` vorhanden; alle drei Tabellen gelistet.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260623120000_add_partner_venues.sql
git commit -m "feat(venues): add venues/venue_photos/venue_ratings tables + events.venue_id"
```

---

### Task 2: DB-Migration — RPCs grant_venue_partner + create_venue_event

**Files:**
- Create: `supabase/migrations/20260623121000_add_venue_rpcs.sql`

**Interfaces:**
- Consumes: Tabellen aus Task 1.
- Produces: RPC `grant_venue_partner(p_owner_user_id uuid, p_name text, p_city text, p_venue_type text, p_address text, p_lat double precision, p_lng double precision)` → `uuid` (service_role); RPC `create_venue_event(p_venue_id uuid, p_title text, p_fight_card text, p_scheduled_at timestamptz, p_duration_min int, p_max_slots int, p_notes text)` → `uuid` (authenticated).

- [ ] **Step 1: RPC-Migration schreiben**

```sql
-- ---------------------------------------------------------------------------
-- grant_venue_partner: B2B onboarding, service_role only. Creates an ACTIVE venue.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION grant_venue_partner(
  p_owner_user_id uuid,
  p_name          text,
  p_city          text,
  p_venue_type    text DEFAULT 'bar',
  p_address       text DEFAULT NULL,
  p_lat           double precision DEFAULT NULL,
  p_lng           double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO venues (owner_user_id, name, city, venue_type, address, lat, lng, is_active)
  VALUES (p_owner_user_id, p_name, p_city, p_venue_type, p_address, p_lat, p_lng, true)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- create_venue_event: owner of an active venue creates a FREE event tied to it.
-- No verification/IAP path. Location is taken from the venue.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_venue_event(
  p_venue_id     uuid,
  p_title        text,
  p_fight_card   text,
  p_scheduled_at timestamptz,
  p_duration_min int,
  p_max_slots    int,
  p_notes        text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  v_uid   uuid := auth.uid();
  v_venue venues%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_venue FROM venues WHERE id = p_venue_id;
  IF NOT FOUND OR v_venue.owner_user_id <> v_uid OR NOT v_venue.is_active THEN
    RAISE EXCEPTION 'not_venue_owner';
  END IF;

  INSERT INTO events (
    created_by, title, event_type, fight_card, venue_name, address, lat, lng,
    scheduled_at, duration_min, max_slots, notes, is_active, is_paid, venue_id
  )
  VALUES (
    v_uid, p_title, 'public_viewing', p_fight_card, v_venue.name, v_venue.address,
    v_venue.lat, v_venue.lng, p_scheduled_at, p_duration_min, p_max_slots, p_notes,
    true, false, p_venue_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION grant_venue_partner(uuid, text, text, text, text, double precision, double precision) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION create_venue_event(uuid, text, text, timestamptz, int, int, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION create_venue_event(uuid, text, text, timestamptz, int, int, text) TO authenticated;
-- grant_venue_partner: service_role only, no grant.
```

- [ ] **Step 2: Auf Remote anwenden + verifizieren**

```sql
SELECT proname FROM pg_proc WHERE proname IN ('grant_venue_partner','create_venue_event');
```
Expected: beide Funktionen gelistet.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260623121000_add_venue_rpcs.sql
git commit -m "feat(venues): add grant_venue_partner + create_venue_event RPCs"
```

---

### Task 3: TypeScript-Typen für venues

**Files:**
- Modify: `src/types/database.types.ts`

**Interfaces:**
- Produces: Typen `Venue`, `VenuePhoto`, `VenueRating` und `venue_id` an der Event-Row, von Hooks konsumiert.

- [ ] **Step 1: Bestehendes Event-Row-Typ-Muster ansehen**

Run: `grep -n "events\|venue\|studio" src/types/database.types.ts | head -30`
Ziel: vorhandenes Namensschema (Interface vs. Table-Map) erkennen und exakt spiegeln.

- [ ] **Step 2: Typen ergänzen (an das vorgefundene Schema angepasst)**

Füge Typen analog zum dort vorhandenen Stil hinzu. Beispiel, falls flache Interfaces verwendet werden:

```typescript
export interface Venue {
  id: string;
  owner_user_id: string;
  name: string;
  venue_type: string;
  city: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  capacity: number | null;
  opening_hours: Record<string, string> | null;
  avatar_url: string | null;
  banner_url: string | null;
  instagram: string | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
}

export interface VenuePhoto {
  id: string;
  venue_id: string;
  url: string;
  sort_order: number;
  created_at: string;
}

export interface VenueRating {
  id: string;
  venue_id: string;
  user_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
}
```

Falls die Event-Row dort als eigenes Interface existiert, ergänze `venue_id: string | null;`.

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.types.ts
git commit -m "feat(venues): add Venue/VenuePhoto/VenueRating types"
```

---

### Task 4: Geteilten Foto-Upload-Helfer extrahieren

**Files:**
- Create: `src/lib/uploadImage.ts`
- Modify: `src/screens/StudioDetailScreen.tsx` (inline `uploadImage` durch Import ersetzen)

**Interfaces:**
- Produces: `uploadImage(localUri: string, bucket: string, path: string): Promise<{ url: string | null; error: string | null }>` — von VenueDetailScreen (Task 8) und StudioDetailScreen genutzt.

- [ ] **Step 1: Bestehenden inline-Helfer kopieren**

Run: `grep -n "async function uploadImage" src/screens/StudioDetailScreen.tsx`
Lies die Funktion vollständig (ca. ab der gefundenen Zeile bis zur schließenden Klammer).

- [ ] **Step 2: Helfer nach `src/lib/uploadImage.ts` auslagern (1:1, exportiert)**

```typescript
import * as FileSystem from 'expo-file-system/legacy';
import { decode as base64Decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

// Upload a local image URI to Supabase Storage using the FileSystem + base64
// approach. Never use fetch().blob() — it does not work in the Expo context.
export async function uploadImage(
  localUri: string,
  bucket: string,
  path: string,
): Promise<{ url: string | null; error: string | null }> {
  // ... exact body copied verbatim from StudioDetailScreen.tsx ...
}
```
(Body 1:1 aus StudioDetailScreen übernehmen — Logik nicht ändern.)

- [ ] **Step 3: StudioDetailScreen auf Import umstellen**

Inline-`uploadImage` aus `src/screens/StudioDetailScreen.tsx` entfernen, oben importieren:
```typescript
import { uploadImage } from '../lib/uploadImage';
```
Ungenutzte Imports (`FileSystem`, `base64Decode`), falls nur noch hier verwendet, entfernen.

- [ ] **Step 4: tsc + jest**

Run: `npx tsc --noEmit && npx jest`
Expected: keine Fehler; Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/lib/uploadImage.ts src/screens/StudioDetailScreen.tsx
git commit -m "refactor(upload): extract shared uploadImage helper"
```

---

### Task 5: Hooks — useVenueProfile, useVenuePhotos, useMyVenue

**Files:**
- Create: `src/hooks/useVenueProfile.ts`
- Create: `src/hooks/useVenuePhotos.ts`
- Create: `src/hooks/useMyVenue.ts`

**Interfaces:**
- Consumes: Typen aus Task 3, `queryCache` (`src/lib/queryCache.ts`), `supabase`, `useAuth`.
- Produces: `useVenueProfile(venueId): { venue: Venue | null; loading; refetch }`; `useVenuePhotos(venueId): { photos: VenuePhoto[]; loading; refetch }`; `useMyVenue(): { venueId: string | null; loading; refetch }`.

- [ ] **Step 1: `useStudioProfile` als Vorlage lesen**

Run: `sed -n '1,60p' src/hooks/useStudioProfile.ts` (bereits bekannt — Muster: cacheKey, getCached/setCached, stale-while-revalidate).

- [ ] **Step 2: `useVenueProfile.ts` schreiben (mirror useStudioProfile)**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { Venue } from '../types/database.types';

export function useVenueProfile(venueId: string): {
  venue: Venue | null;
  loading: boolean;
  refetch: () => void;
} {
  const cacheKey = venueId.trim().length > 0 ? `useVenueProfile:${venueId}` : null;
  const cached = cacheKey ? getCached<Venue>(cacheKey) : undefined;
  const [venue, setVenue] = useState<Venue | null>(() => cached ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [trigger, setTrigger] = useState(0);
  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (venueId.trim().length === 0) return;
    let cancelled = false;
    const hasCache = cacheKey ? getCached<Venue>(cacheKey) !== undefined : false;
    if (!hasCache) setLoading(true);
    void (async () => {
      const { data } = await supabase.from('venues').select('*').eq('id', venueId).single();
      if (cancelled) return;
      setVenue((data as Venue | null) ?? null);
      if (data !== null && cacheKey) setCached<Venue>(cacheKey, data as Venue);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [venueId, trigger, cacheKey]);

  return { venue, loading, refetch };
}
```

- [ ] **Step 3: `useVenuePhotos.ts` schreiben**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { VenuePhoto } from '../types/database.types';

type Snapshot = { photos: VenuePhoto[] };

export function useVenuePhotos(venueId: string): {
  photos: VenuePhoto[];
  loading: boolean;
  refetch: () => void;
} {
  const cacheKey = venueId.trim().length > 0 ? `useVenuePhotos:${venueId}` : null;
  const cached = cacheKey ? getCached<Snapshot>(cacheKey) : undefined;
  const [photos, setPhotos] = useState<VenuePhoto[]>(() => cached?.photos ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [trigger, setTrigger] = useState(0);
  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (venueId.trim().length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('venue_photos').select('*').eq('venue_id', venueId)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      const rows = (data as VenuePhoto[] | null) ?? [];
      setPhotos(rows);
      if (cacheKey) setCached<Snapshot>(cacheKey, { photos: rows });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [venueId, trigger, cacheKey]);

  return { photos, loading, refetch };
}
```

- [ ] **Step 4: `useMyVenue.ts` schreiben**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getCached, setCached } from '../lib/queryCache';

type Snapshot = { venueId: string | null };

export function useMyVenue(refetchTrigger = 0): {
  venueId: string | null;
  loading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const cacheKey = user ? `useMyVenue:${user.id}` : null;
  const cached = cacheKey ? getCached<Snapshot>(cacheKey) : undefined;
  const [venueId, setVenueId] = useState<string | null>(() => cached?.venueId ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [localTrigger, setLocalTrigger] = useState(0);
  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;
    void (async () => {
      const { data } = await supabase
        .from('venues').select('id').eq('owner_user_id', user.id).maybeSingle();
      const id = (data as { id: string } | null)?.id ?? null;
      setVenueId(id);
      if (cacheKey) setCached<Snapshot>(cacheKey, { venueId: id });
      setLoading(false);
    })();
  }, [user, refetchTrigger, localTrigger]);

  return { venueId, loading, refetch };
}
```

- [ ] **Step 5: tsc**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useVenueProfile.ts src/hooks/useVenuePhotos.ts src/hooks/useMyVenue.ts
git commit -m "feat(venues): add venue profile/photos/my-venue hooks"
```

---

### Task 6: Hooks — useVenueEvents, useVenueRatings, useVenueMapMarkers

**Files:**
- Create: `src/hooks/useVenueEvents.ts`
- Create: `src/hooks/useVenueRatings.ts`
- Create: `src/hooks/useVenueMapMarkers.ts`

**Interfaces:**
- Consumes: `EventWithMeta` (`src/hooks/useOpenEvents.ts`), Typen aus Task 3, `useStudioRatings` als Muster.
- Produces: `useVenueEvents(venueId): { events: EventWithMeta[]; loading; refetch }`; `useVenueRatings(venueId): { average: number; count: number; myRating: number | null; loading; refetch; submit(stars, comment): Promise<{error}> }`; `useVenueMapMarkers(refetchTrigger): { venues: VenueMapMarker[]; loading; refetch }` mit `VenueMapMarker = { id; name; lat; lng; venue_type }`.

- [ ] **Step 1: `useStudioRatings` als Vorlage lesen**

Run: `cat src/hooks/useStudioRatings.ts`
Die Signatur von `useVenueRatings` exakt an `useStudioRatings` angleichen (gleiche Felder/Methoden, nur `studio_ratings`→`venue_ratings`, `studio_id`→`venue_id`).

- [ ] **Step 2: `useVenueEvents.ts` schreiben**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import type { EventWithMeta } from './useOpenEvents';

type Snapshot = { events: EventWithMeta[] };

export function useVenueEvents(venueId: string): {
  events: EventWithMeta[];
  loading: boolean;
  refetch: () => void;
} {
  const cacheKey = venueId.trim().length > 0 ? `useVenueEvents:${venueId}` : null;
  const cached = cacheKey ? getCached<Snapshot>(cacheKey) : undefined;
  const [events, setEvents] = useState<EventWithMeta[]>(() => cached?.events ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [trigger, setTrigger] = useState(0);
  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (venueId.trim().length === 0) return;
    let cancelled = false;
    void (async () => {
      const now = new Date().toISOString();
      const { data: rows } = await supabase
        .from('events').select('*')
        .eq('venue_id', venueId).eq('is_active', true)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true });
      if (cancelled) return;
      const ids = (rows ?? []).map((r) => r.id);
      const { data: signups } = ids.length > 0
        ? await supabase.from('event_signups').select('event_id').in('event_id', ids)
        : { data: [] as Array<{ event_id: string }> };
      const countMap: Record<string, number> = {};
      for (const s of signups ?? []) countMap[s.event_id] = (countMap[s.event_id] ?? 0) + 1;
      const result: EventWithMeta[] = (rows ?? []).map((r) => ({
        id: r.id, created_by: r.created_by, title: r.title, fight_card: r.fight_card,
        venue_name: r.venue_name, address: r.address ?? '', lat: r.lat, lng: r.lng,
        scheduled_at: r.scheduled_at, duration_min: r.duration_min, max_slots: r.max_slots,
        notes: r.notes, is_active: r.is_active, created_at: r.created_at,
        signup_count: countMap[r.id] ?? 0, is_signed_up: false,
      }));
      setEvents(result);
      if (cacheKey) setCached<Snapshot>(cacheKey, { events: result });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [venueId, trigger, cacheKey]);

  return { events, loading, refetch };
}
```
Hinweis: `EventWithMeta` aus `useOpenEvents` exportiert (bereits `export interface`). Falls `venue_id` zur Anzeige nötig wird, dort dem Interface + Mapping hinzufügen.

- [ ] **Step 3: `useVenueRatings.ts` schreiben (1:1 mirror useStudioRatings, Tabelle/Spalte ersetzt)**

Übernimm die in Step 1 gelesene Struktur exakt; ersetze `studio_ratings`→`venue_ratings`, Parameter `studioId`→`venueId`, Spalte `studio_id`→`venue_id`. Keine zusätzliche Logik.

- [ ] **Step 4: `useVenueMapMarkers.ts` schreiben (mirror useStudioMapMarkers)**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';

export interface VenueMapMarker {
  id: string;
  name: string;
  venue_type: string;
  lat: number;
  lng: number;
}

type Snapshot = { venues: VenueMapMarker[] };

export function useVenueMapMarkers(refetchTrigger = 0): {
  venues: VenueMapMarker[];
  loading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const cacheKey = user ? `useVenueMapMarkers:${user.id}` : null;
  const cached = cacheKey ? getCached<Snapshot>(cacheKey) : undefined;
  const [venues, setVenues] = useState<VenueMapMarker[]>(() => cached?.venues ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [localTrigger, setLocalTrigger] = useState(0);
  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;
    void (async () => {
      const { data, error } = await supabase
        .from('venues').select('id, name, venue_type, lat, lng')
        .eq('is_active', true).not('lat', 'is', null).not('lng', 'is', null);
      if (error !== null) { reportNetworkError(error); setLoading(false); return; }
      reportNetworkSuccess();
      const markers = (data ?? []) as VenueMapMarker[];
      setVenues(markers);
      if (cacheKey) setCached<Snapshot>(cacheKey, { venues: markers });
      setLoading(false);
    })();
  }, [user, refetchTrigger, localTrigger]);

  return { venues, loading, refetch };
}
```

- [ ] **Step 5: tsc**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useVenueEvents.ts src/hooks/useVenueRatings.ts src/hooks/useVenueMapMarkers.ts
git commit -m "feat(venues): add venue events/ratings/map-markers hooks"
```

---

### Task 7: Venue-Präsentationskomponenten

**Files:**
- Create: `src/components/venue/VenueHero.tsx`
- Create: `src/components/venue/VenuePhotoGallery.tsx`
- Create: `src/components/venue/VenueInfoSection.tsx`
- Create: `src/components/venue/VenueEventsList.tsx`

**Interfaces:**
- Consumes: Typen aus Task 3, `EventWithMeta`, `colors`.
- Produces: Komponenten, die VenueDetailScreen (Task 8) zusammensetzt:
  - `VenueHero({ venue: Venue, onEditAvatar?: () => void, onEditBanner?: () => void })`
  - `VenuePhotoGallery({ photos: VenuePhoto[], editable: boolean, onAdd?: () => void, onRemovePhoto?: (id: string) => void })`
  - `VenueInfoSection({ venue: Venue })`
  - `VenueEventsList({ events: EventWithMeta[], onPressEvent: (e: EventWithMeta) => void })`

- [ ] **Step 1: `StudioHero` als Stil-Vorlage lesen**

Run: `cat src/components/studio/StudioHero.tsx`
Designsprache (dunkler Hero, Banner + überlappender Avatar) übernehmen; Farben aus `colors`.

- [ ] **Step 2: `VenueHero.tsx` schreiben**

Spiegele `StudioHero`: `ImageBackground` mit `venue.banner_url` (Fallback `colors.dark`), überlappender runder Avatar aus `venue.avatar_url` (Fallback Initialen via vorhandenem `getInitials`-Muster), Name + `venue_type`-Label. Edit-Badges (Kamera-Ionicon) nur wenn `onEditAvatar`/`onEditBanner` gesetzt. `StyleSheet.create`, 8px-Raster.

- [ ] **Step 3: `VenuePhotoGallery.tsx` schreiben**

Horizontale `ScrollView` mit Foto-Kacheln (`Image`, feste Höhe, `borderRadius`). Bei `editable`: erste Kachel ist „Foto hinzufügen" (Ionicon `add`) → `onAdd`; jede Kachel bekommt ein kleines Lösch-Overlay (Ionicon `close`) → `onRemovePhoto(id)`. Leerer Zustand (kein Foto, nicht editable): kurzer Hinweistext.

- [ ] **Step 4: `VenueInfoSection.tsx` schreiben**

Zeigt Beschreibung, `venue_type`, Adresse (antippbar → `Linking.openURL('https://maps.apple.com/?q=' + encoded)` analog Studio), Kapazität, Öffnungszeiten (über `opening_hours`-Objekt iterieren, Tageskürzel Mo–So), `tags` als Chips, Instagram-Link. Nur vorhandene Felder rendern.

- [ ] **Step 5: `VenueEventsList.tsx` schreiben**

Liste der `events` mit Titel, `fight_card`, Datum/Zeit (`toLocaleDateString('de-DE')`), `signup_count/max_slots`. Jede Zeile `TouchableOpacity` → `onPressEvent`. Leerer Zustand: „Keine kommenden Events".

- [ ] **Step 6: tsc**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/components/venue/
git commit -m "feat(venues): add venue presentation components"
```

---

### Task 8: VenueDetailScreen (rollenbewusst) + Navigation

**Files:**
- Create: `src/screens/VenueDetailScreen.tsx`
- Create: `src/components/venue/VenueOwnerBar.tsx`
- Create: `src/components/venue/VenueRatingSheet.tsx`
- Modify: `src/navigation/types.ts` (Route `VenueDetail: { venueId: string }`)
- Modify: `src/navigation/RootNavigator.tsx` (Screen registrieren)

**Interfaces:**
- Consumes: Hooks aus Tasks 5/6, Komponenten aus Task 7, `uploadImage` (Task 4), `useAuth`.
- Produces: Route `VenueDetail` mit Param `{ venueId: string }`; navigierbar via `navigation.navigate('VenueDetail', { venueId })`.

- [ ] **Step 1: `StudioDetailScreen` als Vorlage lesen (Rollen-Logik + Inline-Edit + Owner-Bar + Rating-Sheet-Einbindung)**

Run: `grep -n "owner_user_id\|isOwner\|StudioOwnerBar\|StudioRatingSheet\|uploadImage\|ImagePicker\|geocodeAddress" src/screens/StudioDetailScreen.tsx`
Muster übernehmen: `isOwner = venue.owner_user_id === user?.id`.

- [ ] **Step 2: `VenueRatingSheet.tsx` schreiben (mirror StudioRatingSheet)**

Run: `cat src/components/studio/StudioRatingSheet.tsx`
1:1 spiegeln; `useVenueRatings` statt `useStudioRatings` einbinden.

- [ ] **Step 3: `VenueOwnerBar.tsx` schreiben (mirror StudioOwnerBar)**

Run: `cat src/components/studio/StudioOwnerBar.tsx`
Buttons: „Profil bearbeiten" (toggelt Edit-Modus) und **„Event anlegen"** (`onCreateEvent`). Designsprache übernehmen.

- [ ] **Step 4: `VenueDetailScreen.tsx` schreiben**

Struktur (rollenbewusst):
- `SafeAreaView` + `ScrollView`. `useVenueProfile(venueId)`, `useVenuePhotos`, `useVenueEvents`, `useVenueRatings`. `isOwner` wie in Step 1.
- Gast: `VenueHero` (ohne Edit-Props) → `VenuePhotoGallery editable={false}` → `VenueInfoSection` → `VenueEventsList onPressEvent={openEvent}` → Bewertungs-Block + `VenueRatingSheet`.
- Owner: zusätzlich `VenueOwnerBar`; im Edit-Modus Inline-Felder (Name/Beschreibung/Typ/Kapazität/Öffnungszeiten/Instagram/Adresse) → Speichern via `supabase.from('venues').update({...}).eq('id', venueId)` (RLS-gebunden) → `refetch`. Avatar/Banner/Galerie-Upload via `uploadImage(localUri, 'venues', path)` aus `expo-image-picker`-Auswahl; Galerie-Insert via `supabase.from('venue_photos').insert(...)`, Löschen via `.delete().eq('id', id)`.
- Adresse im Edit-Modus mit Geocode-Button (`geocodeAddress` aus `src/utils/geocoding.ts`) — exakt das StudioDetailScreen-Muster.
- „Event anlegen" öffnet `CreateEventSheet` mit `venueId={venueId}` (Task 10).
- `openEvent(e)` öffnet `EventDetailSheet` (vorhandene Komponente) ODER navigiert — am bestehenden Event-Detail-Aufruf orientieren.
- Hardware-Back: NativeStack-Modal genügt (Standard-Back); Sheets fangen Back selbst ab.

- [ ] **Step 5: Route registrieren**

In `src/navigation/types.ts` zur `RootStackParamList` hinzufügen:
```typescript
VenueDetail: { venueId: string };
```
In `src/navigation/RootNavigator.tsx` analog zu `StudioDetail` einen `<Stack.Screen name="VenueDetail" component={VenueDetailScreen} ... />` registrieren (gleiche Modal-Options wie StudioDetail).

- [ ] **Step 6: tsc**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/screens/VenueDetailScreen.tsx src/components/venue/ src/navigation/types.ts src/navigation/RootNavigator.tsx
git commit -m "feat(venues): add role-aware VenueDetailScreen + navigation route"
```

---

### Task 9: Storage-Bucket `venues`

**Files:**
- Create: `supabase/migrations/20260623122000_add_venues_bucket.sql` (oder via Dashboard, dann als Migration dokumentieren)

**Interfaces:**
- Produces: Storage-Bucket `venues` (public read), Policies analog `avatars`.

- [ ] **Step 1: Avatars-Bucket-Setup als Vorlage finden**

Run: `grep -rln "avatars" supabase/migrations/`
Die dortige Bucket-/Policy-Definition als Vorlage nehmen.

- [ ] **Step 2: Bucket + Policies spiegeln**

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('venues', 'venues', true)
  ON CONFLICT (id) DO NOTHING;

-- Public read.
CREATE POLICY "public read venues bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'venues');

-- Authenticated users may upload/update/delete within the venues bucket.
-- (Path convention: <venueId>/<file>. Tighter per-owner checks optional.)
CREATE POLICY "authenticated writes venues bucket" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'venues');
CREATE POLICY "authenticated updates venues bucket" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'venues');
CREATE POLICY "authenticated deletes venues bucket" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'venues');
```
Falls die `avatars`-Policies strenger/anders sind, exakt deren Muster übernehmen.

- [ ] **Step 3: Auf Remote anwenden + verifizieren**

```sql
SELECT id, public FROM storage.buckets WHERE id = 'venues';
```
Expected: Bucket `venues`, `public = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260623122000_add_venues_bucket.sql
git commit -m "feat(venues): add public venues storage bucket"
```

---

### Task 10: CreateEventSheet — venueId-Pfad (gratis) + Adress-Texteingabe

**Files:**
- Modify: `src/components/sparring/CreateEventSheet.tsx`
- Modify: `src/hooks/useEventActions.ts`

**Interfaces:**
- Consumes: `create_venue_event` RPC (Task 2), `geocodeAddress` (`src/utils/geocoding.ts`).
- Produces: `useEventActions().createVenueEvent(venueId, params)`; `CreateEventSheet`-Prop `venueId?: string`.

- [ ] **Step 1: `geocodeAddress`-Signatur prüfen**

Run: `sed -n '1,30p' src/utils/geocoding.ts`
Bestätigen: `geocodeAddress(query: string): Promise<{ lat; lng } | null>` (exakte Feldnamen übernehmen).

- [ ] **Step 2: `createVenueEvent` in `useEventActions.ts` ergänzen**

```typescript
const createVenueEvent = useCallback(
  async (
    venueId: string,
    params: { title: string; fightCard: string; scheduledAt: string; durationMin: number; maxSlots: number; notes: string },
  ): Promise<{ error: string | null; eventId?: string }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    const { data, error } = await supabase.rpc('create_venue_event', {
      p_venue_id:     venueId,
      p_title:        params.title,
      p_fight_card:   params.fightCard,
      p_scheduled_at: params.scheduledAt,
      p_duration_min: params.durationMin,
      p_max_slots:    params.maxSlots,
      p_notes:        params.notes,
    });
    if (error !== null) return { error: error.message };
    const eventId = typeof data === 'string' ? data : (data as { id?: string } | null)?.id;
    return { error: null, eventId };
  },
  [user],
);
```
`createVenueEvent` in das Rückgabe-Objekt + Typsignatur des Hooks aufnehmen.

- [ ] **Step 3: `CreateEventSheet` um `venueId`-Prop + Verzweigung erweitern**

- Neues optionales Prop `venueId?: string`. Bei gesetztem `venueId`: Location-Block (Karten-Picker + Adressfeld) ausblenden, stattdessen Hinweis „Findet in deiner Location statt"; Submit ruft `createVenueEvent(venueId, {...})` und überspringt `EventPaymentSheet` (Sheet direkt mit Erfolg schließen + `onCreated` callback).
- Ohne `venueId`: bestehender Pfad (`createEvent` + Payment) unverändert.

- [ ] **Step 4: Adress-Texteingabe im Nicht-Venue-Pfad ergänzen**

Im Location-Block neben „Auf Karte wählen" ein `TextInput` „Adresse eingeben" + Button „Adresse suchen":
```typescript
async function handleAddressSearch(): Promise<void> {
  const q = addressQuery.trim();
  if (q.length === 0) return;
  setGeocoding(true);
  const coords = await geocodeAddress(q);
  setGeocoding(false);
  if (coords === null) { Alert.alert('Nicht gefunden', 'Zu dieser Adresse wurden keine Koordinaten gefunden.'); return; }
  setLat(coords.lat); setLng(coords.lng); setResolvedAddress(q);
}
```
Beide Wege (Karte/Texteingabe) schreiben in denselben `lat`/`lng`/`address`-State; Submit bleibt blockiert, solange keine gültigen Koordinaten gesetzt sind.

- [ ] **Step 5: tsc**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/components/sparring/CreateEventSheet.tsx src/hooks/useEventActions.ts
git commit -m "feat(events): venue-bound free events + address text entry in CreateEventSheet"
```

---

### Task 11: Map-Integration — persistente Venue-Marker (iOS + Android)

**Files:**
- Modify: `src/screens/SparringMapScreen.tsx`
- Ggf. Modify: Map-Komponenten-Split (`*.ios.tsx` / `*.android.tsx`) — am vorhandenen Studio-Marker-Rendering orientieren.

**Interfaces:**
- Consumes: `useVenueMapMarkers` (Task 6), Navigation `VenueDetail` (Task 8).

- [ ] **Step 1: Bestehendes Studio-Marker-Rendering lokalisieren**

Run: `grep -n "useStudioMapMarkers\|StudioMapMarker\|Marker\|studio" src/screens/SparringMapScreen.tsx`
Verstehen, wie Studio-Dots auf iOS (`react-native-maps`) und Android (MapLibre) gerendert werden.

- [ ] **Step 2: Venue-Marker einbinden**

- `useVenueMapMarkers()` einbinden.
- Venue-Marker als eigener Typ rendern (eigenes Ionicon/Pin-Farbe, klar unterscheidbar von Studio-Dots und Event-Markern), persistent (nicht modusabhängig — immer sichtbar).
- iOS: `<Marker>` (react-native-maps) analog Studio. Android: MapLibre-Marker analog Studio (OHNE `androidView`-Prop). KEIN Google Maps.
- Tap → `navigation.navigate('VenueDetail', { venueId: marker.id })`.

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 4: Build-Verifizierung (manuell, beide Plattformen)**

Run (iOS): `npx expo run:ios` — Venue-Marker erscheint, Tap öffnet Profil.
Run (Android): `npx expo run:android` — Marker rendert ohne Crash (MapLibre `GLSurfaceView`), Tap öffnet Profil.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SparringMapScreen.tsx
git commit -m "feat(venues): show persistent venue markers on the map (iOS + Android)"
```

---

### Task 12: EventDetailSheet — Venue-Verlinkung

**Files:**
- Modify: `src/components/sparring/EventDetailSheet.tsx`
- Modify: `src/hooks/useOpenEvents.ts` (Feld `venue_id` an `EventWithMeta` + Mapping)

**Interfaces:**
- Consumes: Navigation `VenueDetail`.
- Produces: `EventWithMeta.venue_id: string | null`.

- [ ] **Step 1: `venue_id` an `EventWithMeta` ergänzen**

In `src/hooks/useOpenEvents.ts`: Feld `venue_id: string | null;` zum Interface + im Mapping `venue_id: r.venue_id ?? null,`.

- [ ] **Step 2: Venue-Zeile im EventDetailSheet rendern**

Wenn `event.venue_id !== null`: antippbare Zeile „Veranstaltet von [venue_name] →" (Ionicon `business-outline`). Da der Venue-Name bereits in `event.venue_name` steht, kein Extra-Fetch nötig. Tap → über die `EventDetailSheet`-Props eine `onOpenVenue(venueId)`-Callback nach oben reichen (SparringMapScreen navigiert dann zu `VenueDetail`). Falls das Sheet keinen Navigationszugriff hat, neuen optionalen Prop `onOpenVenue?: (venueId: string) => void` ergänzen und im aufrufenden Screen verdrahten.

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/components/sparring/EventDetailSheet.tsx src/hooks/useOpenEvents.ts
git commit -m "feat(events): link event detail to host venue profile"
```

---

### Task 13: ProfilScreen — „Meine Location"-Einstieg

**Files:**
- Modify: `src/screens/ProfilScreen.tsx`

**Interfaces:**
- Consumes: `useMyVenue` (Task 5), Navigation `VenueDetail`.

- [ ] **Step 1: Einstiegspunkt im ProfilScreen finden**

Run: `grep -n "useFocusEffect\|navigation.navigate\|StudioDetail\|Card\|Section" src/screens/ProfilScreen.tsx | head -30`
Eine passende Stelle für eine Karte/Zeile (analog zu vorhandenen Navigations-Karten) wählen.

- [ ] **Step 2: „Meine Location"-Karte ergänzen**

- `const { venueId } = useMyVenue(focusTrigger);` (Refetch-Muster wie andere Hooks im Screen).
- Wenn `venueId !== null`: Karte/Zeile „Meine Location" (Ionicon `business-outline`) → `navigation.navigate('VenueDetail', { venueId })`. Wenn `null`: nichts rendern (B2B — nur Partner sehen den Einstieg).

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ProfilScreen.tsx
git commit -m "feat(venues): add 'Meine Location' entry to ProfilScreen for venue owners"
```

---

### Task 14: B2B-Onboarding dokumentieren + Gesamt-Verifizierung

**Files:**
- Modify: `CLAUDE.md` (kurzer Venue-Eintrag in der Feature-Map) — optional, nur 1 Zeile.
- Verifizierung: gesamtes Feature.

- [ ] **Step 1: Onboarding-Aufruf dokumentieren**

In der Feature-Map (`CLAUDE.md`) eine Zeile ergänzen, z.B.:
> **Partner-Venues:** Bars/Locations mit Profil (`venues`/`venue_photos`/`venue_ratings`); B2B-Freischaltung serverseitig via `grant_venue_partner(...)` (service_role, kein IAP); Partner-Events gratis via `create_venue_event`; `VenueDetailScreen` rollenbewusst. Spec/Plan unter `docs/superpowers/`.

Beispiel-Aufruf (service_role, SQL-Editor / MCP `execute_sql`) für das Onboarding einer Bar:
```sql
SELECT grant_venue_partner(
  '<owner-user-uuid>', 'Bar Name', 'Berlin', 'sportsbar',
  'Beispielstr. 1, 10115 Berlin', 52.5300, 13.3850
);
```

- [ ] **Step 2: Gesamt-Verifizierung**

Run: `npx tsc --noEmit && npx jest`
Expected: keine TS-Fehler; alle Tests grün.

Run: `npx expo-doctor`
Expected: „No issues detected" (Release-Checkliste).

Manuell (Dev-Build, beide Plattformen):
- Bar per `grant_venue_partner` freischalten → Owner sieht „Meine Location" → öffnet `VenueDetailScreen` → bearbeitet Profil, lädt Banner/Logo/Galerie-Fotos hoch, legt ein gratis Event an.
- Zweiter Account (Gast): sieht Venue-Marker auf der Map → öffnet Profil (Galerie/Eckdaten/Events/Bewertungen) → meldet sich für Event an → bewertet die Location.
- Normaler Nutzer: Event-Erstellung mit Adress-Texteingabe (Geocoding) statt Karte → 9,99-€-Pfad weiterhin funktionsfähig.
- Android: Venue-Marker rendert ohne Crash; Foto-Picker-Permission-Flow; Tastatur verdeckt Eingaben nicht.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(venues): document B2B venue onboarding in feature map"
```

---

## Self-Review

**Spec coverage:**
- B2B-Freischaltung → Task 2 (`grant_venue_partner`), Task 14 (Doku). ✓
- Beide Event-Pfade parallel → Task 10 (venueId-Verzweigung, 9,99-Pfad unverändert). ✓
- Profil-Inhalt (Galerie/Eckdaten/Events/Bewertungen) → Tasks 7, 8, 5, 6. ✓
- Persistenter Venue-Marker → Task 11. ✓
- Paralleles System (`venues`-Tabellen/RPCs/Screen/Hooks) → Tasks 1–8. ✓
- `events.venue_id` → Task 1; Verlinkung → Task 12. ✓
- Foto-Galerie + Bucket → Tasks 7, 9; Upload-Helfer extrahiert → Task 4. ✓
- Adress-Texteingabe beim Event-Anlegen → Task 10 (Step 4). ✓
- „Meine Location"-Einstieg → Task 13. ✓
- is_active-Guard gegen Self-Activation → Task 1 (Step 2). ✓

**Platzhalter:** Screen/Komponenten-Tasks verweisen bewusst auf exakt benannte Vorlagen (`StudioHero`, `StudioOwnerBar`, `StudioRatingSheet`, `StudioDetailScreen`) mit konkreten grep-Befehlen — kein „TODO/TBD". RPCs/Hooks/Util/Migration enthalten vollständigen Code.

**Typ-Konsistenz:** `Venue`/`VenuePhoto`/`VenueRating` (Task 3) durchgängig genutzt; `VenueMapMarker` in Task 6 definiert + Task 11 konsumiert; `createVenueEvent`-Signatur in Task 10 konsistent; `useVenueRatings` an `useStudioRatings` angeglichen (in Task 8/Step 2 konsumiert).

**Hinweis Reihenfolge:** Tasks 1→2→3 sind harte Voraussetzungen. 5/6 hängen an 3. 7→8. 9 vor 8-Upload-Test. 10/11/12/13 nach 8.
