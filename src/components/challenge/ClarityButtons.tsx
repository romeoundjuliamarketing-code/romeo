import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ClarityValue } from '../../data/sparringChallenges';
import { CLARITY_LEVELS } from './clarityLevels';
import { colors } from '../../theme/colors';

interface Props {
  selected:      ClarityValue | null;
  onSelect:      (value: ClarityValue) => void;
  iconSize:      number;
  inactiveColor: string;
  showLabels?:   boolean;
}

// The three clarity buttons. Layout around them differs between the inline row and
// the overlay; the buttons themselves must not.
export default function ClarityButtons({
  selected,
  onSelect,
  iconSize,
  inactiveColor,
  showLabels = false,
}: Props): React.ReactElement {
  return (
    <View style={styles.row}>
      {CLARITY_LEVELS.map((level) => (
        <TouchableOpacity
          key={level.value}
          style={styles.button}
          onPress={() => onSelect(level.value)}
          activeOpacity={0.7}
          disabled={selected !== null}
          accessibilityRole="button"
          accessibilityLabel={level.label}
          accessibilityState={{ selected: selected === level.value }}
        >
          <MaterialCommunityIcons
            name={level.icon}
            size={iconSize}
            color={selected === level.value ? colors.accentBlue : inactiveColor}
          />
          {showLabels ? <Text style={styles.label}>{level.label}</Text> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
