import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
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
