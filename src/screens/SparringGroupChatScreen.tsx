import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
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
import SparringChatInfoBanner from '../components/chat/SparringChatInfoBanner';
import SparringChatParticipantBar from '../components/chat/SparringChatParticipantBar';
import type { Participant } from '../components/chat/SparringChatParticipantBar';
import type { RootStackParamList } from '../navigation/types';
import type { GroupMessageWithSender } from '../hooks/useSparringGroupChat';
import { isSameDay, chatDateLabel } from '../utils/chatDate';
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

export default function SparringGroupChatScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<Props['route']>();
  const { user }   = useAuth();

  const { sparringId, sparringTitle, scheduledAt, durationMin, isOrganizer } = params;

  const { messages, loading, sending, isReadOnly, sendError, sendText, sendImage, clearSendError } =
    useSparringGroupChat(sparringId, scheduledAt, durationMin);
  const { mediaEnabled, toggleMedia } =
    useSparringChatSettings(sparringId, isOrganizer);
  const { signUp, cancelSignup } = useSparringActions();
  const { bannedWords } = useBannedWords();

  const [inputText,       setInputText]       = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const listRef         = useRef<FlatList<GroupMessageWithSender>>(null);
  const isNearBottomRef = useRef(true);

  // Sparring info + participants
  const [sparringInfo, setSparringInfo] = useState<{
    address: string; signupCount: number; maxSlots: number;
  } | null>(null);
  const [participants,   setParticipants]   = useState<Participant[]>([]);
  const [isSignedUp,     setIsSignedUp]     = useState(false);
  const [signupLoading,  setSignupLoading]  = useState(false);

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
        .eq('sparring_id', sparringId),
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
    setSignupLoading(true);
    if (isSignedUp) {
      await cancelSignup(sparringId);
    } else {
      const { error } = await signUp(sparringId);
      if (error !== null) {
        setSignupLoading(false);
        Alert.alert('Hinweis', error);
        return;
      }
    }
    await loadDetails();
    setSignupLoading(false);
  }

  async function handleSend() {
    const text = inputText.trim();
    if (text.length === 0 || sending) return;
    const verdict = checkText(text, bannedWords);
    if (!verdict.ok) {
      Alert.alert('Nachricht blockiert', filterErrorMessage(verdict.category));
      return;
    }
    isNearBottomRef.current = true;
    const { error } = await sendText(text);
    if (error === null) setInputText('');
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
              prev.sender_id !== item.sender_id ||
              !!prev.is_system ||
              !!item.is_system ||
              showDateSeparator;

            const isLastInGroup =
              next === null ||
              next.sender_id !== item.sender_id ||
              !!next.is_system ||
              !!item.is_system ||
              !isSameDay(new Date(item.created_at), new Date(next.created_at));

            return (
              <>
                {showDateSeparator && (
                  <ChatDateSeparator label={chatDateLabel(item.created_at)} />
                )}
                <GroupMessageBubble
                  message={item}
                  isOwn={user?.id === item.sender_id}
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
        />
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

      {/* Read-only banner or input row */}
      {isReadOnly ? (
        <View style={[styles.readOnlyBanner, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={styles.readOnlyText}>Dieses Sparring hat stattgefunden.</Text>
        </View>
      ) : (
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          {mediaEnabled && (
            <ChatImagePicker
              onImageSelected={(uri) => { void sendImage(uri); }}
              disabled={sending}
            />
          )}
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
  messageList: {
    paddingVertical: 8,
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
