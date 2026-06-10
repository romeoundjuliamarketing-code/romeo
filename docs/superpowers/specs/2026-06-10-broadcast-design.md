# Implementierungsplan: Broadcast

## Überblick
Studio-Staff (Owner/Coach) sendet eine Freitextnachricht an alle aktiven Mitglieder + Staff des Studios. Push + In-App-Notification über bestehende `notify_user`-Infrastruktur. Rate-Limit: 3 Broadcasts/Tag/Studio (gezählt über `notifications`-Tabelle, kein extra Log nötig).

## 1. Migration

**Datei:** `supabase/migrations/20260610120004_add_broadcast_to_studio_members.sql`

```sql
CREATE OR REPLACE FUNCTION broadcast_to_studio_members(
  p_studio_id uuid,
  p_title     text,
  p_body      text
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sender      uuid := auth.uid();
  v_title       text := btrim(p_title);
  v_body        text := btrim(p_body);
  v_studio_name text;
  v_today_count integer;
  v_recipient   uuid;
  v_count       integer := 0;
BEGIN
  IF NOT is_studio_staff(p_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung, um Nachrichten an dieses Studio zu senden.';
  END IF;

  IF v_title IS NULL OR length(v_title) = 0 THEN RAISE EXCEPTION 'Titel darf nicht leer sein.'; END IF;
  IF v_body  IS NULL OR length(v_body)  = 0 THEN RAISE EXCEPTION 'Nachricht darf nicht leer sein.'; END IF;
  IF length(v_title) > 50  THEN RAISE EXCEPTION 'Titel darf maximal 50 Zeichen lang sein.'; END IF;
  IF length(v_body)  > 200 THEN RAISE EXCEPTION 'Nachricht darf maximal 200 Zeichen lang sein.'; END IF;

  -- Rate limit: max 3 broadcasts per studio per day
  SELECT count(DISTINCT created_at) INTO v_today_count
  FROM notifications
  WHERE type = 'studio_broadcast'
    AND data->>'studio_id' = p_studio_id::text
    AND created_at >= date_trunc('day', now());

  IF v_today_count >= 3 THEN
    RAISE EXCEPTION 'Tageslimit erreicht: maximal 3 Broadcasts pro Tag.';
  END IF;

  SELECT name INTO v_studio_name FROM studios WHERE id = p_studio_id;

  FOR v_recipient IN
    SELECT DISTINCT recipient FROM (
      SELECT c.user_id AS recipient
      FROM studio_member_contracts c
      WHERE c.studio_id = p_studio_id AND c.status IN ('active', 'cancellation_requested')
      UNION
      SELECT s.owner_user_id AS recipient FROM studios s
      WHERE s.id = p_studio_id AND s.owner_user_id IS NOT NULL
      UNION
      SELECT p.id AS recipient FROM profiles p
      WHERE p.studio_id = p_studio_id AND p.is_coach = true
    ) AS recipients
    WHERE recipient IS DISTINCT FROM v_sender
  LOOP
    PERFORM notify_user(
      v_recipient, 'studio_broadcast', v_title, v_body,
      jsonb_build_object('studio_id', p_studio_id, 'studio_name', v_studio_name, 'sender_id', v_sender)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END; $$;

REVOKE EXECUTE ON FUNCTION broadcast_to_studio_members(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION broadcast_to_studio_members(uuid, text, text) TO authenticated;
```

## 2. Hook: `src/hooks/useStudioBroadcast.ts`

```ts
export function useStudioBroadcast() {
  // sending: boolean, error: string | null
  // sendBroadcast(studioId, title, body): Promise<number | null>
  //   → supabase.rpc('broadcast_to_studio_members', ...)
  //   → returns count of notified users, null on error
}
```

## 3. Komponente: `src/components/team/BroadcastSheet.tsx`

Bottom-Sheet (Modal, KeyboardAvoidingView, gleiche Styles wie TeamScreen-Sheets):
- Titel-Input (max 50 Zeichen) + Zeichenzähler
- Nachricht-Input multiline (max 200 Zeichen) + Zeichenzähler
- Senden-Button disabled wenn leer oder `sending`
- Nach Erfolg: "X Mitglieder benachrichtigt" + auto-close nach 1.5s
- Bei Fehler (z.B. Rate-Limit): Fehlertext in `colors.deleteRed`

## 4. Einbindung: `src/screens/TeamScreen.tsx`

```tsx
// Im Trainer-Aktionen coachGrid (nur studio-Plan):
{entitlement.tier === 'studio' && (
  <TouchableOpacity style={styles.coachGridBtn} onPress={() => setBroadcastVisible(true)}>
    <MaterialCommunityIcons name="broadcast" size={22} color={colors.accentBlue} />
    <Text style={styles.coachGridLabel}>Broadcast</Text>
  </TouchableOpacity>
)}

// Modal:
<BroadcastSheet visible={broadcastVisible} studioId={studioId} onClose={() => setBroadcastVisible(false)} />
```

## Betroffene Dateien

| Datei | Art |
|---|---|
| `supabase/migrations/20260610120004_add_broadcast_to_studio_members.sql` | neu |
| `src/types/database.types.ts` | edit |
| `src/hooks/useStudioBroadcast.ts` | neu |
| `src/components/team/BroadcastSheet.tsx` | neu |
| `src/screens/TeamScreen.tsx` | edit |
