import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSkip: () => void;
}

export default function StepInviteCode({ value, onChange, onSkip }: Props) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(t) => onChange(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        placeholder="XXXXXX"
        placeholderTextColor={colors.textSecondary}
        autoFocus
        autoCapitalize="characters"
        maxLength={6}
        returnKeyType="done"
      />
      <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={styles.skipBtn}>
        <Text style={styles.skipText}>Kein Code vorhanden</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  input: {
    width: 180,
    height: 72,
    backgroundColor: colors.card,
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
    letterSpacing: 6,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipText: {
    fontSize: 15,
    color: colors.accentBlue,
    fontWeight: '600',
  },
});
