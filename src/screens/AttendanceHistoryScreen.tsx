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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { attendedDates, loading } = useAttendanceHistory();

  const months = useMemo<MonthBlock[]>(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (attendedDates.size === 0) {
      return [{ year: currentYear, month: currentMonth }];
    }

    // Find earliest attended date — parse manually to avoid UTC-offset month shift
    const sorted = Array.from(attendedDates).sort();
    const parts = sorted[0].split('-').map(Number);
    const startYear = parts[0];
    const startMonth = parts[1] - 1; // 0-indexed

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

const CELL_SIZE = 40;

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
    borderRadius: 20,
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
    height: 48,
  },
});
