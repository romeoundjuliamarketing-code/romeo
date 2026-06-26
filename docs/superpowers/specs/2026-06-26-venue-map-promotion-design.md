# Design: Locations auf der Map bewerben

Datum: 2026-06-26
Status: Zur Genehmigung (Brainstorming abgeschlossen)
Autor: Claude Code (Brainstorming-Session)

## Ziel

Partner-Venues (Bars/Locations mit Public-Viewing-Events) sollen auf der Karte
sichtbar **beworben** werden, damit App-Nutzer sie wahrnehmen und hingehen — das
ist der Gegenwert, fuer den eine Bar den B2B-Monatsbetrag zahlt.

Heute ist der Venue-Marker statisch (immer derselbe `location`-Dot fuer aktive
Venues, nur im `events`-Map-Mode sichtbar). Der eigentliche Werbewert entsteht
aber an dem Abend, an dem dort ein Event laeuft (z.B. UFC-Uebertragung). Dieses
Feature koppelt die Hervorhebung an reale Event-Relevanz statt an Dauerwerbung.

## Entscheidungen (aus Brainstorming)

- **Umfang:** Zwei rein **client-seitige** Bausteine. **Keine DB-Migration, kein
  bezahlter Dienst** — alle benoetigten Felder existieren bereits
  (`events.venue_id/scheduled_at/duration_min`, `venues.is_active/lat/lng`).
- **A1 Hervorhebung:** Zeitfenster „Heute + Live-Unterzustand" (zwei Stufen).
- **A1 Marker-Optik:** Neutrales Icon + Badge (kein Venue-Logo/`avatar_url` auf
  der Karte) — schlanker, weniger Image-Loads.
- **A2 Push:** Lokal (gespiegelt von `useProximitySparringNotifications`), kein
  Server-Push. Null Infrastruktur, konsistent mit dem bestehenden Muster.
- **A3 Verworfen:** Tap auf den Marker navigiert weiterhin **direkt** zu
  `VenueDetail` (keine Vorschau-/Callout-Karte). Werbeflaeche = Marker + Push.
- **Kein Tier/Monetarisierung (B2)** in diesem Schritt.

## Baustein 1 — Hervorgehobener Venue-Marker („Heute" / „Live")

### Datenebene — `src/hooks/useVenueMapMarkers.ts`

- Bestehender Venue-Query bleibt (`id, name, venue_type, lat, lng`,
  `is_active = true`, Geo not null). **`avatar_url` wird NICHT benoetigt.**
- Zweiter Query auf `events` fuer die heutigen Partner-Events der gefetchten
  Venues:
  - `venue_id in (<aktive Venue-IDs>)`
  - `is_active = true`
  - `scheduled_at` zwischen **jetzt** und **Tagesende lokal**
  - Felder: `venue_id, scheduled_at, duration_min`
- Pro Venue wird der Hervorhebungs-Zustand client-seitig berechnet:
  - `'live'` — `now` liegt in `[scheduled_at, scheduled_at + duration_min)`
  - `'today'` — Venue hat heute ein Event, aber keines ist gerade live
  - `'none'` — kein Event heute
  - Mehrere Events pro Venue: `live` schlaegt `today` schlaegt `none`.
- Diese Berechnung wird als **pure Funktion** ausgelagert
  (`src/utils/venueHighlight.ts`, `computeVenueHighlight(events, now)`) und mit
  Unit-Test versehen (`venueHighlight.test.ts`): Grenzfaelle Start/Ende des
  Live-Fensters, „heute aber spaeter", „gestern/morgen" (ausserhalb),
  Tagesende-Grenze.

### Typ-Erweiterung

```ts
export type VenueHighlight = 'none' | 'today' | 'live';

export interface VenueMapMarker {
  id:         string;
  name:       string;
  venue_type: string;
  lat:        number;
  lng:        number;
  highlight:  VenueHighlight; // neu
}
```

`SparringMapView.types.ts` importiert `VenueMapMarker` aus dem Hook → **keine
Aenderung** dort noetig.

### Marker-Optik — `SparringMapView.ios.tsx` UND `.android.tsx`

Neue Marker-Variante (identisch in beiden Dateien, analog zu `VenueMarker()` /
`FeaturedMarker()`):

- `highlight === 'live'` → vergroesserter `location`-Marker mit Ring in
  `colors.deleteRed` (#D94A4A) + Badge-Label „Live".
- `highlight === 'today'` → vergroesserter `location`-Marker mit Ring in
  `colors.accentBlue` + Badge-Label „Heute".
- `highlight === 'none'` → bestehender `VenueMarker`-Dot, **unveraendert**.
- Hervorgehobene Venues bekommen hoeheres `zIndex` als die `none`-Dots (analog
  zum Sparring-`is_featured`-Sort in `sortedSparrings`).
- Badge-Styling spiegelt `featuredLabel`/`featuredLabelText` (Pille unter dem
  Marker), Farben aus `colors.ts`, 8px-Raster, keine Emojis, `@expo/vector-icons`.

Sichtbarkeit unveraendert: Venue-Marker erscheinen nur bei `mapMode === 'events'`
(`SparringMapScreen` Zeile ~291). Tap bleibt
`navigation.navigate('VenueDetail', { venueId })` (unveraendert).

## Baustein 2 — Lokaler Proximity-Push „Heute Abend in deiner Naehe"

Neuer Hook `src/hooks/useProximityVenueEventNotifications.ts`, **gespiegelt** von
`useProximitySparringNotifications.ts`:

- Laeuft **einmal pro App-Session** (`hasRun`-Ref-Muster).
- Prueft Notification-Permission **und** Standort-Permission — nur bei `granted`
  beider wird fortgefahren (Android-13 POST_NOTIFICATIONS respektiert).
- Holt aktuelle Position (`Location.Accuracy.Balanced`).
- Radius ueber den **bestehenden** `PROXIMITY_RADIUS_KEY` (eine gemeinsame
  Nutzer-Einstellung fuer Sparring- und Venue-Proximity).
- Eigener Notified-Key `venue_event_notified_v1`, TTL 24 h, Dedup **pro Event-ID**
  (ein Venue kann mehrere Events haben; jedes Event eigenstaendig).
- Query: Partner-Events heute — `events` mit `venue_id not null`, `is_active`,
  `scheduled_at` zwischen jetzt und Tagesende; Felder
  `id, title, lat, lng, scheduled_at, venues!venue_id(name)`. (Events erben
  `lat/lng` aus der Venue via `create_venue_event` → Geo am Event vorhanden.)
- Innerhalb Radius (`haversineKm`) **und** noch nicht benachrichtigt → lokale
  Notification:
  - Titel: „Heute Abend in deiner Naehe"
  - Body: `${title} · ${distStr} entfernt · ${barName}, ${timeStr}`
  - `data: { type: 'venue_event_nearby', venueId }`
  - `identifier: 'venue-event-' + eventId`
- Tap-Listener (warm via `addNotificationResponseReceivedListener` + cold start
  via `getLastNotificationResponseAsync`) → bei `type === 'venue_event_nearby'`:
  `navigation.navigate('VenueDetail', { venueId })`.
- **Bewusst schlank:** **kein** „nichts in der Naehe"-Nudge (das ist
  Sparring-Akquise, fuer Venues irrelevant). Nur positive Benachrichtigungen.
- Wird neben `useProximitySparringNotifications()` gemountet (`App.tsx`).

## Dateien — vollstaendige Liste

### Neu angelegt

| Datei | Zweck |
|---|---|
| `src/utils/venueHighlight.ts` | Pure `computeVenueHighlight(events, now)` → `VenueHighlight` |
| `src/utils/venueHighlight.test.ts` | Unit-Tests fuer die Highlight-Logik |
| `src/hooks/useProximityVenueEventNotifications.ts` | Lokaler Venue-Event-Proximity-Push |

### Geaendert

| Datei | Aenderung |
|---|---|
| `src/hooks/useVenueMapMarkers.ts` | Zweiter Events-Query + `highlight` pro Venue via `computeVenueHighlight` |
| `src/components/sparring/SparringMapView.ios.tsx` | Hervorgehobene Venue-Marker-Variante + `zIndex`-Sort |
| `src/components/sparring/SparringMapView.android.tsx` | Identische Variante (MapLibre, **ohne** `androidView`) |
| `App.tsx` | `useProximityVenueEventNotifications()` mounten |

### Nicht angefasst

- DB / Migrationen (alle Felder existieren).
- `SparringMapView.types.ts` (importiert `VenueMapMarker` aus dem Hook).
- Bestehende Sparring-/Studio-/Event-Marker-Logik.
- `VenueDetailScreen`, Venue-Profil, `create_venue_event`.
- `colors.ts` (kein neuer Farbwert — `deleteRed`/`accentBlue` vorhanden).

## Plattform-Pflichten (iOS + Android)

- Hervorgehobener Marker auf **beiden** Karten identisch implementiert; MapLibre
  `<Map>` **ohne** `androidView`-Prop (SIGSEGV-Falle).
- Android-13 POST_NOTIFICATIONS und Standort-Permission im Push-Pfad nie als
  erteilt annehmen — nur bei `granted` feuern (bereits im Muster).
- Edge-to-Edge: Marker/Badges nutzen kein hartes Pixel-Layout gegen System-Bars.
- `npx tsc --noEmit` + `npx jest` gruen.

## Bewusst NICHT enthalten (YAGNI)

- Kein Tier/Monetarisierung (B2) — Hervorhebung ist (vorerst) fuer alle aktiven
  Venues gleich.
- Kein Server-Push (pg_net→Expo) — lokaler Pfad reicht und ist konsistent.
- Keine Vorschau-/Callout-Karte (A3) — Tap navigiert direkt zum Profil.
- Keine neue Map-Filter-/Mode-Erweiterung.
- Kein Venue-Logo auf dem Marker (neutrales Icon + Badge gewaehlt).

## Offene Implementierungsdetails (im Plan zu klaeren)

- Exakte „Tagesende"-Definition (lokale Mitternacht des Geraets) und Umgang mit
  Events, die ueber Mitternacht hinaus laufen (`scheduled_at` heute, Live-Fenster
  reicht in den naechsten Tag) — Live-Status korrekt, „today"-Fetch-Grenze
  pragmatisch auf lokale Mitternacht.
- Badge-/Marker-Masse final an den bestehenden `FeaturedMarker`-Stil angleichen
  (Groesse, Schatten, Label-Pille) — beide Plattformen pixelgleich.
- Refetch-Kadenz von `useVenueMapMarkers`: Highlight ist zeitabhaengig; bei
  Re-Focus des Map-Screens neu berechnen (bestehender `refetch`-Trigger genuegt,
  kein Timer noetig).
