import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useEventGroupChat } from '../hooks/useEventGroupChat';
import { useAuth } from '../context/AuthContext';
import { isSameDay, chatDateLabel } from '../utils/chatDate';
import ChatDateSeparator from '../components/chat/ChatDateSeparator';
import type { RootStackParamList } from '../navigation/types';
import type { EventMessageWithSender } from '../hooks/useEventGroupChat';

type Props = NativeStackScreenProps<RootStackParamList, 'EventGroupChat'>;

const AVATAR_SIZE   = 32;
const AVATAR_GUTTER = AVATAR_SIZE + 8;

function getCountdown(iso: string): string {
  const now   = new Date();
  const event = new Date(iso);
  const diff  = Math.floor((event.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const time  = event.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (event < now)  return 'Bereits vorbei';
  if (diff === 0)   return `Heute · ${time} Uhr`;
  if (diff === 1)   return `Morgen · ${time} Uhr`;
  return `In ${diff} Tagen · ${time} Uhr`;
}

function getInitial(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name.trim().charAt(0).toUpperCase();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

interface MessageBubbleProps {
  message:        EventMessageWithSender;
  isOwn:          boolean;
  isFirstInGroup: boolean;
  isLastInGroup:  boolean;
}

function EventMessageBubble({ message, isOwn, isFirstInGroup, isLastInGroup }: MessageBubbleProps) {
  const rowStyle = [
    styles.msgRow,
    isOwn ? styles.msgRowOwn : styles.msgRowOther,
    isFirstInGroup ? styles.msgRowMarginFirst : styles.msgRowMarginContinue,
  ];

  const bubbleStyle = [
    styles.bubble,
    isOwn   ? styles.bubbleOwn   : styles.bubbleOther,
    isOwn && isLastInGroup  ? styles.bubbleTailOwn   : null,
    !isOwn && isLastInGroup ? styles.bubbleTailOther : null,
  ];

  return (
    <View style={rowStyle}>
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
      <View style={styles.msgColumn}>
        {!isOwn && isFirstInGroup && (
          <Text style={styles.senderName}>{message.senderName ?? 'Unbekannt'}</Text>
        )}
        <View style={bubbleStyle}>
          <Text style={[styles.msgContent, isOwn && styles.msgContentOwn]}>
            {message.body}
          </Text>
          <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>
            {formatTime(message.created_at)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function EventGroupChatScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<Props['route']>();
  const { user }   = useAuth();

  const { eventId, eventTitle, scheduledAt, durationMin } = params;

  const { messages, loading, sending, isReadOnly, sendError, sendText, clearSendError } =
    useEventGroupChat(eventId, scheduledAt, durationMin);

  const [inputText, setInputText] = useState('');
  const listRef         = useRef<FlatList<EventMessageWithSender>>(null);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    if (sendError !== null) {
      Alert.alert('Fehler', sendError, [{ text: 'OK', onPress: clearSendError }]);
    }
  }, [sendError, clearSendError]);

  async function handleSend() {
    const text = inputText.trim();
    if (text.length === 0 || sending) return;
    isNearBottomRef.current = true;
    const { error } = await sendText(text);
    if (error === null) setInputText('');
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{eventTitle}</Text>
          <Text style={styles.headerSub}>{getCountdown(scheduledAt)}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => {
            const prev = index > 0 ? messages[index - 1] : null;
            const next = index < messages.length - 1 ? messages[index + 1] : null;

            const showDateSeparator =
              index === 0 ||
              (prev !== null && !isSameDay(new Date(prev.created_at), new Date(item.created_at)));

            const isFirstInGroup =
              prev === null ||
              prev.user_id !== item.user_id ||
              showDateSeparator;

            const isLastInGroup =
              next === null ||
              next.user_id !== item.user_id ||
              !isSameDay(new Date(item.created_at), new Date(next.created_at));

            return (
              <>
                {showDateSeparator && (
                  <ChatDateSeparator label={chatDateLabel(item.created_at)} />
                )}
                <EventMessageBubble
                  message={item}
                  isOwn={user?.id === item.user_id}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                />
              </>
            );
          }}
          contentContainerStyle={styles.messageList}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            isNearBottomRef.current =
              contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
          }}
          scrollEventThrottle={100}
          onContentSizeChange={() => {
            if (isNearBottomRef.current) {
              listRef.current?.scrollToEnd({ animated: true });
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Noch keine Nachrichten.</Text>
            </View>
          }
        />
      )}

      {/* Read-only banner or input row */}
      {isReadOnly ? (
        <View style={[styles.readOnlyBanner, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.readOnlyText}>Dieses Event hat stattgefunden.</Text>
        </View>
      ) : (
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Nachricht..."
            placeholderTextColor={colors.textSecondary}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => { void handleSend(); }}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, (inputText.trim().length === 0 || sending) && styles.sendBtnDisabled]}
            onPress={() => { void handleSend(); }}
            disabled={inputText.trim().length === 0 || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.card} />
              : <Ionicons name="send" size={18} color={colors.card} />
            }
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingBottom:     12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.background,
    gap:               12,
  },
  headerCenter: {
    flex: 1,
    gap:   2,
  },
  headerTitle: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  headerSub: {
    fontSize: 12,
    color:    colors.textSecondary,
  },
  headerSpacer: {
    width: 24,
  },
  loader: {
    marginTop: 48,
  },
  messageList: {
    paddingVertical: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop:  48,
  },
  emptyText: {
    fontSize:  14,
    color:     colors.textSecondary,
    fontStyle: 'italic',
  },
  readOnlyBanner: {
    paddingHorizontal: 24,
    paddingTop:        16,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    alignItems:        'center',
  },
  readOnlyText: {
    fontSize:  14,
    color:     colors.textSecondary,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    paddingHorizontal: 8,
    paddingTop:        8,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    backgroundColor:   colors.background,
    gap:               8,
  },
  input: {
    flex:              1,
    minHeight:         40,
    maxHeight:         120,
    backgroundColor:   colors.card,
    borderRadius:      20,
    paddingHorizontal: 16,
    paddingVertical:   10,
    fontSize:          15,
    color:             colors.text,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  sendBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.accentBlue,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  // Message rows
  msgRow: {
    flexDirection:     'row',
    paddingHorizontal: 8,
    alignItems:        'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
  msgRowOwn: {
    justifyContent: 'flex-end',
  },
  msgRowMarginFirst: {
    marginTop: 8,
  },
  msgRowMarginContinue: {
    marginTop: 2,
  },
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
  msgColumn: {
    maxWidth: '78%',
    gap:       2,
  },
  senderName: {
    fontSize:     12,
    fontWeight:   '600',
    color:        colors.accentBlue,
    marginLeft:   4,
    marginBottom: 2,
  },
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
  bubbleTailOwn: {
    borderBottomRightRadius: 4,
  },
  bubbleTailOther: {
    borderBottomLeftRadius: 4,
  },
  msgContent: {
    fontSize:   15,
    color:      colors.text,
    lineHeight: 21,
  },
  msgContentOwn: {
    color: colors.card,
  },
  msgTime: {
    fontSize:  11,
    color:     colors.textSecondary,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  msgTimeOwn: {
    color: colors.headerTextSecondary,
  },
});
