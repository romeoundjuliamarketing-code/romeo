import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSkip: () => void;
}

export default function StepWeight({ value, onChange, onSkip }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(t) => {
            // Allow only numbers and one decimal point
            const clean = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
            onChange(clean);
          }}
          keyboardType="decimal-pad"
          placeholder="75"
          placeholderTextColor={colors.textSecondary}
          maxLength={5}
          autoFocus
        />
        <Text style={styles.unit}>kg</Text>
      </View>

      <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={styles.skipBtn}>
        <Text style={styles.skipText}>Lieber nicht angeben</Text>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    width: 120,
    height: 72,
    backgroundColor: colors.card,
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 32,
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
  unit: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
