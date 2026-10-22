import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';

// Waving coach cut off flat below the hands, so it sits on the lower edge of the
// entry. Trimmed from halber_coach.png (418 x 402).
const COACH_PEEK = require('../../../assets/coach/coach-peek.png');

const STEP_KEYS = ['challenge.landing.step1', 'challenge.landing.step2', 'challenge.landing.step3'] as const;

// Compact entry above the card stage: brand line with the discipline beside it.
export function CardsHero(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <Text style={styles.kicker}>{t('challenge.landing.kicker')}</Text>
        <View style={styles.discipline}>
          <Text style={styles.disciplineText}>{t('challenge.landing.discipline')}</Text>
        </View>
      </View>
      <Text style={styles.heroTitle} accessibilityRole="header">{t('challenge.landing.heroTitle')}</Text>
      <Text style={styles.heroBody}>{t('challenge.landing.heroBody')}</Text>
    </View>
  );
}

interface CtaProps {
  onStart: () => void;
  // Shown only without access; the price only when the store delivered it.
  needsSubscription: boolean;
  // Localized price with its billing period, e.g. "4,99 € / Monat".
  price: string | null;
}

// Main action. The game route keeps its own access check; without access the
// caller routes through the coach invite to the paywall.
export function CardsCta({ onStart, needsSubscription, price }: CtaProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.cta}>
      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        onPress={onStart}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>{t('challenge.landing.start')}</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.card} />
      </Pressable>
      {needsSubscription ? (
        <Text style={styles.ctaNote}>
          {price !== null
            // Non-breaking spaces keep the price on one line.
            ? t('challenge.landing.subscriptionNote', { price: price.replace(/ /g, '\u00A0') })
            : t('challenge.landing.subscriptionNeeded')}
        </Text>
      ) : null}
    </View>
  );
}

// Invitation to the explanation: the coach on a light blue area, one tap target
// as a whole (the arrow is part of it). Open to everyone, with or without access.
export function CardsBenefitEntry({ onPress }: { onPress: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Pressable
      style={({ pressed }) => [styles.entry, pressed && styles.entryPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t('challenge.landing.benefitEntryTitle')} ${t('challenge.landing.benefitEntryBody')}`}
      accessibilityHint={t('challenge.landing.benefitEntryHint')}
    >
      <Image source={COACH_PEEK} style={styles.entryCoach} resizeMode="contain" accessibilityIgnoresInvertColors />
      <View style={styles.entryText}>
        <Text style={styles.entryTitle}>{t('challenge.landing.benefitEntryTitle')}</Text>
        <Text style={styles.entryBody}>{t('challenge.landing.benefitEntryBody')}</Text>
      </View>
      <View style={styles.entryArrow}>
        <Ionicons name="arrow-down" size={20} color={colors.card} />
      </View>
    </Pressable>
  );
}

// The flow in one line (part of the explanation); wraps between steps on narrow screens or large text.
export function CardsSteps(): React.ReactElement {
  const { t } = useTranslation();
  const steps = STEP_KEYS.map((key) => t(key));
  return (
    <View style={styles.stepsBlock}>
      <View
        style={styles.steps}
        accessible
        accessibilityLabel={`${t('challenge.landing.stepsLabel')}: ${steps.join(t('challenge.landing.stepsJoiner'))}`}
      >
        {steps.map((step, i) => (
          <View key={step} style={styles.step}>
            {i > 0 ? <Ionicons name="arrow-forward" size={16} color={colors.accentBlueText} /> : null}
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.partnerNote}>{t('challenge.landing.partnerNote')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Small gap to the deck: the tilted backs rise a little above the stage.
  hero: { gap: 8, marginBottom: 8 },
  heroTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kicker: { color: colors.accentBlueText, fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 2 },
  discipline: { borderWidth: 1, borderColor: colors.hairline, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4 },
  disciplineText: { color: colors.textMuted, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16 },
  heroTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 34, letterSpacing: -0.5 },
  heroBody: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  cta: { gap: 8 },
  primaryButton: { minHeight: 56, backgroundColor: colors.accentBlue, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonPressed: { backgroundColor: colors.accentBluePressed, transform: [{ scale: 0.98 }] },
  primaryButtonText: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 17, lineHeight: 24 },
  ctaNote: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, backgroundColor: colors.accentBlueTint, paddingLeft: 8, paddingRight: 16, overflow: 'hidden' },
  entryPressed: { backgroundColor: colors.accentBlueSoft, transform: [{ scale: 0.98 }] },
  // Rests on the lower edge; the area grows with the text, the coach keeps its size.
  entryCoach: { alignSelf: 'flex-end', width: 72, height: 69 },
  entryText: { flex: 1, gap: 4, paddingVertical: 16 },
  entryTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 19, lineHeight: 24 },
  entryBody: { color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  entryArrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentBlue, alignItems: 'center', justifyContent: 'center' },
  stepsBlock: { gap: 8, alignItems: 'flex-start' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center', rowGap: 4, columnGap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepText: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 22 },
  partnerNote: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
});
