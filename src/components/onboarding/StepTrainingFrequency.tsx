import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export type FrequencyTier = 'low' | 'medium' | 'high';

interface Option {
  value:    FrequencyTier;
  label:    string;
  sub:      string;
}

const OPTIONS: Option[] = [
  { value: 'low',    label: 'ca. 3x pro Woche',  sub: 'Moderat aktiv'       },
  { value: 'medium', label: 'ca. 5x pro Woche',  sub: 'Sehr aktiv'          },
  { value: 'high',   label: 'ca. 10x pro Woche', sub: '2x täglich'          },
];

interface Props {
  value:    FrequencyTier | null;
  onChange: (v: FrequencyTier) => void;
}

export default function StepTrainingFrequency({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.75}
          >
            <View style={styles.textCol}>
              <Text style={[styles.label, active && styles.labelActive]}>
                {opt.label}
              </Text>
              <Text style={[styles.sub, active && styles.subActive]}>
                {opt.sub}
              </Text>
            </View>
            {active && (
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingHorizontal: 24,
  },
  textCol: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  optionActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  labelActive: {
    color: '#FFFFFF',
  },
  sub: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  subActive: {
    color: 'rgba(255,255,255,0.65)',
  },
});
