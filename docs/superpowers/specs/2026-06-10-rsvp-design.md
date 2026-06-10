# Implementierungsplan: "Ich komme"-RSVP für Trainingseinheiten

## Überblick
Mitglieder können sich für eine konkrete Trainingseinheit (Datum + Stundenplan-Eintrag) anmelden. Owner/Coach sieht Teilnehmerliste und -anzahl. Toggle ohne Confirmation-Dialog.

Eine konkrete Session = `(schedule_id, session_date)`.

## 1. Migration

**Datei:** `supabase/migrations/20260610120002_add_schedule_rsvps.sql`

```sql
CREATE TABLE IF NOT EXISTS schedule_rsvps (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  schedule_id   uuid        NOT NULL REFERENCES studio_schedule(id)   ON DELETE CASCADE,
  session_date  date        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, schedule_id, session_date)
);

CREATE INDEX IF NOT EXISTS schedule_rsvps_session_idx
  ON schedule_rsvps (schedule_id, session_date);

ALTER TABLE schedule_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_rsvps_select" ON schedule_rsvps
  FOR SELECT USING (
    auth.uid() = user_id
    OR is_studio_staff(
      (SELECT ss.studio_id FROM studio_schedule ss WHERE ss.id = schedule_id)
    )
  );

-- Validierungshelfer (intern, nicht für API)
CREATE OR REPLACE FUNCTION _rsvp_resolve_studio(p_schedule_id uuid, p_date date)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_studio_id uuid; v_dow int; v_active boolean;
BEGIN
  SELECT ss.studio_id, ss.day_of_week, ss.is_active
    INTO v_studio_id, v_dow, v_active
  FROM studio_schedule ss WHERE ss.id = p_schedule_id;
  IF v_studio_id IS NULL THEN RAISE EXCEPTION 'Einheit nicht gefunden'; END IF;
  IF v_active IS NOT TRUE THEN RAISE EXCEPTION 'Einheit ist nicht aktiv'; END IF;
  IF ((EXTRACT(DOW FROM p_date)::int + 6) % 7) <> v_dow THEN
    RAISE EXCEPTION 'Datum passt nicht zum Wochentag der Einheit';
  END IF;
  RETURN v_studio_id;
END; $$;
REVOKE EXECUTE ON FUNCTION _rsvp_resolve_studio(uuid, date) FROM PUBLIC, anon, authenticated;

-- RSVP anmelden
CREATE OR REPLACE FUNCTION rsvp_session(p_schedule_id uuid, p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_studio_id uuid; v_uid uuid := auth.uid();
BEGIN
  v_studio_id := _rsvp_resolve_studio(p_schedule_id, p_date);
  IF NOT EXISTS (
    SELECT 1 FROM studio_member_contracts c
    WHERE c.user_id = v_uid AND c.studio_id = v_studio_id AND c.status = 'active'
  ) THEN RAISE EXCEPTION 'Nur aktive Mitglieder können sich anmelden'; END IF;

  INSERT INTO schedule_rsvps (user_id, schedule_id, session_date)
  VALUES (v_uid, p_schedule_id, p_date)
  ON CONFLICT (user_id, schedule_id, session_date) DO NOTHING;
END; $$;
GRANT EXECUTE ON FUNCTION rsvp_session(uuid, date) TO authenticated;

-- RSVP abmelden
CREATE OR REPLACE FUNCTION cancel_rsvp(p_schedule_id uuid, p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM schedule_rsvps
  WHERE user_id = auth.uid() AND schedule_id = p_schedule_id AND session_date = p_date;
END; $$;
GRANT EXECUTE ON FUNCTION cancel_rsvp(uuid, date) TO authenticated;

-- Teilnehmerliste (nur Staff)
CREATE OR REPLACE FUNCTION get_session_rsvps(p_schedule_id uuid, p_date date)
RETURNS TABLE (user_id uuid, name text, avatar_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_studio_id uuid;
BEGIN
  SELECT ss.studio_id INTO v_studio_id FROM studio_schedule ss WHERE ss.id = p_schedule_id;
  IF v_studio_id IS NULL OR NOT is_studio_staff(v_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  RETURN QUERY
  SELECT r.user_id, p.name, p.avatar_url
  FROM schedule_rsvps r JOIN profiles p ON p.id = r.user_id
  WHERE r.schedule_id = p_schedule_id AND r.session_date = p_date
  ORDER BY p.name NULLS LAST;
END; $$;
GRANT EXECUTE ON FUNCTION get_session_rsvps(uuid, date) TO authenticated;

-- Anzahl + eigener Status (alle authenticated)
CREATE OR REPLACE FUNCTION get_session_rsvp_count(p_schedule_id uuid, p_date date)
RETURNS TABLE (total integer, me_attending boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int, bool_or(r.user_id = auth.uid())
  FROM schedule_rsvps r
  WHERE r.schedule_id = p_schedule_id AND r.session_date = p_date;
$$;
GRANT EXECUTE ON FUNCTION get_session_rsvp_count(uuid, date) TO authenticated;
```

## 2. TypeScript-Typen (`src/types/database.types.ts`)

```ts
// Tables
schedule_rsvps: {
  Row: { id: string; user_id: string; schedule_id: string; session_date: string; created_at: string }
  Insert: { id?: string; user_id: string; schedule_id: string; session_date: string; created_at?: string }
  Update: { id?: string; user_id?: string; schedule_id?: string; session_date?: string; created_at?: string }
  Relationships: []
}
// Functions
rsvp_session:            { Args: { p_schedule_id: string; p_date: string }; Returns: undefined }
cancel_rsvp:             { Args: { p_schedule_id: string; p_date: string }; Returns: undefined }
get_session_rsvps:       { Args: { p_schedule_id: string; p_date: string }; Returns: { user_id: string; name: string | null; avatar_url: string | null }[] }
get_session_rsvp_count:  { Args: { p_schedule_id: string; p_date: string }; Returns: { total: number; me_attending: boolean }[] }
```

## 3. Datums-Helper

**Datei:** `src/utils/sessionDate.ts` (+ Unit-Test `sessionDate.test.ts`)

```ts
// Returns ISO "YYYY-MM-DD" for given weekday (0=Mon..6=Sun) in the current week
export function sessionDateForDow(dayOfWeek: number, today = new Date()): string {
  const todayDow = (today.getDay() + 6) % 7;
  const diff = dayOfWeek - todayDow;
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

## 4. Hook: `src/hooks/useScheduleRsvp.ts`

Optimistic toggle: update UI sofort, revert bei RPC-Fehler.

```ts
export function useScheduleRsvp(scheduleId: string, date: string, refetchTrigger = 0) {
  // count, meAttending, loading, toggling
  // toggle() → optimistic update → rsvp_session / cancel_rsvp → revert on error
  // loadParticipants() → get_session_rsvps (staff only)
}
```

## 5. Neue Komponenten

- `src/components/training/SessionRsvpControl.tsx` — Button + Zähler pro Session
- `src/components/training/SessionRsvpListModal.tsx` — Teilnehmerliste für Coach/Owner

## 6. Props-Durchreichung

```
TrainingScreen (profile.studio_id, profile.is_coach)
  → StundenplanSection (studioId, isCoach)
    → DayBlock (rsvpEnabled, isCoach)
      → SessionRow
        → SessionRsvpControl (scheduleId, dayOfWeek, isCoach)
```

RSVP nur aktiv wenn: `!hasPersonalSchedule && hasStudio && !editMode`

## Betroffene Dateien

| Datei | Art |
|---|---|
| `supabase/migrations/20260610120002_add_schedule_rsvps.sql` | neu |
| `src/types/database.types.ts` | edit |
| `src/utils/sessionDate.ts` + `sessionDate.test.ts` | neu |
| `src/hooks/useScheduleRsvp.ts` | neu |
| `src/components/training/SessionRsvpControl.tsx` | neu |
| `src/components/training/SessionRsvpListModal.tsx` | neu |
| `src/screens/TrainingScreen.tsx` | edit |
| `src/components/training/StundenplanSection.tsx` | edit |
| `src/components/training/TrainingsplanTab.tsx` | edit |
