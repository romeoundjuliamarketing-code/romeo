import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { ListRenderItemInfo } from 'react-native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useSparringGroupChat } from '../hooks/useSparringGroupChat';
import { useSparringChatSettings } from '../hooks/useSparringChatSettings';
import { useSparringActions } from '../hooks/useSparringActions';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import GroupMessageBubble from '../components/chat/GroupMessageBubble';
import ChatDateSeparator from '../components/chat/ChatDateSeparator';
import ChatImagePicker from '../components/chat/ChatImagePicker';
import ChatComposer from '../components/chat/ChatComposer';
import NewMessagesPill from '../components/chat/NewMessagesPill';
import SparringChatInfoBanner from '../components/chat/SparringChatInfoBanner';
import SparringChatParticipantBar from '../components/chat/SparringChatParticipantBar';
import SparringRulesConsentSheet from '../components/sparring/SparringRulesConsentSheet';
import type { Participant } from '../components/chat/SparringChatParticipantBar';
import type { RootStackParamList } from '../navigation/types';
import type { GroupMessageWithSender } from '../hooks/useSparringGroupChat';
import { chatDateLabel } from '../utils/chatDate';
import { computeLayoutFlags } from '../utils/chatMessages';
import { useChatListScroll, NEAR_LATEST_PX } from '../hooks/useChatListScroll';
import { checkText, filterErrorMessage } from '../utils/contentFilter';
import { useBannedWords } from '../hooks/useBannedWords';

type Props = NativeStackScreenProps<RootStackParamList, 'SparringGroupChat'>;

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

const MAINTAIN_POSITION = { minIndexForVisible: 0, autoscrollToTopThreshold: NEAR_LATEST_PX };

function keyExtractor(m: GroupMessageWithSender): string {
  return m.id;
}

function sameSenderGroup(a: GroupMessageWithSender, b: GroupMessageWithSender): boolean {
  return a.sender_id === b.sender_id && !a.is_system && !b.is_system;
}

export default function SparringGroupChatScreen() {
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
  const { signUp, cancelSignup } = useSparringActions();
  const { bannedWords } = useBannedWords();

  const [settingsVisible, setSettingsVisible] = useState(false);

  // Inverted list: index 0 is the newest message and sits at the bottom.
  const newestFirst = useMemo(() => [...messages].reverse(), [messages]);
  const userId      = user?.id ?? null;
  const isOwnMsg    = useCallback((m: GroupMessageWithSender) => m.sender_id === userId, [userId]);
  const { listRef, onScroll, showHint, scrollToLatest } = useChatListScroll(newestFirst, isOwnMsg);

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<GroupMessageWithSender>) => {
    const flags = computeLayoutFlags(newestFirst, index, sameSenderGroup);
    return (
      <>
        {flags.showDateSeparator && (
          <ChatDateSeparator label={chatDateLabel(item.created_at)} />
        )}
        <GroupMessageBubble
          message={item}
          isOwn={item.sender_id === userId}
          isFirstInGroup={flags.isFirstInGroup}
          isLastInGroup={flags.isLastInGroup}
        />
      </>
    );
  }, [newestFirst, userId]);

  // Sparring info + participants
  const [sparringInfo, setSparringInfo] = useState<{
    address: string; signupCount: number; maxSlots: number;
  } | null>(null);
  const [participants,   setParticipants]   = useState<Participant[]>([]);
  const [isSignedUp,     setIsSignedUp]     = useState(false);
  const [signupLoading,  setSignupLoading]  = useState(false);
  // Open while the user confirms the Sparr-Grundregeln before joining
  const [consentVisible, setConsentVisible] = useState(false);

  const loadDetails = useCallback(async () => {
    const [sparringRes, signupsRes] = await Promise.all([
      supabase
        .from('open_sparrings')
        .select('address, max_slots')
        .eq('id', sparringId)
        .single(),
      supabase
        .from('sparring_signups')
        .select('user_id, profiles!user_id(name, avatar_url)')
        .eq('sparring_id', sparringId)
        .in('status', ['pending', 'confirmed', 'attended', 'no_show']),
    ]);

    if (sparringRes.data !== null) {
      setSparringInfo({
        address:     sparringRes.data.address,
        signupCount: signupsRes.data?.length ?? 0,
        maxSlots:    sparringRes.data.max_slots,
      });
    }

    if (signupsRes.data !== null) {
      type ProfileJoin = { name: string | null; avatar_url: string | null } | null;
      const ps: Participant[] = signupsRes.data.map((row) => ({
        id:        row.user_id,
        name:      (row.profiles as ProfileJoin)?.name ?? null,
        avatarUrl: (row.profiles as ProfileJoin)?.avatar_url ?? null,
      }));
      setParticipants(ps);
      setIsSignedUp(ps.some((p) => p.id === user?.id));
    }
  }, [sparringId, user?.id]);

  useEffect(() => { void loadDetails(); }, [loadDetails]);

  useEffect(() => {
    if (sendError !== null) {
      Alert.alert('Fehler', sendError, [{ text: 'OK', onPress: clearSendError }]);
    }
  }, [sendError, clearSendError]);

  async function handleToggleSignup() {
    if (signupLoading) return;
    // Joining requires accepting the Sparr-Grundregeln first; cancelling does not.
    if (!isSignedUp) {
      setConsentVisible(true);
      return;
    }
    setSignupLoading(true);
    await cancelSignup(sparringId);
    await loadDetails();
    setSignupLoading(false);
  }

  async function handleConfirmConsent(rulesVersion: number) {
    setSignupLoading(true);
    const { error } = await signUp(sparringId, rulesVersion);
    setConsentVisible(false);
    if (error !== null) {
      setSignupLoading(false);
      Alert.alert('Hinweis', error);
      return;
    }
    await loadDetails();
    setSignupLoading(false);
  }

  async function handleSend(text: string): Promise<boolean> {
    const verdict = checkText(text, bannedWords);
    if (!verdict.ok) {
      Alert.alert('Nachricht blockiert', filterErrorMessage(verdict.category));
      return false;
    }
    const { error } = await sendText(text);
    return error === null;
  }

  const isFull = sparringInfo !== null
    ? sparringInfo.signupCount >= sparringInfo.maxSlots
    : false;

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
          <Text style={styles.headerTitle} numberOfLines={1}>{sparringTitle}</Text>
          <Text style={styles.headerSub}>
            {getCountdown(scheduledAt)}
          </Text>
        </View>
        {isOrganizer ? (
          <TouchableOpacity onPress={() => setSettingsVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Info banner: address + slots */}
      {sparringInfo !== null && (
        <SparringChatInfoBanner
          address={sparringInfo.address}
          signupCount={sparringInfo.signupCount}
          maxSlots={sparringInfo.maxSlots}
        />
      )}

      {/* Messages */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <View style={styles.listWrap}>
          <FlatList
            ref={listRef}
            inverted
            data={newestFirst}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.messageList}
            onScroll={onScroll}
            scrollEventThrottle={100}
            // Keeps the reading position when messages arrive; follows them near the bottom.
            maintainVisibleContentPosition={MAINTAIN_POSITION}
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

      {/* Participant bar + Ich bin dabei (only when not organizer + active sparring) */}
      {!isOrganizer && !isReadOnly && (
        <SparringChatParticipantBar
          participants={participants}
          isSignedUp={isSignedUp}
          loading={signupLoading}
          isFull={isFull}
          onToggle={() => { void handleToggleSignup(); }}
        />
      )}

      {/* Sparring rules consent (gate before every signup) */}
      <SparringRulesConsentSheet
        visible={consentVisible}
        sparringTitle={sparringTitle}
        loading={signupLoading}
        onClose={() => setConsentVisible(false)}
        onConfirm={(rulesVersion) => { void handleConfirmConsent(rulesVersion); }}
      />

      {/* Read-only banner or input row */}
      {isReadOnly ? (
        <View style={[styles.readOnlyBanner, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.readOnlyText}>Dieses Sparring hat stattgefunden.</Text>
        </View>
      ) : (
        <ChatComposer
          sending={sending}
          bottomInset={insets.bottom}
          onSend={handleSend}
          leading={mediaEnabled ? (
            <ChatImagePicker
              onImageSelected={(uri) => { void sendImage(uri); }}
              disabled={sending}
            />
          ) : null}
        />
      )}

      {/* Settings Sheet */}
      {settingsVisible && (
        <TouchableOpacity
          style={styles.settingsOverlay}
          activeOpacity={1}
          onPress={() => setSettingsVisible(false)}
        >
          <TouchableOpacity
            style={[styles.settingsSheet, { paddingBottom: insets.bottom + 16 }]}
            activeOpacity={1}
          >
            <View style={styles.settingsHandleRow}>
              <View style={styles.settingsHandle} />
            </View>
            <Text style={styles.settingsTitle}>Chat-Einstellungen</Text>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Bilder und Videos erlauben</Text>
              <Switch
                value={mediaEnabled}
                onValueChange={() => { void toggleMedia(); }}
                trackColor={{ false: colors.border, true: colors.accentBlue }}
                thumbColor={colors.card}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
    fontSize:   12,
    color:      colors.textSecondary,
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
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent:  'flex-end',
  },
  settingsSheet: {
    backgroundColor:      colors.background,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingHorizontal:    24,
    paddingTop:           8,
  },
  settingsHandleRow: {
    alignItems:    'center',
    paddingBottom: 16,
  },
  settingsHandle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
  },
  settingsTitle: {
    fontSize:     18,
    fontWeight:   '700',
    color:        colors.text,
    marginBottom: 16,
  },
  settingsRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: 8,
  },
  settingsLabel: {
    fontSize: 15,
    color:    colors.text,
  },
});
