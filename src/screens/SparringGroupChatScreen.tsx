import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { ListRenderItemInfo } from 'react-native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/language';
import { sparringDisplayTitle } from '../utils/sparringDisplayTitle';
import { useSparringGroupChat } from '../hooks/useSparringGroupChat';
import { useSparringChatSettings } from '../hooks/useSparringChatSettings';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import GroupMessageBubble from '../components/chat/GroupMessageBubble';
import ChatDateSeparator from '../components/chat/ChatDateSeparator';
import ChatImagePicker from '../components/chat/ChatImagePicker';
import ChatComposer from '../components/chat/ChatComposer';
import NewMessagesPill from '../components/chat/NewMessagesPill';
import SystemEventRun from '../components/chat/SystemEventRun';
import SparringChatHeader, { type ChatParticipant } from '../components/chat/SparringChatHeader';
import SparringChatOptionsSheet from '../components/chat/SparringChatOptionsSheet';
import SparringChatEmptyState from '../components/chat/SparringChatEmptyState';
import type { RootStackParamList } from '../navigation/types';
import type { GroupMessageWithSender } from '../hooks/useSparringGroupChat';
import { chatDateLabel } from '../utils/chatDate';
import { computeLayoutFlags } from '../utils/chatMessages';
import { buildTimeline, type TimelineItem } from '../utils/chatTimeline';
import { useChatListScroll, chatKeyExtractor, CHAT_MAINTAIN_POSITION } from '../hooks/useChatListScroll';
import { checkText, filterErrorMessage } from '../utils/contentFilter';
import { useBannedWords } from '../hooks/useBannedWords';
import { useBlockedUsers } from '../hooks/useBlockedUsers';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import { withoutBlocked } from '../utils/blockedFilter';

type Props = NativeStackScreenProps<RootStackParamList, 'SparringGroupChat'>;
type Item  = TimelineItem<GroupMessageWithSender>;

interface SparringInfo {
  address:    string;
  maxSlots:   number;
  notes:      string | null;
  accessNote: string | null;
}

// Two real messages of the same sender form a group; system runs never do.
function sameSenderGroup(a: Item, b: Item): boolean {
  return a.kind === 'message' && b.kind === 'message' && a.message.sender_id === b.message.sender_id;
}

export default function SparringGroupChatScreen() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<Props['route']>();
  const { user }   = useAuth();

  const { sparringId, sparringTitle, scheduledAt, durationMin, isOrganizer } = params;

  const {
    messages, loading, loadingOlder, hasMore, loadOlder,
    sending, isReadOnly, sendError, sendText, sendImage, clearSendError,
  } = useSparringGroupChat(sparringId, scheduledAt, durationMin);
  const { mediaEnabled, toggleMedia } =
    useSparringChatSettings(sparringId, isOrganizer);
  const { bannedWords } = useBannedWords();

  const [optionsVisible, setOptionsVisible] = useState(false);

  const { blockedIds, refetch: refetchBlocked } = useBlockedUsers();

  // Inverted list: index 0 is the newest entry and sits at the bottom.
  // Blocked senders are hidden at render time only, so paging stays intact.
  // Consecutive system events are merged for display only (see chatTimeline).
  const timeline = useMemo(
    () => buildTimeline([...withoutBlocked(messages, blockedIds, (m) => (m.is_system ? null : m.sender_id))].reverse()),
    [messages, blockedIds],
  );
  const userId   = user?.id ?? null;
  const isOwnMsg = useCallback((m: Item) => m.kind === 'message' && m.message.sender_id === userId, [userId]);
  const { listRef, onScroll, showHint, scrollToLatest } = useChatListScroll(timeline, isOwnMsg);

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<Item>) => {
    const flags = computeLayoutFlags(timeline, index, sameSenderGroup);
    return (
      <>
        {flags.showDateSeparator && (
          <ChatDateSeparator label={chatDateLabel(item.created_at)} />
        )}
        {item.kind === 'system' ? (
          <SystemEventRun events={item.events} />
        ) : (
          <GroupMessageBubble
            message={item.message}
            isOwn={item.message.sender_id === userId}
            isFirstInGroup={flags.isFirstInGroup}
            isLastInGroup={flags.isLastInGroup}
          />
        )}
      </>
    );
  }, [timeline, userId]);

  // Sparring facts + participants for the header
  const [sparringInfo, setSparringInfo] = useState<SparringInfo | null>(null);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);

  const loadDetails = useCallback(async () => {
    const [sparringRes, signupsRes] = await Promise.all([
      supabase
        .from('open_sparrings')
        .select('address, max_slots, notes, access_note')
        .eq('id', sparringId)
        .single(),
      supabase
        .from('sparring_signups')
        .select('user_id, profiles!user_id(name, avatar_url)')
        .eq('sparring_id', sparringId)
        .in('status', ['pending', 'confirmed', 'attended', 'no_show']),
    ]);

    if (sparringRes.data !== null) {
      const sp = sparringRes.data;
      setSparringInfo({
        address:    sp.address,
        maxSlots:   sp.max_slots,
        notes:      sp.notes,
        accessNote: sp.access_note,
      });
    }

    if (signupsRes.data !== null) {
      type ProfileJoin = { name: string | null; avatar_url: string | null } | null;
      setParticipants(signupsRes.data.map((row) => ({
        id:        row.user_id,
        name:      (row.profiles as ProfileJoin)?.name ?? null,
        avatarUrl: (row.profiles as ProfileJoin)?.avatar_url ?? null,
      })));
    }
  }, [sparringId]);

  useEffect(() => { void loadDetails(); }, [loadDetails]);

  // Blocking happens on a pushed profile, sign-up changes in the details: pick both up on return.
  const onRefocus = useCallback(() => {
    refetchBlocked();
    void loadDetails();
  }, [refetchBlocked, loadDetails]);
  useFocusRefetch(onRefocus);

  useEffect(() => {
    if (sendError !== null) {
      Alert.alert(t('common.error'), sendError, [{ text: t('common.ok'), onPress: clearSendError }]);
    }
  }, [sendError, clearSendError]);

  const isSignedUp = userId !== null && participants.some((p) => p.id === userId);

  // Participant list, sign-up/cancel (with its confirmation) and organizer
  // actions live in the existing sparring details on the map.
  const openDetails = useCallback(() => {
    setOptionsVisible(false);
    navigation.navigate('SparringMap', { focusSparringId: sparringId });
  }, [navigation, sparringId]);

  const openMaps = useCallback(() => {
    if (sparringInfo === null) return;
    setOptionsVisible(false);
    const encoded = encodeURIComponent(sparringInfo.address);
    const url = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?q=${encoded}`
      : `geo:0,0?q=${encoded}`;
    void Linking.openURL(url);
  }, [sparringInfo]);

  const closeOptions = useCallback(() => setOptionsVisible(false), []);
  const openOptions  = useCallback(() => setOptionsVisible(true), []);
  const goBack       = useCallback(() => navigation.goBack(), [navigation]);

  async function handleSend(text: string): Promise<boolean> {
    const verdict = checkText(text, bannedWords);
    if (!verdict.ok) {
      Alert.alert(t('chat.screen.messageBlocked'), filterErrorMessage(verdict.category));
      return false;
    }
    const { error } = await sendText(text);
    return error === null;
  }

  const title = sparringDisplayTitle(sparringTitle, language);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <SparringChatHeader
        title={title}
        scheduledAt={scheduledAt}
        address={sparringInfo?.address ?? null}
        participants={participants}
        maxSlots={sparringInfo?.maxSlots ?? null}
        currentUserId={userId}
        topInset={insets.top}
        onBack={goBack}
        onOptions={openOptions}
        onParticipants={openDetails}
        onAddress={openMaps}
      />

      {/* Messages */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : timeline.length === 0 ? (
        <View style={styles.listWrap}>
          <SparringChatEmptyState
            notes={sparringInfo?.notes ?? null}
            accessNote={sparringInfo?.accessNote ?? null}
          />
        </View>
      ) : (
        <View style={styles.listWrap}>
          <FlatList
            ref={listRef}
            inverted
            data={timeline}
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
          />
          {showHint && <NewMessagesPill onPress={scrollToLatest} />}
        </View>
      )}

      {/* Read-only banner or input row */}
      {isReadOnly ? (
        <View style={[styles.readOnlyBanner, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.readOnlyText}>{t('chat.screen.sparringOver')}</Text>
        </View>
      ) : (
        <ChatComposer
          sending={sending}
          bottomInset={insets.bottom}
          onSend={handleSend}
          placeholder={t('chat.sparring.composerPlaceholder')}
          leading={mediaEnabled ? (
            <ChatImagePicker
              onImageSelected={(uri) => { void sendImage(uri); }}
              disabled={sending}
            />
          ) : null}
        />
      )}

      {optionsVisible && (
        <SparringChatOptionsSheet
          title={title}
          bottomInset={insets.bottom}
          hasAddress={sparringInfo !== null}
          isOrganizer={isOrganizer}
          canCancel={isSignedUp}
          isReadOnly={isReadOnly}
          mediaEnabled={mediaEnabled}
          onToggleMedia={() => { void toggleMedia(); }}
          onDetails={openDetails}
          onOpenMaps={openMaps}
          onCancel={openDetails}
          onClose={closeOptions}
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
  loader: {
    marginTop: 48,
  },
  listWrap: {
    flex: 1,
  },
  messageList: {
    paddingTop:    8,
    paddingBottom: 16,
  },
  olderLoader: {
    paddingVertical: 16,
  },
  readOnlyBanner: {
    paddingHorizontal: 24,
    paddingTop:        16,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    colors.fieldBorder,
    alignItems:        'center',
  },
  readOnlyText: {
    fontSize:  14,
    color:     colors.textMuted,
    textAlign: 'center',
  },
});
