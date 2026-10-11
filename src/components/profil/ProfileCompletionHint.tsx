import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import type { ProfileGap } from '../../utils/intro';

const ICONS: Record<ProfileGap, React.ComponentProps<typeof Ionicons>['name']> = {
  photo:       'camera-outline',
  disciplines: 'body-outline',
};

// Quiet hint on the own profile while photo or disciplines are
// missing. Only missing items are listed; each opens the profile editor.
export default function ProfileCompletionHint({ gaps, onEdit }: {
  gaps:   readonly ProfileGap[];
  onEdit: () => void;
}): React.ReactElement | null {
  const { t } = useTranslation();
  if (gaps.length === 0) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('onboarding.profileHint.title')}</Text>
      <Text style={styles.body}>{t('onboarding.profileHint.body')}</Text>
      <View style={styles.actions}>
        {gaps.map((gap) => (
          <TouchableOpacity key={gap} style={styles.action} onPress={onEdit} accessibilityRole="button">
            <Ionicons name={ICONS[gap]} size={16} color={colors.accentBlueText} />
            <Text style={styles.actionText}>{t(`onboarding.profileHint.${gap}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap:             8,
    padding:         16,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     colors.hairline,
    backgroundColor: colors.card,
  },
  title: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  body: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  action: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    minHeight:         40,
    paddingHorizontal: 16,
    borderRadius:      20,
    backgroundColor:   colors.accentBlueTint,
  },
  actionText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.accentBlueText,
  },
});
