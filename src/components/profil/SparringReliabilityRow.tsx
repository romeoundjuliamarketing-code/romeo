import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useSparringReliability } from '../../hooks/useSparringReliability';
import { formatReliability } from '../../utils/sparringReliability';

interface SparringReliabilityRowProps {
  userId: string | null;
  refetchTrigger?: number;
}

// Compact row showing the objective "X von Y bestätigten Treffen
// wahrgenommen" reliability quote in place of the sparring star average.
export default function SparringReliabilityRow({
  userId,
  refetchTrigger = 0,
}: SparringReliabilityRowProps): React.ReactElement {
  const { attended, committed } = useSparringReliability(userId, refetchTrigger);
  const { label, hasHistory } = formatReliability({ attended, committed });

  return (
    <View style={styles.row}>
      <Ionicons
        name="shield-checkmark-outline"
        size={16}
        color={hasHistory ? colors.accentBlue : colors.textSecondary}
      />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
