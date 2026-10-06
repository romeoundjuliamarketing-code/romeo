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

const STATUS: Record<SparringCardState, { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }> = {
  host:      { icon: 'person-outline',       text: 'Du organisierst' },
  confirm:   { icon: 'alert-circle-outline', text: 'Bestätigung offen' },
  in:        { icon: 'checkmark',            text: 'Zugesagt' },
  confirmed: { icon: 'checkmark-done',       text: 'Bestätigt' },
};

// "bis heute, 12:30 Uhr" / "bis Fr., 2. Okt., 12:30 Uhr"
function deadlineText(deadline: Date, now: Date): string {
  const day = appointmentDayLabel(deadline, now);
  const dayLower = day === 'Heute' || day === 'Morgen' ? day.toLowerCase() : day;
  return `Bitte bis ${dayLower}, ${timeLabel(deadline)} Uhr bestätigen.`;
}

// Home's next sparring as an appointment panel on a white surface (set apart
// from the open Sparr Cards composition): dark date block and a large time line
// lead, then title, place and status. Date and details are top-aligned columns. The main area opens the details; the chat
// is a sibling target laid over the participants row (no nested pressables).
export default function HomeNextSparring({
  sparring, now, currentUserId, upcomingCount, chatUnread, confirming, confirmError,
  onConfirm, onDetails, onChat, onAll,
}: Props) {
  const { width, fontScale } = useWindowDimensions();
  const startsAt = new Date(sparring.scheduledAt);
  const state    = sparringCardState(sparring, now);
  const status   = STATUS[state];
  const title    = homeSparringTitle(sparring.title, sparring.locationLabel);
  const block    = dateBlockParts(startsAt, now);
  const time     = `${timeLabel(startsAt)} Uhr`;
  const isToday  = appointmentDayLabel(startsAt, now) === 'Heute';
  // Little room: fewer decorative avatars first, the count text always stays.
  const maxAvatars = fontScale > 1.6 ? 0 : width < 360 || fontScale > 1.3 ? 2 : 3;
  const people   = participantsPreview(sparring.participants, currentUserId, maxAvatars);
  const alert    = state === 'confirm';
  const deadline = alert ? confirmDeadline(sparring.scheduledAt, now) : null;
  // Gym (if any) adds information; the place only when it is not the title already.
  const city  = sparring.locationLabel.split(',').map((p) => p.trim()).filter((p) => p.length > 0).pop() ?? null;
  const where = sparring.gymName !== null && sparring.gymName !== title.text
    ? sparring.gymName
    : title.isPlace ? null : city;

  const a11yLabel = [
    title.text,
    isToday ? `Heute, ${time}` : `${appointmentDayLabel(startsAt, now)}, ${time}`,
    where, title.isPlace ? null : sparring.locationLabel, status.text, people.label,
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
      <View style={styles.headerRow}>
        <Text style={styles.heading} accessibilityRole="header">DEIN NÄCHSTES SPARRING</Text>
        {upcomingCount > 1 && (
          <TouchableOpacity
            style={styles.allLink}
            onPress={onAll}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Alle Termine, ${upcomingCount}`}
          >
            <Text style={styles.allLinkText}>Alle Termine</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.accentBlueText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Date, title block and participants all open the details as sibling
          targets; only the title block is announced (with the full summary),
          the others are hidden from screen readers. The chat is its own
          target next to the participants — no nested pressables. */}
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

        <View style={styles.info}>
          <TouchableOpacity
            onPress={onDetails}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityHint="Öffnet den Termin"
          >
            <Text style={styles.time}>{isToday ? `Heute · ${time}` : time}</Text>
            <Text style={styles.title} numberOfLines={2}>{title.text}</Text>
            <Text style={styles.meta}>
              {where !== null && `${where} · `}
              <Text style={alert ? styles.statusAlert : styles.status}>{status.text} </Text>
              <Ionicons name={status.icon} size={14} color={alert ? colors.accentBlueText : colors.text} />
            </Text>
          </TouchableOpacity>

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
              accessibilityLabel={chatUnread > 0 ? `Gruppenchat öffnen, ${chatUnread} ungelesen` : 'Gruppenchat öffnen'}
            >
              <View style={styles.chatCircle}>
                <Ionicons name="chatbubbles-outline" size={18} color={colors.text} />
              </View>
              {chatUnread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{chatUnread > 99 ? '99+' : String(chatUnread)}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {alert && (
        <View style={styles.confirmArea}>
          <Text style={styles.hint}>
            {deadline !== null ? deadlineText(deadline, now) : 'Bitte bestätige deine Teilnahme.'}
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
              : <Text style={styles.confirmText}>Teilnahme bestätigen</Text>}
          </TouchableOpacity>
        </View>
      )}
      {confirmError !== null && <Text style={styles.error}>{confirmError}</Text>}

      <TouchableOpacity
        style={styles.detailsLink}
        onPress={onDetails}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Zum Sparring, öffnet den Termin"
      >
        <Text style={styles.detailsLinkText}>Zum Sparring</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.accentBlueText} />
      </TouchableOpacity>
    </View>
  );
}

// Loading stand-in in the same open layout, so the page does not reorder.
export function HomeNextSparringPlaceholder() {
  return (
    <View style={[styles.root, styles.placeholderRoot]} accessibilityLabel="Dein nächstes Sparring wird geladen">
      <Text style={styles.heading}>DEIN NÄCHSTES SPARRING</Text>
      <View style={styles.entry}>
        <View style={styles.placeholderDate} />
        <View style={styles.info}>
          <View style={styles.placeholderLong} />
          <View style={styles.placeholderShort} />
        </View>
      </View>
    </View>
  );
}

const DATE_BOX_WIDTH = 64;
const AVATAR_SIZE    = 28;
const CHAT_SIZE      = 44;

const styles = StyleSheet.create({
  // White appointment panel; flat (no shadow).
  root: {
    padding: 16,
    paddingBottom: 8,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  placeholderRoot: {
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 8,
  },
  // Blue label: accentBlueText keeps small text above 4.5:1 on the page background.
  heading: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.accentBlueText,
  },
  allLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  allLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlueText,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginTop: 8,
  },
  // Dark date block, white text (high contrast).
  dateBox: {
    width: DATE_BOX_WIDTH,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.dark,
    alignItems: 'center',
  },
  weekday: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: colors.card,
  },
  day: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.card,
  },
  month: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.card,
  },
  // Time leads the details column (sport face, blue for links/text on light).
  time: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    textTransform: 'uppercase',
    color: colors.accentBlueText,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  // Sport face, uppercase; long names wrap to a second line instead of shrinking.
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    textTransform: 'uppercase',
    color: colors.text,
  },
  meta: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 44,
  },
  detailsLinkText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  status: {
    fontWeight: '600',
    color: colors.text,
  },
  statusAlert: {
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  people: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: CHAT_SIZE,
  },
  avatars: {
    flexDirection: 'row',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.card,
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
    color: colors.text,
  },
  // Sits right after the participants, not at the far edge.
  chat: {
    width: CHAT_SIZE,
    height: CHAT_SIZE,
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
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
    marginTop: 8,
    gap: 8,
  },
  hint: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentBlueText,
  },
  confirm: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  confirmBusy: {
    opacity: 0.7,
  },
  // Dark text on blue: #0A0A0A on #4A90D9 is above 6:1 (white would be ~3.3:1).
  confirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
  },
  error: {
    marginTop: 8,
    fontSize: 14,
    color: colors.deleteRed,
  },
  placeholderDate: {
    width: DATE_BOX_WIDTH,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.hairline,
  },
  placeholderLong: {
    width: '70%',
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.hairline,
  },
  placeholderShort: {
    width: '45%',
    height: 14,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: colors.hairline,
  },
});
