# Studios auf der Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Studios mit aktivem Studio-Abo als Marker auf der SparringMap anzeigen; Studio-Sparrings am eigenen Standort grün markieren.

**Architecture:** SparringMapScreen bekommt einen Modus-Schalter (Sparrings | Studios). Ein neues `is_at_studio`-Flag in `open_sparrings` aktiviert grüne Marker. Eine neue `get_subscribed_studios`-RPC liefert Map-fähige Studios. Alle Marker verbleiben direkt im `<MapView>`-Block des Screens; Sheets und Hooks sind ausgelagert.

**Tech Stack:** React Native Maps, Supabase (Postgres RPC + RLS), Expo vector-icons, TypeScript strict.

---

## File Map

| Aktion | Datei |
|--------|-------|
| Neu | `supabase/migrations/20260527200000_add_is_at_studio_and_subscribed_studios.sql` |
| Neu | `src/hooks/useStudioMapMarkers.ts` |
| Neu | `src/components/sparring/StudioMapDetailSheet.tsx` |
| Ändern | `src/types/database.types.ts` |
| Ändern | `src/hooks/useOpenSparrings.ts` |
| Ändern | `src/hooks/useSparringActions.ts` |
| Ändern | `src/components/sparring/CreateSparringSheet.tsx` |
| Ändern | `src/screens/SparringMapScreen.tsx` |

---

## Task 1: DB-Migration

**Files:**
- Create: `supabase/migrations/20260527200000_add_is_at_studio_and_subscribed_studios.sql`

- [ ] **Step 1: Migration-Datei erstellen**

```sql
-- Add is_at_studio flag to open_sparrings
ALTER TABLE open_sparrings
  ADD COLUMN IF NOT EXISTS is_at_studio boolean NOT NULL DEFAULT false;

-- RPC: studios with active studio subscription that have coordinates
CREATE OR REPLACE FUNCTION get_subscribed_studios()
RETURNS TABLE (
  id        uuid,
  name      text,
  city      text,
  address   text,
  lat       double precision,
  lng       double precision
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT s.id, s.name, s.city, s.address, s.lat, s.lng
  FROM studios s
  JOIN subscriptions sub ON sub.user_id = s.owner_user_id
  WHERE sub.tier = 'studio'
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND s.lat IS NOT NULL
    AND s.lng IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION get_subscribed_studios() TO authenticated;
```

- [ ] **Step 2: Migration auf Supabase anwenden**

```bash
# Im Supabase Dashboard → SQL Editor ausführen,
# oder via CLI:
npx supabase db push
```

Erwartetes Ergebnis: Kein Fehler. Tabelle `open_sparrings` hat neue Spalte `is_at_studio`. Funktion `get_subscribed_studios` existiert.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527200000_add_is_at_studio_and_subscribed_studios.sql
git commit -m "feat(db): add is_at_studio flag and get_subscribed_studios rpc"
```

---

## Task 2: database.types.ts aktualisieren

**Files:**
- Modify: `src/types/database.types.ts`

- [ ] **Step 1: `is_at_studio` in open_sparrings Row/Insert/Update einfügen**

In der `open_sparrings` Row-Definition (nach `is_featured: boolean`):

```ts
// VORHER:
        Row: {
          // ...
          is_featured: boolean
          created_at: string
        }
        Insert: {
          // ...
          is_featured?: boolean
          created_at?: string
        }
        Update: {
          // ...
          is_featured?: boolean
          created_at?: string
        }

// NACHHER:
        Row: {
          // ...
          is_featured: boolean
          is_at_studio: boolean
          created_at: string
        }
        Insert: {
          // ...
          is_featured?: boolean
          is_at_studio?: boolean
          created_at?: string
        }
        Update: {
          // ...
          is_featured?: boolean
          is_at_studio?: boolean
          created_at?: string
        }
```

- [ ] **Step 2: `get_subscribed_studios` RPC in Functions einfügen**

Vor dem abschließenden `}` der Functions-Sektion (nach `deactivate_sparring`):

```ts
      get_subscribed_studios: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          city: string
          address: string | null
          lat: number
          lng: number
        }[]
      }
```

- [ ] **Step 3: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.types.ts
git commit -m "feat(types): add is_at_studio to open_sparrings and get_subscribed_studios rpc type"
```

---

## Task 3: useOpenSparrings — is_at_studio ergänzen

**Files:**
- Modify: `src/hooks/useOpenSparrings.ts`

- [ ] **Step 1: `is_at_studio` zu `SparringWithMeta` hinzufügen**

```ts
// VORHER:
export interface SparringWithMeta {
  // ...
  is_featured: boolean
  created_at: string
  // ...
}

// NACHHER:
export interface SparringWithMeta {
  // ...
  is_featured: boolean
  is_at_studio: boolean
  created_at: string
  // ...
}
```

- [ ] **Step 2: Mapping in der `result`-Aufbereitung ergänzen**

Im `map`-Block der `useEffect`-Funktion:

```ts
// VORHER:
        return {
          // ...
          is_featured: r.is_featured ?? false,
          created_at: r.created_at,
          // ...
        };

// NACHHER:
        return {
          // ...
          is_featured: r.is_featured ?? false,
          is_at_studio: r.is_at_studio ?? false,
          created_at: r.created_at,
          // ...
        };
```

Hinweis: Das select `'*'` holt bereits alle Spalten inkl. `is_at_studio` — kein Query-Change nötig.

- [ ] **Step 3: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useOpenSparrings.ts
git commit -m "feat(hooks): add is_at_studio to SparringWithMeta"
```

---

## Task 4: useSparringActions — is_at_studio beim Insert setzen

**Files:**
- Modify: `src/hooks/useSparringActions.ts`

- [ ] **Step 1: `CreateSparringInput` Typ um `isAtStudio` und `atStudioId` erweitern**

```ts
// VORHER (address-Branch):
  | {
      address: string;
      /** Pre-resolved coordinates from map picker — skips geocoding when set */
      lat?: number;
      lng?: number;
      studioId?: never;
      title: string;
      discipline: string;
      scheduledAt: string;
      durationMin: number;
      maxSlots: number;
      notes: string;
    };

// NACHHER (address-Branch):
  | {
      address: string;
      /** Pre-resolved coordinates from map picker — skips geocoding when set */
      lat?: number;
      lng?: number;
      studioId?: never;
      /** true when a coach registers this sparring at their own studio location */
      isAtStudio?: boolean;
      /** studio_id to link — required when isAtStudio = true */
      atStudioId?: string;
      title: string;
      discipline: string;
      scheduledAt: string;
      durationMin: number;
      maxSlots: number;
      notes: string;
    };
```

Der `studioId`-Branch (Coach-Modus) bleibt unverändert — dort ist `is_at_studio` implizit immer `true`.

- [ ] **Step 2: Insert im `studioId`-Branch mit `is_at_studio: true` ergänzen**

```ts
// VORHER:
    const { error } = await supabase.from('open_sparrings').insert({
      studio_id: studioId,
      created_by: user.id,
      title: params.title,
      // ...
    });

// NACHHER:
    const { error } = await supabase.from('open_sparrings').insert({
      studio_id: studioId,
      is_at_studio: true,
      created_by: user.id,
      title: params.title,
      // ...
    });
```

- [ ] **Step 3: Insert im `address`-Branch mit `is_at_studio` und `studio_id` ergänzen**

```ts
// VORHER (address-Branch, letztes insert):
    const { error } = await supabase.from('open_sparrings').insert({
      studio_id: studioId,  // studioId ist hier null (aus dem else-Branch)
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

// NACHHER:
    const { error } = await supabase.from('open_sparrings').insert({
      studio_id: params.isAtStudio === true ? (params.atStudioId ?? null) : null,
      is_at_studio: params.isAtStudio === true,
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
```

Hinweis: Die Variable `studioId` existiert nur im `studioId`-Branch. Im `address`-Branch gibt es diese Variable nicht — dort war `studio_id: studioId` ein Bug (undefined). Der Fix setzt `studio_id` korrekt auf `atStudioId` oder `null`.

- [ ] **Step 4: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSparringActions.ts
git commit -m "feat(hooks): support is_at_studio flag in createSparring"
```

---

## Task 5: useStudioMapMarkers Hook erstellen

**Files:**
- Create: `src/hooks/useStudioMapMarkers.ts`

- [ ] **Step 1: Hook erstellen**

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

export interface StudioMapMarker {
  id: string;
  name: string;
  city: string;
  address: string | null;
  lat: number;
  lng: number;
}

export function useStudioMapMarkers(refetchTrigger = 0): {
  studios: StudioMapMarker[];
  loading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const [studios, setStudios] = useState<StudioMapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [localTrigger, setLocalTrigger] = useState(0);

  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;

    void (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_subscribed_studios');

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      reportNetworkSuccess();
      setStudios((data ?? []) as StudioMapMarker[]);
      setLoading(false);
    })();
  }, [user, refetchTrigger, localTrigger]);

  return { studios, loading, refetch };
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStudioMapMarkers.ts
git commit -m "feat(hooks): add useStudioMapMarkers for subscribed studios"
```

---

## Task 6: StudioMapDetailSheet Komponente erstellen

**Files:**
- Create: `src/components/sparring/StudioMapDetailSheet.tsx`

Zeigt Studio-Name, Stadt, Adresse und aktive Sparrings des Studios. Aktive Sparrings werden direkt im Sheet geladen.

- [ ] **Step 1: Komponente erstellen**

```tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import type { StudioMapMarker } from '../../hooks/useStudioMapMarkers';

interface ActiveSparring {
  id: string;
  title: string;
  discipline: string;
  scheduled_at: string;
  signup_count: number;
  max_slots: number;
}

interface Props {
  studio: StudioMapMarker | null;
  onClose: () => void;
}

function formatScheduled(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StudioMapDetailSheet({ studio, onClose }: Props) {
  const [sparrings, setSparrings] = useState<ActiveSparring[]>([]);
  const [loadingSparrings, setLoadingSparrings] = useState(false);

  useEffect(() => {
    if (studio === null) {
      setSparrings([]);
      return;
    }

    void (async () => {
      setLoadingSparrings(true);
      const now = new Date().toISOString();

      const { data: rows } = await supabase
        .from('open_sparrings')
        .select('id, title, discipline, scheduled_at, max_slots')
        .eq('studio_id', studio.id)
        .eq('is_active', true)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(5);

      if (rows === null || rows.length === 0) {
        setSparrings([]);
        setLoadingSparrings(false);
        return;
      }

      const { data: signupData } = await supabase
        .from('sparring_signups')
        .select('sparring_id')
        .in('sparring_id', rows.map((r) => r.id));

      const countMap: Record<string, number> = {};
      for (const s of signupData ?? []) {
        countMap[s.sparring_id] = (countMap[s.sparring_id] ?? 0) + 1;
      }

      setSparrings(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          discipline: r.discipline,
          scheduled_at: r.scheduled_at,
          max_slots: r.max_slots,
          signup_count: countMap[r.id] ?? 0,
        })),
      );
      setLoadingSparrings(false);
    })();
  }, [studio]);

  if (studio === null) return null;

  return (
    <Modal
      visible={studio !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <View style={styles.studioIcon}>
            <Ionicons name="business" size={22} color={colors.card} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{studio.name}</Text>
            <Text style={styles.city}>{studio.city}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {studio.address !== null && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.address}>{studio.address}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Aktive Sparrings</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {loadingSparrings ? (
            <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
          ) : sparrings.length === 0 ? (
            <Text style={styles.empty}>Keine bevorstehenden Sparrings</Text>
          ) : (
            sparrings.map((s) => (
              <View key={s.id} style={styles.sparringRow}>
                <View style={styles.sparringLeft}>
                  <Text style={styles.sparringTitle}>{s.title}</Text>
                  <Text style={styles.sparringMeta}>
                    {s.discipline}  ·  {formatScheduled(s.scheduled_at)}
                  </Text>
                </View>
                <Text style={styles.sparringSlots}>
                  {s.signup_count}/{s.max_slots}
                </Text>
              </View>
            ))
          )}
          <View style={styles.bottomPad} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  studioIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  city: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  address: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  loader: {
    marginVertical: 24,
  },
  empty: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: 24,
  },
  sparringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  sparringLeft: {
    flex: 1,
  },
  sparringTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sparringMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sparringSlots: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  bottomPad: {
    height: 16,
  },
});
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/components/sparring/StudioMapDetailSheet.tsx
git commit -m "feat(components): add StudioMapDetailSheet"
```

---

## Task 7: CreateSparringSheet — Checkbox "Am Studio-Standort"

**Files:**
- Modify: `src/components/sparring/CreateSparringSheet.tsx`

Die Checkbox erscheint nur im User-Modus, wenn der aufrufende Screen `coachStudio`-Daten übergibt (d.h. der User ist Coach mit gesetzter Adresse). Wenn die Checkbox aktiv ist, wird die Adresse auf die Studio-Adresse gesetzt und das Adressfeld deaktiviert.

- [ ] **Step 1: Props-Typ für User-Modus um `coachStudio` erweitern**

```ts
// VORHER:
type Props =
  | {
      visible: boolean;
      mode?: 'coach';
      studioId: string;
      onClose: () => void;
      onCreate: (params: CreateSparringInput) => Promise<void>;
    }
  | {
      visible: boolean;
      mode: 'user';
      studioId?: never;
      onClose: () => void;
      onCreate: (params: CreateSparringInput) => Promise<void>;
    };

// NACHHER:
type CoachStudioInfo = {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

type Props =
  | {
      visible: boolean;
      mode?: 'coach';
      studioId: string;
      coachStudio?: never;
      onClose: () => void;
      onCreate: (params: CreateSparringInput) => Promise<void>;
    }
  | {
      visible: boolean;
      mode: 'user';
      studioId?: never;
      /** When provided, shows the "Am Studio-Standort" checkbox for coaches */
      coachStudio?: CoachStudioInfo | null;
      onClose: () => void;
      onCreate: (params: CreateSparringInput) => Promise<void>;
    };
```

- [ ] **Step 2: State für `isAtStudio` und `coachStudio` auslesen**

Im Funktionskörper von `CreateSparringSheet`, direkt nach den bestehenden State-Deklarationen:

```ts
  const coachStudio = 'coachStudio' in props ? props.coachStudio : null;
  const showAtStudioCheckbox =
    isUserMode && coachStudio !== null && coachStudio !== undefined && coachStudio.address.trim().length > 0;

  const [isAtStudio, setIsAtStudio] = useState(false);
```

- [ ] **Step 3: Checkbox-Handler implementieren**

Nach den bestehenden Handler-Funktionen (`formatDate`, `formatTime`), direkt vor `handleCreate`:

```ts
  function handleToggleAtStudio(): void {
    if (coachStudio === null || coachStudio === undefined) return;
    const next = !isAtStudio;
    setIsAtStudio(next);
    if (next) {
      setAddress(coachStudio.address);
      setPickedCoord(
        coachStudio.lat !== null && coachStudio.lng !== null
          ? { lat: coachStudio.lat, lng: coachStudio.lng }
          : null,
      );
    } else {
      setAddress('');
      setPickedCoord(null);
    }
  }
```

- [ ] **Step 4: `handleCreate` im User-Modus um `isAtStudio` + `atStudioId` erweitern**

```ts
// VORHER (im isUserMode-Branch von handleCreate):
    const params: CreateSparringInput = isUserMode
      ? {
          address: address.trim(),
          ...(pickedCoord !== null ? { lat: pickedCoord.lat, lng: pickedCoord.lng } : {}),
          title: resolvedTitle,
          discipline,
          scheduledAt: scheduledAt.toISOString(),
          durationMin: dur,
          maxSlots: slots,
          notes,
        }
      : ...

// NACHHER:
    const params: CreateSparringInput = isUserMode
      ? {
          address: address.trim(),
          ...(pickedCoord !== null ? { lat: pickedCoord.lat, lng: pickedCoord.lng } : {}),
          ...(isAtStudio && coachStudio !== null && coachStudio !== undefined
            ? { isAtStudio: true as const, atStudioId: coachStudio.id }
            : {}),
          title: resolvedTitle,
          discipline,
          scheduledAt: scheduledAt.toISOString(),
          durationMin: dur,
          maxSlots: slots,
          notes,
        }
      : ...
```

- [ ] **Step 5: State beim Schließen/Reset zurücksetzen**

Am Ende von `handleCreate`, vor `onClose()`:

```ts
    setIsAtStudio(false);
    // (die anderen resets bleiben unverändert)
    onClose();
```

- [ ] **Step 6: Checkbox im JSX einfügen**

Im User-Modus-Block, direkt nach dem `pickedBadge`-Block (nach Zeile ~207), vor dem `Max. Plätze`-Block:

```tsx
          {showAtStudioCheckbox && (
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={handleToggleAtStudio}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, isAtStudio && styles.checkboxChecked]}>
                {isAtStudio && <Ionicons name="checkmark" size={14} color={colors.card} />}
              </View>
              <Text style={styles.checkboxLabel}>Am Studio-Standort</Text>
            </TouchableOpacity>
          )}
```

- [ ] **Step 7: Adressfeld bei aktivem `isAtStudio` sperren**

Im `TextInput` für `address` (User-Modus), `editable`-Prop hinzufügen und Stil anpassen:

```tsx
                <TextInput
                  style={[styles.input, styles.locationInput, isAtStudio && styles.inputDisabled]}
                  value={address}
                  onChangeText={(t) => {
                    if (isAtStudio) return;
                    setAddress(t);
                    if (pickedCoord !== null) setPickedCoord(null);
                  }}
                  editable={!isAtStudio}
                  placeholder="Adresse eingeben"
                  placeholderTextColor={colors.textSecondary}
                />
```

Und den Map-Pick-Button bei aktivem `isAtStudio` deaktivieren:

```tsx
                <TouchableOpacity
                  style={[styles.mapPickBtn, isAtStudio && styles.mapPickBtnDisabled]}
                  onPress={() => { if (!isAtStudio) setLocationPickerVisible(true); }}
                  activeOpacity={0.8}
                >
```

- [ ] **Step 8: Styles für Checkbox und disabled-Zustand ergänzen**

Am Ende von `StyleSheet.create`:

```ts
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  mapPickBtnDisabled: {
    opacity: 0.35,
  },
```

- [ ] **Step 9: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.

- [ ] **Step 10: Commit**

```bash
git add src/components/sparring/CreateSparringSheet.tsx
git commit -m "feat(components): add Am Studio-Standort checkbox to CreateSparringSheet"
```

---

## Task 8: SparringMapScreen — Modus-Schalter, grüne Marker, Studios-Modus

**Files:**
- Modify: `src/screens/SparringMapScreen.tsx`

Dies ist der grösste Task. Er führt den Modus-Schalter ein, verdrahtet alle neuen Hooks und Komponenten und fügt grüne Marker für Studio-Sparrings hinzu.

- [ ] **Step 1: Imports ergänzen**

```ts
// Bestehende Imports bleiben. Folgendes hinzufügen:
import { useStudio } from '../hooks/useStudio';
import { useStudioAddress } from '../hooks/useStudioAddress';
import { useStudioMapMarkers } from '../hooks/useStudioMapMarkers';
import type { StudioMapMarker } from '../hooks/useStudioMapMarkers';
import StudioMapDetailSheet from '../components/sparring/StudioMapDetailSheet';
```

- [ ] **Step 2: Konstante für Grün-Farbe ergänzen**

Direkt unter `const ORANGE_COLOR`:

```ts
const STUDIO_GREEN = '#22C55E'; // Studio-Sparring am eigenen Standort
```

- [ ] **Step 3: `StudioMarker`-Komponente hinzufügen**

Nach der bestehenden `FeaturedMarker`-Funktion:

```tsx
// Studio location marker for Studios mode
function StudioMarker(): React.ReactElement {
  return (
    <View style={styles.studioMarkerBase}>
      <Ionicons name="business" size={20} color={colors.card} />
    </View>
  );
}

// Studio-hosted sparring at own location — always green, no time-window differentiation
function AtStudioMarker(): React.ReactElement {
  return (
    <View style={[styles.markerBase, styles.markerAtStudio]}>
      <Ionicons name="shield-checkmark" size={18} color={colors.card} />
    </View>
  );
}

- [ ] **Step 4: Mode-State und neue Hooks im Screen-Body hinzufügen**

Direkt nach den bestehenden State/Hook-Deklarationen in `SparringMapScreen`:

```ts
  const [mode, setMode] = useState<'sparrings' | 'studios'>('sparrings');
  const [selectedStudio, setSelectedStudio] = useState<StudioMapMarker | null>(null);

  const { currentStudio } = useStudio();
  const { address: studioAddress, lat: studioLat, lng: studioLng } = useStudioAddress(
    currentStudio?.id ?? '',
  );
  const { studios: studioMarkers } = useStudioMapMarkers();

  const coachStudio =
    currentStudio !== null &&
    studioAddress !== null &&
    studioAddress.trim().length > 0
      ? {
          id: currentStudio.id,
          address: studioAddress,
          lat: studioLat,
          lng: studioLng,
        }
      : null;
```

- [ ] **Step 5: Marker-Rendering im `<MapView>`-Block anpassen**

Der bestehende `{filtered.map(...)}` Block bleibt für Sparrings. Darunter Studio-Marker einfügen:

```tsx
        {/* Sparring markers */}
        {mode === 'sparrings' && filtered.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            onPress={() => setSelected(s)}
            tracksViewChanges={false}
          >
            {s.is_featured
              ? <FeaturedMarker />
              : s.is_at_studio
                ? <AtStudioMarker />
                : <SparringMarker window={getTimeWindow(s.scheduled_at)} />
            }
          </Marker>
        ))}

        {/* Studio markers */}
        {mode === 'studios' && studioMarkers.map((st) => (
          <Marker
            key={st.id}
            coordinate={{ latitude: st.lat, longitude: st.lng }}
            onPress={() => setSelectedStudio(st)}
            tracksViewChanges={false}
          >
            <StudioMarker />
          </Marker>
        ))}
```

- [ ] **Step 6: TopBar um Modus-Schalter und bedingten Zeitfilter erweitern**

Den bestehenden `<View style={[styles.topBar, ...]}>` Block ersetzen:

```tsx
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        {/* Mode switch — always visible */}
        <View style={styles.modeSwitchRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'sparrings' && styles.modeBtnActive]}
            onPress={() => setMode('sparrings')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, mode === 'sparrings' && styles.modeBtnTextActive]}>
              Sparrings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'studios' && styles.modeBtnActive]}
            onPress={() => setMode('studios')}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, mode === 'studios' && styles.modeBtnTextActive]}>
              Studios
            </Text>
          </TouchableOpacity>
        </View>

        {/* Time filter — only in Sparrings mode */}
        {mode === 'sparrings' && (
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.closeBtn, timeFilter === 'all' && styles.closeBtnDimmed]}
              onPress={() => setTimeFilter('all')}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.segmentGroup}>
              {FILTER_TABS.map((tab) => {
                const count = sparrings.filter(
                  (s) => getTimeWindow(s.scheduled_at) === tab.key,
                ).length;
                const isActive = timeFilter === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.segment, isActive && styles.segmentActive]}
                    onPress={() => setTimeFilter(tab.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                      {`${tab.label} (${count})`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>
```

- [ ] **Step 7: FAB und Sheets um Modus-Bedingung ergänzen**

Der FAB "Sparring anmelden" nur im Sparrings-Modus:

```tsx
      {mode === 'sparrings' && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 16 }]}
          onPress={() => setCreateSheetVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={22} color={colors.card} />
          <Text style={styles.fabText}>Sparring anmelden</Text>
        </TouchableOpacity>
      )}
```

`SparringDetailSheet` und `CreateSparringSheet` bleiben immer gerendert (sie prüfen intern auf `sparring !== null` / `visible`).

`StudioMapDetailSheet` nach `CreateSparringSheet` einfügen:

```tsx
      <StudioMapDetailSheet
        studio={selectedStudio}
        onClose={() => setSelectedStudio(null)}
      />
```

- [ ] **Step 8: `coachStudio` an CreateSparringSheet übergeben**

```tsx
      <CreateSparringSheet
        visible={createSheetVisible}
        mode="user"
        coachStudio={coachStudio}
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

- [ ] **Step 9: Styles für neue Elemente ergänzen**

Am Ende von `StyleSheet.create`, nach den bestehenden Styles:

```ts
  // ── Mode switch ─────────────────────────────────────────────────────────
  modeSwitchRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 4,
    height: 40,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    alignSelf: 'center',
  },
  modeBtn: {
    paddingHorizontal: 20,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.accentBlue,
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeBtnTextActive: {
    color: colors.card,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  // ── Studio marker ────────────────────────────────────────────────────────
  studioMarkerBase: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: colors.card,
  },
  // ── At-studio sparring marker ────────────────────────────────────────────
  markerAtStudio: {
    backgroundColor: STUDIO_GREEN,
  },
```

- [ ] **Step 10: TopBar-Style anpassen** 

Der bestehende `topBar`-Style muss auf `flexDirection: 'column'` umgestellt werden, da jetzt zwei Zeilen drin sind:

```ts
  // VORHER:
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },

  // NACHHER:
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    gap: 0,
  },
```

- [ ] **Step 11: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.

- [ ] **Step 12: Commit**

```bash
git add src/screens/SparringMapScreen.tsx
git commit -m "feat(screen): add Studios mode and green at-studio markers to SparringMapScreen"
```

---

## Task 9: End-to-End Smoke Test

- [ ] **Step 1: App starten**

```bash
npx expo start --ios
```

- [ ] **Step 2: Sparrings-Modus prüfen**

- [ ] Modus-Schalter "Sparrings | Studios" erscheint oben
- [ ] Zeitfilter (Jetzt / Demnächst / Bald) ist sichtbar
- [ ] Bestehende Marker erscheinen unverändert
- [ ] "Sparring anmelden" FAB ist sichtbar

- [ ] **Step 3: Studios-Modus prüfen**

- [ ] Tab "Studios" antippen → Zeitfilter verschwindet, FAB verschwindet
- [ ] Studios mit aktivem Abo und Koordinaten erscheinen als dunkle Marker
- [ ] Antippen öffnet `StudioMapDetailSheet` mit Name, Stadt, Adresse, Sparrings
- [ ] Zurück-/Schließen-Geste schließt das Sheet

- [ ] **Step 4: Grüner Marker prüfen**

- [ ] "Sparring anmelden" öffnen → Checkbox "Am Studio-Standort" erscheint (nur wenn der User Coach mit Studio-Adresse ist)
- [ ] Checkbox aktivieren → Adressfeld wird vorbelegt, ist nicht editierbar
- [ ] Sparring anlegen → Marker erscheint grün auf der Map

- [ ] **Step 5: TypeScript Final-Check**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.
