import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

// Only letters (including German umlauts and extended Latin), spaces, hyphens, apostrophes
const NAME_REGEX        = /^[a-zA-ZäöüÄÖÜßÀ-ÖØ-öø-ÿ\s\-']+$/;
// Must contain at least one vowel
const VOWEL_REGEX       = /[aeiouäöüyAEIOUÄÖÜY]/;
// No 3+ consecutive identical characters (e.g. "aaa", "lll")
const REPEATED_REGEX    = /(.)\1{2}/;

export function isValidName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) return false;
  if (!NAME_REGEX.test(trimmed)) return false;
  if (!VOWEL_REGEX.test(trimmed)) return false;
  if (REPEATED_REGEX.test(trimmed)) return false;
  // At least 2 distinct characters (rules out "aa", "bb")
  const distinct = new Set(trimmed.toLowerCase().replace(/[\s\-']/g, ''));
  if (distinct.size < 2) return false;
  return true;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function StepName({ value, onChange }: Props) {
  // Show error only after user has typed something
  const hasInput   = value.trim().length > 0;
  const showError  = hasInput && !isValidName(value);

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, showError && styles.inputError]}
        value={value}
        onChangeText={onChange}
        placeholder="Dein Name"
        placeholderTextColor={colors.textSecondary}
        autoFocus
        autoCapitalize="words"
        maxLength={50}
        returnKeyType="done"
      />
      {showError && (
        <Text style={styles.errorText}>
          Bitte gib deinen echten Namen ein
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  input: {
    width: '100%',
    height: 72,
    backgroundColor: colors.card,
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  inputError: {
    borderColor: colors.deleteRed,
  },
  errorText: {
    fontSize: 13,
    color: colors.deleteRed,
    textAlign: 'center',
    fontWeight: '500',
  },
});
