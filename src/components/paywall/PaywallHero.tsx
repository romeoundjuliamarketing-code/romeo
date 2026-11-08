import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import PremiumCoachArt from './PremiumCoachArt';

interface Props {
  onClose: () => void;
}

export default function PaywallHero({ onClose }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const benefits = [t('paywall.hero.premium.benefit1'), t('paywall.hero.premium.benefit2')];
  return (
    <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('paywall.hero.close')}>
          <MaterialCommunityIcons name="close" size={24} color={colors.headerTextPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.coaches}>
        <PremiumCoachArt />
      </View>

      <Text style={styles.title}>{t('paywall.hero.premium.title')}</Text>
      <View style={styles.benefits}>
        {benefits.map((item) => (
          <View key={item} style={styles.benefitRow}>
            <MaterialCommunityIcons name="check-circle" size={20} color={colors.gold} />
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
    borderBottomWidth: 2,
    borderBottomColor: colors.gold,
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
    marginTop: -32,
  },
  title: {
    marginTop: 16,
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: colors.gold,
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
