import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export interface PlanOptionProps {
  title: string;
  subtitle: string;
  /** Localized store price, undefined while the package is unavailable. */
  price: string | undefined;
  badge?: string;
  selected: boolean;
  active: boolean;
  onPress: () => void;
}

export default function PlanOption({
  title, subtitle, price, badge, selected, active, onPress,
}: PlanOptionProps): React.ReactElement {
  const disabled = active || price === undefined;
  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
    >
      <MaterialCommunityIcons
        name={selected ? 'radiobox-marked' : 'radiobox-blank'}
        size={24}
        color={selected ? colors.accentBlue : colors.inactive}
      />
      <View style={styles.texts}>
        {badge !== undefined && <Text style={styles.badge}>{badge}</Text>}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.priceBox}>
        {active ? (
          <Text style={styles.activeTag}>Aktiv</Text>
        ) : price === undefined ? (
          <Text style={styles.unavailable}>Nicht verfügbar</Text>
        ) : (
          <>
            <Text style={styles.price}>{price}</Text>
            <Text style={styles.period}>pro Monat</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rowSelected: {
    borderColor: colors.accentBlue,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.accentBlueSoft,
    color: colors.accentBlueText,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textMuted,
  },
  priceBox: {
    alignItems: 'flex-end',
  },
  price: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: colors.text,
  },
  period: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.textMuted,
  },
  activeTag: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: colors.accentBlueText,
  },
  unavailable: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.textMuted,
  },
});
