import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { appointmentDayLabel, timeLabel } from '../../utils/homeAgenda';

export interface ChatParticipant {
  id:        string;
  name:      string | null;
  avatarUrl: string | null;
}

interface Props {
  title:          string;
  scheduledAt:    string;
  /** Null until the sparring details are loaded. */
  address:        string | null;
  participants:   ChatParticipant[];
  maxSlots:       number | null;
  currentUserId:  string | null;
  topInset:       number;
  onBack:         () => void;
  onOptions:      () => void;
  onParticipants: () => void;
  onAddress:      () => void;
}

const MAX_AVATARS = 3;
const AVATAR_SIZE = 24;
const HIT         = { top: 10, bottom: 10, left: 8, right: 8 };

function initial(name: string | null): string {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
}

// Navigation and sparring facts as one compact block: back / title / options,
// then a soft blue panel with the date as the main fact, the place below and
// the participants as a small avatar group that opens the participant list.
function SparringChatHeader({
  title, scheduledAt, address, participants, maxSlots, currentUserId, topInset,
  onBack, onOptions, onParticipants, onAddress,
}: Props) {
  const { t } = useTranslation();
  const startsAt = new Date(scheduledAt);
  const dateLine = t('chat.sparring.dateTime', {
    day:  appointmentDayLabel(startsAt, new Date()),
    time: timeLabel(startsAt),
  });

  // Own avatar first, then the others (only real sign-ups).
  const ordered  = [
    ...participants.filter((p) => p.id === currentUserId),
    ...participants.filter((p) => p.id !== currentUserId),
  ];
  const shown    = ordered.slice(0, MAX_AVATARS);
  const overflow = participants.length - shown.length;
  const count    = participants.length;

  return (
    <View style={[styles.wrap, { paddingTop: topInset }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onOptions}
          accessibilityRole="button"
          accessibilityLabel={t('chat.sparring.options')}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.panel}>
        <Text style={styles.date}>{dateLine}</Text>
        <View style={styles.panelRow}>
          {address !== null ? (
            <TouchableOpacity
              style={styles.place}
              onPress={onAddress}
              hitSlop={HIT}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={t('chat.sparring.addressA11y', { address })}
            >
              <Ionicons name="location-outline" size={16} color={colors.accentBlueText} />
              <Text style={styles.placeText} numberOfLines={1}>{address}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.place} />
          )}

          {maxSlots !== null && (
            <TouchableOpacity
              style={styles.people}
              onPress={onParticipants}
              hitSlop={HIT}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={t('chat.sparring.participantsA11y', { count, max: maxSlots })}
            >
              {shown.length > 0 && (
                <View style={styles.avatars}>
                  {shown.map((p, i) => (
                    <View key={p.id} style={[styles.avatar, i > 0 && styles.avatarOverlap]}>
                      {p.avatarUrl !== null ? (
                        <Image source={{ uri: p.avatarUrl }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarInitial}>{initial(p.name)}</Text>
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
              <Text style={styles.peopleText}>{t('chat.sparring.signedUp', { count, max: maxSlots })}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.accentBlueText} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default React.memo(SparringChatHeader);

const styles = StyleSheet.create({
  wrap: {
    backgroundColor:   colors.background,
    paddingBottom:     8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.fieldBorder,
  },
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 8,
    minHeight:         48,
  },
  iconBtn: {
    width:          48,
    height:         48,
    alignItems:     'center',
    justifyContent: 'center',
  },
  title: {
    flex:       1,
    fontSize:   17,
    fontWeight: '700',
    color:      colors.text,
    textAlign:  'center',
  },
  panel: {
    marginHorizontal:  16,
    marginTop:         0,
    paddingHorizontal: 16,
    paddingTop:        8,
    paddingBottom:     8,
    borderRadius:      16,
    backgroundColor:   colors.accentBlueTint,
  },
  date: {
    fontFamily: fonts.display,
    fontSize:   24,
    lineHeight: 32,
    color:      colors.text,
    textTransform: 'uppercase',
  },
  panelRow: {
    flexDirection:  'row',
    alignItems:     'center',
    flexWrap:       'wrap',
    columnGap:      16,
    rowGap:         8,
    paddingBottom:  4,
  },
  place: {
    flex:          1,
    minWidth:      128,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    minHeight:     24,
  },
  placeText: {
    flexShrink: 1,
    fontSize:   14,
    fontWeight: '500',
    color:      colors.accentBlueText,
  },
  people: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    minHeight:     24,
  },
  avatars: {
    flexDirection: 'row',
  },
  avatar: {
    width:           AVATAR_SIZE,
    height:          AVATAR_SIZE,
    borderRadius:    AVATAR_SIZE / 2,
    borderWidth:     2,
    borderColor:     colors.accentBlueTint,
    backgroundColor: colors.card,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarImg: {
    width:  AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarInitial: {
    fontSize:   11,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  avatarMore: {
    backgroundColor: colors.accentBlue,
  },
  avatarMoreText: {
    fontSize:   10,
    fontWeight: '700',
    color:      colors.card,
  },
  peopleText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.text,
  },
});
