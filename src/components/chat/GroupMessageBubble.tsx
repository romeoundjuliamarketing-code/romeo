import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import type { GroupMessageWithSender } from '../../hooks/useSparringGroupChat';

interface Props {
  message:        GroupMessageWithSender;
  isOwn:          boolean;
  isFirstInGroup: boolean;
  isLastInGroup:  boolean;
}

const AVATAR_SIZE   = 32;
const AVATAR_GUTTER = AVATAR_SIZE + 8; // avatar width + gap

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getInitial(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name.trim().charAt(0).toUpperCase();
}

function GroupMessageBubble({ message, isOwn, isFirstInGroup, isLastInGroup }: Props) {
  // System messages: centred chip, ignore grouping props
  if (message.is_system) {
    return (
      <View style={styles.systemRow}>
        <View style={styles.systemChip}>
          <Text style={styles.systemText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  const rowStyle = [
    styles.row,
    isOwn ? styles.rowOwn : styles.rowOther,
    // Vertical spacing: tighter within a group, larger at the start of one
    isFirstInGroup ? styles.rowMarginFirst : styles.rowMarginContinue,
  ];

  const bubbleStyle = [
    styles.bubble,
    isOwn   ? styles.bubbleOwn   : styles.bubbleOther,
    // Tail: last bubble in a group gets a pointy bottom corner
    isOwn && isLastInGroup  ? styles.bubbleTailOwn   : null,
    !isOwn && isLastInGroup ? styles.bubbleTailOther : null,
  ];

  return (
    <View style={rowStyle}>
      {/* Avatar gutter (other messages only) */}
      {!isOwn && (
        <View style={styles.avatarGutter}>
          {isFirstInGroup && (
            <View style={styles.avatar}>
              {message.senderAvatarUrl !== null ? (
                <Image source={{ uri: message.senderAvatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitial}>{getInitial(message.senderName)}</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Message column */}
      <View style={styles.messageColumn}>
        {/* Sender name: only on first message of a group (other side) */}
        {!isOwn && isFirstInGroup && (
          <Text style={styles.senderName}>{message.senderName ?? 'Unbekannt'}</Text>
        )}

        <View style={bubbleStyle}>
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
    </View>
  );
}

export default React.memo(GroupMessageBubble);

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    paddingHorizontal: 8,
    alignItems:        'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowMarginFirst: {
    marginTop: 8,
  },
  rowMarginContinue: {
    marginTop: 2,
  },

  // Avatar gutter (fixed width so bubbles align even without avatar)
  avatarGutter: {
    width:          AVATAR_GUTTER,
    alignItems:     'flex-start',
    justifyContent: 'flex-end',
    paddingBottom:  2,
  },
  avatar: {
    width:           AVATAR_SIZE,
    height:          AVATAR_SIZE,
    borderRadius:    AVATAR_SIZE / 2,
    backgroundColor: colors.accentBlueSoft,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  avatarImg: {
    width:  AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarInitial: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.accentBlue,
  },

  // Message column holds the sender name + bubble
  messageColumn: {
    maxWidth: '78%',
    gap:       2,
  },
  senderName: {
    fontSize:    12,
    fontWeight:  '600',
    color:       colors.accentBlue,
    marginLeft:  4,
    marginBottom: 2,
  },

  // Bubble
  bubble: {
    borderRadius:      16,
    paddingVertical:   8,
    paddingHorizontal: 12,
    shadowColor:       colors.dark,
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.08,
    shadowRadius:      2,
  },
  bubbleOwn: {
    backgroundColor: colors.accentBlue,
  },
  bubbleOther: {
    backgroundColor: colors.card,
  },
  // Tail: flatten the near-sender bottom corner on the last bubble in a group
  bubbleTailOwn: {
    borderBottomRightRadius: 4,
  },
  bubbleTailOther: {
    borderBottomLeftRadius: 4,
  },

  // Content
  content: {
    fontSize:  15,
    color:     colors.text,
    lineHeight: 21,
  },
  contentOwn: {
    color: colors.card,
  },
  image: {
    width:        220,
    height:       160,
    borderRadius: 8,
    marginBottom:  8,
  },

  // Timestamp
  time: {
    fontSize:  11,
    color:     colors.textSecondary,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  timeOwn: {
    color: colors.headerTextSecondary,
  },

  // System message
  systemRow: {
    alignItems:        'center',
    paddingVertical:   8,
    paddingHorizontal: 16,
    marginTop:         4,
  },
  systemChip: {
    backgroundColor:   colors.border,
    borderRadius:      12,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  systemText: {
    fontSize:  12,
    color:     colors.textSecondary,
    textAlign: 'center',
  },
});
