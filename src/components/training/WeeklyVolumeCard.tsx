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
          Diese Woche: {sessions} Einheiten · {minutes} Min · {points} Pts
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
