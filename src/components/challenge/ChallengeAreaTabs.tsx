import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CHALLENGE_AREAS } from '../../data/sparringChallenges';
import type { ChallengeArea } from '../../data/sparringChallenges';
import { colors } from '../../theme/colors';

interface Props {
  area:     ChallengeArea;
  onSelect: (area: ChallengeArea) => void;
}

// Segmented control on a single track — lighter than three separate pills.
export default function ChallengeAreaTabs({ area, onSelect }: Props): React.ReactElement {
  return (
    <View style={styles.track}>
      {CHALLENGE_AREAS.map((entry) => {
        const active = entry.key === area;
        return (
          <TouchableOpacity
            key={entry.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onSelect(entry.key)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
              {entry.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'center',
    padding: 8,
    borderRadius: 14,
    backgroundColor: colors.headerCard,
  },
  segment: {
    minHeight: 36,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: colors.accentBlue,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  labelActive: {
    color: colors.headerTextPrimary,
    fontWeight: '700',
  },
});
