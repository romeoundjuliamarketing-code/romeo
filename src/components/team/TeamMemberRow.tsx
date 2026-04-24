import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { Profile } from '../../types/database.types';

function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

interface Props {
  rank: number;
  member: Profile;
  isCurrentUser: boolean;
  hasActions: boolean;
  weightKg?: number | null;
  onActionPress: () => void;
}

export default function TeamMemberRow({
  rank,
  member,
  isCurrentUser,
  hasActions,
  weightKg = null,
  onActionPress,
}: Props): React.ReactElement {
  const isTopRank = rank <= 3;

  return (
    <View style={[styles.row, isCurrentUser && styles.rowSelf]}>
      {/* Rank — hidden if member opted out of showing points */}
      <Text style={[styles.rank, isTopRank && styles.rankTop]}>
        {member.show_points_in_group !== false ? rank : '–'}
      </Text>

      {/* Avatar */}
      <View style={[styles.avatar, isCurrentUser && styles.avatarSelf]}>
        <Text style={styles.avatarText}>{getInitials(member.name)}</Text>
      </View>

      {/* Name + badges */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {member.name ?? 'Unbekannt'}
          </Text>
          {member.is_coach && (
            <View style={styles.coachBadge}>
              <MaterialCommunityIcons name="shield-star" size={11} color={colors.accentBlue} />
              <Text style={styles.coachLabel}>Trainer</Text>
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          {member.show_points_in_group !== false && (
            <Text style={styles.points}>{member.total_points} Pkt.</Text>
          )}
          {weightKg !== null && member.show_weight_in_group !== false && (
            <Text style={styles.weight}>{weightKg} kg</Text>
          )}
        </View>
      </View>

      {/* Actions */}
      {hasActions ? (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onActionPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.actionPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowSelf: {
    backgroundColor: colors.accentBlueSoft,
  },
  rank: {
    width: 24,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  rankTop: {
    color: colors.accentBlue,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.darkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelf: {
    backgroundColor: colors.accentBlueSoft,
    borderWidth: 2,
    borderColor: colors.accentBlue,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  coachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coachLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  points: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  weight: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  actionBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPlaceholder: {
    width: 32,
  },
});
