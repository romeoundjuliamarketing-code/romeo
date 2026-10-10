import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  label: string;
}

// Day change: small centred label between two fine lines, clearly different
// from the system event lines in the history.
export default function ChatDateSeparator({ label }: Props) {
  return (
    <View style={styles.wrapper} accessibilityRole="header">
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingVertical:   16,
    gap:               8,
  },
  line: {
    flex:            1,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: colors.fieldBorder,
  },
  label: {
    fontSize:   12,
    fontWeight: '600',
    color:      colors.textMuted,
  },
});
