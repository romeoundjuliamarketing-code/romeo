import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { useLanguage } from '../../../i18n/language';
import { localeFor } from '../../../utils/language';
import { formatTooFarKm } from '../../../utils/sparringTrust';
import { SPARRING_TRUST } from '../../../data/sparringConfig';
import type { JoinGate } from '../../../utils/joinGate';

// Replaces the join button when the server refused the distance: what is
// blocked, why (distance vs. limit), how to unlock more, and what to do now.
export default function JoinBlockedCard({ gate, onNearby, onWhy }: {
  gate: Extract<JoinGate, { kind: 'tooFar' }>;
  onNearby: () => void;
  onWhy: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const distance = formatTooFarKm(gate.distanceM, gate.radiusKm, localeFor(language));

  return (
    <View style={styles.card}>
      <View style={styles.head} accessible accessibilityRole="alert">
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={16} color={colors.text} />
        </View>
        <View style={styles.texts}>
          <Text style={styles.title}>{t('sparringTrust.blocked.title')}</Text>
          <Text style={styles.body}>
            {distance !== null
              ? t('sparringTrust.blocked.distance', { distance, limit: gate.radiusKm })
              : t('sparringTrust.blocked.distanceUnknown', { limit: gate.radiusKm })}
          </Text>
          {!gate.unlocked && (
            <Text style={styles.body}>{t('sparringTrust.blocked.unlockHint', { km: SPARRING_TRUST.radiusUnlockedKm })}</Text>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.primary} onPress={onNearby} activeOpacity={0.8} accessibilityRole="button">
        <Text style={styles.primaryText}>{t('sparringTrust.blocked.findNearby')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={onWhy} accessibilityRole="button">
        <Text style={styles.secondaryText}>{t('sparringTrust.actions.limit')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accentLight,
    borderRadius:    16,
    padding:         16,
    gap:             8,
  },
  head: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  texts: { flex: 1, gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, lineHeight: 21, color: colors.text },
  primary: {
    minHeight: 48, borderRadius: 24, backgroundColor: colors.accentBlue,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 8,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.card, textAlign: 'center' },
  secondary: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14, fontWeight: '600', color: colors.accentBlueText, textAlign: 'center' },
});
