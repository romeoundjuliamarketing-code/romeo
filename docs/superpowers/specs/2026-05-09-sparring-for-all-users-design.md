# Spec: Sparring anmelden für alle Nutzer

**Datum:** 2026-05-09
**Status:** Genehmigt

---

## Ziel

Jeden eingeloggten Nutzer (nicht nur Coaches) befähigen, ein Sparring direkt auf der SparringMap zu erstellen. Coaches behalten ihren bestehenden Flow über den TeamScreen.

---

## Architektur

### Datenbank

**Migration:** `supabase/migrations/20260509100000_open_sparrings_for_all_users.sql`

- `open_sparrings.studio_id` von `NOT NULL` auf nullable ändern (`DROP NOT NULL`)
- Bestehende INSERT-Policy ersetzen durch zwei Policies:
  - `"coaches insert sparrings"` — Coach mit `is_coach = true` und `studio_id = open_sparrings.studio_id`
  - `"users insert own sparrings"` — jeder `authenticated` User, wenn `studio_id IS NULL AND created_by = auth.uid()`
- UPDATE-Policy bleibt unverändert (creator darf updaten)

### Types (`src/types/database.types.ts`)

- `open_sparrings.Row.studio_id`: `string | null`
- `open_sparrings.Insert.studio_id`: `string | null` (optional)
- `open_sparrings.Update.studio_id`: `string | null` (optional)
- Relationship für `studio_id` FK bleibt erhalten (nullable FK)
- `SparringWithMeta.studio_name` und `studio_city` bleiben `string` (non-null) — Fallbacks werden im Hook gesetzt

### `useSparringActions` — Discriminated Union

Neuer Typ `CreateSparringInput` ersetzt `CreateSparringParams`:

```ts
type CreateSparringInput = {
  title: string;
  discipline: string;
  scheduledAt: string;
  durationMin: number;
  maxSlots: number;
  notes: string;
} & (
  | { studioId: string; address?: never }
  | { address: string; studioId?: never }
);
```

- `studioId`-Branch: fetch Studio-Adresse → geocode → insert mit `studio_id`
- `address`-Branch: direkt geocoden → insert mit `studio_id: null`

### `CreateSparringSheet` (`src/components/sparring/CreateSparringSheet.tsx`)

Neuer optionaler Prop `mode: 'coach' | 'user'` (default `'coach'`).

| Feld | Coach-Mode | User-Mode |
|---|---|---|
| Titel | TextInput required | Auto: `"${discipline} – Sparring"` |
| Ort | — | TextInput required |
| Kampfsportart | Pill-Picker | Pill-Picker |
| Datum / Uhrzeit | DateTimePicker | DateTimePicker |
| Dauer (Min.) | TextInput | versteckt, fix 90 |
| Max. Plätze | TextInput | versteckt, fix 10 |
| Hinweise | optional | optional |

- `onCreate`-Prop-Typ wird auf `CreateSparringInput` aktualisiert
- Validation im User-Mode: Ort darf nicht leer sein
- Coach-Mode bleibt vollständig rückwärtskompatibel

### `SparringMapScreen` (`src/screens/SparringMapScreen.tsx`)

- FAB: absolut positioniert, `bottom: 32, right: 16`
- Icon `add-circle-outline` (Ionicons), Label "Sparring anmelden"
- Farbe: `colors.accentBlue`, weißer Text
- State `createSheetVisible: boolean`
- On press: Sheet mit `mode="user"` öffnen
- Nach Submit: `refetch()` + Sheet schließen

### `useOpenSparrings` (`src/hooks/useOpenSparrings.ts`)

- Supabase JOIN `studios!studio_id(name, city)` funktioniert bei nullable FK als LEFT JOIN — keine Syntaxänderung
- Mapping: `studio_name: studio?.name ?? 'Privat'`, `studio_city: studio?.city ?? ''`
- TypeScript-Cast auf `StudioJoin | null`

---

## Reihenfolge

1. Migration
2. Types
3. `useSparringActions`
4. `CreateSparringSheet`
5. `SparringMapScreen`
6. `useOpenSparrings`
7. `npx tsc --noEmit`

---

## Scope-Grenzen

- `TeamScreen` wird **nicht** geändert
- Bestehender Coach-Flow bleibt vollständig funktionsfähig
- Keine neuen Screens, keine neuen Navigations-Einträge
