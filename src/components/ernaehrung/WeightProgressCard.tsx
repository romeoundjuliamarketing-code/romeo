import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  currentWeight: number;
  targetWeight: number;
  startWeight: number;
  isGain: boolean;
}

export default function WeightProgressCard({ currentWeight, targetWeight, startWeight, isGain }: Props): React.ReactElement {
  const totalDelta = Math.abs(targetWeight - startWeight);
  const currentDelta = Math.abs(currentWeight - startWeight);
  const progress = totalDelta === 0 ? 0 : Math.min(1, Math.max(0, currentDelta / totalDelta));

  const remaining = Math.abs(targetWeight - currentWeight);
  const directionLabel = isGain ? 'noch aufzubauen' : 'noch abzunehmen';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.metricGroup}>
          <Text style={styles.metricValue}>{currentWeight.toFixed(1)} kg</Text>
          <Text style={styles.metricLabel}>Aktuell</Text>
        </View>
        <View style={styles.metricGroupCenter}>
          <Text style={styles.remainingValue}>{remaining.toFixed(1)} kg</Text>
          <Text style={styles.metricLabel}>{directionLabel}</Text>
        </View>
        <View style={styles.metricGroupRight}>
          <Text style={styles.metricValue}>{targetWeight.toFixed(1)} kg</Text>
          <Text style={styles.metricLabel}>Ziel</Text>
        </View>
      </View>

      <View style={styles.trackBg}>
        <View style={[styles.trackFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      <Text style={styles.percentLabel}>{Math.round(progress * 100)} % erreicht</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  metricGroup: {
    flex: 1,
    gap: 2,
  },
  metricGroupCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricGroupRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  remainingValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.inactive,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  trackBg: {
    height: 6,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    height: 6,
    backgroundColor: colors.accentBlue,
    borderRadius: 3,
  },
  percentLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.inactive,
    textAlign: 'right',
  },
});
