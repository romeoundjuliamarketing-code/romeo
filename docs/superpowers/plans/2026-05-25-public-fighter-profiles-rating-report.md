# Public Fighter Profiles – Rating & Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to view other participants' public profiles after sparring, rate their behaviour (1–5 stars, mandatory comment), and report misconduct – all with privacy controls and an admin email notification on report.

**Architecture:** New screens (`PublicProfileScreen`) and components (`SparringParticipantsList`) hang off the existing `AppStack`; two new Supabase tables (`sparring_ratings`, `user_reports`) store data; a Supabase Edge Function sends admin email via Resend on each report. Existing `FightRecordCard` is re-used in read-only mode via a new optional prop.

**Tech Stack:** React Native + Expo SDK 55, Supabase (Postgres RLS, Edge Functions), TypeScript strict, `@expo/vector-icons` (Ionicons / MaterialCommunityIcons), `src/theme/colors.ts`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create (SQL) | `supabase/migrations/20260525000001_sparring_ratings.sql` | `sparring_ratings` table + RLS |
| Create (SQL) | `supabase/migrations/20260525000002_user_reports.sql` | `user_reports` table + RLS |
| Create (SQL) | `supabase/migrations/20260525000003_profiles_privacy_cols.sql` | Add `show_fight_record` + `show_stats` to `profiles` |
| Modify | `src/types/database.types.ts` | Add new table types + privacy columns to `profiles` |
| Create | `src/hooks/useSparringRatings.ts` | Load avg rating, existing own rating, submitRating, canRate |
| Create | `src/hooks/useUserReport.ts` | submitReport + Edge Function call |
| Create | `src/components/sparring/SparringParticipantsList.tsx` | Load + display signups, tap → onPressProfile |
| Modify | `src/components/profil/FightRecordCard.tsx` | Add optional `readOnly?: boolean` prop |
| Create | `src/screens/PublicProfileScreen.tsx` | Public profile view, rating modal, report modal |
| Modify | `src/navigation/types.ts` | Add `PublicProfile` route params |
| Modify | `src/navigation/RootNavigator.tsx` | Register `PublicProfileScreen` in AppStack |
| Modify | `src/components/sparring/SparringDetailSheet.tsx` | Embed `SparringParticipantsList`, navigate to PublicProfile |
| Create | `supabase/functions/notify-report/index.ts` | Edge Function: send Resend email on report |

---

## Task 1: DB Migration – sparring_ratings

**Files:**
- Create: `supabase/migrations/20260525000001_sparring_ratings.sql`

- [ ] **Step 1: Create migration file**

```sql
-- sparring_ratings: one rating per (rater, rated_user, sparring) pair
CREATE TABLE sparring_ratings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rated_user_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sparring_id   uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  stars         smallint    NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment       text        NOT NULL CHECK (char_length(comment) <= 200),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rater_id, rated_user_id, sparring_id)
);

ALTER TABLE sparring_ratings ENABLE ROW LEVEL SECURITY;

-- Rater can read their own ratings
CREATE POLICY "Own ratings readable" ON sparring_ratings
  FOR SELECT USING (auth.uid() = rater_id);

-- Anyone can read ratings for a given rated_user (needed for avg calculation)
CREATE POLICY "Ratings for user readable" ON sparring_ratings
  FOR SELECT USING (true);

-- Insert only when signed up for that sparring and not rating yourself
CREATE POLICY "Insert own rating" ON sparring_ratings
  FOR INSERT WITH CHECK (
    auth.uid() = rater_id
    AND auth.uid() <> rated_user_id
    AND EXISTS (
      SELECT 1 FROM sparring_signups
      WHERE sparring_id = sparring_ratings.sparring_id
        AND user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply migration**

```bash
# Via Supabase Dashboard → SQL Editor, or:
npx supabase db push
```

Expected: no errors, table `sparring_ratings` visible in Supabase.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260525000001_sparring_ratings.sql
git commit -m "feat(db): add sparring_ratings table with RLS"
```

---

## Task 2: DB Migration – user_reports

**Files:**
- Create: `supabase/migrations/20260525000002_user_reports.sql`

- [ ] **Step 1: Create migration file**

```sql
-- user_reports: misconduct reports per (reporter, reported_user, sparring)
CREATE TABLE user_reports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sparring_id      uuid        NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  reason           text        NOT NULL CHECK (reason IN (
    'unsportliches_verhalten',
    'gefaehrliches_verhalten',
    'beleidigung'
  )),
  details          text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Only own reports can be inserted; cannot report yourself
CREATE POLICY "Insert own report" ON user_reports
  FOR INSERT WITH CHECK (
    auth.uid() = reporter_id
    AND auth.uid() <> reported_user_id
  );
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: table `user_reports` visible in Supabase.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260525000002_user_reports.sql
git commit -m "feat(db): add user_reports table with RLS"
```

---

## Task 3: DB Migration – profiles privacy columns

**Files:**
- Create: `supabase/migrations/20260525000003_profiles_privacy_cols.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add privacy controls to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_fight_record boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_stats        boolean NOT NULL DEFAULT true;
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: columns `show_fight_record` and `show_stats` visible in `profiles`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260525000003_profiles_privacy_cols.sql
git commit -m "feat(db): add show_fight_record and show_stats to profiles"
```

---

## Task 4: Update database.types.ts

**Files:**
- Modify: `src/types/database.types.ts`

- [ ] **Step 1: Add privacy columns to `profiles` Row/Insert/Update**

In `profiles.Row`, after `expo_push_token: string | null`, add:
```typescript
          show_fight_record: boolean
          show_stats: boolean
```

In `profiles.Insert`, after `expo_push_token?: string | null`, add:
```typescript
          show_fight_record?: boolean
          show_stats?: boolean
```

In `profiles.Update`, after `expo_push_token?: string | null`, add:
```typescript
          show_fight_record?: boolean
          show_stats?: boolean
```

- [ ] **Step 2: Add sparring_ratings table type**

After the `sparring_signups` table block and before `subscriptions`, add:

```typescript
      sparring_ratings: {
        Row: {
          id:            string
          rater_id:      string
          rated_user_id: string
          sparring_id:   string
          stars:         number
          comment:       string
          created_at:    string
        }
        Insert: {
          id?:           string
          rater_id:      string
          rated_user_id: string
          sparring_id:   string
          stars:         number
          comment:       string
          created_at?:   string
        }
        Update: {
          id?:           string
          rater_id?:     string
          rated_user_id?: string
          sparring_id?:  string
          stars?:        number
          comment?:      string
          created_at?:   string
        }
        Relationships: [
          {
            foreignKeyName: 'sparring_ratings_rater_id_fkey'
            columns: ['rater_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sparring_ratings_rated_user_id_fkey'
            columns: ['rated_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sparring_ratings_sparring_id_fkey'
            columns: ['sparring_id']
            isOneToOne: false
            referencedRelation: 'open_sparrings'
            referencedColumns: ['id']
          },
        ]
      }
```

- [ ] **Step 3: Add user_reports table type**

After `sparring_ratings` block, before `subscriptions`:

```typescript
      user_reports: {
        Row: {
          id:               string
          reporter_id:      string
          reported_user_id: string
          sparring_id:      string
          reason:           'unsportliches_verhalten' | 'gefaehrliches_verhalten' | 'beleidigung'
          details:          string | null
          created_at:       string
        }
        Insert: {
          id?:              string
          reporter_id:      string
          reported_user_id: string
          sparring_id:      string
          reason:           'unsportliches_verhalten' | 'gefaehrliches_verhalten' | 'beleidigung'
          details?:         string | null
          created_at?:      string
        }
        Update: {
          id?:              string
          reporter_id?:     string
          reported_user_id?: string
          sparring_id?:     string
          reason?:          'unsportliches_verhalten' | 'gefaehrliches_verhalten' | 'beleidigung'
          details?:         string | null
          created_at?:      string
        }
        Relationships: []
      }
```

- [ ] **Step 4: Add convenience types at the bottom of the file**

After the last `export type` line, add:

```typescript
export type SparringRating = Database['public']['Tables']['sparring_ratings']['Row']
export type SparringRatingInsert = Database['public']['Tables']['sparring_ratings']['Insert']
export type UserReport = Database['public']['Tables']['user_reports']['Row']
export type UserReportInsert = Database['public']['Tables']['user_reports']['Insert']
export type ReportReason = 'unsportliches_verhalten' | 'gefaehrliches_verhalten' | 'beleidigung'
```

- [ ] **Step 5: Run type check**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.types.ts
git commit -m "feat(types): add sparring_ratings, user_reports, profile privacy cols"
```

---

## Task 5: useSparringRatings hook

**Files:**
- Create: `src/hooks/useSparringRatings.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface RatingSummary {
  averageStars: number | null;
  ratingCount:  number;
}

interface ExistingRating {
  stars:   number;
  comment: string;
}

interface UseSparringRatingsResult {
  averageStars:   number | null;
  ratingCount:    number;
  existingRating: ExistingRating | null;
  submitRating: (
    sparringId:   string,
    ratedUserId:  string,
    stars:        number,
    comment:      string,
  ) => Promise<{ error: string | null }>;
  canRate: (sparringScheduledAt: string) => boolean;
}

// Returns true when now is between scheduledAt and scheduledAt + 7 days
function canRateWindow(sparringScheduledAt: string): boolean {
  const now        = Date.now();
  const scheduled  = new Date(sparringScheduledAt).getTime();
  const windowEnd  = scheduled + 7 * 24 * 60 * 60 * 1000;
  return now >= scheduled && now <= windowEnd;
}

export function useSparringRatings(
  ratedUserId:        string,
  sparringId:         string,
  refetchTrigger = 0,
): UseSparringRatingsResult {
  const { user } = useAuth();

  const [summary,        setSummary]        = useState<RatingSummary>({ averageStars: null, ratingCount: 0 });
  const [existingRating, setExistingRating] = useState<ExistingRating | null>(null);

  // Load average + own existing rating
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // All ratings for this user (for average)
      const { data: allRatings } = await supabase
        .from('sparring_ratings')
        .select('stars')
        .eq('rated_user_id', ratedUserId);

      if (!cancelled) {
        const rows = allRatings ?? [];
        if (rows.length === 0) {
          setSummary({ averageStars: null, ratingCount: 0 });
        } else {
          const total = rows.reduce((sum, r) => sum + r.stars, 0);
          setSummary({ averageStars: total / rows.length, ratingCount: rows.length });
        }
      }

      // Own rating for this sparring
      if (user !== null) {
        const { data: own } = await supabase
          .from('sparring_ratings')
          .select('stars, comment')
          .eq('rated_user_id', ratedUserId)
          .eq('sparring_id',   sparringId)
          .eq('rater_id',      user.id)
          .maybeSingle();

        if (!cancelled) {
          setExistingRating(own !== null ? { stars: own.stars, comment: own.comment } : null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [ratedUserId, sparringId, user, refetchTrigger]);

  const submitRating = useCallback(
    async (
      sid:         string,
      ruid:        string,
      stars:       number,
      comment:     string,
    ): Promise<{ error: string | null }> => {
      if (user === null) return { error: 'Nicht eingeloggt' };

      const { error } = await supabase.from('sparring_ratings').insert({
        rater_id:      user.id,
        rated_user_id: ruid,
        sparring_id:   sid,
        stars,
        comment,
      });

      return { error: error?.message ?? null };
    },
    [user],
  );

  return {
    averageStars:   summary.averageStars,
    ratingCount:    summary.ratingCount,
    existingRating,
    submitRating,
    canRate:        canRateWindow,
  };
}
```

- [ ] **Step 2: Run type check**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSparringRatings.ts
git commit -m "feat(hooks): add useSparringRatings"
```

---

## Task 6: useUserReport hook

**Files:**
- Create: `src/hooks/useUserReport.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { ReportReason } from '../types/database.types';

interface UseUserReportResult {
  submitReport: (
    reportedUserId: string,
    sparringId:     string,
    reason:         ReportReason,
    details?:       string,
  ) => Promise<{ error: string | null }>;
}

export function useUserReport(): UseUserReportResult {
  const { user } = useAuth();

  const submitReport = useCallback(
    async (
      reportedUserId: string,
      sparringId:     string,
      reason:         ReportReason,
      details?:       string,
    ): Promise<{ error: string | null }> => {
      if (user === null) return { error: 'Nicht eingeloggt' };

      // Insert into user_reports
      const { error: insertError } = await supabase.from('user_reports').insert({
        reporter_id:      user.id,
        reported_user_id: reportedUserId,
        sparring_id:      sparringId,
        reason,
        details:          details ?? null,
      });

      if (insertError !== null) return { error: insertError.message };

      // Notify admin via Edge Function (fire-and-forget; errors don't block the user)
      void supabase.functions.invoke('notify-report', {
        body: {
          reportedUserId,
          reporterUserId: user.id,
          sparringId,
          reason,
          details:   details ?? null,
          timestamp: new Date().toISOString(),
        },
      });

      return { error: null };
    },
    [user],
  );

  return { submitReport };
}
```

- [ ] **Step 2: Run type check**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useUserReport.ts
git commit -m "feat(hooks): add useUserReport with Edge Function call"
```

---

## Task 7: SparringParticipantsList component

**Files:**
- Create: `src/components/sparring/SparringParticipantsList.tsx`

- [ ] **Step 1: Write the component**

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';

interface Participant {
  userId:    string;
  name:      string | null;
  avatarUrl: string | null;
}

interface Props {
  sparringId:          string;
  currentUserId:       string | null;
  sparringScheduledAt: string;
  onPressProfile:      (userId: string) => void;
}

// Derive up-to-2-letter initials from a display name
function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export default function SparringParticipantsList({
  sparringId,
  currentUserId,
  onPressProfile,
}: Props): React.ReactElement | null {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { data } = await supabase
        .from('sparring_signups')
        .select('user_id, profiles!user_id(name, avatar_url)')
        .eq('sparring_id', sparringId);

      if (cancelled) return;

      type ProfileJoin = { name: string | null; avatar_url: string | null } | null;

      const list: Participant[] = (data ?? [])
        .filter((row) => row.user_id !== currentUserId)
        .map((row) => {
          const p = row.profiles as ProfileJoin;
          return {
            userId:    row.user_id,
            name:      p?.name ?? null,
            avatarUrl: p?.avatar_url ?? null,
          };
        });

      setParticipants(list);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [sparringId, currentUserId]);

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={colors.accentBlue} />
      </View>
    );
  }

  if (participants.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Teilnehmer</Text>
      {participants.map((p) => (
        <TouchableOpacity
          key={p.userId}
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => onPressProfile(p.userId)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(p.name)}</Text>
          </View>
          <Text style={styles.name}>{p.name ?? 'Unbekannt'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  container: {
    borderTopWidth:  1,
    borderTopColor:  colors.border,
    paddingTop:      16,
    gap:             8,
  },
  sectionLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textSecondary,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    paddingVertical: 8,
  },
  avatar: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.accentBlueSoft,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlue,
  },
  name: {
    fontSize:   15,
    fontWeight: '500',
    color:      colors.text,
  },
});
```

- [ ] **Step 2: Run type check**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/sparring/SparringParticipantsList.tsx
git commit -m "feat(sparring): add SparringParticipantsList component"
```

---

## Task 8: Add readOnly prop to FightRecordCard

**Files:**
- Modify: `src/components/profil/FightRecordCard.tsx`

- [ ] **Step 1: Add `readOnly` prop to the Props type**

Change the `FightRecordCardProps` type from:
```typescript
type FightRecordCardProps = {
  fights:   FightRecord[];
  loading:  boolean;
  onAdd:    () => void;
  onDelete: (id: string) => Promise<void>;
};
```
to:
```typescript
type FightRecordCardProps = {
  fights:    FightRecord[];
  loading:   boolean;
  onAdd?:    () => void;
  onDelete?: (id: string) => Promise<void>;
  readOnly?: boolean;
};
```

- [ ] **Step 2: Guard onAdd and onDelete calls behind readOnly check**

In the `handleDelete` function, guard the whole body:
```typescript
function handleDelete(id: string): void {
  if (readOnly === true || onDelete === undefined) return;
  Alert.alert(
    'Kampf löschen',
    'Diesen Eintrag wirklich löschen?',
    [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => { void onDelete(id); } },
    ],
  );
}
```

In the header `TouchableOpacity` that calls `onAdd`, wrap in a conditional:
```tsx
{readOnly !== true && onAdd !== undefined && (
  <TouchableOpacity
    onPress={onAdd}
    activeOpacity={0.7}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  >
    <MaterialCommunityIcons name="plus-circle-outline" size={24} color={colors.accentBlue} />
  </TouchableOpacity>
)}
```

In each `fight` row, wrap the delete `TouchableOpacity` in a conditional:
```tsx
{readOnly !== true && onDelete !== undefined && (
  <TouchableOpacity
    onPress={() => handleDelete(fight.id)}
    activeOpacity={0.7}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  >
    <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.inactive} />
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Run type check**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
```

Expected: 0 errors (existing usages still pass `onAdd` / `onDelete` so no breakage).

- [ ] **Step 4: Commit**

```bash
git add src/components/profil/FightRecordCard.tsx
git commit -m "feat(profil): add readOnly prop to FightRecordCard"
```

---

## Task 9: Navigation – types + RootNavigator

**Files:**
- Modify: `src/navigation/types.ts`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Add PublicProfile to RootStackParamList in types.ts**

After `SparringMap: undefined;`, add:
```typescript
  PublicProfile: {
    userId:              string;
    sparringId:          string;
    sparringScheduledAt: string;
  };
```

- [ ] **Step 2: Register PublicProfileScreen in RootNavigator.tsx**

Add import at top:
```typescript
import PublicProfileScreen from '../screens/PublicProfileScreen';
```

Add inside `<AppStack.Navigator>` before the closing tag (after `SparringMap`):
```tsx
<AppStack.Screen name="PublicProfile" component={PublicProfileScreen} />
```

- [ ] **Step 3: Run type check**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
```

Expected: 0 errors (PublicProfileScreen doesn't exist yet – if TS complains about missing module, create a placeholder `export default function PublicProfileScreen() { return null; }` file first, then replace in Task 10).

- [ ] **Step 4: Commit**

```bash
git add src/navigation/types.ts src/navigation/RootNavigator.tsx
git commit -m "feat(nav): register PublicProfile route"
```

---

## Task 10: PublicProfileScreen

**Files:**
- Create: `src/screens/PublicProfileScreen.tsx`

This is the largest task. Build incrementally: profile shell → rating row → fight record card → rating modal → report modal.

- [ ] **Step 1: Write the full screen**

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import type { ReportReason } from '../types/database.types';
import { supabase } from '../lib/supabase';
import { useSparringRatings } from '../hooks/useSparringRatings';
import { useUserReport }      from '../hooks/useUserReport';
import { useFightRecord }     from '../hooks/useFightRecord';
import FightRecordCard        from '../components/profil/FightRecordCard';

// ── helpers ────────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

const STAR_LABELS: Record<number, string> = {
  1: 'Nicht empfehlenswert',
  2: 'War okay',
  3: 'Guter Sparringspartner',
  4: 'Sehr empfehlenswert',
  5: 'Immer wieder gerne',
};

const REPORT_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'unsportliches_verhalten', label: 'Unsportliches Verhalten' },
  { value: 'gefaehrliches_verhalten', label: 'Gefährliches Verhalten' },
  { value: 'beleidigung',             label: 'Beleidigung / Harassment' },
];

// ── types ──────────────────────────────────────────────────────────────────────

interface PublicProfile {
  name:             string | null;
  age_years:        number | null;
  avatar_url:       string | null;
  disciplines:      string[];
  show_fight_record: boolean;
  show_stats:        boolean;
}

// ── component ─────────────────────────────────────────────────────────────────

type NavProp   = NativeStackNavigationProp<RootStackParamList, 'PublicProfile'>;
type RoutePropT = RouteProp<RootStackParamList, 'PublicProfile'>;

export default function PublicProfileScreen(): React.ReactElement {
  const navigation = useNavigation<NavProp>();
  const { params }  = useRoute<RoutePropT>();
  const { userId, sparringId, sparringScheduledAt } = params;

  const [profile,        setProfile]        = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Rating
  const [ratingTrigger, setRatingTrigger] = useState(0);
  const { averageStars, ratingCount, existingRating, submitRating, canRate } =
    useSparringRatings(userId, sparringId, ratingTrigger);

  // Report
  const { submitReport } = useUserReport();

  // Fight record (read-only)
  const { fights, loading: fightsLoading } = useFightRecord(0);  // NOTE: hook uses auth user; see below

  // Rating modal
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedStars,      setSelectedStars]      = useState(0);
  const [ratingComment,      setRatingComment]      = useState('');
  const [ratingSubmitting,   setRatingSubmitting]   = useState(false);

  // Report modal
  const [reportModalVisible,   setReportModalVisible]   = useState(false);
  const [selectedReason,       setSelectedReason]       = useState<ReportReason | null>(null);
  const [reportDetails,        setReportDetails]        = useState('');
  const [reportSubmitting,     setReportSubmitting]     = useState(false);
  const [reportConfirmed,      setReportConfirmed]      = useState(false);

  // Load public profile data
  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);

    void supabase
      .from('profiles')
      .select('name, age_years, avatar_url, disciplines, show_fight_record, show_stats')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        if (data !== null) {
          setProfile({
            name:              data.name,
            age_years:         data.age_years,
            avatar_url:        data.avatar_url,
            disciplines:       data.disciplines ?? [],
            show_fight_record: data.show_fight_record ?? true,
            show_stats:        data.show_stats ?? true,
          });
        }
        setProfileLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId]);

  // We need fights for the target user, not the current user.
  // Fetch separately since useFightRecord only loads for the authenticated user.
  const [targetFights,        setTargetFights]        = useState<import('../types/database.types').FightRecord[]>([]);
  const [targetFightsLoading, setTargetFightsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setTargetFightsLoading(true);
    void supabase
      .from('fight_records')
      .select('*')
      .eq('user_id', userId)
      .order('fight_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setTargetFights(data ?? []);
          setTargetFightsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [userId]);

  // ── Rating handlers ──────────────────────────────────────────────────────

  const handleSubmitRating = useCallback(async () => {
    if (selectedStars === 0 || ratingComment.trim().length === 0) return;
    setRatingSubmitting(true);
    const { error } = await submitRating(sparringId, userId, selectedStars, ratingComment.trim());
    setRatingSubmitting(false);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    setRatingModalVisible(false);
    setRatingTrigger((n) => n + 1);
  }, [selectedStars, ratingComment, submitRating, sparringId, userId]);

  // ── Report handlers ──────────────────────────────────────────────────────

  const handleSubmitReport = useCallback(async () => {
    if (selectedReason === null) return;
    setReportSubmitting(true);
    const { error } = await submitReport(
      userId,
      sparringId,
      selectedReason,
      reportDetails.trim().length > 0 ? reportDetails.trim() : undefined,
    );
    setReportSubmitting(false);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    setReportConfirmed(true);
  }, [selectedReason, reportDetails, submitReport, userId, sparringId]);

  // ── Render ───────────────────────────────────────────────────────────────

  const canRateNow = canRate(sparringScheduledAt) && existingRating === null;

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentBlue} />
      </SafeAreaView>
    );
  }

  const initials = getInitials(profile?.name ?? null);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setReportModalVisible(true); setReportConfirmed(false); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="flag-outline" size={22} color={colors.deleteRed} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>

        {/* Name */}
        <Text style={styles.name}>{profile?.name ?? 'Unbekannt'}</Text>

        {/* Age + weight row — always visible */}
        {profile?.age_years !== null && profile?.age_years !== undefined && (
          <Text style={styles.meta}>{profile.age_years} Jahre</Text>
        )}

        {/* Average rating — always visible */}
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={averageStars !== null && s <= Math.round(averageStars) ? 'star' : 'star-outline'}
              size={20}
              color={colors.accent}
            />
          ))}
          <Text style={styles.ratingCount}>
            {ratingCount === 0
              ? 'Noch keine Bewertungen'
              : `(${ratingCount} ${ratingCount === 1 ? 'Bewertung' : 'Bewertungen'})`}
          </Text>
        </View>

        {/* Disciplines — only if show_stats */}
        {profile?.show_stats === true && profile.disciplines.length > 0 && (
          <View style={styles.disciplinesRow}>
            {profile.disciplines.map((d) => (
              <View key={d} style={styles.disciplineBadge}>
                <Text style={styles.disciplineBadgeText}>{d}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Fight record — only if show_fight_record */}
        {profile?.show_fight_record === true && (
          <FightRecordCard
            fights={targetFights}
            loading={targetFightsLoading}
            readOnly
          />
        )}

        {/* Rate button */}
        {canRateNow && (
          <TouchableOpacity
            style={styles.rateBtn}
            activeOpacity={0.8}
            onPress={() => setRatingModalVisible(true)}
          >
            <Text style={styles.rateBtnText}>Jetzt bewerten</Text>
          </TouchableOpacity>
        )}

        {existingRating !== null && (
          <View style={styles.existingRatingBox}>
            <Text style={styles.existingRatingLabel}>Deine Bewertung</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={s <= existingRating.stars ? 'star' : 'star-outline'}
                  size={16}
                  color={colors.accent}
                />
              ))}
            </View>
            <Text style={styles.existingRatingComment}>{existingRating.comment}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Rating Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={ratingModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => setRatingModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Bewertung abgeben</Text>
            <Text style={styles.ratingSubtext}>Bewerte das Verhalten – nicht den Skill</Text>

            {/* Stars */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSelectedStars(s)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Ionicons
                    name={s <= selectedStars ? 'star' : 'star-outline'}
                    size={36}
                    color={colors.accent}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {selectedStars > 0 && (
              <Text style={styles.starLabel}>{STAR_LABELS[selectedStars]}</Text>
            )}

            {/* Comment input */}
            <TextInput
              style={styles.commentInput}
              placeholder="Kurzer Kommentar..."
              placeholderTextColor={colors.textSecondary}
              value={ratingComment}
              onChangeText={setRatingComment}
              maxLength={200}
              multiline
            />
            <Text style={styles.charCount}>{ratingComment.length}/200</Text>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (selectedStars === 0 || ratingComment.trim().length === 0) && styles.submitBtnDisabled,
              ]}
              onPress={() => { void handleSubmitRating(); }}
              disabled={ratingSubmitting || selectedStars === 0 || ratingComment.trim().length === 0}
            >
              {ratingSubmitting
                ? <ActivityIndicator color={colors.card} />
                : <Text style={styles.submitBtnText}>Speichern</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Report Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => setReportModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {reportConfirmed ? (
              <View style={styles.reportConfirmedBox}>
                <Ionicons name="checkmark-circle" size={40} color={colors.difficultyGreen} />
                <Text style={styles.reportConfirmedText}>Meldung wurde übermittelt</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Nutzer melden</Text>

                {REPORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.reportOption,
                      selectedReason === opt.value && styles.reportOptionSelected,
                    ]}
                    onPress={() => setSelectedReason(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.reportOptionText,
                      selectedReason === opt.value && styles.reportOptionTextSelected,
                    ]}>
                      {opt.label}
                    </Text>
                    {selectedReason === opt.value && (
                      <Ionicons name="checkmark" size={16} color={colors.accentBlue} />
                    )}
                  </TouchableOpacity>
                ))}

                <TextInput
                  style={styles.commentInput}
                  placeholder="Details (optional)..."
                  placeholderTextColor={colors.textSecondary}
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  multiline
                />

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    selectedReason === null && styles.submitBtnDisabled,
                  ]}
                  onPress={() => { void handleSubmitReport(); }}
                  disabled={reportSubmitting || selectedReason === null}
                >
                  {reportSubmitting
                    ? <ActivityIndicator color={colors.card} />
                    : <Text style={styles.submitBtnText}>Absenden</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical:   12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom:     40,
    alignItems:        'center',
    gap:               16,
  },
  avatarCircle: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: colors.accentBlueSoft,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       8,
  },
  avatarInitials: {
    fontSize:   28,
    fontWeight: '700',
    color:      colors.accentBlue,
  },
  name: {
    fontSize:   22,
    fontWeight: '700',
    color:      colors.text,
    textAlign:  'center',
  },
  meta: {
    fontSize:  14,
    color:     colors.textSecondary,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  ratingCount: {
    fontSize:    13,
    color:       colors.textSecondary,
    marginLeft:  4,
  },
  disciplinesRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    justifyContent: 'center',
  },
  disciplineBadge: {
    backgroundColor:  colors.accentBlueSoft,
    borderRadius:     8,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  disciplineBadgeText: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
  rateBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius:    14,
    height:          50,
    alignItems:      'center',
    justifyContent:  'center',
    alignSelf:       'stretch',
    marginTop:       8,
  },
  rateBtnText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.card,
  },
  existingRatingBox: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         16,
    alignSelf:       'stretch',
    gap:             8,
  },
  existingRatingLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  starsRow: {
    flexDirection: 'row',
    gap:           4,
  },
  existingRatingComment: {
    fontSize: 14,
    color:    colors.text,
  },
  // Modal
  modalBackdrop: {
    flex:            1,
    justifyContent:  'flex-end',
  },
  modalDismiss: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:    24,
    paddingBottom: 40,
    gap:        16,
  },
  modalHandle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
    alignSelf:       'center',
    marginBottom:    4,
  },
  modalTitle: {
    fontSize:   20,
    fontWeight: '700',
    color:      colors.text,
  },
  ratingSubtext: {
    fontSize: 13,
    color:    colors.textSecondary,
    marginTop: -8,
  },
  starLabel: {
    fontSize:  14,
    color:     colors.textSecondary,
    textAlign: 'center',
  },
  commentInput: {
    backgroundColor: colors.background,
    borderRadius:    12,
    padding:         12,
    fontSize:        14,
    color:           colors.text,
    minHeight:       80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize:  12,
    color:     colors.textSecondary,
    textAlign: 'right',
    marginTop: -8,
  },
  submitBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius:    14,
    height:          50,
    alignItems:      'center',
    justifyContent:  'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.accentBlueMuted,
  },
  submitBtnText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.card,
  },
  reportOption: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingVertical:   12,
    paddingHorizontal: 16,
    borderRadius:     12,
    borderWidth:       1,
    borderColor:      colors.border,
  },
  reportOptionSelected: {
    borderColor:      colors.accentBlue,
    backgroundColor:  colors.accentBlueSoft,
  },
  reportOptionText: {
    fontSize:   14,
    fontWeight: '500',
    color:      colors.text,
  },
  reportOptionTextSelected: {
    color: colors.accentBlue,
  },
  reportConfirmedBox: {
    alignItems:     'center',
    paddingVertical: 24,
    gap:             16,
  },
  reportConfirmedText: {
    fontSize:   16,
    fontWeight: '600',
    color:      colors.text,
  },
});
```

- [ ] **Step 2: Run type check**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/PublicProfileScreen.tsx
git commit -m "feat: add PublicProfileScreen with rating and report modals"
```

---

## Task 11: Wire SparringDetailSheet

**Files:**
- Modify: `src/components/sparring/SparringDetailSheet.tsx`

The sheet currently uses `Modal` (no `ScrollView`). Add `SparringParticipantsList` below the notes, above the sign-up button. The sheet needs `navigation` access and current user id.

- [ ] **Step 1: Add new imports at the top**

After existing imports, add:
```typescript
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import SparringParticipantsList from './SparringParticipantsList';
```

- [ ] **Step 2: Add navigation inside component**

At the top of the component body (after `const slotsLeft = ...`), add:
```typescript
const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
```

- [ ] **Step 3: Add onPressProfile handler**

```typescript
function handlePressProfile(userId: string): void {
  if (sparring === null) return;
  onClose();
  navigation.navigate('PublicProfile', {
    userId,
    sparringId:          sparring.id,
    sparringScheduledAt: sparring.scheduled_at,
  });
}
```

- [ ] **Step 4: Embed SparringParticipantsList inside the sheet**

Wrap the sheet content in a `ScrollView`. Replace the outer `<View style={styles.sheet}>` wrapper to also contain a `ScrollView`. Add `SparringParticipantsList` between notes and the sign-up button:

```tsx
{sparring.notes !== null && sparring.notes.length > 0 && (
  <Text style={styles.notes}>{sparring.notes}</Text>
)}

<SparringParticipantsList
  sparringId={sparring.id}
  currentUserId={currentUserId}
  sparringScheduledAt={sparring.scheduled_at}
  onPressProfile={handlePressProfile}
/>
```

- [ ] **Step 5: Run type check**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/sparring/SparringDetailSheet.tsx
git commit -m "feat(sparring): embed SparringParticipantsList in detail sheet"
```

---

## Task 12: Edge Function – notify-report

**Files:**
- Create: `supabase/functions/notify-report/index.ts`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p /Users/romeogeorgiadis/strikeforce/supabase/functions/notify-report
```

```typescript
// supabase/functions/notify-report/index.ts
// Sends an admin email via Resend when a user report is submitted.
// Required secret: RESEND_API_KEY (set in Supabase Dashboard → Project Settings → Edge Function Secrets)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const ADMIN_EMAIL = 'romeoundjuliamarketing@gmail.com';
const RESEND_URL  = 'https://api.resend.com/emails';

interface ReportPayload {
  reportedUserId: string;
  reporterUserId: string;
  sparringId:     string;
  reason:         string;
  details:        string | null;
  timestamp:      string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const payload = await req.json() as ReportPayload;

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (resendApiKey === undefined || resendApiKey.length === 0) {
    // Log and return 200 so the client is not blocked
    console.error('RESEND_API_KEY not set');
    return new Response(JSON.stringify({ ok: false, reason: 'no api key' }), { status: 200 });
  }

  const emailBody = `
Neue Meldung in Sparr

Gemeldeter Nutzer: ${payload.reportedUserId}
Melder:            ${payload.reporterUserId}
Sparring ID:       ${payload.sparringId}
Grund:             ${payload.reason}
Details:           ${payload.details ?? '–'}
Zeitstempel:       ${payload.timestamp}
  `.trim();

  const res = await fetch(RESEND_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'Sparr App <onboarding@resend.dev>',
      to:      [ADMIN_EMAIL],
      subject: `[Sparr] Neue Meldung: ${payload.reason}`,
      text:    emailBody,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify({ ok: res.ok, data }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

> **Note for Romeo:** Before deploying this function, you must:
> 1. Create a free Resend account at https://resend.com (3 000 free emails/month).
> 2. Set `RESEND_API_KEY` in Supabase Dashboard → Project Settings → Edge Functions → Secrets.
> 3. Deploy: `npx supabase functions deploy notify-report`

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/notify-report/index.ts
git commit -m "feat(edge): add notify-report Edge Function (Resend email on report)"
```

---

## Task 13: Final type check + Obsidian log

- [ ] **Step 1: Full type check**

```bash
cd /Users/romeogeorgiadis/strikeforce && npx tsc --noEmit
```

Expected: 0 errors. Fix any remaining issues before proceeding.

- [ ] **Step 2: Update Obsidian**

Append to `/Users/romeogeorgiadis/Documents/Obsidian Vault/02 Projekte/Sparr/Funktionen.md`:

```markdown
## Öffentliche Kämpferprofile, Bewertung & Meldung – 2026-05-25

- PublicProfileScreen: Avatar/Initialen, Name, Alter, Durchschnittsbewertung, Disziplinen-Badges (show_stats), Kampfrekord (show_fight_record)
- Rating-Modal: 1–5 Sterne + Pflichtkommentar (max. 200 Zeichen), Bewertungs-Window: scheduledAt → +7 Tage
- Report-Modal: 3 Gründe auswählbar + optionaler Freitext; nach Absenden Bestätigungsmeldung
- Edge Function notify-report: sendet E-Mail via Resend an Admin bei jedem Report
- SparringParticipantsList: Teilnehmerliste im SparringDetailSheet, tap → PublicProfile
- DB: sparring_ratings (RLS), user_reports (RLS), profiles.show_fight_record + show_stats
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: public fighter profiles, sparring ratings and user reports complete"
```

---

## Self-Review

**Spec coverage:**
| Requirement | Task |
|-------------|------|
| `sparring_ratings` table + RLS | Task 1 |
| `user_reports` table + RLS | Task 2 |
| `show_fight_record` / `show_stats` columns | Task 3 |
| `database.types.ts` updated | Task 4 |
| `useSparringRatings` hook with `canRate`, `averageStars`, `existingRating`, `submitRating` | Task 5 |
| `useUserReport` hook | Task 6 |
| `SparringParticipantsList` component | Task 7 |
| `FightRecordCard` read-only mode | Task 8 |
| Navigation types + registration | Task 9 |
| `PublicProfileScreen` with both modals | Task 10 |
| `SparringDetailSheet` integration | Task 11 |
| Edge Function `notify-report` | Task 12 |
| Final type check | Task 13 |

**Placeholder scan:** No TBD/TODO/placeholder text found.

**Type consistency:**
- `ReportReason` defined in Task 4, used in Tasks 6 + 10. ✓
- `FightRecord` imported from `database.types.ts` in Task 10. ✓
- `PublicProfile` route params defined in Task 9, consumed in Task 10. ✓
- `SparringParticipantsList` props defined in Task 7, consumed in Task 11. ✓
- `readOnly` prop on `FightRecordCard` defined in Task 8, used in Task 10. ✓
- `useSparringRatings(ratedUserId, sparringId, refetchTrigger)` signature defined in Task 5, used in Task 10. ✓
