# Training Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the TrainingScreen into a fixed header (Heute + stats) + two-tab layout (Workouts | Plan) with clean visual hierarchy.

**Architecture:** The screen gains a `activeTab` state; a non-scrolling header sits above a pill tab-bar and a single ScrollView whose content swaps based on the active tab. No new components are created — existing ones are reused or lightly adjusted.

**Tech Stack:** React Native, Expo SDK 55, TypeScript strict, `@expo/vector-icons`, `colors` from `src/theme/colors.ts`

---

## File Map

| File | Change |
|------|--------|
| `src/components/training/WeeklyVolumeCard.tsx` | Add `compact?: boolean` prop — compact mode renders a single text row instead of the large card |
| `src/components/training/WorkoutCategoryRows.tsx` | Remove blue glow (`shadowColor`, `shadowOpacity`, `shadowRadius`, `elevation`, `rgba` borderColor) from `card` style |
| `src/screens/TrainingScreen.tsx` | Full restructure: fixed header + tab-bar + tab-content ScrollView |

---

## Task 1: WeeklyVolumeCard — compact mode

**Files:**
- Modify: `src/components/training/WeeklyVolumeCard.tsx`

- [ ] **Step 1: Read the current file**

```bash
# already read — confirmed structure at lines 1-85
```

- [ ] **Step 2: Add `compact` prop and compact render path**

Replace the entire file content with:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useWeeklyVolume } from '../../hooks/useWeeklyVolume';

interface Props {
  refetchTrigger?: number;
  compact?: boolean;
}

interface MetricProps {
  value: string;
  label: string;
}

function Metric({ value, label }: MetricProps): React.ReactElement {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function WeeklyVolumeCard({ refetchTrigger = 0, compact = false }: Props): React.ReactElement {
  const { sessions, minutes, points } = useWeeklyVolume(refetchTrigger);

  if (compact) {
    return (
      <View style={styles.compactRow}>
        <Text style={styles.compactText}>
          {sessions} Einheiten · {minutes} Min · {points} Pts
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Diese Woche</Text>
      <View style={styles.row}>
        <Metric value={String(sessions)} label="Einheiten" />
        <View style={styles.divider} />
        <Metric value={String(minutes)} label="Minuten" />
        <View style={styles.divider} />
        <Metric value={String(points)} label="Punkte" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    backgroundColor: colors.headerCard,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.headerBorder,
  },
  heading: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.headerTextSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.headerTextPrimary,
    lineHeight: 32,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.headerTextSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.headerBorder,
  },
  compactRow: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  compactText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.headerTextSecondary,
  },
});
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/training/WeeklyVolumeCard.tsx
git commit -m "feat(training): add compact mode to WeeklyVolumeCard"
```

---

## Task 2: WorkoutCategoryRows — remove blue glow

**Files:**
- Modify: `src/components/training/WorkoutCategoryRows.tsx` (lines 333–354)

- [ ] **Step 1: Replace the `card` style**

Find this block (around line 333):

```ts
  card: {
    backgroundColor: colors.headerCard,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,144,217,0.6)',
    ...Platform.select({
      ios: {
        shadowColor: '#4A90D9',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.95,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
```

Replace with:

```ts
  card: {
    backgroundColor: colors.headerCard,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.headerBorder,
  },
```

- [ ] **Step 2: Remove unused `Platform` import if no longer needed**

Check the rest of `WorkoutCategoryRows.tsx` for any remaining `Platform` usage. If `Platform` only appeared in the shadow block, remove it from the import line:

```ts
// Before:
import { View, Text, TouchableOpacity, StyleSheet, Platform, ... } from 'react-native';

// After (if Platform unused):
import { View, Text, TouchableOpacity, StyleSheet, ... } from 'react-native';
```

If `Platform` is used elsewhere in the file, leave the import unchanged.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/training/WorkoutCategoryRows.tsx
git commit -m "fix(training): remove blue glow from workout category cards"
```

---

## Task 3: TrainingScreen — fixed header + two tabs

**Files:**
- Modify: `src/screens/TrainingScreen.tsx`

- [ ] **Step 1: Replace the entire TrainingScreen**

Write the following content to `src/screens/TrainingScreen.tsx`:

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useSchedule } from '../hooks/useSchedule';
import { useParticipation } from '../hooks/useParticipation';
import { useProfile } from '../hooks/useProfile';
import StundenplanSection from '../components/training/StundenplanSection';
import WorkoutCategoryRows from '../components/training/WorkoutCategoryRows';
import ExtraTab from '../components/training/ExtraTab';
import WeeklyVolumeCard from '../components/training/WeeklyVolumeCard';
import type { StudioSchedule } from '../types/database.types';

type TabKey = 'workouts' | 'plan';

// JS getDay(): 0=Sun … 6=Sat → 0=Mon … 6=Sun
function todayDayOfWeek(): number {
  return (new Date().getDay() + 6) % 7;
}

// ─── Today session card ───────────────────────────────────────────────────────

type TodayCardProps = {
  session: StudioSchedule;
  participating: boolean;
  onParticipate: () => void;
  onCancel: () => void;
};

function TodaySessionCard({ session, participating, onParticipate, onCancel }: TodayCardProps): React.ReactElement {
  return (
    <View style={styles.todayCard}>
      <View style={styles.todayCardInfo}>
        <Text style={styles.todayCardName}>{session.training_name}</Text>
        <Text style={styles.todayCardMeta}>
          {session.start_time.slice(0, 5)} Uhr · {session.duration_min} Min
          {session.coach_name !== null ? ` · ${session.coach_name}` : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.participateBtn, participating && styles.participateBtnActive]}
        onPress={participating ? onCancel : onParticipate}
        activeOpacity={0.7}
      >
        <Text style={[styles.participateBtnText, participating && styles.participateBtnTextActive]}>
          {participating ? 'Zugesagt' : 'Teilnehmen'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrainingScreen(): React.ReactElement {
  const todayDow = todayDayOfWeek();
  const todayDate = new Date().toISOString().split('T')[0];
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('workouts');

  useFocusEffect(useCallback(() => {
    setFocusTrigger((n) => n + 1);
  }, []));

  const { schedule: todaySchedule } = useSchedule(todayDow);
  const { schedule: fullSchedule, loading: scheduleLoading } = useSchedule();
  const { isParticipating, participate, cancelParticipation } = useParticipation();
  const { profile } = useProfile(focusTrigger);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>

        {/* ── Fixed header ── */}
        <View style={styles.header}>
          {todaySchedule.length === 0 ? (
            <View style={styles.todayCard}>
              <View style={styles.todayCardInfo}>
                <Text style={styles.todayCardName}>Heute kein Studiotraining</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveTab('workouts')} activeOpacity={0.7}>
                <Text style={styles.freeTrainingLink}>Freies Training starten</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.todayList}>
              {todaySchedule.map((session) => (
                <TodaySessionCard
                  key={session.id}
                  session={session}
                  participating={isParticipating(session.id, todayDate)}
                  onParticipate={() => { void participate(session.id, todayDate, session.points_per_30min, session.duration_min, session.training_name, session.training_type); }}
                  onCancel={() => { void cancelParticipation(session.id, todayDate); }}
                />
              ))}
            </View>
          )}
          <WeeklyVolumeCard refetchTrigger={focusTrigger} compact />
        </View>

        {/* ── Tab bar ── */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'workouts' && styles.tabPillActive]}
            onPress={() => setActiveTab('workouts')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'workouts' && styles.tabLabelActive]}>
              Workouts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'plan' && styles.tabPillActive]}
            onPress={() => setActiveTab('plan')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'plan' && styles.tabLabelActive]}>
              Plan
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Tab content ── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'workouts' ? (
            <>
              <WorkoutCategoryRows disciplines={profile?.disciplines ?? []} />
              <Text style={styles.extraHeader}>Zusatztraining</Text>
              <ExtraTab />
            </>
          ) : (
            <StundenplanSection
              studioSchedule={fullSchedule}
              studioLoading={scheduleLoading}
              todayDow={todayDow}
              hasStudio={profile?.studio_id !== null && profile?.studio_id !== undefined}
            />
          )}
          <View style={styles.bottomPad} />
        </ScrollView>

      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 16,
    gap: 0,
  },
  todayList: {
    paddingHorizontal: 16,
    gap: 8,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  tabPill: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.headerCard,
  },
  tabPillActive: {
    backgroundColor: colors.accentBlue,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  tabLabelActive: {
    color: colors.headerTextPrimary,
  },

  // Scroll area
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },

  // Extras section header
  extraHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 32,
    marginBottom: 8,
    paddingHorizontal: 16,
  },

  bottomPad: {
    height: 32,
  },

  // Today card
  todayCard: {
    marginHorizontal: 16,
    backgroundColor: colors.headerCard,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.headerBorder,
  },
  todayCardInfo: {
    flex: 1,
    gap: 4,
  },
  todayCardName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  todayCardMeta: {
    fontSize: 12,
    color: colors.headerTextSecondary,
    fontWeight: '400',
  },
  freeTrainingLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  participateBtn: {
    borderWidth: 1,
    borderColor: colors.headerBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  participateBtnActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  participateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  participateBtnTextActive: {
    color: colors.headerTextPrimary,
  },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start the app and verify visually**

```bash
npx expo start --ios
```

Check:
- Fixed header (Heute-Card + Stats-Zeile) bleibt beim Scrollen stehen
- "Workouts"-Tab zeigt Workout-Kategorien + "Zusatztraining"-Header + Extra-Units
- "Plan"-Tab zeigt Stundenplan
- Workout-Karten haben keinen blauen Glow mehr
- Wochenstats erscheinen als kompakte Zeile unter der Heute-Card
- "Freies Training starten" Link wechselt zum Workouts-Tab (nur sichtbar wenn keine heutige Session)

- [ ] **Step 4: Commit**

```bash
git add src/screens/TrainingScreen.tsx
git commit -m "feat(training): restructure to fixed header + workouts/plan tabs"
```
