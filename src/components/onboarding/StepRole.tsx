import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export type Role = 'student' | 'coach';

interface Option {
  value: Role;
  labelKey: 'onboarding.roleStudent' | 'onboarding.roleCoach';
  icon: keyof typeof Ionicons.glyphMap;
}

const OPTIONS: Option[] = [
  { value: 'student', labelKey: 'onboarding.roleStudent', icon: 'school-outline' },
  { value: 'coach',   labelKey: 'onboarding.roleCoach', icon: 'ribbon-outline' },
];

interface Props {
  value: Role | null;
  onChange: (v: Role) => void;
}

export default function StepRole({ value, onChange }: Props) {
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
              size={32}
              color={active ? colors.card : colors.text}
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
    gap: 16,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 10,
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
    color: colors.card,
  },
});
