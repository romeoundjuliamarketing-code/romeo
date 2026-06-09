import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const BENEFITS = [
  {
    icon: 'map-marker-radius-outline' as const,
    text: 'Coaches mit Studioabo erscheinen auf der Sparr-Karte. Schüler in deiner Nähe finden dich direkt — und können ihren Fortschritt gezielt messen und verfolgen.',
  },
  {
    icon: 'account-group-outline' as const,
    text: 'Bis zu 8 Schüler erhalten Premium-Zugang über dein Abo',
  },
  {
    icon: 'calendar-edit-outline' as const,
    text: 'Stundenplan direkt in der App verwalten',
  },
  {
    icon: 'shield-check-outline' as const,
    text: 'Alle Funktionen des Einzelabos inklusive',
  },
];

interface Props {
  onSubscribePress: () => void;
}

export default function StepCoachSubscription({ onSubscribePress }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.benefitList}>
        {BENEFITS.map((b) => (
          <View key={b.text} style={styles.benefitRow}>
            <MaterialCommunityIcons name={b.icon} size={22} color={colors.accentBlue} />
            <Text style={styles.benefitText}>{b.text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.cta}
        onPress={onSubscribePress}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaLabel}>Jetzt abonnieren</Text>
      </TouchableOpacity>

      <Text style={styles.skipHint}>
        Du kannst das Abo jederzeit später in den Einstellungen abschliessen.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    gap: 24,
  },
  benefitList: {
    gap: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 22,
  },
  cta: {
    backgroundColor: colors.accentBlue,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  skipHint: {
    fontSize: 13,
    color: colors.inactive,
    textAlign: 'center',
    lineHeight: 18,
  },
});
