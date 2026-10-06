import React from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import UnreadBadge from './UnreadBadge';

// Compact header: back (the list is a pushed screen), big left-aligned title,
// one line of copy and a short slanted blue tape as signature.
export function ChatOverviewHeader({ onBack }: { onBack: () => void }): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.back}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.headerText}>
        <Text style={styles.title} accessibilityRole="header">{t('chat.overview.title')}</Text>
        <View style={styles.tape} />
        <Text style={styles.subtitle}>{t('chat.overview.subtitle')}</Text>
      </View>
    </View>
  );
}

// Collapsed by default; shows unread from past meetings while closed.
export const ArchiveToggle = React.memo(function ArchiveToggle({ count, unread, open, onToggle }: {
  count: number; unread: number; open: boolean; onToggle: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.archive, pressed && styles.archivePressed]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={unread > 0 ? t('chat.overview.archiveA11yUnread', { count, unread }) : t('chat.overview.archiveA11y', { count })}
    >
      <Text style={styles.archiveText}>{t('chat.overview.archive', { count })}</Text>
      <UnreadBadge count={unread} />
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
    </Pressable>
  );
});

// No active chats: small group motif, one sentence, a way to the map.
export function ChatOverviewEmpty({ onFind }: { onFind: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyMotif}>
        <MaterialCommunityIcons name="account-group" size={32} color={colors.accentBlueText} />
      </View>
      <Text style={styles.emptyText}>{t('chat.overview.emptyText')}</Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onFind} accessibilityRole="button" activeOpacity={0.85}>
        <Text style={styles.emptyBtnText}>{t('chat.overview.findSparring')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ChatOverviewNotice({ text, onRetry }: { text: string; onRetry: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={20} color={colors.textMuted} />
      <Text style={styles.noticeText}>{text}</Text>
      <TouchableOpacity onPress={onRetry} accessibilityRole="button" style={styles.noticeBtn}>
        <Text style={styles.noticeBtnText}>{t('common.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function RowSeparator(): React.ReactElement {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    textTransform: 'uppercase',
    color: colors.text,
  },
  tape: {
    width: 40,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.accentBlue,
    transform: [{ rotate: '-4deg' }],
    marginTop: 8,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
  },
  archive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 24,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  archivePressed: {
    backgroundColor: colors.hairline,
  },
  archiveText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 48,
    gap: 16,
  },
  emptyMotif: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.accentBlueTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptyBtn: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  noticeBtn: {
    minHeight: 40,
    justifyContent: 'center',
  },
  noticeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginLeft: 96,
  },
});
