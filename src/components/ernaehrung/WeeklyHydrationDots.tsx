import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export type WeeklyHydrationDay = {
  key: string;
  label: string;
  reachedGoal: boolean;
};

interface WeeklyHydrationDotsProps {
  items: WeeklyHydrationDay[];
}

export default function WeeklyHydrationDots({ items }: WeeklyHydrationDotsProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Wochenverlauf</Text>
      <View style={styles.row}>
        {items.map((item) => (
          <View key={item.key} style={styles.item}>
            <View style={[styles.dot, item.reachedGoal && styles.dotReached]} />
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
      </View>
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
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    alignItems: 'center',
    gap: 8,
    width: 36,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.accentBlue,
    backgroundColor: colors.card,
  },
  dotReached: {
    backgroundColor: colors.accentBlue,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
});
