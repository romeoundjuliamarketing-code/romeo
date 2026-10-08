import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { SPARRING_TRUST } from '../../../data/sparringConfig';

// Shown only while the server reports an unseen unlock (status.unlock_unseen).
export default function UnlockNoticeCard({ onAck }: { onAck: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="trophy-outline" size={24} color={colors.text} />
        <View style={styles.texts}>
          <Text style={styles.title}>{t('sparringTrust.unlock.title', { km: SPARRING_TRUST.radiusUnlockedKm })}</Text>
          <Text style={styles.body}>{t('sparringTrust.unlock.body')}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.button} onPress={onAck} accessibilityRole="button">
        <Text style={styles.buttonText}>{t('sparringTrust.unlock.ok')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accentBlueTint,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  row: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  texts: { flex: 1, gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  button: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.card },
});
