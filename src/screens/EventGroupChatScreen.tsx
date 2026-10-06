import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
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
import type { ListRenderItemInfo } from 'react-native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { colors } from '../theme/colors';
import { formatDate } from '../utils/formatDate';
import { useLanguage } from '../i18n/language';
import type { AppLanguage } from '../utils/language';
import { useEventGroupChat } from '../hooks/useEventGroupChat';
import { useAuth } from '../context/AuthContext';
import { useBlockedUsers } from '../hooks/useBlockedUsers';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import { withoutBlocked } from '../utils/blockedFilter';
import { chatDateLabel } from '../utils/chatDate';
import { computeLayoutFlags } from '../utils/chatMessages';
import { useChatListScroll, chatKeyExtractor, CHAT_MAINTAIN_POSITION } from '../hooks/useChatListScroll';
import ChatDateSeparator from '../components/chat/ChatDateSeparator';
import ChatComposer from '../components/chat/ChatComposer';
import NewMessagesPill from '../components/chat/NewMessagesPill';
import type { RootStackParamList } from '../navigation/types';
import type { EventMessageWithSender } from '../hooks/useEventGroupChat';

type Props = NativeStackScreenProps<RootStackParamList, 'EventGroupChat'>;

const AVATAR_SIZE   = 32;
const AVATAR_GUTTER = AVATAR_SIZE + 8;

function getCountdown(iso: string, t: TFunction, language: AppLanguage): string {
  const now   = new Date();
  const event = new Date(iso);
  const diff  = Math.floor((event.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const time  = formatDate(event, 'time', language);
  if (event < now)  return t('chat.countdown.over');
  if (diff === 0)   return t('chat.countdown.today', { time });
  if (diff === 1)   return t('chat.countdown.tomorrow', { time });
  return t('chat.countdown.inDays', { days: diff, time });
}

function getInitial(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name.trim().charAt(0).toUpperCase();
}

interface MessageBubbleProps {
  message:        EventMessageWithSender;
  isOwn:          boolean;
  isFirstInGroup: boolean;
  isLastInGroup:  boolean;
}

// Memoized list cell: merged messages keep their object identity, so settled cells skip re-rendering.
const EventMessageBubble = React.memo(function EventMessageBubble({ message, isOwn, isFirstInGroup, isLastInGroup }: MessageBubbleProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
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
          <Text style={styles.senderName}>{message.senderName ?? t('chat.unknownSender')}</Text>
        )}
        <View style={bubbleStyle}>
          <Text style={[styles.msgContent, isOwn && styles.msgContentOwn]}>
            {message.body}
          </Text>
          <Text style={[styles.msgTime, isOwn && styles.msgTimeOwn]}>
            {formatDate(message.created_at, 'time', language)}
          </Text>
        </View>
      </View>
    </View>
  );
});

function sameSenderGroup(a: EventMessageWithSender, b: EventMessageWithSender): boolean {
  return a.user_id === b.user_id;
}

export default function EventGroupChatScreen() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<Props['route']>();
  const { user }   = useAuth();

  const { eventId, eventTitle, scheduledAt, durationMin } = params;

  const {
    messages, loading, loadingOlder, hasMore, loadOlder,
    sending, isReadOnly, sendError, sendText, clearSendError,
  } = useEventGroupChat(eventId, scheduledAt, durationMin);

  const { blockedIds, refetch: refetchBlocked } = useBlockedUsers();
  // Blocking happens on a profile pushed over this chat; pick it up on return.
  useFocusRefetch(refetchBlocked);

  // Inverted list: index 0 is the newest message and sits at the bottom.
  // Blocked senders are hidden at render time only, so paging stays intact.
  const newestFirst = useMemo(
    () => [...withoutBlocked(messages, blockedIds, (m) => m.user_id)].reverse(),
    [messages, blockedIds],
  );
  const userId      = user?.id ?? null;
  const isOwnMsg    = useCallback((m: EventMessageWithSender) => m.user_id === userId, [userId]);
  const { listRef, onScroll, showHint, scrollToLatest } = useChatListScroll(newestFirst, isOwnMsg);

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<EventMessageWithSender>) => {
    const flags = computeLayoutFlags(newestFirst, index, sameSenderGroup);
    return (
      <>
        {flags.showDateSeparator && (
          <ChatDateSeparator label={chatDateLabel(item.created_at)} />
        )}
        <EventMessageBubble
          message={item}
          isOwn={item.user_id === userId}
          isFirstInGroup={flags.isFirstInGroup}
          isLastInGroup={flags.isLastInGroup}
        />
      </>
    );
  }, [newestFirst, userId]);

  useEffect(() => {
    if (sendError !== null) {
      Alert.alert(t('common.error'), sendError, [{ text: t('common.ok'), onPress: clearSendError }]);
    }
  }, [sendError, clearSendError]);

  async function handleSend(text: string): Promise<boolean> {
    const { error } = await sendText(text);
    return error === null;
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
          <Text style={styles.headerSub}>{getCountdown(scheduledAt, t, language)}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <View style={styles.listWrap}>
          <FlatList
            ref={listRef}
            inverted
            data={newestFirst}
            keyExtractor={chatKeyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.messageList}
            onScroll={onScroll}
            scrollEventThrottle={100}
            maintainVisibleContentPosition={CHAT_MAINTAIN_POSITION}
            onEndReached={hasMore ? loadOlder : undefined}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingOlder
              ? <ActivityIndicator style={styles.olderLoader} color={colors.accentBlue} />
              : null}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{t('chat.screen.noMessages')}</Text>
              </View>
            }
          />
          {showHint && <NewMessagesPill onPress={scrollToLatest} />}
        </View>
      )}

      {/* Read-only banner or input row */}
      {isReadOnly ? (
        <View style={[styles.readOnlyBanner, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.readOnlyText}>{t('chat.screen.eventOver')}</Text>
        </View>
      ) : (
        <ChatComposer
          sending={sending}
          bottomInset={insets.bottom}
          onSend={handleSend}
        />
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
  listWrap: {
    flex: 1,
  },
  messageList: {
    paddingVertical: 8,
  },
  olderLoader: {
    paddingVertical: 16,
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
