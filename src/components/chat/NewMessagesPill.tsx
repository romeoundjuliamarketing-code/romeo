import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  onPress: () => void;
}

// Shown when messages arrive while the user reads older ones; tap jumps to the latest.
export default function NewMessagesPill({ onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.pill}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Zu neuen Nachrichten springen"
    >
      <Ionicons name="arrow-down" size={16} color={colors.card} />
      <Text style={styles.label}>Neue Nachrichten</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    position:          'absolute',
    alignSelf:         'center',
    bottom:            16,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      24,
    backgroundColor:   colors.accentBlue,
  },
  label: {
    color:      colors.card,
    fontSize:   13,
    fontWeight: '600',
  },
});
