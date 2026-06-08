import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import UnreadBadge from './UnreadBadge';
import type { SparringChatEntry } from '../../hooks/useSparringChatList';

interface Props {
  item:    SparringChatEntry;
  onPress: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function SparringChatListItem({ item, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={1}>{item.sparringTitle}</Text>
        <Text style={styles.date}>{formatDate(item.scheduledAt)}</Text>
        {item.lastMessageText !== null && (
          <Text style={styles.preview} numberOfLines={1}>{item.lastMessageText}</Text>
        )}
      </View>
      <UnreadBadge count={item.unreadCount} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingVertical:   16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flex: 1,
    gap:   4,
  },
  title: {
    fontSize:   16,
    fontWeight: '600',
    color:      colors.text,
  },
  date: {
    fontSize: 13,
    color:    colors.textSecondary,
  },
  preview: {
    fontSize: 13,
    color:    colors.textSecondary,
  },
});
