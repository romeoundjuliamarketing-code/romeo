import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export type FrequencyTier = 'low' | 'medium' | 'high';

interface Props {
  value:    FrequencyTier | null;
  onChange: (value: FrequencyTier) => void;
  loading?: boolean;
}

interface TierOption {
  tier:     FrequencyTier;
  label:    string;
  subLabel: string | null;
}

const OPTIONS: TierOption[] = [
  { tier: 'low',    label: 'ca. 3x pro Woche',           subLabel: null         },
  { tier: 'medium', label: 'ca. 5x pro Woche',           subLabel: null         },
  { tier: 'high',   label: 'ca. 10x pro Woche',          subLabel: '2x täglich' },
];

export default function TrainingFrequencySelector({ value, onChange, loading = false }: Props) {
  // Treat null as 'low' for display (default tier)
  const activeTier: FrequencyTier = value ?? 'low';

  return (
    <View style={styles.wrapper}>
      {OPTIONS.map((option, index) => {
        const selected = option.tier === activeTier;
        const isLast   = index === OPTIONS.length - 1;

        return (
          <React.Fragment key={option.tier}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => { if (!loading) onChange(option.tier); }}
              activeOpacity={0.7}
            >
              {/* Radio circle */}
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioInner} />}
              </View>

              {/* Label */}
              <View style={styles.labelGroup}>
                <Text style={[styles.label, selected && styles.labelSelected]}>
                  {option.label}
                </Text>
                {option.subLabel !== null && (
                  <Text style={styles.subLabel}>{option.subLabel}</Text>
                )}
              </View>
            </TouchableOpacity>

            {!isLast && <View style={styles.divider} />}
          </React.Fragment>
        );
      })}

      <Text style={styles.hint}>
        Das ist ein Richtwert — Abweichungen sind völlig normal.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 0,
    gap: 16,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.accentBlue,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accentBlue,
  },
  labelGroup: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  labelSelected: {
    color: colors.accentBlue,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.inactive,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 40,
  },
  hint: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.inactive,
    textAlign: 'center',
    marginTop: 16,
  },
});
