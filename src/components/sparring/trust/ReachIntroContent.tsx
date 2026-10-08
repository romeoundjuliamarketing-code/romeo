import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { fonts } from '../../../theme/typography';
import { SPARRING_TRUST } from '../../../data/sparringConfig';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const STEPS: { key: 'stepCommit' | 'stepCheckin' | 'stepConfirm'; icon: IconName }[] = [
  { key: 'stepCommit', icon: 'hand-left-outline' },
  { key: 'stepCheckin', icon: 'qr-code-outline' },
  { key: 'stepConfirm', icon: 'checkmark-done-outline' },
];

// Content of the one-time intro ("intro": Weiter/Später) and of the
// "So funktioniert's" explanation ("explain": details + close). Content only:
// the caller decides the container (own sheet, or overlay inside an open modal).
export default function ReachIntroContent({ mode, onPrimary, onSecondary, busy = false, error = null }: {
  mode: 'intro' | 'explain';
  onPrimary: () => void;
  onSecondary?: () => void;
  busy?: boolean;
  error?: string | null;
}): React.ReactElement {
  const { t } = useTranslation();
  const base = SPARRING_TRUST.radiusBaseKm;
  const unlocked = SPARRING_TRUST.radiusUnlockedKm;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">
        {mode === 'intro' ? t('sparringTrust.intro.title') : t('sparringTrust.howItWorks.title')}
      </Text>
      <Text style={styles.body}>{t('sparringTrust.intro.body', { base, unlocked })}</Text>

      <View style={styles.steps}>
        {STEPS.map((s, i) => (
          <View key={s.key} style={styles.step}>
            <View style={styles.stepBadge}>
              <Ionicons name={s.icon} size={24} color={colors.accentBlueText} />
            </View>
            <Text style={styles.stepText}>{`${i + 1}. ${t(`sparringTrust.intro.${s.key}`)}`}</Text>
          </View>
        ))}
      </View>

      {mode === 'explain' && (
        <View style={styles.details}>
          <Text style={styles.detail}>{t('sparringTrust.howItWorks.radius', { base, unlocked })}</Text>
          <Text style={styles.detail}>{t('sparringTrust.howItWorks.slot')}</Text>
          <Text style={styles.detail}>{t('sparringTrust.howItWorks.publishLimit', { count: SPARRING_TRUST.publishLimit })}</Text>
          <Text style={styles.detail}>{t('sparringTrust.howItWorks.checkin', { meters: SPARRING_TRUST.checkinRadiusM })}</Text>
          <Text style={styles.detail}>{t('sparringTrust.howItWorks.confirm')}</Text>
          <Text style={styles.detail}>{t('sparringTrust.howItWorks.privacy')}</Text>
          <Text style={styles.detail}>{t('sparringTrust.howItWorks.noPenalty')}</Text>
          <Text style={styles.detailMuted}>{t('sparringTrust.howItWorks.honesty')}</Text>
        </View>
      )}

      {error !== null && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

      <TouchableOpacity
        style={styles.primary}
        onPress={onPrimary}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color={colors.card} /> : (
          <Text style={styles.primaryText}>
            {mode === 'intro' ? t('sparringTrust.intro.next') : t('sparringTrust.actions.close')}
          </Text>
        )}
      </TouchableOpacity>
      {mode === 'intro' && onSecondary !== undefined && (
        <TouchableOpacity style={styles.secondary} onPress={onSecondary} disabled={busy} accessibilityRole="button">
          <Text style={styles.secondaryText}>{t('sparringTrust.intro.later')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, paddingTop: 8, gap: 16 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 32, color: colors.text },
  body: { fontSize: 16, lineHeight: 24, color: colors.text },
  steps: { gap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBadge: {
    width: 40, height: 40, borderRadius: 24,
    backgroundColor: colors.accentBlueTint, alignItems: 'center', justifyContent: 'center',
  },
  stepText: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  details: { gap: 8 },
  detail: { fontSize: 14, lineHeight: 21, color: colors.text },
  detailMuted: { fontSize: 14, lineHeight: 21, color: colors.textMuted },
  error: { fontSize: 14, color: colors.deleteRed },
  primary: {
    minHeight: 48, borderRadius: 24, backgroundColor: colors.accentBlue,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.card },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 16, fontWeight: '600', color: colors.accentBlueText },
});
