import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import {
  appointmentDayLabel, timeLabel, sparringCardState, confirmDeadline, homeSparringTitle,
  dateBlockParts, participantsPreview,
} from '../../utils/homeAgenda';
import type { HomeSparring, SparringCardState } from '../../utils/homeAgenda';
import { initialsOf } from '../../utils/sparringDetail';
import TicketRopes from './TicketRopes';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

interface Props {
  sparring:      HomeSparring;
  now:           Date;
  currentUserId: string | null;
  upcomingCount: number;
  chatUnread:    number;
  confirming:    boolean;
  confirmError:  string | null;
  onConfirm:     () => void;
  onDetails:     () => void;
  onChat:        () => void;
  onAll:         () => void;
}

const STATUS = {
  host:      { icon: 'person-outline',       textKey: 'home.next.statusHost' },
  confirm:   { icon: 'alert-circle-outline', textKey: 'home.next.statusConfirm' },
  in:        { icon: 'checkmark',            textKey: 'home.next.statusIn' },
  confirmed: { icon: 'checkmark-done',       textKey: 'home.next.statusConfirmed' },
} as const satisfies Record<SparringCardState, { icon: React.ComponentProps<typeof Ionicons>['name']; textKey: string }>;

// "bis heute, 12:30 Uhr" / "bis Fr., 2. Okt., 12:30 Uhr"
function deadlineText(deadline: Date, now: Date): string {
  const day = appointmentDayLabel(deadline, now);
  const dayLower = day === i18n.t('home.agenda.today') || day === i18n.t('home.agenda.tomorrow') ? day.toLowerCase() : day;
  return i18n.t('home.next.deadline', { day: dayLower, time: timeLabel(deadline) });
}

// Home's next sparring as an event ticket: deep blue surface with faint ring
// ropes on the right, a cream date block next to time and place in white sport
// type, a compact status chip, participants and the chat as a small side action.
// A set-off strip at the bottom opens the sparring. Date block, time/place block
// and participants open the details as sibling targets; the chat is its own
// target next to them (no nested pressables).
export default function HomeNextSparring({
  sparring, now, currentUserId, upcomingCount, chatUnread, confirming, confirmError,
  onConfirm, onDetails, onChat, onAll,
}: Props) {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const startsAt = new Date(sparring.scheduledAt);
  const state    = sparringCardState(sparring, now);
  const status   = STATUS[state];
  const title    = homeSparringTitle(sparring.title, sparring.locationLabel);
  const block    = dateBlockParts(startsAt, now);
  const time     = t('home.next.clock', { time: timeLabel(startsAt) });
  const isToday  = appointmentDayLabel(startsAt, now) === t('home.agenda.today');
  // Little room: fewer decorative avatars first, the count text always stays.
  const maxAvatars = fontScale > 1.6 ? 0 : width < 360 || fontScale > 1.3 ? 2 : 3;
  const people   = participantsPreview(sparring.participants, currentUserId, maxAvatars);
  const alert    = state === 'confirm';
  const deadline = alert ? confirmDeadline(sparring.scheduledAt, now) : null;
  // The city leads (last part of the location label); an own title and the gym
  // follow as a quiet line when they add information.
  const city  = sparring.locationLabel.split(',').map((p) => p.trim()).filter((p) => p.length > 0).pop() ?? null;
  const place = city ?? title.text;
  const meta  = [
    title.isPlace || title.text === place ? null : title.text,
    sparring.gymName !== null && sparring.gymName !== place ? sparring.gymName : null,
  ].filter((part): part is string => part !== null).join(' · ');

  const a11yLabel = [
    isToday ? `${t('home.agenda.today')}, ${time}` : `${appointmentDayLabel(startsAt, now)}, ${time}`,
    place, meta, t(status.textKey), people.label,
  ].filter((part): part is string => part !== null && part.length > 0).join(', ');

  const avatarStack = people.shown.length === 0 ? null : (
    <View style={styles.avatars}>
      {people.shown.map((p, i) => (
        <View key={p.userId} style={[styles.avatar, i > 0 && styles.avatarOverlap]}>
          {p.avatarUrl !== null && p.avatarUrl.length > 0
            ? <Image source={{ uri: p.avatarUrl }} style={styles.avatarImage} />
            : <Text style={styles.avatarInitials}>{initialsOf(p.name)}</Text>}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <TicketRopes />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.heading} accessibilityRole="header">{t('home.next.heading')}</Text>
          {upcomingCount > 1 && (
            <TouchableOpacity
              style={styles.allLink}
              onPress={onAll}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('home.next.allLabel', { count: upcomingCount })}
            >
              <Text style={styles.allLinkText}>{t('home.next.all')}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.headerTextPrimary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.entry}>
          <TouchableOpacity
            style={styles.dateBox}
            onPress={onDetails}
            activeOpacity={0.7}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.weekday}>{block.weekday}</Text>
            <Text style={styles.day}>{block.day}</Text>
            <Text style={styles.month}>{block.month}</Text>
            {block.year !== null && <Text style={styles.month}>{block.year}</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.info}
            onPress={onDetails}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityHint={t('home.next.openHint')}
          >
            <Text style={styles.time}>{isToday ? `${t('home.agenda.today')} · ${time}` : time}</Text>
            <Text style={styles.place}>{place}</Text>
            {meta.length > 0 && <Text style={styles.meta}>{meta}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.statusChip} accessible={false} importantForAccessibility="no-hide-descendants">
          <Ionicons name={status.icon} size={16} color={colors.headerTextPrimary} />
          <Text style={styles.statusText}>{t(status.textKey)}</Text>
        </View>

        <View style={styles.peopleRow}>
          {(people.label !== null || avatarStack !== null) && (
            <TouchableOpacity
              style={styles.people}
              onPress={onDetails}
              activeOpacity={0.7}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              {avatarStack}
              {people.label !== null && <Text style={styles.peopleText} numberOfLines={2}>{people.label}</Text>}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.chat}
            onPress={onChat}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={chatUnread > 0 ? t('home.next.chatUnread', { count: chatUnread }) : t('home.next.chat')}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={colors.headerTextPrimary} />
            <Text style={styles.chatText}>{t('home.next.chatShort')}</Text>
            {chatUnread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{chatUnread > 99 ? '99+' : String(chatUnread)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {alert && (
          <View style={styles.confirmArea}>
            <Text style={styles.hint}>
              {deadline !== null ? deadlineText(deadline, now) : t('home.next.confirmPrompt')}
            </Text>
            <TouchableOpacity
              style={[styles.confirm, confirming && styles.confirmBusy]}
              onPress={onConfirm}
              disabled={confirming}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ busy: confirming, disabled: confirming }}
            >
              {confirming
                ? <ActivityIndicator color={colors.dark} />
                : <Text style={styles.confirmText}>{t('home.next.confirm')}</Text>}
            </TouchableOpacity>
          </View>
        )}
        {confirmError !== null && <Text style={styles.error}>{confirmError}</Text>}
      </View>

      <TouchableOpacity
        style={styles.action}
        onPress={onDetails}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('home.next.detailsLabel')}
      >
        <Text style={styles.actionText}>{t('home.next.details')}</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.headerTextPrimary} />
      </TouchableOpacity>
    </View>
  );
}

// Loading stand-in with the same ticket frame, so the page does not reorder.
export function HomeNextSparringPlaceholder() {
  const { t } = useTranslation();
  return (
    <View style={styles.root} accessibilityLabel={t('home.next.loading')}>
      <View style={styles.body}>
        <Text style={styles.heading}>{t('home.next.heading')}</Text>
        <View style={styles.entry}>
          <View style={styles.placeholderDate} />
          <View style={styles.info}>
            <View style={styles.placeholderLong} />
            <View style={styles.placeholderShort} />
          </View>
        </View>
      </View>
    </View>
  );
}

const DATE_BOX_WIDTH = 72;
const AVATAR_SIZE    = 28;
const TOUCH_MIN      = 44;

const styles = StyleSheet.create({
  // Deep blue ticket; children are clipped to the rounded corners (ropes and
  // the action strip never show a light seam at the edges).
  root: {
    borderRadius: 24,
    backgroundColor: colors.ticketBlue,
    overflow: 'hidden',
  },
  body: {
    padding: 16,
    paddingTop: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  heading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.ticketTextMuted,
  },
  allLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  allLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  // Cream date block with dark type (the ticket stub).
  dateBox: {
    width: DATE_BOX_WIDTH,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  weekday: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: colors.text,
  },
  day: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
  },
  month: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.text,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  time: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 36,
    textTransform: 'uppercase',
    color: colors.headerTextPrimary,
  },
  // Long place names wrap instead of shrinking or being cut.
  place: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    textTransform: 'uppercase',
    color: colors.headerTextPrimary,
  },
  meta: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ticketTextMuted,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.ticketChip,
  },
  statusText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  peopleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  people: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: TOUCH_MIN,
  },
  avatars: {
    flexDirection: 'row',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.ticketBlue,
    backgroundColor: colors.accentBlueTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  peopleText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextPrimary,
  },
  // Small, clearly recognisable side action (44 pt high).
  chat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: TOUCH_MIN,
    paddingHorizontal: 16,
    borderRadius: TOUCH_MIN / 2,
    backgroundColor: colors.ticketChip,
  },
  chatText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.deleteRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  confirmArea: {
    gap: 8,
  },
  hint: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextPrimary,
  },
  confirm: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  confirmBusy: {
    opacity: 0.7,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextPrimary,
  },
  // Set-off action strip at the bottom edge of the ticket.
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 16,
    backgroundColor: colors.ticketBlueDeep,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ticketDivider,
  },
  actionText: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.headerTextPrimary,
  },
  placeholderDate: {
    width: DATE_BOX_WIDTH,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.ticketChip,
  },
  placeholderLong: {
    width: '70%',
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.ticketChip,
  },
  placeholderShort: {
    width: '45%',
    height: 24,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: colors.ticketChip,
  },
});
