import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { TextAction } from '../../common/TextAction';
import { SPARRING_TRUST } from '../../../data/sparringConfig';
import { openLocationSettings } from '../../../hooks/useDeviceFix';

// Explains typical check-in problems with real actions. There is deliberately
// no way to grant attendance from here.
export default function CheckinHelpOverlay({ isOrganizer, onRetry }: {
  isOrganizer: boolean;
  onRetry: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">{t('sparringTrust.checkin.helpTitle')}</Text>
      <Text style={styles.text}>{t('sparringTrust.checkin.helpLocation', { meters: SPARRING_TRUST.checkinRadiusM })}</Text>
      {!isOrganizer && <Text style={styles.text}>{t('sparringTrust.checkin.helpCamera')}</Text>}
      {!isOrganizer && <Text style={styles.text}>{t('sparringTrust.checkin.helpCode')}</Text>}
      <Text style={styles.text}>{t('sparringTrust.checkin.helpNetwork')}</Text>
      <Text style={styles.muted}>{t('sparringTrust.checkin.helpNoPenalty')}</Text>
      <TextAction label={t('sparringTrust.actions.retry')} onPress={onRetry} icon="refresh-outline" />
      <TextAction label={t('sparringTrust.actions.settings')} onPress={openLocationSettings} icon="settings-outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, gap: 8 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
  text: { fontSize: 15, lineHeight: 22, color: colors.text },
  muted: { fontSize: 14, lineHeight: 21, color: colors.textMuted },
});
