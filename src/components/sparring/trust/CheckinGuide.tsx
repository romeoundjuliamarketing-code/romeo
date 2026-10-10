import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { useLanguage } from '../../../i18n/language';
import { formatDate } from '../../../utils/formatDate';
import { checkinPhase } from '../../../utils/sparringTrust';
import type { SparringTrustState } from '../../../types/sparringTrust';

// Role-based how-to for the QR check-in of the first sparring (Home). Uses the
// server's check-in window: only while it is open does the box lead to the
// sparring, where the existing check-in (scanner / QR code) lives. Before and
// after it, it is plain information — no dead buttons.
export default function CheckinGuide({ state, serverNowMs, onOpen }: {
  state: SparringTrustState;
  serverNowMs: number;
  onOpen: () => void;
}): React.ReactElement | null {
  const { t } = useTranslation();
  const { language } = useLanguage();
  if (state.cancelled === true || state.role === 'none') return null;

  const isOrganizer = state.role === 'organizer';
  const opensAt = state.checkin_opens_at;
  const closesAt = state.checkin_closes_at;
  const phase = opensAt !== undefined && closesAt !== undefined
    ? checkinPhase(opensAt, closesAt, serverNowMs)
    : 'closed';
  const checkedIn = !isOrganizer && (state.checked_in_at ?? null) !== null;

  let title: string = isOrganizer ? t('sparringTrust.status.guideOrganizer') : t('sparringTrust.status.guideParticipant');
  let detail: string | null = null;
  let action: string | null = null;
  if (state.has_place === false) {
    detail = t('sparringTrust.notice.placeUnknown');
  } else if (checkedIn) {
    title = t('sparringTrust.status.guideCheckedIn');
  } else if (phase === 'before' && opensAt !== undefined) {
    detail = t('sparringTrust.status.guideOpensAt', { time: formatDate(opensAt, 'dateTime', language) });
  } else if (phase === 'open') {
    action = isOrganizer ? t('sparringTrust.status.guideOpenShow') : t('sparringTrust.status.guideOpenScan');
  } else {
    detail = t('sparringTrust.status.guideClosed');
  }

  const content = (
    <>
      <Ionicons name={checkedIn ? 'checkmark-circle-outline' : 'qr-code-outline'} size={24} color={colors.text} />
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {detail !== null && <Text style={styles.detail}>{detail}</Text>}
        {action !== null && (
          <View style={styles.actionRow}>
            <Text style={styles.action}>{action}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.accentBlueText} />
          </View>
        )}
      </View>
    </>
  );

  if (action === null) return <View style={styles.box}>{content}</View>;
  return (
    <TouchableOpacity style={styles.box} onPress={onOpen} activeOpacity={0.7} accessibilityRole="button">
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  texts: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.text,
  },
  detail: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 24,
  },
  action: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
});
