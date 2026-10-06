import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { SparringParticipant } from '../../types/database.types';
import { summarizeParticipants, initialsOf } from '../../utils/sparringDetail';
import { useTranslation } from 'react-i18next';

interface Props {
  participants:     SparringParticipant[];
  currentUserId:    string | null;
  hasStarted:       boolean;
  /** Shown while the participant list is still loading (slot holders count). */
  fallbackCount:    number;
  loading:          boolean;
  expanded:         boolean;
  onToggleExpanded: () => void;
}

const MAX_AVATARS = 5;

// Social summary of who takes part: headline, overlapping avatars (photo or
// initials), a short names line and the waitlist. The full list (status,
// attendance) stays reachable via "Alle Teilnehmer ansehen".
export default function SparringParticipantsSummary({
  participants, currentUserId, hasStarted, fallbackCount, loading, expanded, onToggleExpanded,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const summary = summarizeParticipants(participants, currentUserId);
  const count = loading && participants.length === 0 ? fallbackCount : summary.takingPart.length;
  const avatars = summary.takingPart.slice(0, MAX_AVATARS);
  const overflow = summary.takingPart.length - avatars.length;

  const headline = count === 0
    ? (hasStarted ? t('sparring.participants.nobodyWas') : t('sparring.participants.nobodyYet'))
    : hasStarted
      ? t('sparring.participants.headlinePast', { count })
      : t('sparring.participants.headlinePresent', { count });

  const details: string[] = [];
  if (summary.confirmedCount > 0 && !hasStarted) {
    details.push(t('sparring.participants.confirmedCount', { count: summary.confirmedCount }));
  }
  if (summary.waitlistCount > 0) {
    details.push(t('sparring.participants.waitlistCount', { count: summary.waitlistCount }));
  }
  const hasList = participants.some((p) => p.user_id !== currentUserId);

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>{headline}</Text>

      {avatars.length > 0 && (
        <View
          style={styles.avatarRow}
          accessible
          accessibilityLabel={summary.namesLine ?? headline}
        >
          {avatars.map((p, i) => (
            <View key={p.user_id} style={[styles.avatar, i > 0 && styles.avatarOverlap]}>
              {p.avatar_url !== null && p.avatar_url.length > 0 ? (
                <Image source={{ uri: p.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initialsOf(p.name)}</Text>
              )}
            </View>
          ))}
          {overflow > 0 && (
            <View style={[styles.avatar, styles.avatarOverlap, styles.avatarMore]}>
              <Text style={styles.avatarMoreText}>+{overflow}</Text>
            </View>
          )}
        </View>
      )}

      {summary.namesLine !== null && (
        <Text style={styles.names} numberOfLines={2}>{summary.namesLine}</Text>
      )}
      {count === 0 && !hasStarted && (
        <Text style={styles.names}>{t('sparring.participants.noCommitments')}</Text>
      )}
      {details.length > 0 && (
        <Text style={styles.details}>{details.join(' · ')}</Text>
      )}

      {hasList && (
        <TouchableOpacity
          style={styles.toggle}
          onPress={onToggleExpanded}
          activeOpacity={0.7}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.toggleText}>
            {expanded ? t('sparring.participants.hideList') : t('sparring.participants.showList')}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accentBlue} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const AVATAR_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  headline: {
    fontSize:   18,
    fontWeight: '700',
    color:      colors.text,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  avatar: {
    width:           AVATAR_SIZE,
    height:          AVATAR_SIZE,
    borderRadius:    AVATAR_SIZE / 2,
    backgroundColor: colors.accentBlueSoft,
    borderWidth:     2,
    borderColor:     colors.card,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarImage: {
    width:  '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.accentBlue,
  },
  avatarMore: {
    backgroundColor: colors.background,
  },
  avatarMoreText: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.text,
  },
  names: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.text,
  },
  details: {
    fontSize: 13,
    color:    colors.textSecondary,
  },
  toggle: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:             8,
    alignSelf:       'flex-start',
    paddingVertical: 8,
  },
  toggleText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
});
