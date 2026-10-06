import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export type Gender = 'male' | 'female' | 'other';

interface Option {
  value: Gender;
  labelKey: 'onboarding.genderMale' | 'onboarding.genderFemale' | 'onboarding.genderOther';
  icon: keyof typeof Ionicons.glyphMap;
}

const OPTIONS: Option[] = [
  { value: 'male',   labelKey: 'onboarding.genderMale', icon: 'male-outline'   },
  { value: 'female', labelKey: 'onboarding.genderFemale', icon: 'female-outline' },
  { value: 'other',  labelKey: 'onboarding.genderOther', icon: 'person-outline' },
];

interface Props {
  value: Gender | null;
  onChange: (v: Gender) => void;
}

export default function StepGender({ value, onChange }: Props) {
  const { t } = useTranslation();
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
            <Ionicons
              name={opt.icon}
              size={28}
              color={active ? '#FFFFFF' : colors.text}
            />
            <Text style={[styles.label, active && styles.labelActive]}>
              {t(opt.labelKey)}
            </Text>
            {active && (
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8,
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
