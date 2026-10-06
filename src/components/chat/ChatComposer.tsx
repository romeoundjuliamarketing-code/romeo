import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

interface Props {
  sending:     boolean;
  bottomInset: number;
  /** Resolves true when the text was sent and the draft should be cleared. */
  onSend:      (text: string) => Promise<boolean>;
  leading?:    React.ReactNode;
}

// Owns the draft so keystrokes re-render only this row, not the chat screen and its message list.
export default function ChatComposer({ sending, bottomInset, onSend, leading }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const trimmed  = text.trim();
  const disabled = trimmed.length === 0 || sending;

  async function submit() {
    if (disabled) return;
    if (await onSend(trimmed)) setText('');
  }

  return (
    <View style={[styles.inputRow, { paddingBottom: bottomInset + 8 }]}>
      {leading}
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={t('chat.composerPlaceholder')}
        placeholderTextColor={colors.textSecondary}
        multiline
        returnKeyType="send"
        onSubmitEditing={() => { void submit(); }}
        blurOnSubmit
      />
      <TouchableOpacity
        style={[styles.sendBtn, disabled && styles.sendBtnDisabled]}
        onPress={() => { void submit(); }}
        disabled={disabled}
      >
        {sending
          ? <ActivityIndicator size="small" color={colors.card} />
          : <Ionicons name="send" size={18} color={colors.card} />
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
