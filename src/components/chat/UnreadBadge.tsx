import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  count: number;
}

export default function UnreadBadge({ count }: Props) {
  if (count === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth:          18,
    height:            18,
    borderRadius:      9,
    backgroundColor:   colors.accentBlue,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 4,
  },
  text: {
    fontSize:   11,
    fontWeight: '700',
    color:      colors.card,
  },
});
