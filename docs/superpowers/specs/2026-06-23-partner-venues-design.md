# Design: Partner-Venues (Bars/Locations mit Profil)

Datum: 2026-06-23
Status: Genehmigt (Brainstorming abgeschlossen)

## Ziel

Bars, Restaurants und Locations, die Events hosten (primär Public Viewing von
Kampfsport-Übertragungen), sollen — analog zu Studios — ein **eigenes,
persistentes Profil** bekommen. Sie sollen zeigen können, „wie es bei ihnen
aussieht" (Foto-Galerie), zu **festen Partnern** werden und ihre Events an das
Profil hängen.

Heute ist der Veranstaltungsort eines Events nur ein Freitext-Feld
(`events.venue_name`) — ohne Identität, ohne Profil, ohne Fotos. Dieses Feature
ergänzt eine echte Location-Entität.

## Entscheidungen (aus Brainstorming)

- **Partner-Modell:** B2B, manuell freigeschaltet (analog Studio-Vermittlung /
  `grant_studio_tier`). Serverseitiger Grant, kostenloses Profil + Map-Sichtbarkeit
  nur nach Freischaltung, fester Monatsbetrag außerhalb Apple. **Kein Self-Service-
  Abo, kein IAP für Venues.**
- **Event-Erstellung — beide Pfade parallel:** Normale verifizierte Nutzer legen
  weiter ad-hoc Events für 9,99 € an (Freitext-Location, **unverändert**).
  Partner-Bars legen zusätzlich **unbegrenzt gratis** Events an, die an ihr Profil
  hängen. Beide erscheinen auf der Map.
- **Profil-Inhalt:** Foto-Galerie (zentral), Beschreibung + Eckdaten
  (Typ/Adresse/Kapazität/Öffnungszeiten), Liste kommender Events am Profil,
  Sterne-Bewertungen.
- **Map:** Eigener persistenter Venue-Marker-Typ (analog Studio-Dots), immer
  sichtbar für aktive Venues. Events erscheinen zusätzlich als Event-Marker.
- **Architektur:** Ansatz A — paralleles Venue-System (eigene Tabellen, RPCs,
  Screen, Hooks), bestehende funktionierende Studio- und Event-Logik nicht
  anfassen. Konsistent mit der Events-Entscheidung. Wo eine Low-Level-Komponente
  1:1 wiederverwendbar ist (Foto-Upload-Helfer), wird sie extrahiert (C-Element).

## Datenbank (neue Migration)

Namensschema: `supabase/migrations/<datum>_add_partner_venues.sql`.

### Tabelle `venues`
- `id uuid PK DEFAULT gen_random_uuid()`
- `owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `name text NOT NULL`
- `venue_type text NOT NULL DEFAULT 'bar'` — `bar` / `restaurant` / `lounge` / `sportsbar`
- `city text`
- `address text`, `lat double precision`, `lng double precision`
- `description text`
- `capacity int` (null)
- `opening_hours jsonb` (null) — z.B. `{ "mon": "17:00-23:00", ... }`
- `avatar_url text` (Logo), `banner_url text`
- `instagram text` (null)
- `tags text[]` (null) — z.B. gezeigte Ligen/Sportarten (UFC, Boxen, …)
- `is_active boolean NOT NULL DEFAULT false` — Partner-Flag; nur per B2B-Grant true
- `created_at timestamptz NOT NULL DEFAULT now()`

RLS:
- `SELECT`: jeder liest aktive Venues (`is_active = true`); Owner liest eigene
  (`owner_user_id = auth.uid()`).
- `UPDATE`: nur Owner (`owner_user_id = auth.uid()` in USING + WITH CHECK) —
  exakt das Studio-Profil-Edit-Muster (`20260507`/`20260609`). `is_active` darf
  per Client-UPDATE **nicht** auf true setzbar sein → wird nur über
  `grant_venue_partner` gesetzt; entweder Spalte aus der Update-Policy
  ausschließen (Trigger-Guard) oder im Plan absichern.
- `INSERT`/Aktivierung: nur über `grant_venue_partner` (service_role).

### Tabelle `venue_photos`
- `id uuid PK`, `venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE`
- `url text NOT NULL`, `sort_order int NOT NULL DEFAULT 0`, `created_at`

RLS:
- `SELECT`: Fotos sichtbar bei aktivem Venue (oder Owner).
- `INSERT`/`DELETE`: nur Owner des zugehörigen Venues
  (`EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = auth.uid())`).

### Tabelle `venue_ratings`
Gespiegelt von `studio_ratings`:
- `id uuid PK`, `venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE`
- `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `stars int NOT NULL CHECK (stars BETWEEN 1 AND 5)`, `comment text`, `created_at`
- `UNIQUE (venue_id, user_id)`

RLS: jeder liest Bewertungen aktiver Venues; Nutzer schreibt/aktualisiert/löscht
eigene (`user_id = auth.uid()`). Inhaltsfilter (`is_text_clean()`-Trigger) auf
`comment` analog zu bestehenden Textfeldern.

### Änderung an `events`
- `ALTER TABLE events ADD COLUMN venue_id uuid NULL REFERENCES venues(id) ON DELETE SET NULL;`
- Gesetzt = Partner-Event (gratis erstellt, `is_paid=false`, `is_active=true` ab
  Erstellung). Bestehende Events bleiben `venue_id = NULL` (unverändert).

## RPCs (alle `SECURITY DEFINER`, `SET search_path = public`)

- **`grant_venue_partner(p_owner_user_id uuid, p_name text, p_city text, ...)`
  → uuid** — **nur `service_role`** (B2B-Onboarding via SQL). Legt Venue mit
  `is_active=true` und Owner an, gibt `venue_id` zurück. Mirror von
  `grant_studio_tier`. Kein GRANT an `authenticated`.
- **`create_venue_event(p_venue_id uuid, p_title text, p_fight_card text,
  p_scheduled_at timestamptz, p_duration_min int, p_max_slots int, p_notes text)`
  → uuid** — prüft, dass `auth.uid()` Owner des (aktiven) Venues ist; übernimmt
  `address`/`lat`/`lng`/`venue_name` aus der Venue; fügt Event mit `venue_id`,
  `is_active=true`, `is_paid=false` ein. **Kein** Verifizierungs-/IAP-Pfad.
  Gibt `event_id` zurück. GRANT an `authenticated`, REVOKE PUBLIC/anon.
- **`deactivate_event(p_event_id)`** — wiederverwendet (Owner = `created_by`,
  bereits abgedeckt).
- Profil-Edit, Foto-Verwaltung und Bewertungen laufen über **RLS-gebundene
  Table-Writes** (kein RPC nötig — Studio-Muster).

## Map-Integration

- Neue Markerquelle: `SELECT` auf aktive Venues mit Geo (Hook
  `useVenueMapMarkers`, gespiegelt von `useStudioMapMarkers`).
- `SparringMapScreen` bekommt einen **persistenten Venue-Marker-Typ** (eigenes
  Icon, analog Studio-Dots), immer sichtbar für aktive Venues → Tap öffnet
  `VenueDetailScreen`.
- Plattform-Split beachten: iOS Apple Maps / Android MapLibre — neue Marker auf
  **beiden** Karten-Implementierungen ergänzen.
- Event-Marker bleiben unverändert. `EventDetailSheet` zeigt bei gesetztem
  `venue_id` eine antippbare Zeile „Veranstaltet von [Bar] →" → `VenueDetailScreen`.

## Hooks (gespiegelt von Studio, mit `queryCache`/stale-while-revalidate)

- `useVenueProfile(venueId)` — Profil-Stammdaten (mirror `useStudioProfile`).
- `useVenuePhotos(venueId)` — Galerie-Fotos, nach `sort_order`.
- `useVenueEvents(venueId)` — kommende Events mit `venue_id = venueId`
  (+ optional vergangene), inkl. `signup_count`.
- `useVenueRatings(venueId)` — mirror `useStudioRatings` (Schnitt + eigene
  Bewertung).
- `useVenueMapMarkers()` — aktive Venues mit Geo für die Map.
- `useMyVenue()` — besitzt der aktuelle Nutzer ein Venue? Liefert `venueId`
  (Einstieg + Event-Button im ProfilScreen).

## Screens / Komponenten

- **`VenueDetailScreen`** (rollenbewusst wie `StudioDetailScreen`):
  - **Gast:** Hero (Banner + Logo/Avatar), Foto-Galerie, Beschreibung +
    Eckdaten (Typ, Adresse mit Karte, Kapazität, Öffnungszeiten, Instagram),
    Liste kommender Events mit RSVP, Bewertungen.
  - **Owner:** zusätzlich Inline-Edit der Profilfelder + Foto-Verwaltung +
    Owner-Leiste mit **„Event anlegen"**.
- `src/components/venue/`: `VenueHero`, `VenuePhotoGallery`, `VenueInfoSection`,
  `VenueEventsList`, `VenueOwnerBar`, `VenueRatingSheet`.
- **Foto-Upload (C-Element):** den inline-`uploadImage`-Helfer aus
  `StudioDetailScreen` nach `src/lib/uploadImage.ts` extrahieren (FileSystem +
  `base64-arraybuffer`, **nie** `fetch().blob()`) und in beiden Screens nutzen.
  Neuer Storage-Bucket `venues`.
- Navigation: neue Route `VenueDetail` (NativeStack-Modal) in
  `src/navigation/types.ts` + `RootNavigator`.

## Event-Erstellung für Partner

`CreateEventSheet` bekommt ein optionales `venueId`-Prop:
- Gesetzt → Location-Felder aus der Venue vorbefüllt (read-only), Submit ruft
  `create_venue_event` (gratis), `EventPaymentSheet` wird **übersprungen**.
- Nicht gesetzt → bestehender Pfad: `create_event` + `EventPaymentSheet`
  (9,99 €) **komplett unverändert**.

## Adresse direkt eintippen (Event-Erstellung)

Beim Event-Anlegen (Pfad ohne Venue) soll der Ort **auch per Adress-Texteingabe**
wählbar sein, nicht nur über die Karte. Gespiegelt vom bestehenden
`StudioDetailScreen`-Muster (Adressfeld + Geocode-Button):
- `CreateEventSheet` bekommt neben dem „Auf Karte wählen"-Button ein
  **Adress-Textfeld** + Aktion „Adresse suchen", die `geocodeAddress(query)`
  (`src/utils/geocoding.ts`, bereits vorhanden) aufruft → liefert `lat`/`lng`.
- Beide Wege schreiben in denselben State (`lat`/`lng`/`address`); der zuletzt
  genutzte gewinnt. Der Karten-Picker (`LocationPickerModal`) bleibt unverändert.
- Schlägt das Geocoding fehl (kein Treffer), klare Fehlermeldung; ohne gültige
  Koordinaten kein Submit (wie heute).
- Für Partner-Events (`venueId` gesetzt) ist beides irrelevant — Location kommt
  aus der Venue.

## B2B-Onboarding (manuell)

Du schaltest eine Bar per service-role-Aufruf von `grant_venue_partner(...)`
frei (im Plan dokumentiert, analog Studio-Vermittlung). Der Owner sieht danach
seine Venue über eine **„Meine Location"-Karte im ProfilScreen** → Navigation zu
`VenueDetailScreen` (Edit + „Event anlegen").

## Bewusst NICHT enthalten (YAGNI)

- Kein Self-Service-Abo / IAP für Venues (rein B2B-Grant).
- Kein Venue-Follow / Push-Benachrichtigung bei neuem Event (kein Follow-System).
- Kein Verschmelzen/Claimen bestehender Freitext-Events in Venues.
- Keine Verallgemeinerung von `studios` (paralleles System).
- Keine Venue-Mitgliedschaften / Staff / Check-in (Studio-Territorium).

## Plattform-Pflichten (iOS + Android)

- Venue-Marker auf beiden Karten-Implementierungen (`.ios`/`.android`).
- Edge-to-Edge / SafeArea im neuen Screen; Hardware-Back im Detail-Screen und
  in Sheets (BackHandler / `beforeRemove`).
- Foto-Picker-Permissions auf Android durchspielen.
- `tsc --noEmit` + `jest` grün; neue Util (`uploadImage`) bekommt keinen Test
  (reiner I/O-Wrapper) — aber jede neue reine Util-Logik testen.

## Offene Implementierungsdetails (im Plan zu klären)

- Genaue Signatur/Defaults von `grant_venue_partner` (Pflicht- vs. Optionalfelder).
- Schutz von `venues.is_active` gegen Client-UPDATE (Spalten-Guard via Trigger
  oder eingeschränkte Update-Policy).
- Format/Editor der `opening_hours` (strukturierte 7-Tage-Eingabe vs. einfaches
  Textfeld pro Tag) — für v1 schlank halten.
