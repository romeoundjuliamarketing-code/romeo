import React from 'react';
import { View, Text, Image, Linking, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { formatDate } from '../../utils/formatDate';
import { useLanguage } from '../../i18n/language';
import SystemEventLine from './SystemEventLine';
import type { GroupMessageWithSender } from '../../hooks/useSparringGroupChat';

interface Props {
  message:        GroupMessageWithSender;
  isOwn:          boolean;
  isFirstInGroup: boolean;
  isLastInGroup:  boolean;
}

const AVATAR_SIZE   = 28;
const AVATAR_GUTTER = AVATAR_SIZE + 8; // avatar width + gap
const URL_RE        = /(https?:\/\/[^\s]+)/g;

function getInitial(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name.trim().charAt(0).toUpperCase();
}

// Message text with http(s) links as tappable, underlined spans.
function MessageText({ content, isOwn }: { content: string; isOwn: boolean }) {
  const parts = content.split(URL_RE);
  return (
    <Text style={[styles.content, isOwn && styles.contentOwn]} selectable>
      {parts.map((part, i) => (i % 2 === 1 ? (
        <Text
          key={i}
          style={[styles.link, isOwn && styles.linkOwn]}
          onPress={() => { void Linking.openURL(part); }}
          accessibilityRole="link"
        >
          {part}
        </Text>
      ) : part))}
    </Text>
  );
}

function GroupMessageBubble({ message, isOwn, isFirstInGroup, isLastInGroup }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  if (message.is_system) {
    return <SystemEventLine content={message.content ?? ''} />;
  }

  const rowStyle = [
    styles.row,
    isOwn ? styles.rowOwn : styles.rowOther,
    // Vertical spacing: tight within a group, more air at the start of one
    isFirstInGroup ? styles.rowMarginFirst : styles.rowMarginContinue,
  ];

  const bubbleStyle = [
    styles.bubble,
    isOwn ? styles.bubbleOwn : styles.bubbleOther,
    message.image_url !== null && styles.bubbleWithImage,
    // Grouped bubbles: soften only the corners facing the neighbours
    isOwn && !isFirstInGroup ? styles.joinTopOwn : null,
    isOwn && !isLastInGroup ? styles.joinBottomOwn : null,
    !isOwn && !isFirstInGroup ? styles.joinTopOther : null,
    !isOwn && !isLastInGroup ? styles.joinBottomOther : null,
  ];

  return (
    <View style={rowStyle}>
      {/* Avatar gutter (other messages only), avatar next to the last bubble */}
      {!isOwn && (
        <View style={styles.avatarGutter}>
          {isLastInGroup && (
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

      <View style={[styles.messageColumn, isOwn && styles.messageColumnOwn]}>
        {!isOwn && isFirstInGroup && (
          <Text style={styles.senderName} numberOfLines={1}>{message.senderName ?? t('chat.unknownSender')}</Text>
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
            <View style={message.image_url !== null ? styles.captionPad : null}>
              <MessageText content={message.content} isOwn={isOwn} />
            </View>
          )}
          <Text style={[styles.time, isOwn && styles.timeOwn, message.image_url !== null && styles.timeWithImage]}>
            {formatDate(message.created_at, 'time', language)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default React.memo(GroupMessageBubble);

const RADIUS       = 18;
const RADIUS_JOIN  = 6;

const styles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    paddingHorizontal: 16,
    alignItems:        'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowMarginFirst: {
    marginTop: 16,
  },
  rowMarginContinue: {
    marginTop: 2,
  },

  // Avatar gutter (fixed width so bubbles align even without avatar)
  avatarGutter: {
    width:          AVATAR_GUTTER,
    alignItems:     'flex-start',
    justifyContent: 'flex-end',
  },
  avatar: {
    width:           AVATAR_SIZE,
    height:          AVATAR_SIZE,
    borderRadius:    AVATAR_SIZE / 2,
    backgroundColor: colors.accentBlueTint,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  avatarImg: {
    width:  AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarInitial: {
    fontSize:   12,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },

  // Sender name + bubble, at most ~80% of the row
  messageColumn: {
    maxWidth: '80%',
    flexShrink: 1,
  },
  messageColumnOwn: {
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize:     12,
    fontWeight:   '600',
    color:        colors.accentBlueText,
    marginLeft:   8,
    marginBottom: 4,
  },

  bubble: {
    borderRadius:      RADIUS,
    paddingTop:        8,
    paddingBottom:     8,
    paddingHorizontal: 16,
    overflow:          'hidden',
  },
  bubbleOwn: {
    backgroundColor: colors.accentBlue,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     colors.hairline,
  },
  bubbleWithImage: {
    paddingTop:        0,
    paddingHorizontal: 0,
  },
  joinTopOwn:      { borderTopRightRadius: RADIUS_JOIN },
  joinBottomOwn:   { borderBottomRightRadius: RADIUS_JOIN },
  joinTopOther:    { borderTopLeftRadius: RADIUS_JOIN },
  joinBottomOther: { borderBottomLeftRadius: RADIUS_JOIN },

  content: {
    fontSize:   16,
    lineHeight: 22,
    color:      colors.text,
  },
  contentOwn: {
    color: colors.card,
  },
  link: {
    textDecorationLine: 'underline',
    color:              colors.accentBlueText,
  },
  linkOwn: {
    color: colors.card,
  },
  image: {
    width:  240,
    height: 176,
  },
  captionPad: {
    paddingTop:        8,
    paddingHorizontal: 16,
  },

  time: {
    fontSize:  11,
    color:     colors.textMuted,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  timeOwn: {
    color: colors.coverTextMuted,
  },
  timeWithImage: {
    paddingHorizontal: 16,
  },
});
