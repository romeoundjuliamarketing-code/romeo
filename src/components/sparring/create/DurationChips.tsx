import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { SPARRING_TRUST } from '../../../data/sparringConfig';

// Planned length of the sparring: a few fixed choices.
function DurationChips({ value, onChange }: { value: number; onChange: (min: number) => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {SPARRING_TRUST.durationOptionsMin.map((min) => {
        const active = value === min;
        return (
          <Pressable
            key={min}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(min)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {t('sparringTrust.create.durationMinutes', { count: min })}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default React.memo(DurationChips);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.accentBlue,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  chipTextActive: {
    color: colors.headerTextPrimary,
  },
});
