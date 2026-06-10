# Implementierungsplan: Ausfall-Push ("Einheit absagen")

## Überblick
Studio-Staff (Owner oder Coach) sagt eine konkrete Einheit des Studio-Stundenplans für ein bestimmtes Datum ab. Server-RPC validiert Staff-Berechtigung via `is_studio_staff`, ermittelt alle aktiven Mitglieder (`studio_member_contracts.status = 'active'`) und notifiziert sie per `notify_user`. Push-Versand läuft transparent über die bestehende `send_push_notification`-Pipeline.

Keine neue Tabelle, kein State-Manager.

## 1. Migration

**Datei:** `supabase/migrations/20260610120001_add_cancel_schedule_session_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION cancel_schedule_session(
  p_studio_id   uuid,
  p_schedule_id uuid,
  p_session_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_training_name text;
  v_studio_name   text;
  v_recipient     uuid;
  v_count         integer := 0;
  v_date_label    text;
BEGIN
  IF NOT is_studio_staff(p_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung, um Einheiten dieses Studios abzusagen.';
  END IF;

  SELECT training_name
  INTO v_training_name
  FROM studio_schedule
  WHERE id = p_schedule_id
    AND studio_id = p_studio_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Diese Einheit gehört nicht zu diesem Studio oder ist nicht aktiv.';
  END IF;

  IF p_session_date < current_date THEN
    RAISE EXCEPTION 'Vergangene Termine können nicht abgesagt werden.';
  END IF;

  SELECT name INTO v_studio_name FROM studios WHERE id = p_studio_id;
  v_date_label := TO_CHAR(p_session_date, 'DD.MM.YYYY');

  FOR v_recipient IN
    SELECT DISTINCT c.user_id
    FROM studio_member_contracts c
    JOIN profiles p ON p.id = c.user_id
    WHERE c.studio_id = p_studio_id
      AND c.status    = 'active'
      AND p.studio_id = p_studio_id
      AND c.user_id IS DISTINCT FROM auth.uid()
  LOOP
    PERFORM notify_user(
      v_recipient,
      'session_cancelled',
      'Training fällt aus',
      v_training_name || ' am ' || v_date_label || ' fällt aus.',
      jsonb_build_object(
        'studio_id',    p_studio_id,
        'schedule_id',  p_schedule_id,
        'session_date', p_session_date
      )
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION cancel_schedule_session(uuid, uuid, date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION cancel_schedule_session(uuid, uuid, date) TO authenticated;
```

### Types (`src/types/database.types.ts`)
```ts
cancel_schedule_session: {
  Args: { p_studio_id: string; p_schedule_id: string; p_session_date: string }
  Returns: number
}
```

## 2. Hook: `src/hooks/useCancelSession.ts`

```ts
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

interface CancelSessionArgs {
  studioId:    string;
  scheduleId:  string;
  sessionDate: string; // ISO "YYYY-MM-DD"
}

export function useCancelSession() {
  const [cancelling, setCancelling] = useState(false);

  const cancelSession = useCallback(
    async ({ studioId, scheduleId, sessionDate }: CancelSessionArgs) => {
      setCancelling(true);
      const { data, error } = await supabase.rpc('cancel_schedule_session', {
        p_studio_id:    studioId,
        p_schedule_id:  scheduleId,
        p_session_date: sessionDate,
      });
      setCancelling(false);
      if (error !== null) {
        reportNetworkError(error);
        return { error: error.message, notified: 0 };
      }
      reportNetworkSuccess();
      return { error: null, notified: typeof data === 'number' ? data : 0 };
    },
    [],
  );

  return { cancelling, cancelSession };
}
```

## 3. UI-Integration

**Ort:** `StundenplanSection.tsx` / `TrainingsplanTab.tsx` → `SessionRow`

Neue optionale Props in `SessionRowProps`:
```ts
onCancel?: (session: ScheduleDisplayItem) => void;
showCancel?: boolean;
```

Button in `SessionRow` wenn `showCancel === true`:
```tsx
<TouchableOpacity style={styles.cancelBtn} onPress={() => onCancel?.(session)}>
  <MaterialCommunityIcons name="calendar-remove-outline" size={16} color={colors.deleteRed} />
  <Text style={styles.cancelLabel}>Absagen</Text>
</TouchableOpacity>
```

## 4. UX: Confirmation-Dialog

Natives `Alert.alert` vor dem RPC-Call:
```ts
Alert.alert(
  'Einheit absagen?',
  `${session.training_name} am ${dateLabel} wird abgesagt. Alle aktiven Mitglieder erhalten sofort eine Benachrichtigung.`,
  [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Absagen', style: 'destructive', onPress: () => { void runCancel(session); } },
  ],
);
```

## Betroffene Dateien

| Datei | Art |
|---|---|
| `supabase/migrations/20260610120001_add_cancel_schedule_session_rpc.sql` | neu |
| `src/types/database.types.ts` | edit |
| `src/hooks/useCancelSession.ts` | neu |
| `src/screens/TrainingScreen.tsx` | edit (isStaff + studioId durchreichen) |
| `src/components/training/StundenplanSection.tsx` | edit |
| `src/components/training/TrainingsplanTab.tsx` | edit (SessionRow) |

## Offene Fragen
1. MVP nutzt `nextDateForWeekday` (nächstes Vorkommen des Wochentags). Soll Owner ein konkretes Datum wählen können?
2. Confirmation: Native Alert (MVP) oder poliertes Modal?
