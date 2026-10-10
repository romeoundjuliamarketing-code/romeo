import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { fonts } from '../../../theme/typography';
import { SPARRING_TRUST } from '../../../data/sparringConfig';

// "Warum gibt es diese Grenze?": short reason for the join distance. With the
// 300 km already unlocked it promises no further step.
export default function ReachLimitContent({ unlocked, onClose }: {
  unlocked: boolean;
  onClose: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const base = SPARRING_TRUST.radiusBaseKm;
  const max = SPARRING_TRUST.radiusUnlockedKm;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">{t('sparringTrust.limit.title')}</Text>
      <Text style={styles.body}>{t('sparringTrust.limit.why')}</Text>
      <Text style={styles.body}>
        {unlocked ? t('sparringTrust.limit.unlocked', { km: max }) : t('sparringTrust.limit.unlock', { base, km: max })}
      </Text>
      <TouchableOpacity style={styles.primary} onPress={onClose} accessibilityRole="button">
        <Text style={styles.primaryText}>{t('sparringTrust.actions.close')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingTop: 8, gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 32, color: colors.text },
  body: { fontSize: 16, lineHeight: 24, color: colors.text },
  primary: {
    minHeight: 48, borderRadius: 24, backgroundColor: colors.accentBlue,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.card },
});
