import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CoachNominationDetails } from '../../types/database.types';

interface Props {
  nomination: CoachNominationDetails;
  onConfirm: () => void;
  onReject: () => void;
  loading: boolean;
}

export default function NominationCard({
  nomination,
  onConfirm,
  onReject,
  loading,
}: Props): React.ReactElement {
  const isPromote = nomination.type === 'promote';
  const nominee = nomination.nominee_name ?? 'Unbekannt';
  const nominator = nomination.nominator_name ?? 'Unbekannt';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, !isPromote && styles.iconWrapDemote]}>
          <MaterialCommunityIcons
            name={isPromote ? 'arrow-up-circle' : 'arrow-down-circle'}
            size={20}
            color={isPromote ? colors.accentBlue : colors.deleteRed}
          />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>
            <Text style={styles.bold}>{nominee}</Text>
            {isPromote ? ' soll Trainer werden' : ' soll Trainer-Rolle abgeben'}
          </Text>
          <Text style={styles.sub}>Vorgeschlagen von {nominator}</Text>
        </View>
      </View>

      {nomination.has_voted && (
        <Text style={styles.votedNote}>Bereits abgestimmt</Text>
      )}

      {!nomination.has_voted && (nomination.can_confirm || nomination.can_reject) && (
        <View style={styles.actions}>
          {nomination.can_confirm && (
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.headerTextPrimary} />
              ) : (
                <Text style={styles.confirmLabel}>Bestätigen</Text>
              )}
            </TouchableOpacity>
          )}
          {nomination.can_reject && (
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={onReject}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.rejectLabel}>Ablehnen</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDemote: {
    backgroundColor: 'rgba(217,74,74,0.1)',
  },
  textBlock: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
  sub: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  votedNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  rejectBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
