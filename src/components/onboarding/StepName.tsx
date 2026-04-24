import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function StepName({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="Dein Name"
        placeholderTextColor={colors.textSecondary}
        autoFocus
        autoCapitalize="words"
        maxLength={50}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 24,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
