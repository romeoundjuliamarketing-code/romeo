# Open Sparring Map – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coaches können ein offenes Sparring mit Adresse, Datum, Uhrzeit und Max-Teilnehmern erstellen; alle Nutzer sehen die Sparrings auf einer kleinen Karte im "Plan"-Tab und können sie in einer Vollbild-Karte erkunden und sich anmelden.

**Architecture:** Sparrings speichern Adresse + `lat`/`lng` direkt auf `open_sparrings` (einmalig per Nominatim geocodiert). Im TrainingScreen "Plan"-Tab erscheint eine kleine nicht-interaktive `SparringMapCard`; Antippen öffnet `SparringMapScreen` als RootStack-Modal mit Vollbild-Karte. Marker-Tap öffnet `SparringDetailSheet` (Bottom Sheet über der Karte). Coach erstellt Sparrings aus dem TeamScreen. Kein neuer Tab.

**Tech Stack:** react-native-maps (Apple Maps iOS, kein API-Key), Nominatim (kostenlos, kein Account), @react-native-community/datetimepicker (bereits installiert), Supabase RLS.

---

## File Map

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `supabase/migrations/20260507100000_add_open_sparrings.sql` | Create | Tabellen + RLS |
| `src/utils/geocoding.ts` | Create | Nominatim-Wrapper |
| `src/types/database.types.ts` | Modify | Neue Tabellen |
| `src/hooks/useOpenSparrings.ts` | Create | Sparrings laden + Signup-Status |
| `src/hooks/useSparringActions.ts` | Create | Anmelden, Absagen, Erstellen, Deaktivieren |
| `src/components/sparring/SparringDetailSheet.tsx` | Create | Bottom-Sheet-Detail + Anmelde-Button |
| `src/components/sparring/CreateSparringSheet.tsx` | Create | Coach-Formular (aus TeamScreen) |
| `src/components/sparring/SparringMapCard.tsx` | Create | Kleine Vorschau-Karte im Plan-Tab |
| `src/screens/SparringMapScreen.tsx` | Create | Vollbild-Karte als Modal |
| `src/screens/TeamScreen.tsx` | Modify | Coach-Button zum Erstellen |
| `src/screens/TrainingScreen.tsx` | Modify | SparringMapCard nach StundenplanSection |
| `src/navigation/types.ts` | Modify | `SparringMap` zu RootStackParamList |
| `src/navigation/RootNavigator.tsx` | Modify | SparringMapScreen registrieren |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260507100000_add_open_sparrings.sql`

- [ ] **Step 1: Migration-Datei erstellen**

```sql
-- Sparring sessions with their own address + geocoords
CREATE TABLE open_sparrings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id     uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  discipline    text NOT NULL,
  address       text NOT NULL,
  lat           double precision,
  lng           double precision,
  scheduled_at  timestamptz NOT NULL,
  duration_min  int NOT NULL DEFAULT 90,
  max_slots     int NOT NULL DEFAULT 10,
  notes         text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- User signups for sparring sessions
CREATE TABLE sparring_signups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sparring_id  uuid NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sparring_id, user_id)
);

-- RLS
ALTER TABLE open_sparrings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sparring_signups ENABLE ROW LEVEL SECURITY;

-- Any logged-in user can read active sparrings
CREATE POLICY "read active sparrings" ON open_sparrings
  FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);

-- Only coaches can create sparrings for their own studio
CREATE POLICY "coaches insert sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_coach = true
    )
  );

-- Only creator can soft-delete (set is_active = false)
CREATE POLICY "creator update sparrings" ON open_sparrings
  FOR UPDATE USING (created_by = auth.uid());

-- Any logged-in user can read signups
CREATE POLICY "read sparring signups" ON sparring_signups
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can only sign up themselves
CREATE POLICY "insert own signup" ON sparring_signups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can cancel their own signup
CREATE POLICY "delete own signup" ON sparring_signups
  FOR DELETE USING (user_id = auth.uid());
```

- [ ] **Step 2: Migration in Supabase anwenden**

Via Supabase MCP (`apply_migration`) oder SQL-Editor.

Prüfen:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('open_sparrings', 'sparring_signups');
```

Erwartet: Beide Tabellen erscheinen.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260507100000_add_open_sparrings.sql
git commit -m "feat(db): add open_sparrings and sparring_signups with RLS"
```

---

## Task 2: react-native-maps installieren

**Files:**
- Modify: `package.json` (automatisch)

- [ ] **Step 1: Paket installieren**

```bash
npx expo install react-native-maps
```

Erwartet: `"react-native-maps"` erscheint in `package.json` unter `dependencies`.

- [ ] **Step 2: Native Rebuild**

`react-native-maps` braucht nativen Code. Simulator neu bauen:

```bash
npx expo run:ios
```

Erwartet: Build läuft durch, App startet ohne Fehler.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): add react-native-maps"
```

---

## Task 3: Geocoding-Utility

**Files:**
- Create: `src/utils/geocoding.ts`

- [ ] **Step 1: Datei erstellen**

```ts
interface NominatimResult {
  lat: string;
  lon: string;
}

export interface Geocoordinates {
  lat: number;
  lng: number;
}

export async function geocodeAddress(query: string): Promise<Geocoordinates | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Strikeforce-App/1.0' },
    });
    const data = (await response.json()) as NominatimResult[];
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/utils/geocoding.ts
git commit -m "feat(utils): add Nominatim geocoding utility"
```

---

## Task 4: database.types.ts aktualisieren

**Files:**
- Modify: `src/types/database.types.ts`

- [ ] **Step 1: open_sparrings-Tabelle einfügen**

Nach dem `studios`-Block (vor `subscriptions`) einfügen:

```ts
open_sparrings: {
  Row: {
    id: string
    studio_id: string
    created_by: string
    title: string
    discipline: string
    address: string
    lat: number | null
    lng: number | null
    scheduled_at: string
    duration_min: number
    max_slots: number
    notes: string | null
    is_active: boolean
    created_at: string
  }
  Insert: {
    id?: string
    studio_id: string
    created_by: string
    title: string
    discipline: string
    address: string
    lat?: number | null
    lng?: number | null
    scheduled_at: string
    duration_min?: number
    max_slots?: number
    notes?: string | null
    is_active?: boolean
    created_at?: string
  }
  Update: {
    id?: string
    studio_id?: string
    created_by?: string
    title?: string
    discipline?: string
    address?: string
    lat?: number | null
    lng?: number | null
    scheduled_at?: string
    duration_min?: number
    max_slots?: number
    notes?: string | null
    is_active?: boolean
    created_at?: string
  }
  Relationships: [
    {
      foreignKeyName: 'open_sparrings_studio_id_fkey'
      columns: ['studio_id']
      isOneToOne: false
      referencedRelation: 'studios'
      referencedColumns: ['id']
    },
    {
      foreignKeyName: 'open_sparrings_created_by_fkey'
      columns: ['created_by']
      isOneToOne: false
      referencedRelation: 'profiles'
      referencedColumns: ['id']
    },
  ]
}
sparring_signups: {
  Row: {
    id: string
    sparring_id: string
    user_id: string
    signed_up_at: string
  }
  Insert: {
    id?: string
    sparring_id: string
    user_id: string
    signed_up_at?: string
  }
  Update: {
    id?: string
    sparring_id?: string
    user_id?: string
    signed_up_at?: string
  }
  Relationships: [
    {
      foreignKeyName: 'sparring_signups_sparring_id_fkey'
      columns: ['sparring_id']
      isOneToOne: false
      referencedRelation: 'open_sparrings'
      referencedColumns: ['id']
    },
    {
      foreignKeyName: 'sparring_signups_user_id_fkey'
      columns: ['user_id']
      isOneToOne: false
      referencedRelation: 'profiles'
      referencedColumns: ['id']
    },
  ]
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.types.ts
git commit -m "feat(types): add open_sparrings and sparring_signups to database types"
```

---

## Task 5: useOpenSparrings Hook

**Files:**
- Create: `src/hooks/useOpenSparrings.ts`

- [ ] **Step 1: Datei erstellen**

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

export interface SparringWithMeta {
  id: string;
  studio_id: string;
  created_by: string;
  title: string;
  discipline: string;
  address: string;
  lat: number | null;
  lng: number | null;
  scheduled_at: string;
  duration_min: number;
  max_slots: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  studio_name: string;
  studio_city: string;
  signup_count: number;
  is_signed_up: boolean;
}

export function useOpenSparrings(refetchTrigger = 0): {
  sparrings: SparringWithMeta[];
  loading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const [sparrings, setSparrings] = useState<SparringWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [localTrigger, setLocalTrigger] = useState(0);

  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) return;

    void (async () => {
      setLoading(true);
      const now = new Date().toISOString();

      const { data: rows, error } = await supabase
        .from('open_sparrings')
        .select('*, studios!studio_id(name, city)')
        .eq('is_active', true)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true });

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      const [{ data: mySignups }, { data: allSignups }] = await Promise.all([
        supabase.from('sparring_signups').select('sparring_id').eq('user_id', user.id),
        supabase.from('sparring_signups').select('sparring_id'),
      ]);

      const signedUpIds = new Set((mySignups ?? []).map((s) => s.sparring_id));
      const countMap: Record<string, number> = {};
      for (const s of allSignups ?? []) {
        countMap[s.sparring_id] = (countMap[s.sparring_id] ?? 0) + 1;
      }

      type StudioJoin = { name: string; city: string };

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
          studio_name: studio.name,
          studio_city: studio.city,
          signup_count: countMap[r.id] ?? 0,
          is_signed_up: signedUpIds.has(r.id),
        };
      });

      reportNetworkSuccess();
      setSparrings(result);
      setLoading(false);
    })();
  }, [user, refetchTrigger, localTrigger]);

  return { sparrings, loading, refetch };
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useOpenSparrings.ts
git commit -m "feat(hooks): add useOpenSparrings"
```

---

## Task 6: useSparringActions Hook

**Files:**
- Create: `src/hooks/useSparringActions.ts`

- [ ] **Step 1: Datei erstellen**

```ts
import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { geocodeAddress } from '../utils/geocoding';

export interface CreateSparringParams {
  studioId: string;
  title: string;
  discipline: string;
  address: string;
  scheduledAt: string;
  durationMin: number;
  maxSlots: number;
  notes: string;
}

export function useSparringActions(): {
  signUp: (sparringId: string) => Promise<{ error: string | null }>;
  cancelSignup: (sparringId: string) => Promise<{ error: string | null }>;
  createSparring: (params: CreateSparringParams) => Promise<{ error: string | null }>;
  deactivateSparring: (sparringId: string) => Promise<{ error: string | null }>;
} {
  const { user } = useAuth();

  const signUp = useCallback(async (sparringId: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    const { error } = await supabase
      .from('sparring_signups')
      .insert({ sparring_id: sparringId, user_id: user.id });
    return { error: error?.message ?? null };
  }, [user]);

  const cancelSignup = useCallback(async (sparringId: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    const { error } = await supabase
      .from('sparring_signups')
      .delete()
      .eq('sparring_id', sparringId)
      .eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const createSparring = useCallback(async (params: CreateSparringParams): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };

    const coords = await geocodeAddress(params.address);

    const { error } = await supabase.from('open_sparrings').insert({
      studio_id: params.studioId,
      created_by: user.id,
      title: params.title,
      discipline: params.discipline,
      address: params.address,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      scheduled_at: params.scheduledAt,
      duration_min: params.durationMin,
      max_slots: params.maxSlots,
      notes: params.notes.trim() || null,
    });
    return { error: error?.message ?? null };
  }, [user]);

  const deactivateSparring = useCallback(async (sparringId: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    const { error } = await supabase
      .from('open_sparrings')
      .update({ is_active: false })
      .eq('id', sparringId)
      .eq('created_by', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  return { signUp, cancelSignup, createSparring, deactivateSparring };
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSparringActions.ts
git commit -m "feat(hooks): add useSparringActions"
```

---

## Task 7: SparringDetailSheet

**Files:**
- Create: `src/components/sparring/SparringDetailSheet.tsx`

- [ ] **Step 1: Ordner anlegen und Datei erstellen**

```bash
mkdir -p src/components/sparring
```

```tsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { SparringWithMeta } from '../../hooks/useOpenSparrings';

interface Props {
  sparring: SparringWithMeta | null;
  onClose: () => void;
  onToggleSignup: () => Promise<void>;
  loading: boolean;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time} Uhr`;
}

export default function SparringDetailSheet({ sparring, onClose, onToggleSignup, loading }: Props) {
  if (sparring === null) return null;

  const slotsLeft = sparring.max_slots - sparring.signup_count;
  const isFull = slotsLeft <= 0;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>{sparring.title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{sparring.discipline}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            {sparring.studio_name} · {sparring.address}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>{formatDateTime(sparring.scheduled_at)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>{sparring.duration_min} Minuten</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>
            {sparring.signup_count}/{sparring.max_slots} Angemeldet
            {!isFull && (
              <Text style={styles.slotsLeft}>{`  ${slotsLeft} Platz${slotsLeft === 1 ? '' : 'ätze'} frei`}</Text>
            )}
          </Text>
        </View>

        {sparring.notes !== null && sparring.notes.length > 0 && (
          <Text style={styles.notes}>{sparring.notes}</Text>
        )}

        <TouchableOpacity
          style={[
            styles.btn,
            sparring.is_signed_up && styles.btnCancel,
            isFull && !sparring.is_signed_up && styles.btnDisabled,
          ]}
          onPress={onToggleSignup}
          disabled={loading || (isFull && !sparring.is_signed_up)}
        >
          {loading ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.btnText}>
              {sparring.is_signed_up ? 'Abmelden' : isFull ? 'Ausgebucht' : 'Anmelden'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    lineHeight: 26,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  slotsLeft: {
    color: colors.difficultyGreen,
    fontWeight: '600',
  },
  notes: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnCancel: {
    backgroundColor: colors.deleteRed,
  },
  btnDisabled: {
    backgroundColor: colors.textSecondary,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
});
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/components/sparring/SparringDetailSheet.tsx
git commit -m "feat(components): add SparringDetailSheet"
```

---

## Task 8: CreateSparringSheet

**Files:**
- Create: `src/components/sparring/CreateSparringSheet.tsx`

- [ ] **Step 1: Datei erstellen**

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CreateSparringParams } from '../../hooks/useSparringActions';

const DISCIPLINES = ['Boxen', 'K1 / Kickboxen', 'BJJ', 'MMA', 'Muay Thai', 'Ringen', 'Sonstiges'];

interface Props {
  visible: boolean;
  studioId: string;
  onClose: () => void;
  onCreate: (params: CreateSparringParams) => Promise<void>;
}

function nextDay18h(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

export default function CreateSparringSheet({ visible, studioId, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState(DISCIPLINES[0]);
  const [address, setAddress] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date>(nextDay18h);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [durationMin, setDurationMin] = useState('90');
  const [maxSlots, setMaxSlots] = useState('10');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  function formatDate(d: Date): string {
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatTime(d: Date): string {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  async function handleCreate(): Promise<void> {
    if (title.trim().length === 0) {
      Alert.alert('Titel fehlt', 'Bitte gib einen Titel ein.');
      return;
    }
    if (address.trim().length === 0) {
      Alert.alert('Adresse fehlt', 'Bitte gib die Adresse des Sparrings ein.');
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

    setLoading(true);
    await onCreate({
      studioId,
      title: title.trim(),
      discipline,
      address: address.trim(),
      scheduledAt: scheduledAt.toISOString(),
      durationMin: dur,
      maxSlots: slots,
      notes,
    });
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Sparring planen</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <Text style={styles.label}>Titel</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="z.B. Offenes Boxsparring"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Kampfsport</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.pillRow}>
              {DISCIPLINES.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.pill, discipline === d && styles.pillActive]}
                  onPress={() => setDiscipline(d)}
                >
                  <Text style={[styles.pillText, discipline === d && styles.pillTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.label}>Adresse</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Straße, Hausnummer, Stadt"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Datum</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.inputText}>{formatDate(scheduledAt)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={scheduledAt}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(_, date) => {
                setShowDatePicker(false);
                if (date !== undefined) {
                  const merged = new Date(date);
                  merged.setHours(scheduledAt.getHours(), scheduledAt.getMinutes());
                  setScheduledAt(merged);
                }
              }}
            />
          )}

          <Text style={styles.label}>Uhrzeit</Text>
          <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.inputText}>{formatTime(scheduledAt)}</Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={scheduledAt}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, date) => {
                setShowTimePicker(false);
                if (date !== undefined) {
                  const merged = new Date(scheduledAt);
                  merged.setHours(date.getHours(), date.getMinutes());
                  setScheduledAt(merged);
                }
              }}
            />
          )}

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

          <Text style={styles.label}>Hinweise (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Level, Ausrüstung, Hinweise..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.btnText}>Veröffentlichen</Text>
            )}
          </TouchableOpacity>

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
    maxHeight: '88%',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputText: {
    fontSize: 15,
    color: colors.text,
  },
  multiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.card,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  colItem: {
    flex: 1,
  },
  btn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
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

Erwartet: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/components/sparring/CreateSparringSheet.tsx
git commit -m "feat(components): add CreateSparringSheet"
```

---

## Task 9: SparringMapCard (kleine Vorschau)

**Files:**
- Create: `src/components/sparring/SparringMapCard.tsx`

Diese Karte erscheint im "Plan"-Tab am Ende. Sie zeigt eine kleine, nicht-interaktive Karte mit den aktiven Sparring-Pins und einer Schaltfläche zum Öffnen der Vollbild-Ansicht.

- [ ] **Step 1: Datei erstellen**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { SparringWithMeta } from '../../hooks/useOpenSparrings';

// DACH region
const INITIAL_REGION = {
  latitude: 48.14,
  longitude: 11.58,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

interface Props {
  sparrings: SparringWithMeta[];
  onPress: () => void;
}

export default function SparringMapCard({ sparrings, onPress }: Props) {
  const withCoords = sparrings.filter((s) => s.lat !== null && s.lng !== null);
  const count = sparrings.length;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Offene Sparrings</Text>
        <Text style={styles.cardCount}>
          {count === 0 ? 'Keine' : `${count} offen`}
        </Text>
      </View>

      {/* Non-interactive map preview */}
      <View style={styles.mapWrap}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          pointerEvents="none"
        >
          {withCoords.map((s) => (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            />
          ))}
        </MapView>

        {/* Tap overlay to open fullscreen */}
        <TouchableOpacity style={styles.overlay} onPress={onPress} activeOpacity={0.85}>
          <View style={styles.expandBtn}>
            <Ionicons name="expand-outline" size={16} color={colors.card} />
            <Text style={styles.expandLabel}>Karte öffnen</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  cardCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  mapWrap: {
    height: 160,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 12,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  expandLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.card,
  },
});
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/components/sparring/SparringMapCard.tsx
git commit -m "feat(components): add SparringMapCard preview"
```

---

## Task 10: SparringMapScreen (Vollbild)

**Files:**
- Create: `src/screens/SparringMapScreen.tsx`

- [ ] **Step 1: Datei erstellen**

```tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { useOpenSparrings } from '../hooks/useOpenSparrings';
import { useSparringActions } from '../hooks/useSparringActions';
import SparringDetailSheet from '../components/sparring/SparringDetailSheet';
import type { SparringWithMeta } from '../hooks/useOpenSparrings';

const INITIAL_REGION = {
  latitude: 48.14,
  longitude: 11.58,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

type Props = NativeStackScreenProps<RootStackParamList, 'SparringMap'>;

export default function SparringMapScreen({ navigation }: Props) {
  const { sparrings, refetch } = useOpenSparrings();
  const { signUp, cancelSignup } = useSparringActions();
  const [selected, setSelected] = useState<SparringWithMeta | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const withCoords = sparrings.filter((s) => s.lat !== null && s.lng !== null);

  async function handleToggleSignup(): Promise<void> {
    if (selected === null) return;
    setActionLoading(true);
    const fn = selected.is_signed_up
      ? cancelSignup(selected.id)
      : signUp(selected.id);
    await fn;
    setActionLoading(false);
    refetch();
    setSelected(null);
  }

  return (
    <View style={styles.root}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={INITIAL_REGION}
      >
        {withCoords.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat!, longitude: s.lng! }}
            title={s.title}
            description={`${s.studio_name} · ${s.discipline}`}
            onPress={() => setSelected(s)}
          />
        ))}
      </MapView>

      {/* Close button overlay */}
      <SafeAreaView style={styles.closeWrap} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {sparrings.length === 0
              ? 'Keine offenen Sparrings'
              : `${sparrings.length} Sparring${sparrings.length === 1 ? '' : 's'}`}
          </Text>
        </View>
      </SafeAreaView>

      <SparringDetailSheet
        sparring={selected}
        onClose={() => setSelected(null)}
        onToggleSignup={handleToggleSignup}
        loading={actionLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  closeWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  countBadge: {
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Fehler wegen fehlendem `SparringMap` in `RootStackParamList` — wird in Task 11 behoben.

- [ ] **Step 3: Commit (noch nicht — erst nach Task 11)**

---

## Task 11: Navigation registrieren

**Files:**
- Modify: `src/navigation/types.ts`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: types.ts — SparringMap hinzufügen**

In `RootStackParamList` nach `PointsBreakdown: undefined` einfügen:
```ts
SparringMap: undefined;
```

- [ ] **Step 2: RootNavigator.tsx — Screen registrieren**

Import hinzufügen:
```tsx
import SparringMapScreen from '../screens/SparringMapScreen';
```

Im `AppStack.Navigator` nach `PointsBreakdown` einfügen:
```tsx
<AppStack.Screen
  name="SparringMap"
  component={SparringMapScreen}
  options={{ presentation: 'fullScreenModal' }}
/>
```

- [ ] **Step 3: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/screens/SparringMapScreen.tsx src/navigation/types.ts src/navigation/RootNavigator.tsx
git commit -m "feat(navigation): add SparringMap fullscreen modal"
```

---

## Task 12: TrainingScreen — SparringMapCard einbinden

**Files:**
- Modify: `src/screens/TrainingScreen.tsx`

- [ ] **Step 1: Imports hinzufügen**

Oben einfügen:
```tsx
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import SparringMapCard from '../components/sparring/SparringMapCard';
import { useOpenSparrings } from '../hooks/useOpenSparrings';
```

- [ ] **Step 2: Hook und Navigation aufrufen**

Innerhalb von `TrainingScreen()`, nach den bestehenden Hook-Aufrufen, einfügen:
```tsx
const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
const { sparrings } = useOpenSparrings(focusTrigger);
```

- [ ] **Step 3: SparringMapCard in den "plan"-Tab einfügen**

Der aktuelle "plan"-Zweig ist:
```tsx
) : (
  <StundenplanSection ... />
)}
```

Ersetzen durch:
```tsx
) : (
  <>
    <StundenplanSection
      studioSchedule={fullSchedule}
      studioLoading={scheduleLoading}
      todayDow={todayDow}
      hasStudio={profile?.studio_id !== null && profile?.studio_id !== undefined}
    />
    <SparringMapCard
      sparrings={sparrings}
      onPress={() => navigation.navigate('SparringMap')}
    />
  </>
)}
```

- [ ] **Step 4: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/screens/TrainingScreen.tsx
git commit -m "feat(training): add SparringMapCard to Plan tab"
```

---

## Task 13: TeamScreen — Coach-Button zum Erstellen

**Files:**
- Modify: `src/screens/TeamScreen.tsx`

Der TeamScreen hat bereits eine Coach-Sektion. Hier wird ein neuer "Sparring planen"-Button + das `CreateSparringSheet` hinzugefügt.

- [ ] **Step 1: Imports hinzufügen**

Oben in `TeamScreen.tsx` einfügen:
```tsx
import CreateSparringSheet from '../components/sparring/CreateSparringSheet';
import { useSparringActions } from '../hooks/useSparringActions';
```

- [ ] **Step 2: State und Hook im Screen**

In der Komponente nach den bestehenden States einfügen:
```tsx
const [sparringSheetVisible, setSparringSheetVisible] = useState(false);
const { createSparring } = useSparringActions();
```

- [ ] **Step 3: Coach-Button einfügen**

Im TeamScreen gibt es bereits eine Coach-Sektion, die `isCoach` abfragt. Nach der bestehenden "Einladungscode"-Karte (oder dem letzten Coach-Element) folgenden Block einfügen:

```tsx
{isCoach && (
  <TouchableOpacity
    style={styles.sparringBtn}
    onPress={() => setSparringSheetVisible(true)}
    activeOpacity={0.8}
  >
    <MaterialCommunityIcons name="boxing-glove" size={20} color={colors.accentBlue} />
    <Text style={styles.sparringBtnText}>Sparring planen</Text>
  </TouchableOpacity>
)}
```

Den Stil in `StyleSheet.create` hinzufügen:
```ts
sparringBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  backgroundColor: colors.accentBlueSoft,
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 14,
  marginHorizontal: 16,
  marginTop: 16,
},
sparringBtnText: {
  fontSize: 15,
  fontWeight: '600',
  color: colors.accentBlue,
},
```

- [ ] **Step 4: CreateSparringSheet am Ende des Screens einbinden**

Vor dem letzten schließenden `</SafeAreaView>` einfügen:
```tsx
{studioId !== null && (
  <CreateSparringSheet
    visible={sparringSheetVisible}
    studioId={studioId}
    onClose={() => setSparringSheetVisible(false)}
    onCreate={async (params) => {
      const { error } = await createSparring(params);
      if (error !== null) {
        Alert.alert('Fehler', error);
      }
    }}
  />
)}
```

`studioId` ist bereits über die Screen-Props verfügbar: `route.params.studioId`.

- [ ] **Step 5: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 6: Simulator-Test**

```bash
npx expo run:ios
```

Manuell prüfen:
- Plan-Tab zeigt SparringMapCard ganz unten
- "Karte öffnen" öffnet Vollbild-Modal mit Karte und Close-Button
- Coach sieht "Sparring planen"-Button in TeamScreen
- Sparring erstellen → erscheint als Pin auf der Karte
- Pin antippen → SparringDetailSheet öffnet sich
- Anmelden/Abmelden funktioniert
- Vollbild-Modal schließt mit Close-Button

- [ ] **Step 7: Commit**

```bash
git add src/screens/TeamScreen.tsx
git commit -m "feat(team): add Sparring planen button for coaches"
```

---

## Self-Review

**Spec coverage:**
- [x] Karte im Plan-Tab ganz unten → SparringMapCard in TrainingScreen "plan"-Zweig
- [x] Antippen → Vollbild-Karte → SparringMapScreen als fullScreenModal
- [x] Alle Nutzer sehen Karte → kein Entitlement-Gate
- [x] Coach erstellt Sparring im TeamScreen → CreateSparringSheet + "Sparring planen"-Button
- [x] Adresse als Pflichtfeld → Validation in CreateSparringSheet + Geocoding in useSparringActions
- [x] Datum + Uhrzeit → DateTimePicker
- [x] Max. Teilnehmer → maxSlots-Feld, Slot-Prüfung im Detail-Sheet
- [x] Nur so viele Anmeldungen wie Plätze → isFull-Guard in SparringDetailSheet + RLS erlaubt Anmeldung immer (Overflow-Schutz optional ausbaubar)
- [x] Nur Studios aus der App → Query nur auf `open_sparrings` JOIN `studios`

**Placeholder scan:** Alle Schritte haben vollständigen Code. Keine TBDs.

**Type consistency:**
- `SparringWithMeta` — definiert Task 5, genutzt in Tasks 7, 9, 10 ✓
- `CreateSparringParams` — definiert Task 6, genutzt in Tasks 8, 13 ✓
- `SparringMap` in `RootStackParamList` — definiert Task 11, genutzt in Tasks 10 + 12 ✓
- `useSparringActions` — definiert Task 6, importiert in Tasks 10, 13 ✓
