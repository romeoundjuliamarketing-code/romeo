# Team & Studio

## Coach-System

Peer-Vouching über `coach_nominations` + `coach_votes`:

- Nominierung → mindestens 1 Bestätigung nötig
- Kein Coach im Team → jedes Mitglied darf bestätigen
- Coach vorhanden → nur Coaches dürfen bestätigen
- Selbst-Demotion → sofort via `self_demote_coach` RPC
- Selbst-Nominierung → clientseitig blockiert

## Einladungscode

Studio-Owner generiert 6-stelligen Code (7 Tage gültig).
Mitglied löst Code ein → `studio_memberships`-Eintrag + `profiles.studio_id` gesetzt.

**RPCs:**
- `create_studio_invite(p_studio_id)` → gibt Code zurück
- `accept_studio_invite(p_code)` → gibt studio_id zurück

## Studio erstellen

Nur mit aktivem `studio`-Plan möglich.
RPC: `create_studio_with_owner(p_name, p_city)` — setzt `studios.owner_user_id`.

## Tabellen

| Tabelle | Inhalt |
|---|---|
| `studios` | Studio-Info, owner_user_id |
| `studio_memberships` | Aktive Seat-Zuweisungen |
| `studio_invite_codes` | Aktiver Einladungscode pro Studio |
| `coach_nominations` | Offene Nominierungen |
| `coach_votes` | Abstimmungen |

## Stundenplan

Coaches können den Studio-Stundenplan direkt in der App bearbeiten.
Hook: `src/hooks/useStudioScheduleEditor.ts`

## Wichtige Dateien

- `src/hooks/useStudioInvite.ts`
- `src/screens/TeamScreen.tsx`
- `supabase/migrations/20260410200000_add_studio_invite_rpcs.sql`
