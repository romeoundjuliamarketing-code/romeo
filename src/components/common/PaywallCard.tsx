import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface PaywallCardProps {
  title: string;
  message: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export default function PaywallCard({
  title,
  message,
  ctaLabel = 'Abo ansehen',
  onPressCta,
}: PaywallCardProps): React.ReactElement {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="lock-outline" size={18} color={colors.accentBlue} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.message}>{message}</Text>
      {onPressCta !== undefined && (
        <TouchableOpacity style={styles.ctaBtn} onPress={onPressCta} activeOpacity={0.8}>
          <Text style={styles.ctaLabel}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.inactive,
    lineHeight: 20,
  },
  ctaBtn: {
    marginTop: 8,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentBlue,
  },
});
