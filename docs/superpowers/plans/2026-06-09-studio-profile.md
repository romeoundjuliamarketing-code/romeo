# Studio-Profil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Studios erhalten ein vollständiges, editierbares Profil mit Banner, Avatar, Disziplinen, Beschreibung und Featured Fighters — sichtbar auf der Map und in der Detailansicht.

**Architecture:** Scrollende Profilseite (`StudioDetailScreen` rework) mit Hero-Banner-Overlap, wiederverwendbarer `DisciplineChips`-Komponente (auch im Quick-Sheet), `FeaturedFightersRow` als horizontaler Scroll, neuer `StudioProfileEditScreen` für Owner. Neue DB-Spalten auf `studios` + neue Tabelle `studio_featured_fighters`.

**Tech Stack:** React Native + Expo SDK 55, Supabase (Postgres + Storage), TypeScript strict, `expo-file-system/legacy` + `base64-arraybuffer` für Bild-Upload, `@expo/vector-icons` (Ionicons / MaterialCommunityIcons)

---

## Dateiübersicht

| Aktion | Pfad | Zweck |
|---|---|---|
| Create | `supabase/migrations/20260609180000_add_studio_profile.sql` | DB-Migration |
| Modify | `src/types/database.types.ts` | Neue Felder + Tabelle |
| Create | `src/hooks/useStudioProfile.ts` | Unified studio data fetch |
| Create | `src/hooks/useFeaturedFighters.ts` | Featured fighters CRUD |
| Create | `src/components/studio/DisciplineChips.tsx` | Wiederverwendbare Chips |
| Create | `src/components/studio/StudioHero.tsx` | Banner + Avatar Overlap |
| Create | `src/components/studio/FeaturedFightersRow.tsx` | Horizontale Fighter-Cards |
| Modify | `src/screens/StudioDetailScreen.tsx` | Vollständiger Rework |
| Modify | `src/components/sparring/StudioMapDetailSheet.tsx` | Disziplinen im Quick-Sheet |
| Create | `src/screens/StudioProfileEditScreen.tsx` | Owner-Edit-Screen |
| Modify | `src/navigation/types.ts` | `StudioProfileEdit` Route |
| Modify | `src/navigation/RootNavigator.tsx` | Screen registrieren |

---

## Task 1: DB-Migration

**Files:**
- Create: `supabase/migrations/20260609180000_add_studio_profile.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- supabase/migrations/20260609180000_add_studio_profile.sql

-- New columns on studios
ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS banner_url    text,
  ADD COLUMN IF NOT EXISTS avatar_url    text,
  ADD COLUMN IF NOT EXISTS disciplines   text[] NOT NULL DEFAULT '{}';

-- Featured fighters table
CREATE TABLE IF NOT EXISTS public.studio_featured_fighters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   uuid NOT NULL REFERENCES public.studios(id)   ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, user_id)
);

ALTER TABLE public.studio_featured_fighters ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "sff_select" ON public.studio_featured_fighters
  FOR SELECT TO authenticated USING (true);

-- Only studio owner can insert
CREATE POLICY "sff_insert" ON public.studio_featured_fighters
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.studios s
      WHERE s.id = studio_id AND s.owner_user_id = auth.uid()
    )
  );

-- Owner OR the fighter themselves can delete
CREATE POLICY "sff_delete" ON public.studio_featured_fighters
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE s.id = studio_id AND s.owner_user_id = auth.uid()
    )
  );

-- Owner can update their own studio profile fields
CREATE POLICY "studios_update_owner" ON public.studios
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
```

- [ ] **Step 2: Migration pushen**

```bash
npx supabase db push
```

Expected: Migration erfolgreich angewendet, keine Fehler.

- [ ] **Step 3: Storage Bucket manuell im Supabase Dashboard anlegen**

Bucket-Name: `studio-assets`, Public: ja.  
(Oder via SQL wenn Supabase CLI Storage-Buckets unterstützt:)

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-assets', 'studio-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "studio_assets_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'studio-assets');

CREATE POLICY "studio_assets_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-assets');

CREATE POLICY "studio_assets_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'studio-assets');
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260609180000_add_studio_profile.sql
git commit -m "feat(db): add studio profile fields and featured fighters table"
```

---

## Task 2: TypeScript-Typen aktualisieren

**Files:**
- Modify: `src/types/database.types.ts`

- [ ] **Step 1: `studios` Row/Insert/Update erweitern**

In `database.types.ts`, die `studios`-Blöcke suchen und ersetzen:

```typescript
// Row — vorher:
studios: {
  Row: {
    address: string | null
    city: string
    created_at: string
    id: string
    lat: number | null
    lng: number | null
    name: string
    owner_user_id: string | null
  }

// Row — nachher:
studios: {
  Row: {
    address: string | null
    avatar_url: string | null
    banner_url: string | null
    city: string
    created_at: string
    description: string | null
    disciplines: string[]
    id: string
    lat: number | null
    lng: number | null
    name: string
    owner_user_id: string | null
  }
```

Gleiches für `Insert` und `Update` (alle neuen Felder als optional mit `?`):

```typescript
  Insert: {
    address?: string | null
    avatar_url?: string | null
    banner_url?: string | null
    city: string
    created_at?: string
    description?: string | null
    disciplines?: string[]
    id?: string
    lat?: number | null
    lng?: number | null
    name: string
    owner_user_id?: string | null
  }
  Update: {
    address?: string | null
    avatar_url?: string | null
    banner_url?: string | null
    city?: string
    created_at?: string
    description?: string | null
    disciplines?: string[]
    id?: string
    lat?: number | null
    lng?: number | null
    name?: string
    owner_user_id?: string | null
  }
```

- [ ] **Step 2: `studio_featured_fighters` Tabelle hinzufügen**

Im `Tables`-Block nach `studios` einfügen:

```typescript
studio_featured_fighters: {
  Row: {
    added_at: string
    id: string
    studio_id: string
    user_id: string
  }
  Insert: {
    added_at?: string
    id?: string
    studio_id: string
    user_id: string
  }
  Update: {
    added_at?: string
    id?: string
    studio_id?: string
    user_id?: string
  }
}
```

- [ ] **Step 3: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.types.ts
git commit -m "feat(types): add studio profile fields and studio_featured_fighters types"
```

---

## Task 3: `useStudioProfile` Hook

**Files:**
- Create: `src/hooks/useStudioProfile.ts`

Ersetzt den direkten `supabase.from('studios').select('id, name, city, address')` in `StudioDetailScreen` mit einem vollständigen Fetch inkl. neuer Felder.

- [ ] **Step 1: Hook schreiben**

```typescript
// src/hooks/useStudioProfile.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface StudioProfile {
  id: string;
  name: string;
  city: string;
  address: string | null;
  description: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  disciplines: string[];
  owner_user_id: string | null;
}

export function useStudioProfile(studioId: string): {
  studio: StudioProfile | null;
  loading: boolean;
  refetch: () => void;
} {
  const [studio, setStudio] = useState<StudioProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (studioId.trim().length === 0) return;

    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('studios')
        .select('id, name, city, address, description, banner_url, avatar_url, disciplines, owner_user_id')
        .eq('id', studioId)
        .single();
      setStudio(data ?? null);
      setLoading(false);
    })();
  }, [studioId, trigger]);

  return { studio, loading, refetch };
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Expected: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStudioProfile.ts
git commit -m "feat(hooks): add useStudioProfile with full profile fields"
```

---

## Task 4: `useFeaturedFighters` Hook

**Files:**
- Create: `src/hooks/useFeaturedFighters.ts`

- [ ] **Step 1: Hook schreiben**

```typescript
// src/hooks/useFeaturedFighters.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface FeaturedFighter {
  id: string;       // studio_featured_fighters.id
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  weightClass: string | null;
  discipline: string | null;
}

export function useFeaturedFighters(studioId: string): {
  fighters: FeaturedFighter[];
  loading: boolean;
  addFighter: (userId: string) => Promise<{ error: string | null }>;
  removeFighter: (userId: string) => Promise<{ error: string | null }>;
  refetch: () => void;
} {
  const [fighters, setFighters] = useState<FeaturedFighter[]>([]);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (studioId.trim().length === 0) return;

    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('studio_featured_fighters')
        .select(`
          id,
          user_id,
          profiles:user_id (
            name,
            avatar_url,
            weight_class,
            primary_discipline
          )
        `)
        .eq('studio_id', studioId)
        .order('added_at', { ascending: true });

      setFighters(
        (data ?? []).map((row) => {
          const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return {
            id: row.id,
            userId: row.user_id,
            name: (p as { name: string | null } | null)?.name ?? null,
            avatarUrl: (p as { avatar_url: string | null } | null)?.avatar_url ?? null,
            weightClass: (p as { weight_class: string | null } | null)?.weight_class ?? null,
            discipline: (p as { primary_discipline: string | null } | null)?.primary_discipline ?? null,
          };
        }),
      );
      setLoading(false);
    })();
  }, [studioId, trigger]);

  const addFighter = useCallback(async (userId: string): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('studio_featured_fighters')
      .insert({ studio_id: studioId, user_id: userId });
    if (error !== null) return { error: error.message };
    refetch();
    return { error: null };
  }, [studioId, refetch]);

  const removeFighter = useCallback(async (userId: string): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('studio_featured_fighters')
      .delete()
      .eq('studio_id', studioId)
      .eq('user_id', userId);
    if (error !== null) return { error: error.message };
    refetch();
    return { error: null };
  }, [studioId, refetch]);

  return { fighters, loading, addFighter, removeFighter, refetch };
}
```

**Hinweis:** Die Felder `weight_class` und `primary_discipline` müssen in `profiles` existieren (aus `20260608100000_add_fighter_profile_fields.sql`). Falls die Spaltenamen abweichen, entsprechend anpassen.

- [ ] **Step 2: Spaltennamen prüfen**

```bash
grep -A 5 "weight_class\|primary_discipline\|weightClass" /Users/romeogeorgiadis/strikeforce/src/types/database.types.ts | head -20
```

Wenn die Felder anders heißen, im Hook-Code oben anpassen (nur die Select-Query und das Mapping).

- [ ] **Step 3: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useFeaturedFighters.ts
git commit -m "feat(hooks): add useFeaturedFighters with add/remove/fetch"
```

---

## Task 5: `DisciplineChips` Komponente

**Files:**
- Create: `src/components/studio/DisciplineChips.tsx`

Wiederverwendbar in `StudioDetailScreen` (read-only), `StudioMapDetailSheet` (read-only, kompakt), `StudioProfileEditScreen` (selectable).

- [ ] **Step 1: Komponente schreiben**

```typescript
// src/components/studio/DisciplineChips.tsx
import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  disciplines: string[];
  selectable?: boolean;
  selected?: string[];
  onToggle?: (discipline: string) => void;
  compact?: boolean;
}

export default function DisciplineChips({
  disciplines,
  selectable = false,
  selected = [],
  onToggle,
  compact = false,
}: Props): React.ReactElement | null {
  if (disciplines.length === 0) return null;

  const chipStyle = compact ? styles.chipCompact : styles.chip;
  const textStyle = compact ? styles.chipTextCompact : styles.chipText;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {disciplines.map((d) => {
        const isSelected = selected.includes(d);
        const isActive = !selectable || isSelected;

        return (
          <TouchableOpacity
            key={d}
            style={[chipStyle, isActive && styles.chipActive]}
            onPress={() => selectable && onToggle?.(d)}
            activeOpacity={selectable ? 0.7 : 1}
          >
            <Text style={[textStyle, isActive && styles.chipTextActive]}>{d}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCompact: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.accentBlueSoft,
    borderColor: colors.accentBlue,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextCompact: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accentBlue,
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Expected: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/components/studio/DisciplineChips.tsx
git commit -m "feat(components): add DisciplineChips reusable component"
```

---

## Task 6: `StudioHero` Komponente

**Files:**
- Create: `src/components/studio/StudioHero.tsx`

Banner (200px) + Avatar (72px, -36px overlap) + Name + Stadt/Adresse.

- [ ] **Step 1: Komponente schreiben**

```typescript
// src/components/studio/StudioHero.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  name: string;
  city: string;
  address: string | null;
  bannerUrl: string | null;
  avatarUrl: string | null;
  isOwner: boolean;
  onEditPress: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function StudioHero({
  name,
  city,
  address,
  bannerUrl,
  avatarUrl,
  isOwner,
  onEditPress,
}: Props): React.ReactElement {
  return (
    <View style={styles.root}>
      {/* Banner */}
      <ImageBackground
        source={bannerUrl !== null ? { uri: bannerUrl } : undefined}
        style={styles.banner}
        imageStyle={styles.bannerImage}
      >
        <View style={styles.bannerOverlay} />
        {isOwner && (
          <TouchableOpacity style={styles.editBtn} onPress={onEditPress} activeOpacity={0.8}>
            <Ionicons name="pencil" size={16} color={colors.card} />
          </TouchableOpacity>
        )}
      </ImageBackground>

      {/* Avatar + Info row */}
      <View style={styles.infoRow}>
        <View style={styles.avatarWrap}>
          {avatarUrl !== null ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
            </View>
          )}
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.city} numberOfLines={1}>
            {address !== null ? `${city}  ·  ${address}` : city}
          </Text>
        </View>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 72;
const BANNER_HEIGHT = 200;
const OVERLAP = AVATAR_SIZE / 2;

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.card,
  },
  banner: {
    height: BANNER_HEIGHT,
    backgroundColor: colors.dark,
  },
  bannerImage: {
    resizeMode: 'cover',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  editBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: -OVERLAP,
    gap: 12,
  },
  avatarWrap: {
    borderWidth: 3,
    borderColor: colors.card,
    borderRadius: (AVATAR_SIZE + 6) / 2,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.card,
    letterSpacing: 1,
  },
  textWrap: {
    flex: 1,
    paddingBottom: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  city: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Expected: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/components/studio/StudioHero.tsx
git commit -m "feat(components): add StudioHero with banner/avatar overlap"
```

---

## Task 7: `FeaturedFightersRow` Komponente

**Files:**
- Create: `src/components/studio/FeaturedFightersRow.tsx`

Horizontale ScrollView. Tapping → `PublicProfile`. Eigene Karte zeigt Entfernen-Button.

- [ ] **Step 1: Komponente schreiben**

```typescript
// src/components/studio/FeaturedFightersRow.tsx
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import type { FeaturedFighter } from '../../hooks/useFeaturedFighters';
import type { RootStackParamList } from '../../navigation/types';

const CARD_SIZE = 80;

function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface Props {
  fighters: FeaturedFighter[];
  loading: boolean;
  currentUserId: string | null;
  onRemoveSelf: () => void;
}

export default function FeaturedFightersRow({
  fighters,
  loading,
  currentUserId,
  onRemoveSelf,
}: Props): React.ReactElement | null {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={colors.accentBlue} />
      </View>
    );
  }

  if (fighters.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {fighters.map((f) => {
        const isSelf = f.userId === currentUserId;
        return (
          <TouchableOpacity
            key={f.id}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PublicProfile', { userId: f.userId })}
          >
            {f.avatarUrl !== null ? (
              <Image source={{ uri: f.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.initials}>{getInitials(f.name)}</Text>
              </View>
            )}
            <Text style={styles.fighterName} numberOfLines={1}>
              {f.name ?? 'Unbekannt'}
            </Text>
            {f.discipline !== null && (
              <Text style={styles.fighterMeta} numberOfLines={1}>{f.discipline}</Text>
            )}
            {isSelf && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={onRemoveSelf}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color={colors.deleteRed} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  card: {
    width: CARD_SIZE + 16,
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_SIZE / 2,
  },
  avatarPlaceholder: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_SIZE / 2,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  fighterName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    width: CARD_SIZE + 16,
  },
  fighterMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: -4,
    right: 0,
  },
});
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Expected: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/components/studio/FeaturedFightersRow.tsx
git commit -m "feat(components): add FeaturedFightersRow with self-removal"
```

---

## Task 8: `StudioDetailScreen` rework

**Files:**
- Modify: `src/screens/StudioDetailScreen.tsx`

Ersetzt alten inline-Fetch durch `useStudioProfile`, fügt Hero, DisciplineChips, Beschreibung, FeaturedFightersRow ein. Navigation zu `StudioProfileEdit` für Owner.

- [ ] **Step 1: Screen komplett ersetzen**

```typescript
// src/screens/StudioDetailScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useStudioProfile } from '../hooks/useStudioProfile';
import { useFeaturedFighters } from '../hooks/useFeaturedFighters';
import { useSchedule } from '../hooks/useSchedule';
import { useMyStudioRequests } from '../hooks/useMyStudioRequests';
import { useStudioMembershipPlans } from '../hooks/useStudioMembershipPlans';
import StudioHero from '../components/studio/StudioHero';
import DisciplineChips from '../components/studio/DisciplineChips';
import FeaturedFightersRow from '../components/studio/FeaturedFightersRow';
import TrialBookingSheet from '../components/studio/TrialBookingSheet';
import MembershipPlansList from '../components/studio/MembershipPlansList';

type Props = NativeStackScreenProps<RootStackParamList, 'StudioDetail'>;

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const STATUS_LABELS: Record<string, string> = {
  pending:   'Ausstehend',
  confirmed: 'Bestätigt',
  declined:  'Abgelehnt',
  cancelled: 'Abgebrochen',
};

export default function StudioDetailScreen({ route, navigation }: Props): React.ReactElement {
  const { studioId } = route.params;
  const { user } = useAuth();

  const { studio, loading: studioLoading, refetch: refetchStudio } = useStudioProfile(studioId);
  const { fighters, loading: fightersLoading, removeFighter } = useFeaturedFighters(studioId);
  const { schedule, loading: scheduleLoading } = useSchedule(undefined, studioId);
  const { trialBookings, contracts, loading: requestsLoading, refetch } = useMyStudioRequests();
  const { plans, loading: plansLoading, refetch: refetchPlans } = useStudioMembershipPlans(studioId);
  const [bookingSheetVisible, setBookingSheetVisible] = useState(false);

  const isOwner = studio !== null && user !== null && studio.owner_user_id === user.id;

  const studioBooking = trialBookings.find((b) => b.studio_id === studioId) ?? null;
  const activeBooking =
    studioBooking !== null &&
    (studioBooking.status === 'pending' || studioBooking.status === 'confirmed')
      ? studioBooking
      : null;

  const activeContract =
    contracts.find(
      (c) =>
        c.studio_id === studioId &&
        (c.status === 'pending' || c.status === 'active' || c.status === 'cancellation_requested'),
    ) ?? null;

  async function handleRemoveSelf(): Promise<void> {
    if (user === null) return;
    Alert.alert(
      'Featured-Status entfernen',
      'Dein Profil wird nicht mehr auf dieser Studioseite angezeigt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await removeFighter(user.id);
            if (error !== null) Alert.alert('Fehler', error);
          },
        },
      ],
    );
  }

  const isLoading = studioLoading || requestsLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      </SafeAreaView>
    );
  }

  if (studio === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TouchableOpacity style={styles.backBtnStandalone} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Back button — floats over banner */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={22} color={colors.card} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <StudioHero
          name={studio.name}
          city={studio.city}
          address={studio.address}
          bannerUrl={studio.banner_url}
          avatarUrl={studio.avatar_url}
          isOwner={isOwner}
          onEditPress={() => navigation.navigate('StudioProfileEdit', { studioId })}
        />

        {studio.disciplines.length > 0 && (
          <DisciplineChips disciplines={studio.disciplines} />
        )}

        {studio.description !== null && studio.description.trim().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Über uns</Text>
            <Text style={styles.description}>{studio.description}</Text>
          </View>
        )}

        {(fighters.length > 0 || fightersLoading) && (
          <View style={styles.sectionNopad}>
            <Text style={[styles.sectionLabel, styles.sectionLabelPad]}>Featured Fighters</Text>
            <FeaturedFightersRow
              fighters={fighters}
              loading={fightersLoading}
              currentUserId={user?.id ?? null}
              onRemoveSelf={handleRemoveSelf}
            />
          </View>
        )}

        <View style={styles.content}>
          {/* Trial booking CTA or status */}
          {activeBooking !== null ? (
            <View style={styles.statusCard}>
              <Ionicons
                name={activeBooking.status === 'confirmed' ? 'checkmark-circle' : 'time-outline'}
                size={20}
                color={activeBooking.status === 'confirmed' ? colors.difficultyGreen : colors.accentBlue}
              />
              <View style={styles.statusTextBlock}>
                <Text style={styles.statusTitle}>Probetraining-Anfrage</Text>
                <Text style={styles.statusValue}>
                  {STATUS_LABELS[activeBooking.status] ?? activeBooking.status}
                  {'  ·  '}
                  {activeBooking.requested_date.split('-').reverse().join('.')}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() => setBookingSheetVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.card} />
              <Text style={styles.bookBtnText}>Probetraining buchen</Text>
            </TouchableOpacity>
          )}

          {/* Schedule */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Stundenplan</Text>
            {scheduleLoading ? (
              <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
            ) : schedule.length === 0 ? (
              <Text style={styles.emptyText}>Noch kein Stundenplan vorhanden.</Text>
            ) : (
              schedule.map((entry) => (
                <View key={entry.id} style={styles.scheduleRow}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>{DAY_LABELS[entry.day_of_week]}</Text>
                  </View>
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.scheduleName}>{entry.training_name}</Text>
                    <Text style={styles.scheduleMeta}>
                      {entry.start_time.slice(0, 5)}  ·  {entry.duration_min} Min.
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <MembershipPlansList
            studioId={studioId}
            plans={plans}
            loading={plansLoading}
            activeContract={activeContract}
            onContractSigned={() => { refetch(); refetchPlans(); }}
          />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      <TrialBookingSheet
        visible={bookingSheetVisible}
        studioId={studioId}
        schedule={schedule}
        onClose={() => setBookingSheetVisible(false)}
        onBooked={() => { refetch(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backBtnStandalone: {
    margin: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginTop: 48,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionNopad: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionLabelPad: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
  },
  bookBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  statusTextBlock: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusValue: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  scheduleInfo: {
    flex: 1,
    gap: 2,
  },
  scheduleName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  scheduleMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bottomPad: {
    height: 48,
  },
});
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Expected: Keine Fehler. Falls `StudioProfileEdit` noch nicht in `RootStackParamList` — erst Task 10 abschliessen, dann zurückkommen.

- [ ] **Step 3: Commit**

```bash
git add src/screens/StudioDetailScreen.tsx
git commit -m "feat(screens): rework StudioDetailScreen with hero, disciplines, featured fighters"
```

---

## Task 9: `StudioMapDetailSheet` — Disziplinen ergänzen

**Files:**
- Modify: `src/components/sparring/StudioMapDetailSheet.tsx`

DisciplineChips unter dem Header-Row einfügen. Disziplinen werden separat geladen.

- [ ] **Step 1: Disciplines-Fetch zum bestehenden `useEffect` hinzufügen**

In `StudioMapDetailSheet.tsx`:

1. Import ergänzen:
```typescript
import DisciplineChips from '../studio/DisciplineChips';
```

2. State ergänzen (nach `const [loadingSparrings, setLoadingSparrings] = useState(false);`):
```typescript
const [disciplines, setDisciplines] = useState<string[]>([]);
```

3. Zweiten `useEffect` für Disziplinen ergänzen (nach dem bestehenden Sparrings-useEffect):
```typescript
useEffect(() => {
  if (studio === null) {
    setDisciplines([]);
    return;
  }
  void (async () => {
    const { data } = await supabase
      .from('studios')
      .select('disciplines')
      .eq('id', studio.id)
      .single();
    setDisciplines((data?.disciplines as string[] | null) ?? []);
  })();
}, [studio]);
```

4. Im JSX nach dem `addressRow`-Block und vor dem `studioDetailBtn`:
```tsx
{disciplines.length > 0 && (
  <DisciplineChips disciplines={disciplines} compact />
)}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Expected: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/components/sparring/StudioMapDetailSheet.tsx
git commit -m "feat(sparring): show studio disciplines in map detail sheet"
```

---

## Task 10: Navigation — `StudioProfileEdit` Route

**Files:**
- Modify: `src/navigation/types.ts`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Route in types.ts hinzufügen**

In `src/navigation/types.ts`, nach `StudioDetail: { studioId: string };` einfügen:

```typescript
StudioProfileEdit: { studioId: string };
```

- [ ] **Step 2: Screen in RootNavigator.tsx registrieren**

Import ergänzen:
```typescript
import StudioProfileEditScreen from '../screens/StudioProfileEditScreen';
```

Nach dem `StudioDetail`-Screen-Block einfügen:
```tsx
<AppStack.Screen
  name="StudioProfileEdit"
  component={StudioProfileEditScreen}
  options={{ presentation: 'modal' }}
/>
```

- [ ] **Step 3: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Expected: Keine Fehler (evtl. Fehler weil `StudioProfileEditScreen` noch nicht existiert — dann erst Task 11 abschliessen).

- [ ] **Step 4: Commit**

```bash
git add src/navigation/types.ts src/navigation/RootNavigator.tsx
git commit -m "feat(nav): add StudioProfileEdit route"
```

---

## Task 11: `StudioProfileEditScreen`

**Files:**
- Create: `src/screens/StudioProfileEditScreen.tsx`

Owner-Screen: Banner/Avatar-Upload, Disziplinen-Picker, Beschreibungstext, Featured-Fighters-Management.

- [ ] **Step 1: Screen schreiben**

```typescript
// src/screens/StudioProfileEditScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as base64Decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useStudioProfile } from '../hooks/useStudioProfile';
import { useFeaturedFighters } from '../hooks/useFeaturedFighters';

type Props = NativeStackScreenProps<RootStackParamList, 'StudioProfileEdit'>;

const ALL_DISCIPLINES = [
  'Boxen', 'Kickboxen', 'Muay Thai', 'BJJ', 'Wrestling',
  'MMA', 'Grappling', 'Judo', 'K-1', 'Freistil',
];

const MAX_DESCRIPTION = 300;

interface StudioMember {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

async function uploadImage(
  localUri: string,
  bucket: string,
  path: string,
): Promise<{ url: string | null; error: string | null }> {
  const rawExt = localUri.split('.').pop()?.split('?')[0].toLowerCase() ?? '';
  const ext = rawExt === 'png' ? 'png' : 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const fullPath = `${path}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = base64Decode(base64);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fullPath, arrayBuffer, { upsert: true, contentType: mime });

  if (error !== null) return { url: null, error: error.message };

  const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath);
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
}

export default function StudioProfileEditScreen({ route, navigation }: Props): React.ReactElement {
  const { studioId } = route.params;
  const { studio, loading: studioLoading, refetch: refetchStudio } = useStudioProfile(studioId);
  const { fighters, loading: fightersLoading, addFighter, removeFighter, refetch: refetchFighters } =
    useFeaturedFighters(studioId);

  const [description, setDescription] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);
  const [members, setMembers] = useState<StudioMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    if (studio === null) return;
    setDescription(studio.description ?? '');
    setSelectedDisciplines(studio.disciplines);
  }, [studio]);

  function toggleDiscipline(d: string): void {
    setSelectedDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  async function pickImage(aspect: [number, number]): Promise<string | null> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Zugriff erforderlich', 'Bitte Foto-Zugriff in den Einstellungen erlauben.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect,
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return null;
    return result.assets[0].uri;
  }

  async function handlePickBanner(): Promise<void> {
    const uri = await pickImage([16, 9]);
    if (uri !== null) setBannerUri(uri);
  }

  async function handlePickAvatar(): Promise<void> {
    const uri = await pickImage([1, 1]);
    if (uri !== null) setAvatarUri(uri);
  }

  async function loadMembers(): Promise<void> {
    setMembersLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('studio_id', studioId);
    setMembers((data ?? []) as StudioMember[]);
    setMembersLoading(false);
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        description: description.trim().length > 0 ? description.trim() : null,
        disciplines: selectedDisciplines,
      };

      if (bannerUri !== null) {
        const { url, error } = await uploadImage(bannerUri, 'studio-assets', `${studioId}/banner`);
        if (error !== null) { Alert.alert('Banner-Upload fehlgeschlagen', error); setSaving(false); return; }
        updates.banner_url = url;
      }

      if (avatarUri !== null) {
        const { url, error } = await uploadImage(avatarUri, 'studio-assets', `${studioId}/avatar`);
        if (error !== null) { Alert.alert('Avatar-Upload fehlgeschlagen', error); setSaving(false); return; }
        updates.avatar_url = url;
      }

      const { error } = await supabase
        .from('studios')
        .update(updates)
        .eq('id', studioId);

      if (error !== null) {
        Alert.alert('Fehler beim Speichern', error.message);
        setSaving(false);
        return;
      }

      refetchStudio();
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  const displayBanner = bannerUri ?? studio?.banner_url ?? null;
  const displayAvatar = avatarUri ?? studio?.avatar_url ?? null;
  const studioName = studio?.name ?? '';

  const alreadyFeaturedIds = new Set(fighters.map((f) => f.userId));
  const pickableMembers = members.filter((m) => !alreadyFeaturedIds.has(m.id));

  if (studioLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Abbrechen</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil bearbeiten</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving
            ? <ActivityIndicator size="small" color={colors.accentBlue} />
            : <Text style={styles.saveText}>Speichern</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner */}
          <TouchableOpacity onPress={handlePickBanner} activeOpacity={0.85}>
            <ImageBackground
              source={displayBanner !== null ? { uri: displayBanner } : undefined}
              style={styles.banner}
              imageStyle={styles.bannerImage}
            >
              <View style={styles.bannerOverlay} />
              <View style={styles.bannerEditHint}>
                <Ionicons name="image-outline" size={22} color={colors.card} />
                <Text style={styles.bannerEditText}>Banner ändern</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.avatarRow}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85} style={styles.avatarWrap}>
              {displayAvatar !== null ? (
                <Image source={{ uri: displayAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>
                    {studioName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={14} color={colors.card} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Disciplines */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Disziplinen</Text>
              <View style={styles.disciplinesGrid}>
                {ALL_DISCIPLINES.map((d) => {
                  const active = selectedDisciplines.includes(d);
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.disciplineChip, active && styles.disciplineChipActive]}
                      onPress={() => toggleDiscipline(d)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.disciplineText, active && styles.disciplineTextActive]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Über uns</Text>
                <Text style={styles.charCount}>
                  {description.length}/{MAX_DESCRIPTION}
                </Text>
              </View>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={(t) => setDescription(t.slice(0, MAX_DESCRIPTION))}
                placeholder="Beschreibe dein Studio..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Featured Fighters */}
            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Featured Fighters</Text>
                <TouchableOpacity
                  onPress={async () => {
                    await loadMembers();
                    setMemberPickerVisible(true);
                  }}
                  style={styles.addBtn}
                >
                  <Ionicons name="add" size={18} color={colors.accentBlue} />
                  <Text style={styles.addBtnText}>Hinzufügen</Text>
                </TouchableOpacity>
              </View>

              {fightersLoading ? (
                <ActivityIndicator color={colors.accentBlue} />
              ) : fighters.length === 0 ? (
                <Text style={styles.emptyText}>Noch keine Featured Fighters.</Text>
              ) : (
                fighters.map((f) => (
                  <View key={f.id} style={styles.fighterRow}>
                    {f.avatarUrl !== null ? (
                      <Image source={{ uri: f.avatarUrl }} style={styles.fighterAvatar} />
                    ) : (
                      <View style={[styles.fighterAvatar, styles.fighterAvatarPlaceholder]}>
                        <Text style={styles.fighterInitials}>
                          {(f.name ?? '?').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.fighterName}>{f.name ?? 'Unbekannt'}</Text>
                    <TouchableOpacity
                      onPress={async () => {
                        const { error } = await removeFighter(f.userId);
                        if (error !== null) Alert.alert('Fehler', error);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.deleteRed} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Member picker modal */}
      <Modal
        visible={memberPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMemberPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setMemberPickerVisible(false)}
        />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>Mitglied hinzufügen</Text>
          {membersLoading ? (
            <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
          ) : pickableMembers.length === 0 ? (
            <Text style={styles.emptyText}>Keine weiteren Mitglieder verfügbar.</Text>
          ) : (
            <FlatList
              data={pickableMembers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.memberRow}
                  activeOpacity={0.8}
                  onPress={async () => {
                    setMemberPickerVisible(false);
                    const { error } = await addFighter(item.id);
                    if (error !== null) Alert.alert('Fehler', error);
                  }}
                >
                  {item.avatar_url !== null ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                      <Text style={styles.memberInitials}>
                        {(item.name ?? '?').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.memberName}>{item.name ?? 'Unbekannt'}</Text>
                  <Ionicons name="add-circle-outline" size={22} color={colors.accentBlue} />
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              style={styles.memberList}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: {
    minWidth: 80,
  },
  cancelText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  saveBtn: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  loader: {
    marginTop: 48,
  },
  scroll: {
    flex: 1,
  },
  banner: {
    height: 180,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerImage: {
    resizeMode: 'cover',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bannerEditHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bannerEditText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: '600',
  },
  avatarRow: {
    paddingHorizontal: 16,
    marginTop: -36,
    marginBottom: 8,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.card,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  avatarPlaceholder: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.card,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  charCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  disciplinesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  disciplineChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disciplineChipActive: {
    backgroundColor: colors.accentBlueSoft,
    borderColor: colors.accentBlue,
  },
  disciplineText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  disciplineTextActive: {
    color: colors.accentBlue,
    fontWeight: '600',
  },
  descriptionInput: {
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
    lineHeight: 20,
    fontFamily: 'Inter',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  fighterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fighterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  fighterAvatarPlaceholder: {
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fighterInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  fighterName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.mapOverlay,
  },
  pickerSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '60%',
  },
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  memberList: {
    maxHeight: 320,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarPlaceholder: {
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  memberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  bottomPad: {
    height: 48,
  },
});
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Expected: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/screens/StudioProfileEditScreen.tsx
git commit -m "feat(screens): add StudioProfileEditScreen for owner"
```

---

## Task 12: Abschlusskontrolle

- [ ] **Step 1: Vollständiger TypeScript-Check**

```bash
npx tsc --noEmit
```

Expected: 0 Fehler.

- [ ] **Step 2: App starten und Feature-Pfad durchklicken**

```bash
npx expo start --ios
```

Testen:
1. Map öffnen → Studio-Marker tippen → Quick-Sheet zeigt Disziplinen (falls gesetzt)
2. "Studio ansehen" → StudioDetailScreen mit Banner/Avatar-Fallback (dark), leere Sektionen werden korrekt ausgeblendet
3. Als Owner: Edit-Icon sichtbar → StudioProfileEditScreen öffnet sich als Modal
4. Disziplinen toggen, Beschreibung eingeben, Banner/Avatar hochladen → Speichern → Profil aktualisiert sich
5. Mitglied als Featured Fighter hinzufügen → erscheint in FeaturedFightersRow
6. Als anderer User (der gefeatured ist): "X"-Button auf eigener Karte sichtbar → Entfernen-Alert → verschwindet

- [ ] **Step 3: Obsidian Dev-Log schreiben**

```bash
cat >> "/Users/romeogeorgiadis/Documents/Obsidian Vault/02 Projekte/Sparr/Dev-Log/2026-06-09.md" << 'EOF'

---

## Was wurde gebaut / geändert
- Studio-Profilseite vollständig reworked: Banner + Avatar Hero, Disziplin-Chips, Beschreibung, Featured Fighters Row
- Neue DB-Tabelle `studio_featured_fighters` + neue Spalten auf `studios` (description, banner_url, avatar_url, disciplines)
- `StudioProfileEditScreen` für Studio-Owner: Bild-Upload, Disziplinen-Picker, Featured-Fighters-Management
- `DisciplineChips` Komponente wiederverwendbar in Detail-Screen + Map Quick-Sheet
- Quick-Sheet zeigt jetzt Studio-Disziplinen

## Warum
- Teams/Studios sollen sich visuell auf der Map präsentieren können
- Featured Fighters als Aushängeschild des Studios

## Offene Probleme
- Keine bekannten

## Nächste Schritte
- Disziplin-Filter auf der Map als optionaler nächster Schritt
EOF
```

- [ ] **Step 4: Final Commit**

```bash
git add -A
git commit -m "feat(studio): complete studio profile — hero, disciplines, featured fighters, edit screen"
```

---

## Hinweise

- **profiles.primary_discipline / weight_class**: Die `useFeaturedFighters`-Query joined diese Felder. Falls die Spaltennamen in `database.types.ts` abweichen, müssen sie in der Select-Query in Task 4 angepasst werden (kein Breaking Change, da `null`-Fallback vorhanden).
- **Storage Bucket**: Muss manuell im Supabase Dashboard angelegt werden, falls der SQL-Befehl in Task 1 Step 3 fehlschlägt (einige Supabase-Versionen erlauben keinen direkten Storage-Insert via SQL).
- **Back-Button-Position**: Der float-positionierte Back-Button in `StudioDetailScreen` hat `top: 56` für Standard-SafeArea. Bei ungewöhnlichen Geräten ggf. `insets.top + 8` aus `useSafeAreaInsets` verwenden.
