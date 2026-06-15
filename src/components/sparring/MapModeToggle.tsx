import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';

export type MapMode = 'sparrings' | 'events';

interface Props {
  mode:     MapMode;
  onChange: (m: MapMode) => void;
}

const OPTIONS: Array<{ key: MapMode; label: string }> = [
  { key: 'sparrings', label: 'Sparrings' },
  { key: 'events',    label: 'Events' },
];

export default function MapModeToggle({ mode, onChange }: Props) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((opt) => {
        const active = mode === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:  'row',
    backgroundColor: colors.card,
    borderRadius:   24,
    padding:        4,
    height:         40,
    shadowColor:    colors.dark,
    shadowOffset:   { width: 0, height: 2 },
    shadowOpacity:  0.15,
    shadowRadius:   4,
    elevation:      4,
  },
  segment: {
    flex:           1,
    height:         32,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  segmentActive: {
    backgroundColor: colors.accentBlue,
  },
  label: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  labelActive: {
    color: colors.card,
  },
});
