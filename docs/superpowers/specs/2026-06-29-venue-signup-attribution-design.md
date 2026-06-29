# Venue-Signup-Attribution – B2B-Nachweis "Leute über Sparr"

Datum: 2026-06-29
Status: genehmigt (Stufe 1)

## Problem

Bar-Partner (B2B) sollen sehen können, ob über Sparr Leute zu ihren Events
(Public Viewings) gekommen sind. Die Daten existieren (`event_signups`,
Events sind via `venue_id` an die Venue gekoppelt), aber keine UI macht sie
für den Bar-Owner sichtbar. Das ist der Verkaufsbeweis gegenüber den Bars.

## Scope (Stufe 1 – Anmeldungen)

Der Bar-Owner sieht in seiner "Meine Location"-Ansicht (`VenueDetailScreen`,
wenn er Owner der Venue oder Venue-Admin ist):

- **Kennzahl:** Gesamtzahl der Anmeldungen über Sparr für seine Location.
- **Pro Event:** Titel + Datum + Anzahl Anmeldungen.

Nur aggregierte Zahlen, **keine** Namensliste (datenschutzfreundlich; Zahl
reicht für den B2B-Pitch).

## Bewusst NICHT in Stufe 1

- **Check-in / "war wirklich da"** (QR oder "Ich bin da"-Button → `attended`-Flag).
  Harter Anwesenheitsnachweis, spätere Ausbaustufe, nur wenn Bars das verlangen.
- Namentliche Gästeliste (DSGVO).

## Datenmodell / Backend

Neue RPC (SECURITY DEFINER, da `event_signups`-RLS sonst keine Aggregation
über fremde User erlaubt):

```sql
CREATE FUNCTION get_venue_signup_stats(p_venue_id uuid)
RETURNS TABLE (event_id uuid, title text, scheduled_at timestamptz, signup_count bigint)
```

- Auth-Check intern: nur erlaubt, wenn `venues.owner_user_id = auth.uid()`
  ODER `is_venue_admin()`. Sonst `RAISE EXCEPTION 'not_venue_owner'`.
- Aggregiert `event_signups` pro Event der Venue (`events.venue_id = p_venue_id`).
- `REVOKE … FROM PUBLIC, anon; GRANT … TO authenticated`.
- Gesamtsumme wird clientseitig summiert (kein Extra-Roundtrip).

Relevante echte Spalten: `events.scheduled_at` (nicht `starts_at`),
`event_signups(event_id, user_id, created_at)`.

## Client

- Hook `useVenueSignupStats(venueId, refetchTrigger=0)` nach dem bestehenden
  `useXxx(refetchTrigger)`-Muster inkl. `queryCache` (stale-while-revalidate).
- Sektion in `VenueDetailScreen`, nur sichtbar wenn Owner/Admin: Kennzahl oben,
  darunter Liste pro Event. Leerer Zustand: "Noch keine Anmeldungen über Sparr".

## Dateien

1. `supabase/migrations/2026062913xxxx_venue_signup_stats.sql` (neue RPC)
2. `src/hooks/useVenueSignupStats.ts` (neuer Hook)
3. `src/screens/VenueDetailScreen.tsx` (Reporting-Sektion, owner/admin-gated)

Plus: Typ-Eintrag der RPC in `src/types/database.types.ts`.

## Design-Constraints

Farben nur aus `colors.ts`, `StyleSheet.create`, 8px-Abstände, keine Emojis,
deutsche UI mit Umlauten.
