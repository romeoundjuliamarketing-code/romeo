import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { TextAction } from '../../common/TextAction';
import { useLanguage } from '../../../i18n/language';
import { formatDate } from '../../../utils/formatDate';
import { SPARRING_TRUST } from '../../../data/sparringConfig';
import type { SparringReachStatus } from '../../../types/sparringTrust';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Line({ icon, text }: { icon: IconName; text: string }): React.ReactElement {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={24} color={colors.text} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

// Home status of the user's reach: radius, planned sparrings, publish pause.
// Every state is text + icon, never color alone.
export default function ReachStatusCard({ status, onOpenActive, onHowItWorks }: {
  status: SparringReachStatus;
  onOpenActive: (sparringId: string) => void;
  onHowItWorks: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  // The server sets publish_next_at only while the rolling limit is reached
  // (refetched on focus), so no device-clock comparison is needed.
  const paused = status.publish_next_at !== null;
  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">{t('sparringTrust.status.title')}</Text>
      <Line icon="navigate-circle-outline" text={t('sparringTrust.status.radius', { km: status.radius_km })} />
      <Line
        icon="calendar-outline"
        text={t('sparringTrust.status.planned', { count: status.active_count, limit: status.active_limit })}
      />
      {!status.unlocked && (
        <Line icon="lock-closed-outline" text={t('sparringTrust.status.nextStep', { km: SPARRING_TRUST.radiusUnlockedKm })} />
      )}
      {paused && status.publish_next_at !== null && (
        <Line
          icon="time-outline"
          text={t('sparringTrust.status.publishPaused', { time: formatDate(status.publish_next_at, 'dateTime', language) })}
        />
      )}
      <View style={styles.actions}>
        {status.active_sparring_id !== null && (
          <TextAction
            label={t('sparringTrust.status.toActive')}
            icon="arrow-forward-outline"
            onPress={() => { if (status.active_sparring_id !== null) onOpenActive(status.active_sparring_id); }}
          />
        )}
        <TextAction label={t('sparringTrust.status.howItWorks')} icon="help-circle-outline" onPress={onHowItWorks} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  text: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
});
