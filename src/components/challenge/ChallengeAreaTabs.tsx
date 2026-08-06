import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CHALLENGE_AREAS } from '../../data/sparringChallenges';
import type { ChallengeArea } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';

interface Props {
  area:    ChallengeArea;
  onSelect: (area: ChallengeArea) => void;
}

export default function ChallengeAreaTabs({ area, onSelect }: Props): React.ReactElement {
  return (
    <View style={styles.row}>
      {CHALLENGE_AREAS.map((entry) => {
        const active = entry.key === area;
        return (
          <TouchableOpacity
            key={entry.key}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onSelect(entry.key)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{entry.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  pill: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.headerCard,
    borderWidth: 1,
    borderColor: colors.headerBorder,
  },
  pillActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  labelActive: {
    color: colors.headerTextPrimary,
  },
});
