# Design: Studios auf der Map

**Datum:** 2026-05-27  
**Status:** Genehmigt

---

## Überblick

Der `SparringMapScreen` bekommt einen Modus-Schalter oben (Sparrings | Studios). Im Sparrings-Modus erscheinen Studio-Sparrings am eigenen Standort neu in Grün. Im Studios-Modus werden Studios mit aktivem Studio-Abo als Marker auf der Map gezeigt.

---

## Anforderungen

1. **Modus-Schalter** oben im `SparringMapScreen`: Pill-Toggle zwischen "Sparrings" und "Studios".
2. **Grüner Marker**: Sparrings mit `is_at_studio = true` erscheinen grün (statt rot/orange/blau). Nur Studios mit aktivem Studio-Abo können dieses Flag setzen.
3. **Studios-Modus**: Zeigt Studios mit aktivem `studio`-Abo und gesetzten Koordinaten als dunkle Marker auf der Map.
4. **Studio-Detail-Sheet**: Antippen eines Studio-Markers öffnet ein Sheet mit Name, Stadt, Adresse und aktiven Sparrings dieses Studios.
5. **CreateSparringSheet**: Neue Checkbox "Am Studio-Standort" — füllt Studio-Adresse vor, setzt `is_at_studio = true`.
6. **Zeitfilter** (Jetzt / Demnächst / Bald) ist nur im Sparrings-Modus sichtbar, nicht im Studios-Modus.

---

## Architektur

### Komponentenaufteilung

Der `SparringMapScreen` (aktuell 460 Zeilen) wird als Coordinator umgebaut:

```
SparringMapScreen
├── hält: mode ('sparrings' | 'studios')
├── rendert Modus-Schalter (gemeinsamer TopBar)
├── rendert ZoomSlider (gemeinsam)
├── SparringsMapContent   ← bestehende Logik, extrahiert
└── StudiosMapContent     ← neu
```

**`SparringsMapContent`** (extrahiert aus bestehendem Screen):
- Hält: `timeFilter`, `selected`, `createSheetVisible`
- Nutzt: `useOpenSparrings`, `useSparringActions`
- Rendert: Marker (inkl. grüne Studio-Sparrings), DetailSheet, CreateSheet, FAB

**`StudiosMapContent`** (neu):
- Nutzt: `useStudioMapMarkers`
- Rendert: Studio-Marker, `StudioMapDetailSheet`

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `supabase/migrations/TIMESTAMP_add_is_at_studio.sql` | `is_at_studio` Spalte auf `open_sparrings` |
| `src/hooks/useStudioMapMarkers.ts` | Studios mit aktivem Abo + Koordinaten fetchen |
| `src/components/sparring/StudioMapDetailSheet.tsx` | Detail-Sheet für Studio-Marker |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/types/database.types.ts` | `is_at_studio: boolean` in `open_sparrings` Row/Insert/Update |
| `src/hooks/useOpenSparrings.ts` | `is_at_studio` in `SparringWithMeta` + select |
| `src/hooks/useSparringActions.ts` | `is_at_studio?: boolean` in `CreateSparringParams` |
| `src/components/sparring/CreateSparringSheet.tsx` | Checkbox "Am Studio-Standort" |
| `src/screens/SparringMapScreen.tsx` | Umbau zu Coordinator + Modus-Schalter |

---

## Datenbank

### Migration: `is_at_studio`

```sql
ALTER TABLE open_sparrings
  ADD COLUMN IF NOT EXISTS is_at_studio boolean NOT NULL DEFAULT false;
```

### RPC: `get_subscribed_studios`

Gibt Studios zurück, deren `owner_user_id` ein aktives `studio`-Abo hat und bei denen `lat` und `lng` gesetzt sind.

```sql
CREATE OR REPLACE FUNCTION get_subscribed_studios()
RETURNS TABLE (
  id        uuid,
  name      text,
  city      text,
  address   text,
  lat       double precision,
  lng       double precision
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT s.id, s.name, s.city, s.address, s.lat, s.lng
  FROM studios s
  JOIN subscriptions sub ON sub.user_id = s.owner_user_id
  WHERE sub.tier = 'studio'
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND s.lat IS NOT NULL
    AND s.lng IS NOT NULL;
$$;
```

---

## Marker-Design

| Farbe | Icon | Bedeutung |
|-------|------|-----------|
| `colors.deleteRed` | `flame` | Sparring heute (Jetzt) |
| `#F5820A` (Orange) | `calendar` | Sparring diese Woche (Demnächst) |
| `colors.accentBlue` | `time-outline` | Sparring später (Bald) |
| `#22C55E` (Grün) | `shield-checkmark` | Studio-Sparring am eigenen Standort |
| `colors.dark` | `business` | Studio-Marker (Studios-Modus) |

---

## UI-Details

### Modus-Schalter

Pill-Toggle oben links (ersetzt den X-Button nicht — X bleibt für Zeitfilter-Reset, Modus-Switch ist rechts davon oder integriert). Konkretes Layout:

```
[X]  [Sparrings | Studios]   ← Pill-Toggle
     [Jetzt | Demnächst | Bald]  ← nur im Sparrings-Modus
```

### CreateSparringSheet — Checkbox

Unterhalb des Adressfeldes erscheint für Coaches:

```
[ ] Am Studio-Standort
```

- Wenn aktiviert: Adressfeld wird mit der Studio-Adresse (aus dem Coach-Profil) vorbelegt und deaktiviert (read-only).
- `is_at_studio: true` wird an `createSparring()` übergeben.
- Die Studio-Adresse wird über `useStudioAddress(studioId)` geladen; `studioId` kommt aus dem Profil des eingeloggten Users.
- Wenn kein Studio oder keine Studio-Adresse gesetzt: Checkbox ist ausgeblendet.

### StudioMapDetailSheet

Bottom-Sheet (analog zu `SparringDetailSheet`):
- Studio-Name (groß)
- Stadt + Adresse
- Liste aktiver Sparrings dieses Studios (kompakte Zeilen: Titel, Datum, Disziplin)
- Kein Join-Button — reine Informationsansicht

---

## Typen-Änderungen

### `SparringWithMeta` (in `useOpenSparrings.ts`)

```ts
export interface SparringWithMeta {
  // ...bestehende Felder...
  is_at_studio: boolean; // neu
}
```

### `CreateSparringParams` (in `useSparringActions.ts`)

```ts
export interface CreateSparringParams {
  // ...bestehende Felder...
  is_at_studio?: boolean; // neu, default false
}
```

### `StudioMapMarker` (in `useStudioMapMarkers.ts`)

```ts
export interface StudioMapMarker {
  id: string;
  name: string;
  city: string;
  address: string | null;
  lat: number;
  lng: number;
}
```

---

## Fehlerbehandlung

- Studios ohne Koordinaten werden von der RPC gefiltert (kein Marker ohne Position).
- Wenn `get_subscribed_studios()` fehlschlägt: Studios-Modus zeigt leere Map (kein Crash).
- Wenn Studio-Adresse nicht gesetzt: Checkbox "Am Studio-Standort" in `CreateSparringSheet` wird ausgeblendet.

---

## Out of Scope

- Suchen/Filtern von Studios auf der Map
- Direkte Kontaktaufnahme mit Studios
- Studio-Profil-Screen
- Rating oder Bewertung von Studios
