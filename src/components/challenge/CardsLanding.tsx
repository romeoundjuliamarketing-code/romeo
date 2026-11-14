import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';
import type { PaywallCta } from '../../utils/paywallTrial';

const STEP_KEYS = ['challenge.landing.step1', 'challenge.landing.step2'] as const;

// Matches a regular space; replaced by a non-breaking one so the price stays on one line.
const SPACE = / /g;
const NBSP = String.fromCharCode(160);

// What this is: one small meta line, the page title and one line of benefit.
export function CardsHero(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.hero}>
      <Text style={styles.meta}>
        {t('challenge.landing.metaLine', { kicker: t('challenge.landing.kicker'), discipline: t('challenge.landing.discipline') })}
      </Text>
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
  // Paywall wording when the store offers this account a free trial.
  trial: PaywallCta | null;
}

// Main action. The game route keeps its own access check; without access the
// caller routes through the coach invite to the paywall.
export function CardsCta({ onStart, needsSubscription, price, trial }: CtaProps): React.ReactElement {
  const { t } = useTranslation();
  const trialCta = needsSubscription ? trial : null;
  const label = trialCta !== null ? trialCta.label : t('challenge.landing.start');
  const note = !needsSubscription ? null
    : trialCta !== null ? trialCta.note
    : price !== null ? t('challenge.landing.subscriptionNote', { price: price.replace(SPACE, NBSP) })
    : t('challenge.landing.subscriptionNeeded');
  return (
    <View style={styles.cta}>
      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        onPress={onStart}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>{label}</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.card} />
      </Pressable>
      {note !== null ? <Text style={styles.ctaNote}>{note}</Text> : null}
    </View>
  );
}

// Plain text link under the button; scrolls to the explanation.
export function CardsHowLink({ onPress }: { onPress: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Pressable
      style={({ pressed }) => [styles.howLink, pressed && styles.howLinkPressed]}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityHint={t('challenge.landing.howItWorksHint')}
    >
      <Text style={styles.howLinkText}>{t('challenge.landing.howItWorks')}</Text>
    </Pressable>
  );
}

// The flow in one line; wraps between steps on narrow screens or large text.
export function CardsSteps(): React.ReactElement {
  const { t } = useTranslation();
  const steps = STEP_KEYS.map((key) => t(key));
  return (
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
  );
}

// Type scale of the page: 28 title, 22 section headings, 16 body, 13 muted hints.
const styles = StyleSheet.create({
  // Small gap to the deck: the tilted backs rise a little above the stage.
  hero: { gap: 8, marginBottom: 8 },
  meta: { color: colors.textMuted, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 16 },
  heroTitle: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  heroBody: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },
  cta: { gap: 8 },
  primaryButton: { minHeight: 56, backgroundColor: colors.accentBlue, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonPressed: { backgroundColor: colors.accentBluePressed, transform: [{ scale: 0.98 }] },
  primaryButtonText: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 16, lineHeight: 24 },
  ctaNote: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 16, textAlign: 'center' },
  howLink: { alignSelf: 'center', minHeight: 40, paddingHorizontal: 16, justifyContent: 'center' },
  howLinkPressed: { opacity: 0.6 },
  howLinkText: { color: colors.accentBlueText, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 16, textDecorationLine: 'underline' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', rowGap: 4, columnGap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepText: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 24 },
});
