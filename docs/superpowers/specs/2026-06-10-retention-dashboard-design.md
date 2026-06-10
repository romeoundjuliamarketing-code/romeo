# Implementierungsplan: Retention-Dashboard

## Überblick
Studio-Owner/Coach sieht Mitglieder, die seit 14+ Tagen kein Training hatten. Mit einem Tap sendet er/sie eine "Wir vermissen dich"-Push-Nachricht. Anti-Spam: Button pro Mitglied 24h deaktiviert nach Tap.

## 1. Migration

**Datei:** `supabase/migrations/20260610120003_add_retention_dashboard.sql`

```sql
-- Inaktive Mitglieder eines Studios (Staff only)
CREATE OR REPLACE FUNCTION get_studio_inactive_members(
  p_studio_id     uuid,
  p_days_inactive integer DEFAULT 14
)
RETURNS TABLE (user_id uuid, name text, avatar_url text, last_session_date date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_studio_staff(p_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Studio.';
  END IF;

  RETURN QUERY
  SELECT c.user_id, p.name, p.avatar_url, la.last_date AS last_session_date
  FROM studio_member_contracts c
  JOIN profiles p ON p.id = c.user_id
  LEFT JOIN LATERAL (
    SELECT max(a.session_date) AS last_date
    FROM attendance_logs a
    WHERE a.user_id = c.user_id AND a.studio_id = p_studio_id
  ) la ON true
  WHERE c.studio_id = p_studio_id
    AND c.status    = 'active'
    AND (la.last_date IS NULL
         OR la.last_date <= (current_date - make_interval(days => p_days_inactive)))
  ORDER BY la.last_date ASC NULLS FIRST, p.name ASC;
END; $$;
GRANT EXECUTE ON FUNCTION get_studio_inactive_members(uuid, integer) TO authenticated;

-- "Wir vermissen dich"-Push an ein Mitglied (Staff only)
CREATE OR REPLACE FUNCTION send_retention_nudge(p_studio_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_studio_name text;
BEGIN
  IF NOT is_studio_staff(p_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung für dieses Studio.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM studio_member_contracts
    WHERE user_id = p_user_id AND studio_id = p_studio_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'Mitglied gehört nicht zu diesem Studio.'; END IF;

  SELECT name INTO v_studio_name FROM studios WHERE id = p_studio_id;
  PERFORM notify_user(
    p_user_id, 'retention_nudge', 'Wir vermissen dich',
    'Dein Team bei ' || COALESCE(v_studio_name, 'deinem Studio')
      || ' freut sich auf dein nächstes Training.',
    jsonb_build_object('studio_id', p_studio_id)
  );
END; $$;
GRANT EXECUTE ON FUNCTION send_retention_nudge(uuid, uuid) TO authenticated;
```

## 2. Types (`src/types/database.types.ts`)
```ts
get_studio_inactive_members: {
  Args: { p_studio_id: string; p_days_inactive?: number }
  Returns: { user_id: string; name: string | null; avatar_url: string | null; last_session_date: string | null }[]
}
send_retention_nudge: { Args: { p_studio_id: string; p_user_id: string }; Returns: undefined }
```

## 3. Hook: `src/hooks/useRetentionDashboard.ts`

```ts
export interface InactiveMember {
  userId: string; name: string | null; avatarUrl: string | null; lastSessionDate: string | null;
}
export function useRetentionDashboard(studioId: string | null, refetchTrigger = 0) {
  // members, loading, error
  // sendNudge(userId): Promise<{ error: string | null }>
  // refetch()
}
```

## 4. UI-Komponente: `src/components/team/InactiveMembersSection.tsx`

- Rendert `null` wenn `members.length === 0` (Sektion nur sichtbar wenn inaktive vorhanden)
- Pro Mitglied: Avatar + Name + letztes Training ("Noch nie trainiert" / "Zuletzt: DD.MM.YY")
- Bell-Button rechts: sendet Nudge; nach Tap 24h disabled (AsyncStorage-Key `retention_nudge:<userId>`)
- Anti-Spam: `AsyncStorage.multiGet` beim Init, `nudgedUntil` State als `Record<string, number>`

## 5. Einbindung: `src/screens/TeamScreen.tsx`

```tsx
{isCoach && <InactiveMembersSection studioId={studioId} />}
```
Platzierung: nach `StudioRequestsSection`.

## Betroffene Dateien

| Datei | Art |
|---|---|
| `supabase/migrations/20260610120003_add_retention_dashboard.sql` | neu |
| `src/types/database.types.ts` | edit |
| `src/hooks/useRetentionDashboard.ts` | neu |
| `src/components/team/InactiveMembersSection.tsx` | neu |
| `src/screens/TeamScreen.tsx` | edit |
