import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import UnreadBadge from './UnreadBadge';
import { initialsFromTitle, lastMessageTimeLabel, sparringDateLabel } from '../../utils/chatList';
import type { SparringChatEntry } from '../../hooks/useSparringChatList';

interface Props {
  item:     SparringChatEntry;
  onPress:  () => void;
  past?:    boolean;
}

export default function SparringChatListItem({ item, onPress, past = false }: Props) {
  const hasUnread     = item.unreadCount > 0;
  const initials      = initialsFromTitle(item.sparringTitle);
  const timeLabel     = lastMessageTimeLabel(item.lastMessageAt);
  const dateLabel     = sparringDateLabel(item.scheduledAt);

  return (
    <TouchableOpacity
      style={[styles.card, past && styles.cardPast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left: avatar tile */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Right column */}
      <View style={styles.content}>
        {/* Row 1: title + timestamp */}
        <View style={styles.row}>
          <Text
            style={[styles.title, hasUnread && styles.titleUnread]}
            numberOfLines={1}
          >
            {item.sparringTitle}
          </Text>
          {timeLabel.length > 0 && (
            <Text style={[styles.timeLabel, hasUnread && styles.timeLabelUnread]}>
              {timeLabel}
            </Text>
          )}
        </View>

        {/* Row 2: calendar icon + event date */}
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.metaText}>{dateLabel}</Text>
        </View>

        {/* Row 3: message preview + unread badge */}
        <View style={styles.row}>
          {item.lastMessageText !== null ? (
            <Text
              style={[styles.preview, hasUnread && styles.previewUnread]}
              numberOfLines={1}
            >
              {item.lastMessageText}
            </Text>
          ) : (
            <Text style={styles.previewEmpty} numberOfLines={1}>
              Noch keine Nachrichten
            </Text>
          )}
          <UnreadBadge count={item.unreadCount} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.card,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         12,
    marginHorizontal: 16,
    marginBottom:    8,
    gap:             12,
  },
  cardPast: {
    opacity: 0.7,
  },
  avatar: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: colors.dark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarText: {
    color:      colors.card,
    fontWeight: '700',
    fontSize:   16,
  },
  content: {
    flex: 1,
    gap:  4,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  title: {
    flex:       1,
    fontSize:   15,
    fontWeight: '600',
    color:      colors.text,
    marginRight: 8,
  },
  titleUnread: {
    fontWeight: '700',
  },
  timeLabel: {
    fontSize:   12,
    color:      colors.textSecondary,
    flexShrink: 0,
  },
  timeLabelUnread: {
    color:      colors.accentBlue,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 12,
    color:    colors.textSecondary,
  },
  preview: {
    flex:     1,
    fontSize: 13,
    color:    colors.textSecondary,
  },
  previewUnread: {
    color: colors.text,
  },
  previewEmpty: {
    flex:      1,
    fontSize:  13,
    color:     colors.textSecondary,
    fontStyle: 'italic',
  },
});
