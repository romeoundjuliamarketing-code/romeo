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
  /** Overrides the generic placeholder (e.g. "Nachricht an die Gruppe …"). */
  placeholder?: string;
}

// Owns the draft so keystrokes re-render only this row, not the chat screen and its message list.
export default function ChatComposer({ sending, bottomInset, onSend, leading, placeholder }: Props) {
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
        placeholder={placeholder ?? t('chat.composerPlaceholder')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={placeholder ?? t('chat.composerPlaceholder')}
        multiline
        returnKeyType="send"
        onSubmitEditing={() => { void submit(); }}
        blurOnSubmit
      />
      <TouchableOpacity
        style={[styles.sendBtn, disabled && styles.sendBtnDisabled]}
        onPress={() => { void submit(); }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('chat.send')}
        accessibilityState={{ disabled }}
      >
        {sending
          ? <ActivityIndicator size="small" color={colors.card} />
          : <Ionicons name="arrow-up" size={20} color={disabled ? colors.textMuted : colors.card} />
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    paddingHorizontal: 16,
    paddingTop:        8,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    colors.fieldBorder,
    backgroundColor:   colors.background,
    gap:               8,
  },
  input: {
    flex:              1,
    minHeight:         44,
    maxHeight:         128,
    backgroundColor:   colors.card,
    borderRadius:      24,
    paddingHorizontal: 16,
    paddingTop:        12,
    paddingBottom:     12,
    fontSize:          16,
    lineHeight:        20,
    color:             colors.text,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       colors.fieldBorder,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: colors.accentBlue,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.hairline,
  },
});
