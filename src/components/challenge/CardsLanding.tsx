import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const BENEFITS: { icon: IconName; titleKey: 'challenge.landing.benefit1Title' | 'challenge.landing.benefit2Title' | 'challenge.landing.benefit3Title'; bodyKey: 'challenge.landing.benefit1Body' | 'challenge.landing.benefit2Body' | 'challenge.landing.benefit3Body' }[] = [
  {
    icon: 'layers-outline',
    titleKey: 'challenge.landing.benefit1Title',
    bodyKey: 'challenge.landing.benefit1Body',
  },
  {
    icon: 'eye-outline',
    titleKey: 'challenge.landing.benefit2Title',
    bodyKey: 'challenge.landing.benefit2Body',
  },
  {
    icon: 'navigate-outline',
    titleKey: 'challenge.landing.benefit3Title',
    bodyKey: 'challenge.landing.benefit3Body',
  },
];

// Compact entry above the card stage. Full width, so the headline never squeezes into
// a narrow column next to an illustration.
export function CardsHero(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.hero}>
      <Text style={styles.kicker}>{t('challenge.landing.kicker')}</Text>
      <Text style={styles.heroTitle} accessibilityRole="header">{t('challenge.landing.heroTitle')}</Text>
      <Text style={styles.heroBody}>{t('challenge.landing.heroBody')}</Text>
      <View style={styles.disciplinePill}><Text style={styles.disciplineText}>{t('challenge.landing.discipline')}</Text></View>
    </View>
  );
}

const STEP_KEYS = ['challenge.landing.step1', 'challenge.landing.step2', 'challenge.landing.step3'] as const;

// Start button for everyone — the game route keeps its own access check — plus the
// three steps and the single way into the intro.
export function CardsStart({ onStart, onHowItWorks }: { onStart: () => void; onHowItWorks: () => void }): React.ReactElement {
  const { t } = useTranslation();
  const steps = STEP_KEYS.map((key) => t(key));
  return (
    <View style={styles.start}>
      <TouchableOpacity style={styles.primaryButton} onPress={onStart} accessibilityRole="button">
        <Text style={styles.primaryButtonText}>{t('challenge.landing.start')}</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.card} />
      </TouchableOpacity>
      <View style={styles.steps} accessible accessibilityLabel={steps.join(t('challenge.landing.stepsJoiner'))}>
        {steps.map((step, i) => (
          <View key={step} style={styles.step}>
            {i > 0 ? <Ionicons name="arrow-forward" size={14} color={colors.accentBlueText} /> : null}
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.howLink} onPress={onHowItWorks} accessibilityRole="button">
        <Text style={styles.howLinkText}>{t('challenge.landing.howItWorks')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function CardsBenefits(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.benefits}>
      {BENEFITS.map((benefit) => (
        <View key={benefit.titleKey} style={styles.benefitRow}>
          <View style={styles.benefitIcon}><Ionicons name={benefit.icon} size={24} color={colors.accentBlueText} /></View>
          <View style={styles.benefitCopy}>
            <Text style={styles.benefitTitle}>{t(benefit.titleKey)}</Text>
            <Text style={styles.bodyText}>{t(benefit.bodyKey)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function CardsOffer({ price, loading, onOpen }: { price: string | null; loading: boolean; onOpen: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.offer}>
      <Text style={styles.offerKicker}>{t('challenge.landing.offerKicker')}</Text>
      <Text style={styles.offerTitle}>{t('challenge.landing.offerTitle')}</Text>
      <Text style={styles.offerBody}>{t('challenge.landing.offerBody')}</Text>
      <Text style={styles.offerPrice}>{loading ? t('challenge.landing.offerLoading') : price ?? t('challenge.landing.offerSeePrices')}</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={onOpen} accessibilityRole="button">
        <Text style={styles.primaryButtonText}>{t('challenge.landing.offerButton')}</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.card} />
      </TouchableOpacity>
      <Text style={styles.offerFootnote}>{t('challenge.landing.offerFootnote')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
  kicker: { color: colors.accentBlueText, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 2 },
  heroTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 38 },
  heroBody: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 24 },
  disciplinePill: { alignSelf: 'flex-start', marginTop: 8, borderColor: colors.hairline, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4 },
  disciplineText: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  start: { gap: 16 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', rowGap: 4, columnGap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepText: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
  howLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  howLinkText: { color: colors.accentBlueText, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  primaryButton: { minHeight: 48, backgroundColor: colors.accentBlue, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 15 },
  benefits: { gap: 8 },
  benefitRow: { flexDirection: 'row', gap: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  benefitIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.accentBlueTint, alignItems: 'center', justifyContent: 'center' },
  benefitCopy: { flex: 1, gap: 8 },
  benefitTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 17, lineHeight: 24 },
  bodyText: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 24 },
  offer: { backgroundColor: colors.dark, borderRadius: 24, padding: 24, gap: 16 },
  offerKicker: { color: colors.headerTextSecondary, fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 2 },
  offerTitle: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 32 },
  offerBody: { color: colors.headerTextPrimary, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 24 },
  offerPrice: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 24 },
  offerFootnote: { color: colors.headerTextSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 20 },
});
