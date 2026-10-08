import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { TextAction } from '../../common/TextAction';
import { useLanguage } from '../../../i18n/language';
import { localeFor } from '../../../utils/language';
import { formatDate } from '../../../utils/formatDate';
import { SPARRING_TRUST } from '../../../data/sparringConfig';
import { formatTooFarKm, trustNoticeFor, type TrustAction } from '../../../utils/sparringTrust';
import type { TrustRefusal } from '../../../types/sparringTrust';
import type { FixError } from '../../../hooks/useDeviceFix';
import type de from '../../../i18n/locales/de';

// What went wrong with a binding action: a server refusal, a device location
// problem, or no connection. Always explained in words with a way forward;
// never a bare disabled button or a technical code.
export type TrustProblem =
  | { kind: 'refused'; refusal: TrustRefusal }
  | { kind: 'location'; error: FixError }
  | { kind: 'network' };

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const LOCATION_KEY: Record<FixError, keyof typeof de.sparringTrust.location> = {
  services_off: 'servicesOff',
  denied: 'denied',
  blocked: 'blocked',
  imprecise: 'imprecise',
  timeout: 'timeout',
  inaccurate: 'inaccurate',
  unavailable: 'unavailable',
};

function locationActions(error: FixError): TrustAction[] {
  switch (error) {
    case 'services_off':
    case 'blocked':
    case 'imprecise':
      return ['settings', 'retry'];
    default:
      return ['retry'];
  }
}

export default function TrustNoticeCard({ problem, onAction }: {
  problem: TrustProblem;
  onAction: (action: TrustAction) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const locale = localeFor(language);

  let icon: IconName = 'information-circle-outline';
  let lines: string[];
  let actions: TrustAction[];

  if (problem.kind === 'network') {
    icon = 'cloud-offline-outline';
    lines = [t('sparringTrust.notice.network')];
    actions = ['retry'];
  } else if (problem.kind === 'location') {
    icon = 'location-outline';
    lines = [t('sparringTrust.notice.locationMissing'), t(`sparringTrust.location.${LOCATION_KEY[problem.error]}` as const)];
    actions = locationActions(problem.error);
  } else {
    const r = problem.refusal;
    const notice = trustNoticeFor(r.reason);
    actions = notice.actions;
    const radius = r.radius_km ?? SPARRING_TRUST.radiusBaseKm;
    if (r.reason === 'too_far') {
      icon = 'navigate-circle-outline';
      const distance = formatTooFarKm(r.distance_m, radius, locale);
      lines = [distance !== null
        ? t('sparringTrust.notice.tooFar', { distance, radius })
        : t('sparringTrust.notice.tooFarUnknown', { radius })];
      if (r.unlocked !== true) {
        lines.push(t('sparringTrust.notice.tooFarHint', { km: SPARRING_TRUST.radiusUnlockedKm }));
      }
    } else if (r.reason === 'rate_limited') {
      icon = 'time-outline';
      const time = r.next_publish_at ? formatDate(r.next_publish_at, 'dateTime', language) : '';
      lines = [t('sparringTrust.notice.rateLimited', { time })];
    } else if (r.reason === 'slot_taken') {
      icon = 'calendar-outline';
      lines = [t('sparringTrust.notice.slotTaken')];
    } else if (r.reason === 'checkin_not_open') {
      icon = 'time-outline';
      const time = r.opens_at ? formatDate(r.opens_at, 'dateTime', language) : '';
      lines = [t('sparringTrust.notice.checkinNotOpen', { time })];
    } else if (r.reason === 'too_far_from_venue') {
      icon = 'location-outline';
      lines = [t('sparringTrust.notice.tooFarFromVenue', { meters: SPARRING_TRUST.checkinRadiusM })];
    } else {
      lines = [t(`sparringTrust.notice.${notice.key}` as const)];
    }
  }

  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.row}>
        <Ionicons name={icon} size={24} color={colors.text} />
        <View style={styles.texts}>
          {lines.map((line) => <Text key={line} style={styles.text}>{line}</Text>)}
        </View>
      </View>
      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map((a) => (
            <TextAction key={a} label={t(`sparringTrust.actions.${a}` as const)} onPress={() => onAction(a)} />
          ))}
        </View>
      )}
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
  row: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  texts: { flex: 1, gap: 8 },
  text: { fontSize: 15, lineHeight: 22, color: colors.text },
  actions: { paddingLeft: 40 },
});
