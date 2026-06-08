# Sparring für alle Nutzer – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeden eingeloggten Nutzer befähigen, ein Sparring direkt auf der SparringMap zu erstellen — ohne Coach-Status oder Studio-Zugehörigkeit.

**Architecture:** `studio_id` in `open_sparrings` wird nullable; eine neue RLS-Policy erlaubt INSERT ohne Studio. `useSparringActions.createSparring` nimmt eine Discriminated Union: entweder `studioId` (Coach-Flow) oder `address` (User-Flow). `CreateSparringSheet` bekommt einen `mode`-Prop; im User-Mode entfallen Titel/Dauer/Plätze, dafür gibt es ein Pflichtfeld „Ort". `SparringMapScreen` bekommt einen FAB, der das Sheet im User-Mode öffnet.

**Tech Stack:** React Native + Expo SDK 55, Supabase (Postgres + RLS), TypeScript strict, `@expo/vector-icons` (Ionicons)

---

## File Map

| Datei | Aktion |
|---|---|
| `supabase/migrations/20260509100000_open_sparrings_for_all_users.sql` | Create |
| `src/types/database.types.ts` | Modify — `open_sparrings.studio_id` nullable |
| `src/hooks/useSparringActions.ts` | Modify — Discriminated Union + Branch-Logik |
| `src/components/sparring/CreateSparringSheet.tsx` | Modify — `mode`-Prop, Ort-Feld, bedingte Felder |
| `src/screens/SparringMapScreen.tsx` | Modify — FAB + Sheet-Integration |
| `src/hooks/useOpenSparrings.ts` | Modify — Null-safe Studio-Mapping |

---

## Task 1: DB-Migration

**Files:**
- Create: `supabase/migrations/20260509100000_open_sparrings_for_all_users.sql`

- [ ] **Step 1: Migration-Datei anlegen**

```sql
-- Allow studio_id to be null for user-created sparrings
ALTER TABLE open_sparrings ALTER COLUMN studio_id DROP NOT NULL;

-- Replace the single coach-only INSERT policy with two separate policies
DROP POLICY IF EXISTS "coaches insert sparrings" ON open_sparrings;

-- Coaches can create sparrings for their own studio (unchanged behaviour)
CREATE POLICY "coaches insert sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND studio_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND is_coach = true
        AND studio_id = open_sparrings.studio_id
    )
  );

-- Any authenticated user can create a sparring without a studio
CREATE POLICY "users insert own sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND studio_id IS NULL
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260509100000_open_sparrings_for_all_users.sql
git commit -m "feat(db): allow all authenticated users to create sparrings"
```

---

## Task 2: `database.types.ts` — `studio_id` nullable

**Files:**
- Modify: `src/types/database.types.ts` (lines ~230–295)

- [ ] **Step 1: Row, Insert, Update auf nullable setzen**

Im `open_sparrings`-Block folgende drei Änderungen vornehmen:

**Row** (bisher `studio_id: string`):
```ts
// vorher:
studio_id: string
// nachher:
studio_id: string | null
```

**Insert** (bisher `studio_id: string`):
```ts
// vorher:
studio_id: string
// nachher:
studio_id?: string | null
```

**Update** (bisher `studio_id?: string`):
```ts
// vorher:
studio_id?: string
// nachher:
studio_id?: string | null
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: Fehler wegen `studio_id` in `useSparringActions.ts` (dort wird `studio_id: params.studioId` gesetzt, Typ ändert sich in Task 3). Alle anderen Fehler hier beheben.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.types.ts
git commit -m "feat(types): make open_sparrings.studio_id nullable"
```

---

## Task 3: `useSparringActions.ts` — Discriminated Union

**Files:**
- Modify: `src/hooks/useSparringActions.ts`

- [ ] **Step 1: `CreateSparringParams` durch `CreateSparringInput` ersetzen**

Ersetze die bestehende `CreateSparringParams`-Schnittstelle (Zeilen 6–14) komplett durch:

```ts
export type CreateSparringInput =
  | {
      studioId: string;
      address?: never;
      title: string;
      discipline: string;
      scheduledAt: string;
      durationMin: number;
      maxSlots: number;
      notes: string;
    }
  | {
      address: string;
      studioId?: never;
      title: string;
      discipline: string;
      scheduledAt: string;
      durationMin: number;
      maxSlots: number;
      notes: string;
    };
```

- [ ] **Step 2: Return-Typ des Hooks anpassen**

Zeile 19 — `createSparring`-Signatur im Rückgabetyp:

```ts
// vorher:
createSparring: (params: CreateSparringParams) => Promise<{ error: string | null }>;
// nachher:
createSparring: (params: CreateSparringInput) => Promise<{ error: string | null }>;
```

- [ ] **Step 3: `createSparring`-Implementierung ersetzen**

Die gesamte `createSparring`-Funktion (Zeilen 42–80) durch folgende ersetzen:

```ts
const createSparring = useCallback(async (params: CreateSparringInput): Promise<{ error: string | null }> => {
  if (user === null) return { error: 'Nicht eingeloggt' };

  let resolvedAddress: string;
  let studioId: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;

  if (params.studioId !== undefined) {
    // Coach flow: fetch address from studio
    const { data: studio, error: studioError } = await supabase
      .from('studios')
      .select('address, lat, lng')
      .eq('id', params.studioId)
      .single();

    if (studioError !== null || studio === null) {
      return { error: 'Studio nicht gefunden.' };
    }
    if (studio.address === null || studio.address.trim().length === 0) {
      return { error: 'Das Studio hat noch keine Adresse hinterlegt. Bitte zuerst die Studio-Adresse setzen.' };
    }

    resolvedAddress = studio.address;
    studioId = params.studioId;
    lat = studio.lat;
    lng = studio.lng;

    if (lat === null || lng === null) {
      const coords = await geocodeAddress(resolvedAddress);
      lat = coords?.lat ?? null;
      lng = coords?.lng ?? null;
    }
  } else {
    // User flow: geocode provided address directly
    resolvedAddress = params.address;
    const coords = await geocodeAddress(resolvedAddress);
    lat = coords?.lat ?? null;
    lng = coords?.lng ?? null;
  }

  const { error } = await supabase.from('open_sparrings').insert({
    studio_id: studioId,
    created_by: user.id,
    title: params.title,
    discipline: params.discipline,
    address: resolvedAddress,
    lat,
    lng,
    scheduled_at: params.scheduledAt,
    duration_min: params.durationMin,
    max_slots: params.maxSlots,
    notes: params.notes.trim() || null,
  });
  return { error: error?.message ?? null };
}, [user]);
```

- [ ] **Step 4: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartete Fehler: `CreateSparringSheet.tsx` importiert noch `CreateSparringParams` (wird in Task 4 behoben). `TeamScreen.tsx` sollte fehlerfrei sein, da es `createSparring(params)` direkt aufruft und der Typ kompatibel bleibt.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSparringActions.ts
git commit -m "feat(actions): support address-based sparring creation for all users"
```

---

## Task 4: `CreateSparringSheet.tsx` — `mode`-Prop

**Files:**
- Modify: `src/components/sparring/CreateSparringSheet.tsx`

- [ ] **Step 1: Import-Zeile aktualisieren**

Zeile 17:
```ts
// vorher:
import type { CreateSparringParams } from '../../hooks/useSparringActions';
// nachher:
import type { CreateSparringInput } from '../../hooks/useSparringActions';
```

- [ ] **Step 2: Props-Interface ersetzen**

Zeilen 21–26:
```ts
// vorher:
interface Props {
  visible: boolean;
  studioId: string;
  onClose: () => void;
  onCreate: (params: CreateSparringParams) => Promise<void>;
}
// nachher:
interface Props {
  visible: boolean;
  studioId?: string;
  mode?: 'coach' | 'user';
  onClose: () => void;
  onCreate: (params: CreateSparringInput) => Promise<void>;
}
```

- [ ] **Step 3: Destructuring + neuer `address`-State**

Zeile 35 (Funktionskopf):
```ts
// vorher:
export default function CreateSparringSheet({ visible, studioId, onClose, onCreate }: Props) {
// nachher:
export default function CreateSparringSheet({ visible, studioId, mode = 'coach', onClose, onCreate }: Props) {
```

Nach `const [loading, setLoading] = useState(false);` (Zeile 44) einfügen:
```ts
  const [address, setAddress] = useState('');
  const isUserMode = mode === 'user';
```

- [ ] **Step 4: `handleCreate` ersetzen**

Die gesamte `handleCreate`-Funktion (Zeilen 54–88) durch folgende ersetzen:

```ts
async function handleCreate(): Promise<void> {
  if (isUserMode) {
    if (address.trim().length === 0) {
      Alert.alert('Ort fehlt', 'Bitte gib einen Ort oder eine Adresse ein.');
      return;
    }
  } else {
    if (title.trim().length === 0) {
      Alert.alert('Titel fehlt', 'Bitte gib einen Titel ein.');
      return;
    }
    const dur = parseInt(durationMin, 10);
    const slots = parseInt(maxSlots, 10);
    if (isNaN(dur) || dur < 1) {
      Alert.alert('Ungültige Dauer', 'Bitte gib eine gültige Dauer in Minuten ein.');
      return;
    }
    if (isNaN(slots) || slots < 1) {
      Alert.alert('Ungültige Plätze', 'Bitte gib mindestens 1 Platz ein.');
      return;
    }
  }

  const dur = isUserMode ? 90 : parseInt(durationMin, 10);
  const slots = isUserMode ? 10 : parseInt(maxSlots, 10);
  const resolvedTitle = isUserMode ? `${discipline} – Sparring` : title.trim();

  const params: CreateSparringInput = isUserMode
    ? { address: address.trim(), title: resolvedTitle, discipline, scheduledAt: scheduledAt.toISOString(), durationMin: dur, maxSlots: slots, notes }
    : { studioId: studioId!, title: resolvedTitle, discipline, scheduledAt: scheduledAt.toISOString(), durationMin: dur, maxSlots: slots, notes };

  setLoading(true);
  await onCreate(params);
  setLoading(false);
  setTitle('');
  setAddress('');
  setDiscipline(DISCIPLINES[0]);
  setNotes('');
  setDurationMin('90');
  setMaxSlots('10');
  setScheduledAt(nextDay18h());
  onClose();
}
```

- [ ] **Step 5: JSX — Titel-Feld bedingen, Ort-Feld hinzufügen**

Den Block mit `<Text style={styles.label}>Titel</Text>` und dem zugehörigen `<TextInput>` (aktuell Zeilen 104–111) durch folgenden Code ersetzen:

```tsx
{!isUserMode && (
  <>
    <Text style={styles.label}>Titel</Text>
    <TextInput
      style={styles.input}
      value={title}
      onChangeText={setTitle}
      placeholder="z.B. Offenes Boxsparring"
      placeholderTextColor={colors.textSecondary}
    />
  </>
)}

{isUserMode && (
  <>
    <Text style={styles.label}>Ort</Text>
    <TextInput
      style={styles.input}
      value={address}
      onChangeText={setAddress}
      placeholder="Adresse oder Ort eingeben"
      placeholderTextColor={colors.textSecondary}
    />
  </>
)}
```

- [ ] **Step 6: JSX — Dauer/Plätze-Block bedingen**

Den `<View style={styles.twoCol}>…</View>`-Block (Zeilen 171–192) in eine Bedingung einwickeln:

```tsx
{!isUserMode && (
  <View style={styles.twoCol}>
    <View style={styles.colItem}>
      <Text style={styles.label}>Dauer (Min.)</Text>
      <TextInput
        style={styles.input}
        value={durationMin}
        onChangeText={setDurationMin}
        keyboardType="numeric"
        placeholderTextColor={colors.textSecondary}
      />
    </View>
    <View style={styles.colItem}>
      <Text style={styles.label}>Max. Plätze</Text>
      <TextInput
        style={styles.input}
        value={maxSlots}
        onChangeText={setMaxSlots}
        keyboardType="numeric"
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  </View>
)}
```

- [ ] **Step 7: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehler in `CreateSparringSheet.tsx`. `TeamScreen.tsx` ruft das Sheet ohne `mode`-Prop auf → default `'coach'` → `studioId` wird übergeben → korrekt.

- [ ] **Step 8: Commit**

```bash
git add src/components/sparring/CreateSparringSheet.tsx
git commit -m "feat(sheet): add user-mode to CreateSparringSheet with address field"
```

---

## Task 5: `SparringMapScreen.tsx` — FAB + Sheet

**Files:**
- Modify: `src/screens/SparringMapScreen.tsx`

- [ ] **Step 1: Import ergänzen**

Zeile 11 (nach `SparringDetailSheet`-Import):
```ts
import CreateSparringSheet from '../components/sparring/CreateSparringSheet';
```

- [ ] **Step 2: `createSparring` aus Hook destructuren**

Zeile 32:
```ts
// vorher:
const { signUp, cancelSignup, deactivateSparring } = useSparringActions();
// nachher:
const { signUp, cancelSignup, createSparring, deactivateSparring } = useSparringActions();
```

- [ ] **Step 3: State für Sheet hinzufügen**

Nach `const [region, setRegion] = useState(FALLBACK_REGION);` (Zeile 35):
```ts
const [createSheetVisible, setCreateSheetVisible] = useState(false);
```

- [ ] **Step 4: FAB im JSX hinzufügen**

Am Ende des `<View style={styles.root}>` — nach dem `<SparringDetailSheet …/>` (Zeile 135, vor dem schließenden `</View>`):

```tsx
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setCreateSheetVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle-outline" size={22} color={colors.card} />
        <Text style={styles.fabText}>Sparring anmelden</Text>
      </TouchableOpacity>

      <CreateSparringSheet
        visible={createSheetVisible}
        mode="user"
        onClose={() => setCreateSheetVisible(false)}
        onCreate={async (params) => {
          const { error } = await createSparring(params);
          if (error !== null) {
            Alert.alert('Fehler', error);
            return;
          }
          refetch();
        }}
      />
```

- [ ] **Step 5: FAB-Styles hinzufügen**

Am Ende von `StyleSheet.create({…})` vor der abschließenden `})`:

```ts
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentBlue,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
```

- [ ] **Step 6: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/screens/SparringMapScreen.tsx
git commit -m "feat(map): add FAB to create sparring from map screen"
```

---

## Task 6: `useOpenSparrings.ts` — Null-sicheres Studio-Mapping

**Files:**
- Modify: `src/hooks/useOpenSparrings.ts`

- [ ] **Step 1: `SparringWithMeta` — `studio_id` nullable**

Zeile 7 im Interface:
```ts
// vorher:
studio_id: string;
// nachher:
studio_id: string | null;
```

- [ ] **Step 2: `StudioJoin`-Typ und Mapping aktualisieren**

Zeilen 70–91 — den gesamten `type StudioJoin` und das `map()`-Callback ersetzen:

```ts
      type StudioJoin = { name: string; city: string } | null;

      const result: SparringWithMeta[] = (rows ?? []).map((r) => {
        const studio = r.studios as StudioJoin;
        return {
          id: r.id,
          studio_id: r.studio_id,
          created_by: r.created_by,
          title: r.title,
          discipline: r.discipline,
          address: r.address,
          lat: r.lat,
          lng: r.lng,
          scheduled_at: r.scheduled_at,
          duration_min: r.duration_min,
          max_slots: r.max_slots,
          notes: r.notes,
          is_active: r.is_active,
          created_at: r.created_at,
          studio_name: studio?.name ?? 'Privat',
          studio_city: studio?.city ?? '',
          signup_count: countMap[r.id] ?? 0,
          is_signed_up: signedUpIds.has(r.id),
        };
      });
```

- [ ] **Step 3: TypeScript prüfen — sauber**

```bash
npx tsc --noEmit
```

Erwartet: **keine Fehler**. Wenn doch Fehler, vor dem Commit beheben.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useOpenSparrings.ts
git commit -m "fix(sparrings): null-safe studio mapping for user-created sparrings"
```

---

## Task 7: Abschluss & Obsidian Dev-Log

- [ ] **Step 1: Finaler TypeScript-Check**

```bash
npx tsc --noEmit
```

Erwartet: keine Fehler, keine Warnungen.

- [ ] **Step 2: Dev-Log anlegen**

Datei: `/Users/romeogeorgiadis/Library/Mobile Documents/com~apple~CloudDocs/Dokumente/ObsidianVault/Sparr/Dev-Log/2026-05-09.md`

Falls die Datei bereits existiert: mit `---` als Trennlinie anhängen. Sonst neu anlegen:

```markdown
# Dev-Log – 2026-05-09

## Was wurde gebaut / geändert
- `open_sparrings.studio_id` auf nullable geändert (Migration)
- Neue RLS-Policy: alle authentifizierten User können Sparrings ohne Studio anlegen
- `CreateSparringInput` Discriminated Union in `useSparringActions`
- `CreateSparringSheet` bekommt `mode='user'`: Ort-Pflichtfeld, automatischer Titel, fixe Slots/Dauer
- FAB "Sparring anmelden" auf `SparringMapScreen` — öffnet Sheet im User-Mode
- `useOpenSparrings` mappt null-Studio auf `studio_name: 'Privat'`

## Warum
- Sparrings sollten nicht Coach-exklusiv sein — jeder Nutzer soll spontan ein Sparring anbieten können
- Discriminated Union erzwingt korrekte Typsicherheit für beide Flows (Coach mit Studio, User mit Adresse)

## Offene Probleme
- Keine automatische Geocodierung-Fehlerbehandlung: wenn Nominatim die Adresse nicht findet, hat das Sparring keine Koordinaten und erscheint nicht auf der Karte (kein Fehler für den User)

## Nächste Schritte
- Optional: Geocodierung-Feedback im User-Mode ("Adresse nicht gefunden")
```
