import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { GENDERS, type Gender } from '../../utils/gender';

const ICON = {
  female: 'female-outline',
  male:   'male-outline',
  other:  'person-outline',
} as const satisfies Record<Gender, keyof typeof Ionicons.glyphMap>;

// Three tiles (Weiblich / Männlich / Divers). Locked: shows the stored value
// only, since the server refuses any change once set.
export default function GenderPicker({ value, onChange, locked = false, error = null, hint = null }: {
  value:     Gender | null;
  onChange?: (next: Gender) => void;
  locked?:   boolean;
  error?:    string | null;
  hint?:     string | null;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{t('common.gender.label')}</Text>
      <View style={styles.tiles} accessibilityRole="radiogroup">
        {GENDERS.map((g) => {
          const selected = value === g;
          if (locked && !selected) return null;
          return (
            <TouchableOpacity
              key={g}
              style={[styles.tile, selected && styles.tileActive]}
              onPress={() => { if (!locked) onChange?.(g); }}
              disabled={locked}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: locked }}
              accessibilityLabel={t(`common.gender.${g}`)}
            >
              <Ionicons name={ICON[g]} size={18} color={selected ? colors.card : colors.text} />
              <Text style={[styles.tileText, selected && styles.tileTextActive]}>{t(`common.gender.${g}`)}</Text>
              {locked && <Ionicons name="lock-closed" size={14} color={colors.card} />}
            </TouchableOpacity>
          );
        })}
      </View>
      {error !== null && (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>
      )}
      {hint !== null && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  tile: {
    flexGrow:          1,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    minHeight:         48,
    paddingHorizontal: 12,
    borderRadius:      12,
    borderWidth:       1.5,
    borderColor:       colors.hairline,
    backgroundColor:   colors.card,
  },
  tileActive: {
    borderColor:     colors.dark,
    backgroundColor: colors.dark,
  },
  tileText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  tileTextActive: {
    color: colors.card,
  },
  error: {
    fontSize: 14,
    color:    colors.deleteRed,
  },
  hint: {
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
  },
});
