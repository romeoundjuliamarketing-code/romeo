import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { SparringParticipant } from '../../types/database.types';
import { summarizeParticipants, initialsOf } from '../../utils/sparringDetail';
import { useTranslation } from 'react-i18next';
import { avatarTone } from '../../utils/avatarTone';

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

const MAX_AVATARS = 4;
// One tappable line of who takes part: overlapping avatars (photo or
// initials), the count and the waitlist. Tapping opens the full list.
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
      ? t('sparring.invite.peopleWere', { count })
      : t('sparring.invite.peopleIn', { count });
  const detail = summary.waitlistCount > 0
    ? t('sparring.participants.waitlistCount', { count: summary.waitlistCount })
    : count === 0 && !hasStarted
      ? t('sparring.participants.noCommitments')
      : null;
  const hasList = participants.some((p) => p.user_id !== currentUserId);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && hasList && styles.rowPressed]}
      onPress={onToggleExpanded}
      disabled={!hasList}
      accessibilityRole={hasList ? 'button' : undefined}
      accessibilityLabel={[headline, detail].filter((v) => v !== null).join('. ')}
      accessibilityHint={hasList ? (expanded ? t('sparring.invite.closeList') : t('sparring.invite.openList')) : undefined}
      accessibilityState={hasList ? { expanded } : undefined}
    >
      {avatars.length > 0 && (
        <View style={styles.avatars}>
          {avatars.map((p, i) => (
            <View
              key={p.user_id}
              style={[styles.avatar, i > 0 && styles.avatarOverlap, { zIndex: MAX_AVATARS - i, backgroundColor: avatarTone(p.user_id) }]}
            >
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

      <Text style={styles.texts} numberOfLines={2}>
        <Text style={styles.headline}>{headline}</Text>
        {detail !== null && <Text style={styles.detail}>{`  ·  ${detail}`}</Text>}
      </Text>

      {hasList && (
        <View style={styles.view}>
          <Text style={styles.viewText}>{expanded ? t('sparring.invite.hide') : t('sparring.invite.view')}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={16} color={colors.accentBlueText} />
        </View>
      )}
    </Pressable>
  );
}

const AVATAR_SIZE = 28;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    minHeight:     44,
  },
  rowPressed: {
    opacity: 0.7,
  },
  avatars: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  avatar: {
    width:          AVATAR_SIZE,
    height:         AVATAR_SIZE,
    borderRadius:   AVATAR_SIZE / 2,
    borderWidth:    2,
    borderColor:    colors.background,
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarImage: {
    width:  '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize:   11,
    fontWeight: '800',
    color:      colors.text,
  },
  avatarMore: {
    backgroundColor: colors.text,
  },
  avatarMoreText: {
    fontSize:   10,
    fontWeight: '800',
    color:      colors.card,
  },
  texts: {
    flex: 1,
  },
  headline: {
    fontSize:   15,
    lineHeight: 20,
    fontWeight: '700',
    color:      colors.text,
  },
  detail: {
    fontSize: 14,
    color:    colors.textMuted,
  },
  view: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  viewText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.accentBlueText,
  },
});
