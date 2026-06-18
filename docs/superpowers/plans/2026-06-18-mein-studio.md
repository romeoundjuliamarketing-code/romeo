# „Mein Studio" — Implementierungsplan

> **Für agentische Worker:** Dieser Plan wird task-für-task von Sonnet-Subagenten umgesetzt
> (superpowers:subagent-driven-development). Opus reviewt zwischen den Tasks. Schritte sind
> als Checkbox (`- [ ]`) markiert.

**Goal:** Die heute über vier Einstiegspunkte verstreuten Studio-Funktionen in **eine**
rollenbewusste „Mein Studio"-Seite (Schaufenster + Inline-Edit) mit Owner-Leiste und drei
fokussierten Unterseiten zusammenführen, das doppelte Trainer-Konzept auf eines reduzieren
und Naming vereinheitlichen.

**Architecture:** `StudioDetailScreen` wird die einzige Studio-Seite — Gäste sehen das
Schaufenster, Owner/Trainer sehen dieselbe Seite plus Inline-Edit (✎/+) und eine Owner-Leiste
mit Badge-Chips. Jeder Chip öffnet eine eigene NativeStack-Unterseite. `StudioProfileEditScreen`
und der alte `TeamScreen` entfallen. Trainer werden direkt ernannt (eine SECURITY-DEFINER-RPC
setzt `profiles.is_coach` **und** schreibt `studio_coaches`); das Peer-Voting wird aus der UI
entfernt.

**Tech Stack:** React Native + Expo SDK 55, React Navigation (NativeStack), Supabase
(Postgres/RPCs, manuelle Typen), TypeScript strict.

## Global Constraints

- **Verifikations-Gate:** Nach JEDER Codeänderung `npx tsc --noEmit` (muss fehlerfrei sein).
  `npx jest` zusätzlich, wenn ein Hook/Util mit Logik geändert wird. **Keine Tests für reine
  UI-Screens** (CLAUDE.md).
- **TypeScript:** strict, `any` verboten, Typen explizit.
- **Design:** Farben nur aus `src/theme/colors.ts` (keine Hardcoded-Hex), Abstände nur in
  8px-Vielfachen, kein Inline-`style={{}}` (immer `StyleSheet.create`).
- **Icons:** nur `@expo/vector-icons`, keine Emojis/Unicode-Symbole.
- **Sprache:** UI-Texte Deutsch, Umlaute immer als Ä/Ö/Ü/ä/ö/ü; Code-Kommentare Englisch.
- **App-Name in Nutzertexten:** **„Sparr"** (nie „Kombat App").
- **Datenzugriff:** Hook-Muster `useXxx(refetchTrigger = 0)`; Mutationen rufen `refetch` explizit.
- **Supabase:** Schreibende Studio-Logik über SECURITY-DEFINER-RPCs, nicht im Client. Typen
  manuell in `src/types/database.types.ts` pflegen (kein codegen).
- **Android-Pflicht:** Neue Screens mit `SafeAreaView`/Insets; Modals/Sheets fangen den
  Hardware-Back ab.

---

## Dateistruktur (Überblick)

**Neu:**
- `supabase/migrations/20260619120000_unify_studio_trainer.sql` — Ernennen/Entfernen-RPCs.
- `src/hooks/useStudioTrainer.ts` — Client-Wrapper für die neuen RPCs.
- `src/components/studio/StudioOwnerBar.tsx` — Owner-Leiste mit Badge-Chips.
- `src/screens/studio/StudioRequestsScreen.tsx` — Unterseite „Anfragen".
- `src/screens/studio/StudioMembersScreen.tsx` — Unterseite „Mitglieder".
- `src/screens/studio/StudioInviteScreen.tsx` — Unterseite „Code".

**Geändert:**
- `src/screens/StudioDetailScreen.tsx` — wird die einzige Studio-Seite (Schaufenster + Owner-Modus).
- `src/navigation/types.ts` / `src/navigation/RootNavigator.tsx` — neue Routen, alte raus.
- `src/screens/ProfilScreen.tsx` + `src/components/profil/{OverviewTab,TeamPickerCard}.tsx`
  — „Team" → „Mein Studio", Navigationsziel `StudioDetail`.
- `src/hooks/useStudioCoaches.ts` — `addCoaches`/`removeCoach` rufen die neuen RPCs.
- `src/components/studio/StudioCoachesSection.tsx` — Ernennen-UI, keine Voting-Bezüge.
- diverse Dateien mit „Kombat App" → „Sparr".

**Entfällt (nach Migration aller Inhalte):**
- `src/screens/TeamScreen.tsx`, `src/screens/StudioProfileEditScreen.tsx`,
  `src/components/team/NominationCard.tsx`, Nutzung von `useCoachNominations` in der UI.

---

## Phase 0 — Backend: Trainer als ein Konzept

### Task 1: RPCs `appoint_studio_trainer` / `remove_studio_trainer`

**Files:**
- Create: `supabase/migrations/20260619120000_unify_studio_trainer.sql`
- Modify: `src/types/database.types.ts` (Functions-Block: zwei Einträge ergänzen)

**Interfaces:**
- Produces (RPC): `appoint_studio_trainer(p_user_id uuid) returns void`,
  `remove_studio_trainer(p_user_id uuid) returns void`.

- [ ] **Step 1: Migration schreiben**

```sql
-- Unify trainer: appointment sets is_coach AND studio_coaches in one step.
-- Replaces the peer-voting flow for assigning trainers.

CREATE OR REPLACE FUNCTION public.appoint_studio_trainer(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid;
  v_caller uuid := auth.uid();
BEGIN
  -- Caller must be owner or existing coach of a studio.
  SELECT s.id INTO v_studio
  FROM public.studios s
  WHERE s.owner_user_id = v_caller
  LIMIT 1;

  IF v_studio IS NULL THEN
    SELECT p.studio_id INTO v_studio
    FROM public.profiles p
    WHERE p.id = v_caller AND p.is_coach = true AND p.studio_id IS NOT NULL;
  END IF;

  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Target must be a member of the caller's studio.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id AND p.studio_id = v_studio
  ) THEN
    RAISE EXCEPTION 'target is not a member of this studio';
  END IF;

  UPDATE public.profiles SET is_coach = true WHERE id = p_user_id;

  INSERT INTO public.studio_coaches (studio_id, user_id, role)
  VALUES (v_studio, p_user_id, NULL)
  ON CONFLICT (studio_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_studio_trainer(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio uuid;
  v_caller uuid := auth.uid();
BEGIN
  SELECT s.id INTO v_studio
  FROM public.studios s
  WHERE s.owner_user_id = v_caller
  LIMIT 1;

  IF v_studio IS NULL THEN
    SELECT p.studio_id INTO v_studio
    FROM public.profiles p
    WHERE p.id = v_caller AND p.is_coach = true AND p.studio_id IS NOT NULL;
  END IF;

  IF v_studio IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Owner darf sich nicht selbst die Trainer-Rechte nehmen (bleibt verwaltungsfähig als Owner).
  UPDATE public.profiles SET is_coach = false WHERE id = p_user_id AND studio_id = v_studio;
  DELETE FROM public.studio_coaches WHERE studio_id = v_studio AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.appoint_studio_trainer(uuid) FROM public;
REVOKE ALL ON FUNCTION public.remove_studio_trainer(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.appoint_studio_trainer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_studio_trainer(uuid) TO authenticated;
```

- [ ] **Step 2: Typen in `src/types/database.types.ts` ergänzen**

Im `Functions`-Block (Stil der bestehenden Einträge übernehmen) hinzufügen:

```ts
appoint_studio_trainer: {
  Args: { p_user_id: string }
  Returns: undefined
}
remove_studio_trainer: {
  Args: { p_user_id: string }
  Returns: undefined
}
```

- [ ] **Step 3: tsc-Gate**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 4: Migration anwenden + manuell verifizieren**

Migration in Supabase einspielen (durch den User/Owner). Manueller Smoke-Test in SQL:
ein Test-Mitglied ernennen → `profiles.is_coach = true` UND Zeile in `studio_coaches`;
entfernen → beides zurückgesetzt. Aufruf durch Nicht-Owner/Nicht-Coach → `not authorized`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260619120000_unify_studio_trainer.sql src/types/database.types.ts
git commit -m "feat(studio): direct trainer appointment RPCs (unify is_coach + studio_coaches)"
```

### Task 2: Hook `useStudioTrainer`

**Files:**
- Create: `src/hooks/useStudioTrainer.ts`

**Interfaces:**
- Consumes: RPCs aus Task 1.
- Produces: `useStudioTrainer(): { appoint: (userId: string) => Promise<{ error: string | null }>; remove: (userId: string) => Promise<{ error: string | null }>; loading: boolean }`.

- [ ] **Step 1: Hook implementieren**

```ts
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useStudioTrainer(): {
  appoint: (userId: string) => Promise<{ error: string | null }>;
  remove: (userId: string) => Promise<{ error: string | null }>;
  loading: boolean;
} {
  const [loading, setLoading] = useState(false);

  const appoint = useCallback(async (userId: string) => {
    setLoading(true);
    const { error } = await supabase.rpc('appoint_studio_trainer', { p_user_id: userId });
    setLoading(false);
    return { error: error?.message ?? null };
  }, []);

  const remove = useCallback(async (userId: string) => {
    setLoading(true);
    const { error } = await supabase.rpc('remove_studio_trainer', { p_user_id: userId });
    setLoading(false);
    return { error: error?.message ?? null };
  }, []);

  return { appoint, remove, loading };
}
```

- [ ] **Step 2: tsc-Gate** — `npx tsc --noEmit`, keine Fehler.
- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStudioTrainer.ts
git commit -m "feat(studio): useStudioTrainer hook for appoint/remove"
```

### Task 3: `useStudioCoaches` auf RPCs umstellen

**Files:**
- Modify: `src/hooks/useStudioCoaches.ts:76-129`

**Interfaces:**
- Consumes: `useStudioTrainer` (Task 2).
- Produces (unverändert nach außen): `addCoaches(userIds)`, `removeCoach(userId)` rufen jetzt
  intern `appoint`/`remove` statt direktem Table-Insert/Delete; `updateCoachRole` bleibt
  (Rollentext-Update auf `studio_coaches`).

- [ ] **Step 1:** In `addCoaches` den direkten `.from('studio_coaches').insert(...)` ersetzen
  durch eine Schleife/`Promise.all` über `supabase.rpc('appoint_studio_trainer', { p_user_id: id })`.
  In `removeCoach` den `.from('studio_coaches').delete()` ersetzen durch
  `supabase.rpc('remove_studio_trainer', { p_user_id: userId })`. `addCoach` (Single) analog
  oder entfernen, falls ungenutzt (vorher `grep -rn "addCoach\b" src/`).
- [ ] **Step 2: tsc-Gate** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStudioCoaches.ts
git commit -m "refactor(studio): coach add/remove via unified trainer RPCs"
```

---

## Phase 1 — Eine Studio-Seite (Merge + Einstieg)

### Task 4: Inline-Edit in `StudioDetailScreen` integrieren

`StudioProfileEditScreen` (`src/screens/StudioProfileEditScreen.tsx`) liefert die Edit-Logik:
`uploadImage`-Helper, Banner/Avatar-Picker, Disziplinen-Toggle, „Über uns", Adresse + Geocoding,
Featured-Fighters-Picker (`MemberMultiPickerSheet`), Karten-Sichtbarkeits-CTA (WhatsApp).
Diese werden in `StudioDetailScreen` integriert, gegated über `isOwner`.

**Files:**
- Modify: `src/screens/StudioDetailScreen.tsx`
- Referenz (Quelle, danach gelöscht): `src/screens/StudioProfileEditScreen.tsx`

**Interfaces:**
- Consumes: `useStudioProfile`, `useFeaturedFighters` (beide schon importiert), `useEntitlement`,
  `MemberMultiPickerSheet`.

- [ ] **Step 1:** `uploadImage`-Helper (Z. 40-63 der Edit-Datei) nach `StudioDetailScreen`
  übernehmen (oder nach `src/utils/uploadStudioImage.ts` auslagern, falls auch anderswo genutzt —
  vorher `grep`).
- [ ] **Step 2:** Owner-Edit-Affordances pro Schaufenster-Sektion ergänzen, jeweils nur wenn
  `isOwner === true`: Banner/Avatar tappbar (Picker), Stift an „Disziplinen"/„Über uns"/
  „Standort", Plus an „Unsere Trainer"/„Featured Fighters". Editier-Zustände als lokale States
  wie in der Edit-Datei (`description`, `selectedDisciplines`, `address`, `lat`, `lng`,
  `bannerUri`, `avatarUri`, `memberPickerVisible`). Speichern persistiert via
  `supabase.from('studios').update(...)` (wie `handleSave`) + `refetch`.
- [ ] **Step 3:** Karten-Sichtbarkeits-Block (Status-Dot + WhatsApp-CTA „29 EUR/Monat") aus der
  Edit-Datei (Z. 269-297) als Owner-Sektion übernehmen.
- [ ] **Step 4:** `MemberMultiPickerSheet` für Featured Fighters einbinden (wie Edit-Datei
  Z. 420-430). Hardware-Back im Sheet sicherstellen.
- [ ] **Step 5: tsc-Gate** — `npx tsc --noEmit`.
- [ ] **Step 6:** Manuell prüfen (Simulator iOS + Android-Emulator): als Owner Banner/Text/
  Disziplinen ändern → speichern → als Gast identisch sichtbar.
- [ ] **Step 7: Commit**

```bash
git add src/screens/StudioDetailScreen.tsx
git commit -m "feat(studio): inline owner editing on the studio page"
```

### Task 5: Einstieg „Mein Studio" + Routen-Umbau

**Files:**
- Modify: `src/navigation/types.ts:12-16,42` (Route `Team` entfernen, `StudioProfileEdit` entfernen)
- Modify: `src/navigation/RootNavigator.tsx:51,83` (Screen-Registrierungen `Team`/`StudioProfileEdit` entfernen)
- Modify: `src/screens/ProfilScreen.tsx:202-209` (`onViewTeam` → `navigation.navigate('StudioDetail', { studioId: currentStudio.id })`)
- Modify: `src/components/profil/TeamPickerCard.tsx:128,162` und `src/components/profil/OverviewTab.tsx`
  (Label „Team" → „Mein Studio", „Team beitreten" → „Studio beitreten"; Prop `onViewTeam` ggf.
  in `onOpenStudio` umbenennen — konsistent in beiden Dateien + ProfilScreen)

**Interfaces:**
- Consumes: bestehende `StudioDetail`-Route.

- [ ] **Step 1:** `StudioProfileEdit`-Navigation entfernen: in `StudioDetailScreen.tsx:134`
  (`onEditPress`) und überall sonst (`grep -rn "StudioProfileEdit" src/`). `StudioHero`-Prop
  `onEditPress` so anpassen, dass der Stift jetzt Inline-Edit triggert statt zu navigieren.
- [ ] **Step 2:** Profil-Einstieg: `onViewTeam` umverdrahten auf `StudioDetail`. Labels in
  `TeamPickerCard`/`OverviewTab` auf „Mein Studio" anpassen.
- [ ] **Step 3:** Routen `Team` und `StudioProfileEdit` aus `types.ts` + `RootNavigator.tsx`
  entfernen.
- [ ] **Step 4:** Dateien löschen: `src/screens/StudioProfileEditScreen.tsx`. (TeamScreen erst in
  Phase 2, nachdem seine Inhalte migriert sind — hier nur die Edit-Datei.)
- [ ] **Step 5: tsc-Gate** — `npx tsc --noEmit` (fängt verwaiste Imports/Referenzen).
- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(studio): single studio page, drop StudioProfileEdit + Team route rename"
```

---

## Phase 2 — Owner-Leiste + Unterseiten

### Task 6: Routen für die Unterseiten registrieren

**Files:**
- Modify: `src/navigation/types.ts` (drei Routen ergänzen)
- Modify: `src/navigation/RootNavigator.tsx` (drei Screens registrieren)

**Interfaces:**
- Produces (Routen): `StudioRequests: { studioId: string }`,
  `StudioMembers: { studioId: string; studioName: string }`,
  `StudioInvite: { studioId: string }`.

- [ ] **Step 1:** In `types.ts` die drei Routen ergänzen (Stil wie `StudioDetail`).
- [ ] **Step 2:** In `RootNavigator.tsx` drei `AppStack.Screen` registrieren (Komponenten aus
  Task 7-9; bis dahin ggf. Platzhalter-Import, der im selben Commit mit-erstellt wird).
- [ ] **Step 3: tsc-Gate** nachdem Task 7-9 existieren. Commit gemeinsam mit Task 9.

### Task 7: Unterseite „Anfragen"

Konsolidiert alle eingehenden Requests. `StudioRequestsSection`
(`src/components/team/StudioRequestsSection.tsx`) deckt Beitritt/Probetraining/Drop-in/
Mitgliedschaft/Kündigung bereits ab (nutzt `useStudioRequests` + `useMembershipActions`) und
wird hier als Seiteninhalt wiederverwendet.

**Files:**
- Create: `src/screens/studio/StudioRequestsScreen.tsx`
- Reuse: `src/components/team/StudioRequestsSection.tsx` (ggf. nach `src/components/studio/`
  verschieben, falls `team/` aufgelöst wird — sonst belassen)

**Interfaces:**
- Consumes: Route `StudioRequests`, `StudioRequestsSection`.

- [ ] **Step 1:** Screen mit `SafeAreaView` (`edges={['top']}`), Header mit Back-Button +
  Titel „Anfragen", `ScrollView` → `<StudioRequestsSection studioId={studioId} />`.
- [ ] **Step 2: tsc-Gate** — `npx tsc --noEmit`.

### Task 8: Unterseite „Mitglieder" (mit Trainer-Ernennung)

Übernimmt die Mitglieder-/Trainer-Logik aus `TeamScreen.tsx` (Mitgliederliste, Ranking,
Action-Sheet), ersetzt aber die Nominierungs-Aktionen durch direktes Ernennen/Entfernen
(`useStudioTrainer`) und „aus Studio entfernen" (`useStudio().removeMember`).

**Files:**
- Create: `src/screens/studio/StudioMembersScreen.tsx`
- Reuse: `useCoachNominations` NUR für `teamMembers`/`teamCoaches`-Laden — oder besser einen
  schlanken Member-Loader nutzen. (Vorher prüfen: lädt ein anderer Hook bereits die
  Studio-Mitglieder ohne Voting-Ballast? `grep -rn "studio_id" src/hooks/useStudio.ts`.)

**Interfaces:**
- Consumes: Route `StudioMembers`, `useStudioTrainer` (Task 2), `useStudio`.

- [ ] **Step 1:** Mitgliederliste + XP-Ranking rendern (Logik aus `TeamScreen.tsx:134-407`
  übernehmen, ohne Paywall-Sonderfall neu zu erfinden — bestehendes Verhalten beibehalten).
- [ ] **Step 2:** Action-Sheet pro Mitglied: „Zum Trainer ernennen" (`appoint`), „Trainer-Rolle
  entfernen" (`remove`), „Aus Studio entfernen" (`removeMember`). Keine Nominierungs-/Vote-Aufrufe.
- [ ] **Step 3:** Nach jeder Aktion betroffene Hooks `refetch`en.
- [ ] **Step 4: tsc-Gate** — `npx tsc --noEmit`.

### Task 9: Unterseite „Code"

Übernimmt den Einladungscode-Block aus `TeamScreen.tsx:566-628` (inkl. Seat-Auslastung).

**Files:**
- Create: `src/screens/studio/StudioInviteScreen.tsx`
- Reuse: `useStudioInvite`, `useEntitlement`

**Interfaces:**
- Consumes: Route `StudioInvite`, `useStudioInvite`, `useEntitlement`.

- [ ] **Step 1:** Code anzeigen/erzeugen/teilen + Seat-Track (Logik aus `TeamScreen`).
- [ ] **Step 2:** Share-Text auf **„Sparr"** korrigieren: „Tritt unserem Team bei! Gib diesen
  Code in der Sparr-App ein: {code}".
- [ ] **Step 3: tsc-Gate** — `npx tsc --noEmit`.
- [ ] **Step 4: Commit (Task 6-9 gemeinsam)**

```bash
git add -A
git commit -m "feat(studio): Anfragen/Mitglieder/Code sub-pages + routes"
```

### Task 10: `StudioOwnerBar` + Einbindung in die Studio-Seite

**Files:**
- Create: `src/components/studio/StudioOwnerBar.tsx`
- Modify: `src/screens/StudioDetailScreen.tsx` (Leiste oben einsetzen, nur `canManage`)

**Interfaces:**
- Consumes: `useStudioRequests(studioId)` (für Badge-Count), Navigation.
- Produces: `<StudioOwnerBar studioId studioName onOpenAnnouncement onOpenPlanSparring />`
  rendert Chips: **Anfragen [N]**, **Mitglieder**, **Code**, **Ankündigung**, **Sparring planen**.

- [ ] **Step 1:** Komponente mit Chip-Reihe (darf auf zwei Zeilen umbrechen, `flexWrap: 'wrap'`,
  8px-Gaps). Badge-Count = Summe der offenen Requests aus `useStudioRequests`
  (`trialBookings + dropInBookings + membershipRequests + cancellationRequests + joinRequests`).
- [ ] **Step 2:** Chips navigieren zu `StudioRequests`/`StudioMembers`/`StudioInvite`;
  „Ankündigung" und „Sparring planen" öffnen die jeweiligen Sheets/Modals (aus `TeamScreen`
  übernommen — `useAnnouncement` + Announcement-Modal; `CreateSparringSheet` + `useSparringActions`).
- [ ] **Step 3:** In `StudioDetailScreen` direkt unter dem Back-Button/Hero einsetzen, nur wenn
  `canManage === true`.
- [ ] **Step 4: tsc-Gate** — `npx tsc --noEmit`.
- [ ] **Step 5:** Manuell (iOS + Android): Owner sieht Leiste mit korrektem Anfragen-Badge; Gast
  sieht sie nicht.
- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(studio): owner bar with badged chips on the studio page"
```

---

## Phase 3 — Cleanup & Naming

### Task 11: Voting-UI entfernen, `TeamScreen` ablösen

**Files:**
- Delete: `src/screens/TeamScreen.tsx`, `src/components/team/NominationCard.tsx`
- Modify: alle Referenzen auf `useCoachNominations` in der UI (nur noch Member-Laden, falls dort
  weiterverwendet — sonst Hook auf das Nötige reduzieren oder löschen, wenn ungenutzt)

**Interfaces:** keine neuen.

- [ ] **Step 1:** Sicherstellen, dass alle TeamScreen-Inhalte migriert sind (Mitglieder→Task 8,
  Anfragen→Task 7, Code→Task 9, Ankündigung/Sparring→Task 10, Stundenplan-Editor + Map-Profil-Edit
  → bereits inline auf der Studio-Seite). Stundenplan-Editor (`StudioScheduleSection`,
  `useStudioScheduleEditor`) als Owner-Inline-Block am Stundenplan der Studio-Seite einsetzen,
  falls noch nicht in Task 4 erfolgt.
- [ ] **Step 2:** `TeamScreen.tsx` + `NominationCard.tsx` löschen. `grep -rn "TeamScreen\|NominationCard\|useCoachNominations" src/` → alle Treffer auflösen.
- [ ] **Step 3:** `StudioCoachesSection.tsx` prüfen: Plus-Button = „Zum Trainer ernennen"
  (via `useStudioCoaches.addCoaches` → jetzt RPC), keine Voting-Sprache mehr.
- [ ] **Step 4: tsc-Gate** — `npx tsc --noEmit`.
- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(studio): retire TeamScreen + peer-voting UI"
```

### Task 12: Naming-Sweep „Kombat App" → „Sparr"

**Files:**
- Modify: alle Treffer von `grep -rn "Kombat" src/`

- [ ] **Step 1:** `grep -rn "Kombat" src/` → jeden Nutzertext auf „Sparr" setzen.
- [ ] **Step 2: tsc-Gate** — `npx tsc --noEmit`.
- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(studio): app name Kombat -> Sparr in user-facing copy"
```

---

## Self-Review (Spec-Abdeckung)

- **Eine Studio-Seite, Edit-in-place:** Task 4 (Inline-Edit), Task 5 (Merge/Routen). ✔
- **Owner-Leiste mit Chips Anfragen/Mitglieder/Code/Ankündigung/Sparring:** Task 10. ✔
- **Drei Unterseiten:** Task 7-9. ✔
- **Ein Trainer-Begriff (Ernennen=Rechte+Schaufenster, Voting raus):** Task 1-3, 8, 11. ✔
- **Einstieg „Mein Studio" statt „Team":** Task 5. ✔
- **Events bleiben Map-Feature:** keine Task nötig (bewusst unverändert). ✔
- **Naming „Sparr":** Task 9 (Invite), Task 12 (Sweep). ✔
- **`StudioProfileEditScreen`/`TeamScreen` abgelöst:** Task 5, Task 11. ✔

**Offene Annahme zur Klärung vor Phase 2:** Lädt bereits ein schlanker Hook die Studio-Mitglieder
ohne den Voting-Ballast von `useCoachNominations`? Falls nein, in Task 8 einen kleinen Member-Loader
ergänzen statt den Voting-Hook mitzuschleppen.
