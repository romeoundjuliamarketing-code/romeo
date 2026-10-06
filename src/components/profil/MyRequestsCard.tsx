import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { useMyStudioRequests } from '../../hooks/useMyStudioRequests';
import { useMembershipActions } from '../../hooks/useMembershipActions';
import { formatPrice, billingIntervalLabel } from '../../utils/formatPrice';
import { formatDate } from '../../utils/formatDate';
import { useLanguage } from '../../i18n/language';

const TRIAL_STATUS_KEYS = {
  pending:   'profile.requests.trialStatus.pending',
  confirmed: 'profile.requests.trialStatus.confirmed',
  declined:  'profile.requests.trialStatus.declined',
  cancelled: 'profile.requests.trialStatus.cancelled',
} as const;

const TRIAL_STATUS_COLORS: Record<string, string> = {
  pending:   colors.accentBlue,
  confirmed: colors.difficultyGreen,
  declined:  colors.deleteRed,
  cancelled: colors.textSecondary,
};

const CONTRACT_STATUS_KEYS = {
  pending:                'profile.requests.contractStatus.pending',
  active:                 'profile.requests.contractStatus.active',
  cancellation_requested: 'profile.requests.contractStatus.cancellation_requested',
  ended:                  'profile.requests.contractStatus.ended',
  declined:               'profile.requests.contractStatus.declined',
} as const;

// Local date parts, so a date-only string never shifts across a time zone.
function formatRequestedDate(iso: string, language: 'de' | 'en'): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return formatDate(new Date(y, m - 1, d), 'date', language);
}

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  pending:                colors.accentBlue,
  active:                 colors.difficultyGreen,
  cancellation_requested: colors.sparringsOrange,
  ended:                  colors.textSecondary,
  declined:               colors.deleteRed,
};

interface Props {
  refetchTrigger?: number;
  /** Only this studio's entries that are still running (gym page, legacy access). */
  studioId?: string;
}

// Running = still has consequences: an open or upcoming trial, a contract
// that has not ended. Shared with the gym page to decide whether to offer it.
export function isRunningTrial(b: { status: string; requested_date: string }): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return b.status === 'pending' || (b.status === 'confirmed' && b.requested_date >= today);
}
export function isRunningContract(c: { status: string }): boolean {
  return c.status === 'pending' || c.status === 'active' || c.status === 'cancellation_requested';
}

export default function MyRequestsCard({ refetchTrigger = 0, studioId }: Props): React.ReactElement | null {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const all = useMyStudioRequests(refetchTrigger);
  const { loading, refetch, cancelTrial } = all;
  const trialBookings = studioId === undefined
    ? all.trialBookings
    : all.trialBookings.filter((b) => b.studio_id === studioId && isRunningTrial(b));
  const contracts = studioId === undefined
    ? all.contracts
    : all.contracts.filter((c) => c.studio_id === studioId && isRunningContract(c));
  const { requestCancellation } = useMembershipActions();

  function statusLabel<K extends string>(keys: Record<string, K>, status: string): string {
    const key = keys[status];
    return key !== undefined ? t(key as never) : status;
  }

  async function handleCancelTrial(id: string): Promise<void> {
    const { error } = await cancelTrial(id);
    if (error !== null) Alert.alert(t('common.error'), error);
  }

  async function handleCancelMembership(contractId: string): Promise<void> {
    Alert.alert(
      t('profile.requests.cancelTitle'),
      t('profile.requests.cancelMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.requests.cancelAction'),
          style: 'destructive',
          onPress: async () => {
            const { error } = await requestCancellation(contractId);
            if (error !== null) {
              Alert.alert(t('common.error'), error);
              return;
            }
            refetch();
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('profile.requests.title')}</Text>
        <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
      </View>
    );
  }

  if (trialBookings.length === 0 && contracts.length === 0) return null;

  return (
    <View style={styles.card}>
      {/* Trial bookings section */}
      {trialBookings.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>{t('profile.requests.title')}</Text>
          {trialBookings.map((booking, idx) => {
            const statusColor = TRIAL_STATUS_COLORS[booking.status] ?? colors.textSecondary;
            return (
              <View key={booking.id} style={[styles.row, idx > 0 && styles.rowBorder]}>
                <View style={styles.info}>
                  <Text style={styles.studioName} numberOfLines={1}>{booking.studio_name}</Text>
                  <Text style={styles.meta}>
                    {t('profile.requests.trial')} · {formatRequestedDate(booking.requested_date, language)}
                  </Text>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {statusLabel(TRIAL_STATUS_KEYS, booking.status)}
                  </Text>
                </View>
                {booking.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => { void handleCancelTrial(booking.id); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.deleteRed} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </>
      )}

      {/* Membership contracts section */}
      {contracts.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, trialBookings.length > 0 && styles.sectionLabelMarginTop]}>
            {t('profile.requests.memberships')}
          </Text>
          {contracts.map((contract, idx) => {
            const statusColor = CONTRACT_STATUS_COLORS[contract.status] ?? colors.textSecondary;
            return (
              <View key={contract.id} style={[styles.row, idx > 0 && styles.rowBorder]}>
                <View style={styles.info}>
                  <Text style={styles.studioName} numberOfLines={1}>{contract.studio_name}</Text>
                  <Text style={styles.meta}>
                    {contract.plan_name_snapshot}
                    {'  ·  '}
                    {formatPrice(contract.price_cents_snapshot)}/{billingIntervalLabel(contract.billing_interval_snapshot === 'yearly' ? 'yearly' : 'monthly')}
                  </Text>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {statusLabel(CONTRACT_STATUS_KEYS, contract.status)}
                  </Text>
                </View>
                {contract.status === 'active' && (
                  <TouchableOpacity
                    style={styles.cancelMembershipBtn}
                    onPress={() => { void handleCancelMembership(contract.id); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.cancelMembershipLabel}>{t('profile.requests.cancelAction')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  loader: {
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  studioName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionLabelMarginTop: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconBtn: {
    padding: 4,
  },
  cancelMembershipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.deleteRedSoft,
    borderWidth: 1,
    borderColor: colors.deleteRed,
  },
  cancelMembershipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.deleteRed,
  },
});
