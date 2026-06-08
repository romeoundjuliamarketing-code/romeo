# AttendanceHistory Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping the Streak stat card on the ProfilScreen navigates to a new AttendanceHistoryScreen that shows all training attendance dates in a monthly calendar grid.

**Architecture:** A new `useAttendanceHistory` hook queries `attendance_logs` for the current user and returns a `Set<string>` of attended ISO dates. The screen renders one month block per month (newest first) with a 7-column Mo–So grid, attended days highlighted in `accentBlue`. Navigation follows the existing WeightHistory / PointsBreakdown pattern: registered in `RootNavigator` as a standard stack screen, no params needed.

**Tech Stack:** React Native, Supabase JS client, `@react-navigation/native-stack`, `@expo/vector-icons`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/hooks/useAttendanceHistory.ts` | Fetch all `attendance_logs` for current user, return `Set<string>` of dates |
| Create | `src/screens/AttendanceHistoryScreen.tsx` | Monthly calendar grid UI |
| Modify | `src/navigation/types.ts` | Add `AttendanceHistory: undefined` route |
| Modify | `src/navigation/RootNavigator.tsx` | Register `AttendanceHistoryScreen` |
| Modify | `src/screens/ProfilScreen.tsx` | Make Streak stat card a `TouchableOpacity` navigating to `AttendanceHistory` |

---

### Task 1: `useAttendanceHistory` hook

**Files:**
- Create: `src/hooks/useAttendanceHistory.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

export function useAttendanceHistory(): {
  attendedDates: Set<string>;
  loading: boolean;
} {
  const { user } = useAuth();
  const [attendedDates, setAttendedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) return;

    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('session_date')
        .eq('user_id', user.id)
        .order('session_date', { ascending: false });

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      reportNetworkSuccess();
      setAttendedDates(new Set((data ?? []).map((r) => r.session_date as string)));
      setLoading(false);
    })();
  }, [user]);

  return { attendedDates, loading };
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAttendanceHistory.ts
git commit -m "feat(hooks): add useAttendanceHistory"
```

---

### Task 2: AttendanceHistoryScreen

**Files:**
- Create: `src/screens/AttendanceHistoryScreen.tsx`

- [ ] **Step 1: Create the screen**

The calendar logic:
- Months to show: from the month of the earliest attended date up to the current month, newest first.
- If no attendance yet: show just the current month (empty state).
- For each month: compute the Mo-first weekday offset of the 1st: `(new Date(year, month, 1).getDay() + 6) % 7`.
- Each day cell: 36×36, rounded, `accentBlue` background if attended, else transparent.

```tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAttendanceHistory } from '../hooks/useAttendanceHistory';

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Monday-first offset of the 1st of the month (0=Mo … 6=So)
function firstDayOffset(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

interface MonthBlock {
  year: number;
  month: number; // 0-indexed
}

export default function AttendanceHistoryScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { attendedDates, loading } = useAttendanceHistory();

  const months = useMemo<MonthBlock[]>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (attendedDates.size === 0) {
      return [{ year: currentYear, month: currentMonth }];
    }

    // Find earliest attended date
    const sorted = Array.from(attendedDates).sort();
    const earliest = new Date(sorted[0]);
    const startYear = earliest.getFullYear();
    const startMonth = earliest.getMonth();

    const result: MonthBlock[] = [];
    let y = currentYear;
    let m = currentMonth;
    while (y > startYear || (y === startYear && m >= startMonth)) {
      result.push({ year: y, month: m });
      m -= 1;
      if (m < 0) { m = 11; y -= 1; }
    }
    return result;
  }, [attendedDates]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Anwesenheit</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.accentBlue} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.totalLabel}>
            {attendedDates.size === 0
              ? 'Noch keine Anwesenheiten eingetragen.'
              : `${attendedDates.size} Training${attendedDates.size === 1 ? '' : 's'} insgesamt`}
          </Text>

          {months.map(({ year, month }) => {
            const offset = firstDayOffset(year, month);
            const days = daysInMonth(year, month);
            const cells: (number | null)[] = [
              ...Array<null>(offset).fill(null),
              ...Array.from({ length: days }, (_, i) => i + 1),
            ];
            // pad to full rows
            while (cells.length % 7 !== 0) cells.push(null);

            return (
              <View key={`${year}-${month}`} style={styles.monthBlock}>
                <Text style={styles.monthTitle}>
                  {MONTH_NAMES[month]} {year}
                </Text>
                <View style={styles.dayLabelsRow}>
                  {DAY_LABELS.map((d) => (
                    <Text key={d} style={styles.dayLabel}>{d}</Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {cells.map((day, idx) => {
                    if (day === null) {
                      return <View key={`empty-${idx}`} style={styles.cell} />;
                    }
                    const iso = isoDate(year, month, day);
                    const attended = attendedDates.has(iso);
                    return (
                      <View
                        key={iso}
                        style={[styles.cell, attended && styles.cellAttended]}
                      >
                        <Text style={[styles.dayNum, attended && styles.dayNumAttended]}>
                          {day}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const CELL_SIZE = 36;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPlaceholder: {
    width: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  monthBlock: {
    marginBottom: 32,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    marginBottom: 2,
  },
  cellAttended: {
    backgroundColor: colors.accentBlue,
  },
  dayNum: {
    fontSize: 13,
    color: colors.text,
  },
  dayNumAttended: {
    color: colors.card,
    fontWeight: '700',
  },
  bottomPad: {
    height: 40,
  },
});
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/AttendanceHistoryScreen.tsx
git commit -m "feat(screens): add AttendanceHistoryScreen with monthly calendar"
```

---

### Task 3: Register route in navigation

**Files:**
- Modify: `src/navigation/types.ts`
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Add route to types.ts**

In `src/navigation/types.ts`, add `AttendanceHistory: undefined;` after `PointsBreakdown`:

```ts
  PointsBreakdown: undefined;
  AttendanceHistory: undefined;
  SparringMap: undefined;
```

- [ ] **Step 2: Register screen in RootNavigator.tsx**

Add import at the top (after `PointsBreakdownScreen` import):
```ts
import AttendanceHistoryScreen from '../screens/AttendanceHistoryScreen';
```

Add screen registration after the `PointsBreakdown` entry:
```tsx
<AppStack.Screen name="PointsBreakdown" component={PointsBreakdownScreen} />
<AppStack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/types.ts src/navigation/RootNavigator.tsx
git commit -m "feat(navigation): register AttendanceHistoryScreen"
```

---

### Task 4: Make Streak card tappable in ProfilScreen

**Files:**
- Modify: `src/screens/ProfilScreen.tsx`

The current render logic in `STATS.map` uses `isPunkte` to decide between `TouchableOpacity` and `View`. Extend this to also handle `isStreak`.

- [ ] **Step 1: Update the stats map render**

Find this block in `ProfilScreen.tsx` (around line 385):

```tsx
{STATS.map((stat) => {
  const isPunkte = stat.label === 'Punkte';
  const cardContent = (
```

Replace with:

```tsx
{STATS.map((stat) => {
  const isPunkte = stat.label === 'Punkte';
  const isStreak = stat.label === 'Streak';
  const isTappable = isPunkte || isStreak;
  const cardContent = (
```

Find the label row inside `cardContent`:

```tsx
<View style={styles.statLabelRow}>
  <Text style={styles.statLabel}>{stat.label}</Text>
  {isPunkte && (
    <MaterialCommunityIcons name="chevron-right" size={14} color={colors.inactive} />
  )}
</View>
```

Replace with:

```tsx
<View style={styles.statLabelRow}>
  <Text style={styles.statLabel}>{stat.label}</Text>
  {isTappable && (
    <MaterialCommunityIcons name="chevron-right" size={14} color={colors.inactive} />
  )}
</View>
```

Find the return at the bottom of the map:

```tsx
return isPunkte ? (
  <TouchableOpacity
    key={stat.label}
    style={styles.statCard}
    onPress={() => navigation.navigate('PointsBreakdown')}
    activeOpacity={0.7}
  >
    {cardContent}
  </TouchableOpacity>
) : (
  <View key={stat.label} style={styles.statCard}>
    {cardContent}
  </View>
);
```

Replace with:

```tsx
if (isTappable) {
  return (
    <TouchableOpacity
      key={stat.label}
      style={styles.statCard}
      onPress={() =>
        navigation.navigate(isPunkte ? 'PointsBreakdown' : 'AttendanceHistory')
      }
      activeOpacity={0.7}
    >
      {cardContent}
    </TouchableOpacity>
  );
}
return (
  <View key={stat.label} style={styles.statCard}>
    {cardContent}
  </View>
);
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ProfilScreen.tsx
git commit -m "feat(profil): make Streak stat card tappable → AttendanceHistory"
```
