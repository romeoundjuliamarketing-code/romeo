import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { VerificationTier } from '../../utils/verificationTier';

interface VerifiedBadgeProps {
  tier: VerificationTier;
  showLabel?: boolean;
  size?: number;
}

// Shows a checkmark for the 'verified' tier. Renders nothing otherwise.
export default function VerifiedBadge({ tier, showLabel = false, size = 16 }: VerifiedBadgeProps) {
  if (tier !== 'verified') return null;
  return (
    <View style={styles.row}>
      <Ionicons name="checkmark-circle" size={size} color={colors.accentBlue} />
      {showLabel && <Text style={styles.label}>Verifiziert</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.accentBlue },
});
