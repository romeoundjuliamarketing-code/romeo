import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { formatCount } from '../../utils/challengePreview';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../i18n/language';

interface Props {
  name:                    string | null;
  unreadNotificationCount: number;
  onNotificationsPress:    () => void;
  /** Registered members; null hides the line (unknown, never shown as 0). */
  communityCount:          number | null;
}

// Compact head of the Home tab, open on the warm page background (no band, no
// box): a small "Moin," over the first name in Sparr blue in the sport face,
// the bell on a small white disc at the top right. Behind it, like a fight
// poster, an oversized faint "SPARR" in the right half, turned and cut by the
// header's edges — only this background layer is clipped, it takes no layout
// room or touches. Replaces the tall HeroSection (kept in the repo).
export default function HomeHeader({ name, unreadNotificationCount, onNotificationsPress, communityCount }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const firstName = name?.trim().split(' ')[0] ?? '';
  const hasName   = firstName.length > 0;
  const narrow    = width < 360;

  return (
    <View style={styles.wrap}>
      <View
        style={styles.wordmarkLayer}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {/* Little room: smaller and further out (wordmarkNarrow). */}
        <Text
          style={[styles.wordmark, narrow && styles.wordmarkNarrow]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          SPARR
        </Text>
      </View>
      <View style={styles.header}>
        <View
          style={styles.greetingCol}
          accessible
          accessibilityRole="header"
          accessibilityLabel={hasName ? t('home.header.greetingNamed', { name: firstName }) : t('home.header.greeting')}
        >
          {hasName && <Text style={styles.hello}>{t('home.header.hello')}</Text>}
          <Text style={[styles.name, narrow && styles.nameNarrow]} numberOfLines={2}>
            {hasName ? `${firstName}.` : t('home.header.greeting')}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onNotificationsPress}
          style={styles.bellButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={unreadNotificationCount > 0
            ? t('home.header.notificationsUnread', { count: unreadNotificationCount })
            : t('home.header.notifications')}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
          {unreadNotificationCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      {communityCount !== null && communityCount > 0 && (
        <View style={styles.communityRow}>
          <Ionicons name="people-outline" size={14} color={colors.textMuted} />
          <Text style={styles.communityText}>
            {t('home.header.community', { members: language === 'en' ? formatCount(communityCount).replace(/\./g, ',') : formatCount(communityCount) })}
          </Text>
        </View>
      )}
    </View>
  );
}

// Decorative wordmark in the sport face (no wordmark asset exists).
const WORDMARK_SIZE        = 120;
const WORDMARK_SIZE_NARROW = 96;

const styles = StyleSheet.create({
  // Together with the sections' top padding: 24 pt to the first section.
  wrap: {
    paddingBottom: 16,
  },
  // Clips only the decoration, at the header's own edges (no horizontal scroll).
  wordmarkLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  // Sparr blue at about 10 %: visible as texture, well below the name.
  wordmark: {
    position: 'absolute',
    right: -48,
    top: -8,
    fontFamily: fonts.display,
    fontSize: WORDMARK_SIZE,
    lineHeight: WORDMARK_SIZE,
    color: colors.accentBlue,
    opacity: 0.1,
    transform: [{ rotate: '-8deg' }],
  },
  wordmarkNarrow: {
    right: -64,
    top: 0,
    fontSize: WORDMARK_SIZE_NARROW,
    lineHeight: WORDMARK_SIZE_NARROW,
  },
  // Bell sits apart at the top right; the greeting takes the rest.
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingLeft: 16,
    paddingRight: 8,
    paddingTop: 8,
  },
  greetingCol: {
    flex: 1,
    minWidth: 0,
  },
  hello: {
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
  },
  // Large sport face in brand blue (about 3.1:1 on the off-white — passes for
  // large text).
  name: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: colors.accentBlue,
  },
  nameNarrow: {
    fontSize: 30,
    lineHeight: 34,
  },
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  communityText: {
    flexShrink: 1,
    fontSize: 13,
    color: colors.textMuted,
  },
  // Small white disc, set apart from the wordmark behind it.
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.deleteRed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
});
