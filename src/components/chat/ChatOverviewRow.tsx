import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import UnreadBadge from './UnreadBadge';
import ChatGroupMotif from './ChatGroupMotif';
import { chatPlaceLabel, chatPreview, chatWhenLabel, lastMessageTimeLabel } from '../../utils/chatList';
import type { ChatListEntry } from '../../hooks/useSparringChatList';

export function chatEntryKey(item: ChatListEntry): string {
  return item.kind === 'event' ? `event-${item.eventId}` : `sparring-${item.sparringId}`;
}

function chatTitle(item: ChatListEntry): string {
  return item.kind === 'event' ? item.title : item.sparringTitle;
}

// One conversation in the overview. Title first, then place + date (what
// tells equally named meetings apart), then a one-line preview. The whole
// row opens the chat. `nextUp` only changes the surface, never the layout.
function ChatOverviewRow({ item, nextUp, archived, onOpen }: {
  item:     ChatListEntry;
  nextUp:   boolean;
  archived: boolean;
  onOpen:   (item: ChatListEntry) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const title = chatTitle(item);
  const place = chatPlaceLabel(item.placeName, item.address);
  const when = chatWhenLabel(item.scheduledAt);
  const meta = place !== null ? `${place} · ${when}` : when;
  const unread = item.unreadCount > 0;
  const preview = chatPreview({
    kind:           item.kind,
    lastText:       item.lastMessageText,
    lastSenderName: item.lastSenderName,
    lastFromMe:     item.lastFromMe,
    lastIsSystem:   item.lastIsSystem,
  });
  const time = lastMessageTimeLabel(item.lastMessageAt);

  const spoken = [
    nextUp ? t('chat.overview.nextUp') : null,
    title,
    meta,
    preview.sender !== null ? `${preview.sender}: ${preview.text}` : preview.text,
    unread ? t('chat.overview.unreadCount', { count: item.unreadCount }) : null,
  ].filter((p): p is string => p !== null).join('. ');

  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={({ pressed }) => [
        styles.row,
        archived && styles.rowCompact,
        nextUp && styles.rowNext,
        pressed && (nextUp ? styles.rowNextPressed : styles.rowPressed),
      ]}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={t('chat.overview.openHint')}
    >
      <ChatGroupMotif kind={item.kind} participants={item.participants} compact={archived} highlighted={nextUp} />

      <View style={styles.body}>
        {nextUp && <Text style={styles.nextLabel}>{t('chat.overview.nextUp')}</Text>}
        <View style={styles.titleRow}>
          <Text style={[styles.title, archived && styles.titleCompact]} numberOfLines={archived ? 1 : 2}>
            {title}
          </Text>
          {time.length > 0 && <Text style={[styles.time, unread && styles.timeUnread]}>{time}</Text>}
        </View>
        <Text style={[styles.meta, nextUp && styles.metaNext]} numberOfLines={1}>{meta}</Text>
        {!archived && (
          <View style={styles.previewRow}>
            <Text style={[styles.preview, unread && styles.previewUnread, preview.empty && styles.previewEmpty]} numberOfLines={1}>
              {preview.sender !== null && <Text style={styles.sender}>{preview.sender}: </Text>}
              {preview.text}
            </Text>
            <UnreadBadge count={item.unreadCount} />
          </View>
        )}
        {archived && unread && (
          <View style={styles.previewRow}>
            <Text style={[styles.preview, styles.previewUnread]} numberOfLines={1}>{t('chat.overview.newMessages')}</Text>
            <UnreadBadge count={item.unreadCount} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default React.memo(ChatOverviewRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.background,
  },
  rowCompact: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  rowPressed: {
    backgroundColor: colors.hairline,
  },
  rowNext: {
    backgroundColor: colors.accentBlueTint,
  },
  rowNextPressed: {
    backgroundColor: colors.accentBlueSoft,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  nextLabel: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accentBlueText,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.text,
  },
  titleCompact: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    lineHeight: 22,
    color: colors.textMuted,
  },
  timeUnread: {
    color: colors.accentBlueText,
    fontWeight: '700',
  },
  meta: {
    marginTop: 0,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  metaNext: {
    color: colors.text,
    fontWeight: '700',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  preview: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  previewUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  previewEmpty: {
    color: colors.textMuted,
  },
  sender: {
    fontWeight: '700',
    color: colors.text,
  },
});
