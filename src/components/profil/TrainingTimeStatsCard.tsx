import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { colors } from '../../theme/colors';
import { useTrainingTimeStats } from '../../hooks/useTrainingTimeStats';
import type { TrainingTimeRange } from '../../hooks/useTrainingTimeStats';

interface Props {
  refetchTrigger?: number;
}

const RANGE_TABS: { key: TrainingTimeRange; label: string }[] = [
  { key: '7d', label: '7T' },
  { key: '30d', label: '30T' },
  { key: '90d', label: '90T' },
  { key: '12m', label: '12M' },
  { key: 'all', label: 'Gesamt' },
];

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} Min`;
  return `${hours} Std ${minutes} Min`;
}

function comparisonText(delta: number | null, percent: number | null): string {
  if (delta === null || percent === null) return 'Kein Vergleich für Gesamtzeitraum';
  if (delta === 0) return 'Keine Veränderung zum vorherigen Zeitraum';
  const sign = delta > 0 ? '+' : '';
  const direction = delta > 0 ? 'mehr' : 'weniger';
  return `${sign}${delta} Min (${sign}${percent}%) ${direction} als zuvor`;
}

export default function TrainingTimeStatsCard({ refetchTrigger = 0 }: Props): React.ReactElement {
  const [range, setRange] = useState<TrainingTimeRange>('30d');
  const { stats, loading } = useTrainingTimeStats(range, refetchTrigger);

  const categoryShare = useMemo(() => {
    if (stats.totalMinutes <= 0) return [];
    return stats.categories.map((c) => ({
      ...c,
      percent: Math.round((c.minutes / stats.totalMinutes) * 100),
    }));
  }, [stats.categories, stats.totalMinutes]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Trainingszeit</Text>

      <View style={styles.tabsRow}>
        {RANGE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, range === tab.key && styles.tabActive]}
            onPress={() => setRange(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, range === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Wird geladen...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.totalTime}>{formatMinutes(stats.totalMinutes)}</Text>
          <Text style={styles.subtitle}>Trainiert im ausgewählten Zeitraum</Text>

          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{stats.sessionCount}</Text>
              <Text style={styles.kpiLabel}>Einheiten</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{formatMinutes(stats.averagePerWeekMinutes)}</Text>
              <Text style={styles.kpiLabel}>Ø pro Woche</Text>
            </View>
          </View>

          <Text style={styles.compareText}>{comparisonText(stats.comparisonMinutes, stats.comparisonPercent)}</Text>

          <View style={styles.sectionDivider} />

          <Text style={styles.breakdownTitle}>Top-Bereiche nach Zeit</Text>
          {categoryShare.length === 0 ? (
            <Text style={styles.emptySubText}>Noch keine Trainingszeit im Zeitraum erfasst.</Text>
          ) : (
            categoryShare.map((category) => (
              <View key={category.key} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{category.label}</Text>
                <Text style={styles.breakdownValue}>{formatMinutes(category.minutes)} · {category.percent}%</Text>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.headerBg,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inactive,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.accentBlue,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inactive,
  },
  tabLabelActive: {
    color: colors.headerTextPrimary,
  },
  totalTime: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: colors.inactive,
    marginBottom: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 16,
    gap: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.inactive,
  },
  compareText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  breakdownValue: {
    fontSize: 13,
    color: colors.inactive,
    fontWeight: '600',
  },
  emptyWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  emptySubText: {
    fontSize: 13,
    color: colors.inactive,
  },
});
