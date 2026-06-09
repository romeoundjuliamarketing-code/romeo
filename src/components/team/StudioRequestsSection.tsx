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
import { useStudioRequests } from '../../hooks/useStudioRequests';
import { useMembershipActions } from '../../hooks/useMembershipActions';
import { formatPrice } from '../../utils/formatPrice';

interface Props {
  studioId: string;
}

export default function StudioRequestsSection({ studioId }: Props): React.ReactElement {
  const {
    trialBookings,
    membershipRequests,
    cancellationRequests,
    loading,
    refetch,
    respondTrial,
  } = useStudioRequests(studioId);
  const { respondMembership, confirmEnd } = useMembershipActions();

  const totalCount = trialBookings.length + membershipRequests.length + cancellationRequests.length;

  async function handleRespondTrial(id: string, confirm: boolean): Promise<void> {
    const { error } = await respondTrial(id, confirm);
    if (error !== null) Alert.alert('Fehler', error);
  }

  async function handleRespondMembership(id: string, confirm: boolean): Promise<void> {
    const { error } = await respondMembership(id, confirm);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    refetch();
  }

  async function handleConfirmEnd(id: string): Promise<void> {
    const { error } = await confirmEnd(id);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    refetch();
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Anfragen</Text>
        <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
      </View>
    );
  }

  if (totalCount === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Anfragen</Text>
        <Text style={styles.emptyText}>Keine offenen Anfragen.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>Anfragen</Text>

      {/* Trial booking requests */}
      {trialBookings.map((booking, idx) => (
        <View
          key={booking.id}
          style={[styles.requestRow, idx > 0 && styles.requestRowBorder]}
        >
          <View style={styles.requestInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {booking.user_name ?? 'Unbekannt'}
            </Text>
            <Text style={styles.requestMeta}>
              Probetraining · {booking.requested_date.split('-').reverse().join('.')}
            </Text>
            {booking.note !== null && booking.note.length > 0 && (
              <Text style={styles.noteText} numberOfLines={2}>
                {booking.note}
              </Text>
            )}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => { void handleRespondTrial(booking.id, true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="check" size={18} color={colors.difficultyGreen} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => { void handleRespondTrial(booking.id, false); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close" size={18} color={colors.deleteRed} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Membership requests (pending) */}
      {membershipRequests.length > 0 && (
        <>
          <Text style={styles.subLabel}>Mitgliedschaftsanfragen</Text>
          {membershipRequests.map((contract, idx) => (
            <View
              key={contract.id}
              style={[styles.requestRow, idx > 0 && styles.requestRowBorder]}
            >
              <View style={styles.requestInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {contract.user_name ?? 'Unbekannt'}
                </Text>
                <Text style={styles.requestMeta}>
                  {contract.plan_name_snapshot}
                  {'  ·  '}
                  {formatPrice(contract.price_cents_snapshot)}
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={() => { void handleRespondMembership(contract.id, true); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="check" size={18} color={colors.difficultyGreen} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => { void handleRespondMembership(contract.id, false); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close" size={18} color={colors.deleteRed} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Cancellation requests */}
      {cancellationRequests.length > 0 && (
        <>
          <Text style={styles.subLabel}>Kündigungen</Text>
          {cancellationRequests.map((contract, idx) => (
            <View
              key={contract.id}
              style={[styles.requestRow, idx > 0 && styles.requestRowBorder]}
            >
              <View style={styles.requestInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {contract.user_name ?? 'Unbekannt'}
                </Text>
                <Text style={styles.requestMeta}>
                  {contract.plan_name_snapshot}
                  {'  ·  '}
                  Kündigung angefordert
                </Text>
              </View>
              {/* Single confirm-end button */}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => { void handleConfirmEnd(contract.id); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="check" size={18} color={colors.difficultyGreen} />
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  requestRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  requestInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  requestMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  noteText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.difficultyGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.deleteRedSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
