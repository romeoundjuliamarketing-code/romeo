import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export interface PlanCardProps {
  title: string;
  subtitle: string;
  price: string;
  details: string[];
  badge?: string;
  active: boolean;
  available: boolean;
  highlighted?: boolean;
  loading?: boolean;
  onPress: () => void;
}

export default function PlanCard({
  title, subtitle, price, details, badge, active, available, highlighted = false, loading = false, onPress,
}: PlanCardProps): React.ReactElement {
  const label = active ? 'Aktiv' : available ? 'Abo auswählen' : 'Derzeit nicht verfügbar';
  return (
    <View style={[styles.planCard, highlighted && styles.planCardHighlighted]}>
      {badge !== undefined && <Text style={styles.badge}>{badge}</Text>}
      <Text style={styles.planTitle}>{title}</Text>
      <Text style={styles.planSubtitle}>{subtitle}</Text>
      <Text style={styles.planPrice}>{price}</Text>

      <View style={styles.detailList}>
        {details.map((item) => (
          <View key={item} style={styles.detailRow}>
            <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.accentBlue} />
            <Text style={styles.detailText}>{item}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.planButton, highlighted && styles.planButtonHighlighted]}
        onPress={onPress}
        disabled={loading || active || !available}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator size="small" color={highlighted ? colors.card : colors.accentBlue} />
        ) : (
          <Text style={[styles.planButtonLabel, highlighted && styles.planButtonLabelHighlighted]}>{label}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  planCardHighlighted: {
    borderColor: colors.accentBlue,
    borderWidth: 2,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  planSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.inactive,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
    marginBottom: 8,
  },
  detailList: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  planButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  planButtonHighlighted: {
    backgroundColor: colors.accentBlue,
  },
  planButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  planButtonLabelHighlighted: {
    color: colors.card,
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentBlue,
    marginBottom: 8,
  },
});
