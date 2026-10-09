import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import UnreadBadge from './UnreadBadge';
import ChatGroupAvatar from './ChatGroupAvatar';
import {
  chatDisplayTitle, chatPlaceLabel, chatPreview, chatWhenLabel, lastMessageTimeLabel, nextUpLabel, participantNamesLabel,
} from '../../utils/chatList';
import type { ChatListEntry } from '../../hooks/useSparringChatList';

export function chatEntryKey(item: ChatListEntry): string {
  return item.kind === 'event' ? `event-${item.eventId}` : `sparring-${item.sparringId}`;
}

export function chatTitle(item: ChatListEntry): ReturnType<typeof chatDisplayTitle> {
  return chatDisplayTitle({
    kind:      item.kind,
    title:     item.kind === 'event' ? item.title : item.sparringTitle,
    placeName: item.placeName,
    address:   item.address,
  });
}

// One conversation in the overview: group avatar, then title + time of the
// last message, meeting date (+ place when the title does not name it), an
// optional names line (only for otherwise equal titles) and a one-line
// preview. The whole row opens the chat. `nextUp` only changes the surface.
function ChatOverviewRow({ item, nextUp, archived, showNames, onOpen }: {
  item:      ChatListEntry;
  nextUp:    boolean;
  archived:  boolean;
  /** Same title as another row: add the members' first names. */
  showNames: boolean;
  onOpen:    (item: ChatListEntry) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const title = chatTitle(item);
  const place = title.placeInTitle ? null : chatPlaceLabel(item.placeName, item.address);
  const label = nextUp ? nextUpLabel(item.scheduledAt) : null;
  const when = label?.hasTime === true ? null : chatWhenLabel(item.scheduledAt);
  const meta = [when, place].filter((p): p is string => p !== null).join(' · ');
  const names = showNames ? participantNamesLabel(item.participants, item.otherCount) : null;
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
    label?.text ?? null,
    title.text,
    meta.length > 0 ? meta : null,
    names,
    archived ? null : (preview.sender !== null ? `${preview.sender}: ${preview.text}` : preview.text),
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
      <ChatGroupAvatar
        chatId={item.kind === 'event' ? item.eventId : item.sparringId}
        kind={item.kind}
        participants={item.participants}
        otherCount={item.otherCount}
        compact={archived}
        onBlue={nextUp}
      />

      <View style={styles.body}>
        {label !== null && <Text style={styles.nextLabel}>{label.text}</Text>}
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, unread && styles.titleUnread, archived && styles.titleCompact]}
            numberOfLines={archived ? 1 : 2}
          >
            {title.text}
          </Text>
          {time.length > 0 && <Text style={[styles.time, unread && styles.timeUnread]}>{time}</Text>}
        </View>
        {meta.length > 0 && (
          <Text style={[styles.meta, nextUp && styles.metaNext, archived && styles.metaArchived]} numberOfLines={1}>
            {meta}
          </Text>
        )}
        {names !== null && <Text style={styles.names} numberOfLines={1}>{names}</Text>}
        {!archived && (
          <View style={styles.previewRow}>
            <Text
              style={[
                styles.preview,
                unread && !item.lastIsSystem && styles.previewUnread,
                item.lastIsSystem && styles.previewSystem,
              ]}
              numberOfLines={1}
            >
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
    marginHorizontal: 8,
    marginVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
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
    fontWeight: '700',
    color: colors.text,
  },
  titleUnread: {
    fontWeight: '800',
  },
  titleCompact: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
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
  metaArchived: {
    color: colors.text,
  },
  names: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
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
  previewSystem: {
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  sender: {
    fontWeight: '700',
    color: colors.text,
  },
});
