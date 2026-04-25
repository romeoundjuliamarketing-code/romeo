import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export type TrainingSince =
  | 'under_1_year'
  | '1_3_years'
  | '3_5_years'
  | 'over_5_years';

interface Option {
  value: TrainingSince;
  label: string;
  sub: string;
}

const OPTIONS: Option[] = [
  { value: 'under_1_year', label: 'Einsteiger',  sub: 'Weniger als 1 Jahr'   },
  { value: '1_3_years',    label: 'Fortgeschritten', sub: '1 bis 3 Jahre'    },
  { value: '3_5_years',    label: 'Erfahren',    sub: '3 bis 5 Jahre'        },
  { value: 'over_5_years', label: 'Veteran',     sub: 'Mehr als 5 Jahre'     },
];

interface Props {
  value: TrainingSince | null;
  onChange: (v: TrainingSince) => void;
}

export default function StepExperience({ value, onChange }: Props) {
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
    shadowColor: '#000',
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
