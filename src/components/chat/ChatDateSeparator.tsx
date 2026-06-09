import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  label: string;
}

export default function ChatDateSeparator({ label }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.chip}>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems:      'center',
    paddingVertical: 8,
  },
  chip: {
    backgroundColor:   colors.border,
    borderRadius:      12,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  label: {
    fontSize:   12,
    color:      colors.textSecondary,
    fontWeight: '500',
  },
});
