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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { useSparringChat } from '../hooks/useSparringChat';
import { useAuth } from '../context/AuthContext';
import type { SparringMessage } from '../types/database.types';

type NavProp    = NativeStackNavigationProp<RootStackParamList, 'SparringChat'>;
type RoutePropT = RouteProp<RootStackParamList, 'SparringChat'>;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function SparringChatScreen(): React.ReactElement {
  const navigation = useNavigation<NavProp>();
  const { params }  = useRoute<RoutePropT>();
  const { sparringId, otherUserId, otherUserName } = params;

  const { user } = useAuth();
  const { messages, loading, sending, sendMessage, markAllRead } =
    useSparringChat(sparringId, otherUserId);

  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<SparringMessage>>(null);

  // Mark messages as read when screen opens
  useEffect(() => {
    void markAllRead();
  }, [markAllRead]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  async function handleSend(): Promise<void> {
    if (draft.trim().length === 0) return;
    const text = draft.trim();
    setDraft('');
    await sendMessage(text);
  }

  function renderMessage({ item, index }: { item: SparringMessage; index: number }): React.ReactElement {
    const isOwn      = item.sender_id === user?.id;
    const prevItem   = index > 0 ? messages[index - 1] : null;
    const showDate   = prevItem === null ||
      formatDate(item.created_at) !== formatDate(prevItem.created_at);

    return (
      <>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>
            {item.content}
          </Text>
          <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerName} numberOfLines={1}>{otherUserName}</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="large" color={colors.accentBlue} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Noch keine Nachrichten. Schreib etwas!</Text>
            }
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Nachricht..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={1000}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (draft.trim().length === 0 || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={draft.trim().length === 0 || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color={colors.card} />
              : <Ionicons name="send" size={18} color={colors.card} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: colors.background },
  flex:      { flex: 1 },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   16,
    borderBottomWidth:  1,
    borderBottomColor: colors.border,
    backgroundColor:   colors.card,
  },
  headerName: {
    flex:             1,
    textAlign:        'center',
    fontSize:         16,
    fontWeight:       '700',
    color:            colors.text,
    marginHorizontal: 8,
  },
  headerRight: { width: 24 },
  centerLoader: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  messageList: {
    padding:        16,
    gap:             8,
    flexGrow:        1,
    justifyContent: 'flex-end',
  },
  dateSeparator: {
    alignItems:    'center',
    marginVertical: 8,
  },
  dateSeparatorText: {
    fontSize:   11,
    color:      colors.textSecondary,
    fontWeight: '500',
  },
  bubble: {
    maxWidth:          '80%',
    backgroundColor:   colors.card,
    borderRadius:      16,
    paddingHorizontal: 16,
    paddingVertical:   8,
    alignSelf:         'flex-start',
    gap:                4,
  },
  bubbleOwn: {
    alignSelf:       'flex-end',
    backgroundColor: colors.accentBlue,
  },
  bubbleOther:   {},
  bubbleText:    { fontSize: 15, color: colors.text },
  bubbleTextOwn: { color: colors.card },
  bubbleTime:    { fontSize: 11, color: colors.textSecondary, textAlign: 'right' },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.65)' },
  emptyText: {
    textAlign: 'center',
    color:     colors.textSecondary,
    fontSize:  14,
    marginTop: 40,
  },
  inputBar: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    gap:                8,
    padding:           16,
    borderTopWidth:     1,
    borderTopColor:    colors.border,
    backgroundColor:   colors.card,
  },
  input: {
    flex:              1,
    backgroundColor:   colors.background,
    borderRadius:      24,
    paddingHorizontal: 16,
    paddingVertical:    8,
    fontSize:          15,
    color:             colors.text,
    maxHeight:         120,
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
    backgroundColor: colors.inactive,
  },
});
