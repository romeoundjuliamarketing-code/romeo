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
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
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
  // Flat segmented control inside the map header panel.
  container: {
    flexDirection:   'row',
    backgroundColor: colors.card,
    borderRadius:    16,
    padding:         4,
  },
  segment: {
    flex:           1,
    height:         32,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.dark,
  },
  label: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textMuted,
  },
  labelActive: {
    color: colors.card,
  },
});
