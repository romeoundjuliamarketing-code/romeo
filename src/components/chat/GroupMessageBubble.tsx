import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import type { GroupMessageWithSender } from '../../hooks/useSparringGroupChat';

interface Props {
  message: GroupMessageWithSender;
  isOwn:   boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function GroupMessageBubble({ message, isOwn }: Props) {
  return (
    <View style={[styles.row, isOwn && styles.rowOwn]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {!isOwn && (
          <Text style={styles.sender}>{message.senderName ?? 'Unbekannt'}</Text>
        )}
        {message.image_url !== null && (
          <Image
            source={{ uri: message.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
        {message.content !== null && (
          <Text style={[styles.content, isOwn && styles.contentOwn]}>
            {message.content}
          </Text>
        )}
        <Text style={[styles.time, isOwn && styles.timeOwn]}>{formatTime(message.created_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical:    8,
    alignItems:         'flex-start',
  },
  rowOwn: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth:      '75%',
    borderRadius:  16,
    padding:       16,
    shadowColor:   colors.dark,
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius:  2,
  },
  bubbleOwn: {
    backgroundColor: colors.accentBlue,
  },
  bubbleOther: {
    backgroundColor: colors.card,
  },
  sender: {
    fontSize:     12,
    fontWeight:   '600',
    color:        colors.accentBlue,
    marginBottom:  8,
  },
  image: {
    width:        220,
    height:       160,
    borderRadius: 8,
    marginBottom:  8,
  },
  content: {
    fontSize:  15,
    color:     colors.text,
    lineHeight: 21,
  },
  contentOwn: {
    color: colors.card,
  },
  time: {
    fontSize:  11,
    color:     colors.textSecondary,
    marginTop:  8,
    alignSelf: 'flex-end',
  },
  timeOwn: {
    color: colors.headerTextSecondary,
  },
});
