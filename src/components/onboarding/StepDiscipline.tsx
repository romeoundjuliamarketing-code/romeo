import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { ALL_DISCIPLINES } from '../../data/disciplines';
import type { Discipline } from '../../data/disciplines';

interface Props {
  value: Discipline[];
  onChange: (disciplines: Discipline[]) => void;
}

export default function StepDiscipline({ value, onChange }: Props) {
  const toggle = (d: Discipline) => {
    if (value.includes(d)) {
      onChange(value.filter((x) => x !== d));
    } else {
      onChange([...value, d]);
    }
  };

  return (
    <View style={styles.container}>
      {ALL_DISCIPLINES.map((d) => {
        const active = value.includes(d);
        return (
          <TouchableOpacity
            key={d}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => toggle(d)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
              {d}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 40,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  chipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  chipLabelActive: {
    color: '#FFFFFF',
  },
});
