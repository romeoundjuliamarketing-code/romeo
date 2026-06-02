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
import GroupMessageBubble from '../components/chat/GroupMessageBubble';
import ChatImagePicker from '../components/chat/ChatImagePicker';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import type { GroupMessageWithSender } from '../hooks/useSparringGroupChat';

type Props = NativeStackScreenProps<RootStackParamList, 'SparringGroupChat'>;

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

  const [inputText,       setInputText]       = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const listRef = useRef<FlatList<GroupMessageWithSender>>(null);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  useEffect(() => {
    if (sendError !== null) {
      Alert.alert('Fehler', sendError, [{ text: 'OK', onPress: clearSendError }]);
    }
  }, [sendError, clearSendError]);

  async function handleSend() {
    const text = inputText.trim();
    if (text.length === 0 || sending) return;
    setInputText('');
    await sendText(text);
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
          <Text style={styles.headerTitle} numberOfLines={1}>{sparringTitle}</Text>
          <Text style={styles.headerSub}>{formatDate(scheduledAt)}</Text>
        </View>
        {isOrganizer ? (
          <TouchableOpacity
            onPress={() => setSettingsVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <GroupMessageBubble
              message={item}
              isOwn={user?.id === item.sender_id}
            />
          )}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Read-only banner or input */}
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
