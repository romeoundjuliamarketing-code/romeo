import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  title:      string;
  icon:       React.ComponentProps<typeof Ionicons>['name'];
  iconLabel:  string;
  onPress:    () => void;
}

// Shared header for the challenge screen and its card browser.
export default function ChallengeHeader({
  title,
  icon,
  iconLabel,
  onPress,
}: Props): React.ReactElement {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={iconLabel}
      >
        <Ionicons name={icon} size={26} color={colors.headerTextPrimary} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      {/* Balances the button so the title stays centred */}
      <View style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
});
