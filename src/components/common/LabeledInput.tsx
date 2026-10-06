import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

// Plain labelled text field for sheets (label above, error below).
export default function LabeledInput({
  label, value, onChange, max, error, autoFocus = false, multiline = false, keyboardType, autoCapitalize, placeholder,
}: {
  label:           string;
  value:           string;
  onChange:        (v: string) => void;
  max:             number;
  error?:          string;
  autoFocus?:      boolean;
  multiline?:      boolean;
  keyboardType?:   'default' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  placeholder?:    string;
}): React.ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti, error !== undefined && styles.inputError]}
        value={value}
        onChangeText={onChange}
        maxLength={max}
        autoFocus={autoFocus}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? (multiline ? 'sentences' : 'words')}
        autoCorrect={keyboardType === 'url' ? false : undefined}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
      />
      {error !== undefined && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text,
  },
  input: {
    minHeight:         48,
    paddingHorizontal: 16,
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       colors.fieldBorder,
    backgroundColor:   colors.card,
    fontSize:          16,
    color:             colors.text,
  },
  inputMulti: {
    minHeight:         96,
    paddingVertical:   16,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.deleteRed,
  },
  error: {
    fontSize: 13,
    color:    colors.deleteRed,
  },
});
