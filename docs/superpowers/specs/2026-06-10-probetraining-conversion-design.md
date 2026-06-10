# Implementierungsplan: Probetraining Follow-up & Conversion

## Überblick
1. **Automatischer Follow-up** (pg_cron): 2 Tage nach bestätigtem Probetraining erhält der Besucher automatisch eine Push-Nachricht ("Wie war dein Probetraining?")
2. **Conversion-Stats-Karte** im TeamScreen: Wie viele Trial-Besucher wurden aktive Mitglieder?

**Entscheidung: pg_cron (Ansatz A)** — vollautomatisch, keine Extrakosten (Supabase-Standard), idempotent via `followup_sent_at`.

## 1. Migration

**Datei:** `supabase/migrations/20260610120005_add_trial_followup_and_stats.sql`

```sql
-- Idempotenz-Marker
ALTER TABLE trial_bookings ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS trial_bookings_followup_pending_idx
  ON trial_bookings (responded_at)
  WHERE status = 'confirmed' AND followup_sent_at IS NULL;

-- pg_cron aktivieren
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Batch-Sender (täglich, intern)
CREATE OR REPLACE FUNCTION send_trial_followups()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row record; v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT tb.id, tb.user_id, tb.studio_id, s.name AS studio_name
    FROM trial_bookings tb
    JOIN studios s ON s.id = tb.studio_id
    WHERE tb.status = 'confirmed'
      AND tb.followup_sent_at IS NULL
      AND tb.responded_at IS NOT NULL
      AND tb.responded_at <= now() - interval '2 days'
  LOOP
    PERFORM notify_user(
      v_row.user_id, 'trial_followup',
      'Wie war dein Probetraining?',
      'Wie war dein Probetraining bei ' || COALESCE(v_row.studio_name, 'dem Studio')
        || '? Hast du Fragen? Wir helfen dir gern weiter.',
      jsonb_build_object('booking_id', v_row.id, 'studio_id', v_row.studio_id)
    );
    UPDATE trial_bookings SET followup_sent_at = now(), updated_at = now() WHERE id = v_row.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;
REVOKE EXECUTE ON FUNCTION send_trial_followups() FROM PUBLIC, anon, authenticated;

-- Täglich 10:00 UTC
DO $$ BEGIN PERFORM cron.unschedule('trial_followups_daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('trial_followups_daily', '0 10 * * *', $$ SELECT send_trial_followups(); $$);

-- Conversion-Stats für Staff
CREATE OR REPLACE FUNCTION get_studio_trial_stats(p_studio_id uuid)
RETURNS TABLE (total_trials integer, converted integer, conversion_rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total integer; v_converted integer;
BEGIN
  IF NOT is_studio_staff(p_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für die Studio-Statistik.';
  END IF;
  SELECT count(DISTINCT user_id) INTO v_total FROM trial_bookings
  WHERE studio_id = p_studio_id AND status = 'confirmed';
  SELECT count(DISTINCT tb.user_id) INTO v_converted
  FROM trial_bookings tb
  JOIN studio_member_contracts c ON c.user_id = tb.user_id AND c.studio_id = tb.studio_id AND c.status = 'active'
  WHERE tb.studio_id = p_studio_id AND tb.status = 'confirmed';
  total_trials    := COALESCE(v_total, 0);
  converted       := COALESCE(v_converted, 0);
  conversion_rate := CASE WHEN COALESCE(v_total, 0) = 0 THEN 0
    ELSE round((v_converted::numeric / v_total::numeric) * 100, 1) END;
  RETURN NEXT;
END; $$;
GRANT EXECUTE ON FUNCTION get_studio_trial_stats(uuid) TO authenticated;
```

## 2. Types (`src/types/database.types.ts`)

```ts
// Functions
get_studio_trial_stats: {
  Args: { p_studio_id: string }
  Returns: { total_trials: number; converted: number; conversion_rate: number }[]
}
// trial_bookings.Row + Insert: followup_sent_at: string | null ergänzen
// Convenience Type:
export interface StudioTrialStats {
  total_trials: number; converted: number; conversion_rate: number;
}
```

## 3. Hook: `src/hooks/useStudioTrialStats.ts`

```ts
export function useStudioTrialStats(studioId: string, refetchTrigger = 0) {
  // stats: StudioTrialStats | null, loading: boolean
  // lädt get_studio_trial_stats einmalig + bei refetchTrigger
}
```

## 4. Komponente: `src/components/team/StudioTrialStatsCard.tsx`

Zeigt drei Kennzahlen nebeneinander:
- Probetrainings (total)
- Mitglied geworden (converted)
- Quote in % (accentBlue)

Darunter: Fortschrittsbalken (filled = converted, rest = nicht konvertiert).
Leer-Zustand: "Noch keine Probetrainings."

## 5. Einbindung: `src/screens/TeamScreen.tsx`

```tsx
{isCoach && (
  <StudioTrialStatsCard studioId={studioId} refetchTrigger={focusTrigger} />
)}
```
Platzierung: nach `StudioRequestsSection`.

## Verifikation
- `SELECT send_trial_followups();` manuell testen
- `SELECT * FROM get_studio_trial_stats('<uuid>');`
- `SELECT * FROM cron.job;` — Job vorhanden

## Betroffene Dateien

| Datei | Art |
|---|---|
| `supabase/migrations/20260610120005_add_trial_followup_and_stats.sql` | neu |
| `src/types/database.types.ts` | edit |
| `src/hooks/useStudioTrialStats.ts` | neu |
| `src/components/team/StudioTrialStatsCard.tsx` | neu |
| `src/screens/TeamScreen.tsx` | edit |
