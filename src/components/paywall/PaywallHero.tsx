import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { PlanKey } from '../../utils/subscriptionPlans';

const COACH_CREATOR = require('../../../assets/coach/paywall_ersteller.png');
const COACH_CARDS = require('../../../assets/coach/paywall_karten.png');
const COACH_BUNDLE = require('../../../assets/coach/paywall_paket.png');

const COACH_BY_PLAN: Record<PlanKey, number> = {
  creator: COACH_CREATOR,
  cards: COACH_CARDS,
  bundle: COACH_BUNDLE,
};

const HERO_COPY: Record<PlanKey, { title: string; benefits: string[] }> = {
  creator: {
    title: 'Eigene Sparrings erstellen',
    benefits: ['Sparrings anlegen und auf der Karte zeigen', 'Beitreten bleibt für alle kostenlos'],
  },
  cards: {
    title: 'Das komplette Kartenspiel',
    benefits: ['Alle verfügbaren Karten für Kickboxen / K1', 'Karten ziehen und im Sparring umsetzen'],
  },
  bundle: {
    title: 'Ersteller + Karten',
    benefits: ['Sparrings anlegen und auf der Karte zeigen', 'Komplettes Kartenspiel für Kickboxen / K1'],
  },
};

interface Props {
  plan: PlanKey;
  onClose: () => void;
}

export default function PaywallHero({ plan, onClose }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const copy = HERO_COPY[plan];
  return (
    <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Schließen">
          <MaterialCommunityIcons name="close" size={24} color={colors.headerTextPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.coaches}>
        <Image source={COACH_BY_PLAN[plan]} style={styles.coach} resizeMode="contain" />
      </View>

      <Text style={styles.title}>{copy.title}</Text>
      <View style={styles.benefits}>
        {copy.benefits.map((item) => (
          <View key={item} style={styles.benefitRow}>
            <MaterialCommunityIcons name="check-circle" size={20} color={colors.accentBlue} />
            <Text style={styles.benefitText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.dark,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coaches: {
    flexDirection: 'row',
    justifyContent: 'center',
    height: 192,
  },
  coach: {
    width: 128,
    height: 192,
  },
  title: {
    marginTop: 16,
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: colors.headerTextPrimary,
    textAlign: 'center',
  },
  benefits: {
    marginTop: 16,
    gap: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 20,
    color: colors.headerTextSecondary,
  },
});
