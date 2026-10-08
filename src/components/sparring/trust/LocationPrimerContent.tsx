import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';

// Shown before the system location prompt (only while the permission is still
// undetermined). Promises only what the implementation keeps: the position is
// used for the check and never shown to others.
export default function LocationPrimerContent({ onAllow, onLater }: {
  onAllow: () => void;
  onLater: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBadge}>
        <Ionicons name="location-outline" size={32} color={colors.accentBlueText} />
      </View>
      <Text style={styles.title} accessibilityRole="header">{t('sparringTrust.primer.title')}</Text>
      <Text style={styles.body}>{t('sparringTrust.primer.body')}</Text>
      <TouchableOpacity style={styles.primary} onPress={onAllow} accessibilityRole="button">
        <Text style={styles.primaryText}>{t('sparringTrust.primer.allow')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={onLater} accessibilityRole="button">
        <Text style={styles.secondaryText}>{t('sparringTrust.primer.later')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingTop: 8, gap: 16, alignItems: 'stretch' },
  iconBadge: {
    width: 64, height: 64, borderRadius: 32, alignSelf: 'center',
    backgroundColor: colors.accentBlueTint, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24, color: colors.text, textAlign: 'center' },
  primary: {
    minHeight: 48, borderRadius: 24, backgroundColor: colors.accentBlue,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.card },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '600', color: colors.accentBlueText },
});
