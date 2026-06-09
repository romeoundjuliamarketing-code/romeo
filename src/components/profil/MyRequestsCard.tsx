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
import { colors } from '../../theme/colors';
import { useMyStudioRequests } from '../../hooks/useMyStudioRequests';
import { useMembershipActions } from '../../hooks/useMembershipActions';
import { formatPrice, billingIntervalLabel } from '../../utils/formatPrice';

const TRIAL_STATUS_LABELS: Record<string, string> = {
  pending:   'Ausstehend',
  confirmed: 'Bestätigt',
  declined:  'Abgelehnt',
  cancelled: 'Abgebrochen',
};

const TRIAL_STATUS_COLORS: Record<string, string> = {
  pending:   colors.accentBlue,
  confirmed: colors.difficultyGreen,
  declined:  colors.deleteRed,
  cancelled: colors.textSecondary,
};

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  pending:                'Ausstehend',
  active:                 'Aktiv',
  cancellation_requested: 'Kündigung läuft',
  ended:                  'Beendet',
  declined:               'Abgelehnt',
};

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  pending:                colors.accentBlue,
  active:                 colors.difficultyGreen,
  cancellation_requested: colors.sparringsOrange,
  ended:                  colors.textSecondary,
  declined:               colors.deleteRed,
};

interface Props {
  refetchTrigger?: number;
}

export default function MyRequestsCard({ refetchTrigger = 0 }: Props): React.ReactElement | null {
  const { trialBookings, contracts, loading, refetch, cancelTrial } = useMyStudioRequests(refetchTrigger);
  const { requestCancellation } = useMembershipActions();

  async function handleCancelTrial(id: string): Promise<void> {
    const { error } = await cancelTrial(id);
    if (error !== null) Alert.alert('Fehler', error);
  }

  async function handleCancelMembership(contractId: string): Promise<void> {
    Alert.alert(
      'Mitgliedschaft kündigen',
      'Möchtest du deine Mitgliedschaft wirklich kündigen? Das Studio wird informiert.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Kündigen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await requestCancellation(contractId);
            if (error !== null) {
              Alert.alert('Fehler', error);
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
        <Text style={styles.sectionLabel}>Meine Anfragen</Text>
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
          <Text style={styles.sectionLabel}>Meine Anfragen</Text>
          {trialBookings.map((booking, idx) => {
            const statusColor = TRIAL_STATUS_COLORS[booking.status] ?? colors.textSecondary;
            return (
              <View key={booking.id} style={[styles.row, idx > 0 && styles.rowBorder]}>
                <View style={styles.info}>
                  <Text style={styles.studioName} numberOfLines={1}>{booking.studio_name}</Text>
                  <Text style={styles.meta}>
                    Probetraining · {booking.requested_date.split('-').reverse().join('.')}
                  </Text>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {TRIAL_STATUS_LABELS[booking.status] ?? booking.status}
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
            Meine Mitgliedschaften
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
                    {CONTRACT_STATUS_LABELS[contract.status] ?? contract.status}
                  </Text>
                </View>
                {contract.status === 'active' && (
                  <TouchableOpacity
                    style={styles.cancelMembershipBtn}
                    onPress={() => { void handleCancelMembership(contract.id); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.cancelMembershipLabel}>Kündigen</Text>
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
