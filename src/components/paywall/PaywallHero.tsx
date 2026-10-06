import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
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

interface Props {
  plan: PlanKey;
  onClose: () => void;
}

export default function PaywallHero({ plan, onClose }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const benefits = [t(`paywall.hero.${plan}.benefit1`), t(`paywall.hero.${plan}.benefit2`)];
  return (
    <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('paywall.hero.close')}>
          <MaterialCommunityIcons name="close" size={24} color={colors.headerTextPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.coaches}>
        <Image source={COACH_BY_PLAN[plan]} style={styles.coach} resizeMode="contain" />
      </View>

      <Text style={styles.title}>{t(`paywall.hero.${plan}.title`)}</Text>
      <View style={styles.benefits}>
        {benefits.map((item) => (
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
