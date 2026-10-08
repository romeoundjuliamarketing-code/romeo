import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { TextAction } from '../../common/TextAction';
import { useLanguage } from '../../../i18n/language';
import { formatDate } from '../../../utils/formatDate';
import { checkinPhase } from '../../../utils/sparringTrust';
import type { TrustPanel } from './useTrustPanel';
import MeetingFeedbackCard from './MeetingFeedbackCard';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function InfoRow({ icon, text }: { icon: IconName; text: string }): React.ReactElement {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={24} color={colors.text} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

// Inline part of the sparring detail: role-based check-in card plus the
// post-meeting confirmation. Overlays (QR, scanner, help) are rendered by the
// sheet root (TrustPanelOverlays) because they must not live inside the scroll view.
export default function CheckinSection({ panel, sparringId, sparringTitle }: {
  panel: TrustPanel;
  sparringId: string;
  sparringTitle: string;
}): React.ReactElement | null {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { state, serverNowMs } = panel;
  if (state === null || state.cancelled === true || state.role === 'none') return null;

  const isOrganizer = state.role === 'organizer';
  const hasWindow = state.checkin_opens_at !== undefined && state.checkin_closes_at !== undefined;
  const phase = hasWindow
    ? checkinPhase(state.checkin_opens_at ?? '', state.checkin_closes_at ?? '', serverNowMs)
    : 'closed';
  const checkedInAt = state.checked_in_at ?? null;
  const time = (iso: string | undefined, fmt: 'time' | 'dateTime'): string => (iso ? formatDate(iso, fmt, language) : '');

  let body: React.ReactElement;
  if (state.has_place === false) {
    body = <InfoRow icon="location-outline" text={t('sparringTrust.notice.placeUnknown')} />;
  } else if (!isOrganizer && checkedInAt !== null) {
    body = <InfoRow icon="checkmark-circle-outline" text={t('sparringTrust.checkin.checkedInAt', { time: time(checkedInAt, 'time') })} />;
  } else if (phase === 'before') {
    body = <InfoRow icon="time-outline" text={t('sparringTrust.checkin.opensAt', { time: time(state.checkin_opens_at, 'dateTime') })} />;
  } else if (phase === 'closed') {
    body = <InfoRow icon="lock-closed-outline" text={t('sparringTrust.checkin.closed')} />;
  } else if (isOrganizer) {
    body = (
      <>
        <TouchableOpacity style={styles.primary} onPress={() => panel.openOverlay('qr')} accessibilityRole="button">
          <Ionicons name="qr-code-outline" size={20} color={colors.card} />
          <Text style={styles.primaryText}>{t('sparringTrust.checkin.showQr')}</Text>
        </TouchableOpacity>
        <InfoRow icon="people-outline" text={t('sparringTrust.checkin.checkedInList', { count: state.checked_in_count ?? 0 })} />
      </>
    );
  } else {
    body = (
      <TouchableOpacity style={styles.primary} onPress={() => panel.openOverlay('scanner')} accessibilityRole="button">
        <Ionicons name="scan-outline" size={20} color={colors.card} />
        <Text style={styles.primaryText}>{t('sparringTrust.checkin.scan')}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.heading} accessibilityRole="header">{t('sparringTrust.checkin.heading')}</Text>
        {body}
        {state.has_place !== false && (
          <TextAction label={t('sparringTrust.checkin.notWorking')} onPress={() => panel.openOverlay('help')} icon="help-circle-outline" />
        )}
      </View>
      <MeetingFeedbackCard panel={panel} sparringId={sparringId} sparringTitle={sparringTitle} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  heading: { fontSize: 16, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  text: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.accentBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.card },
});
