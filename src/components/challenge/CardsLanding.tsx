import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';

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
            ? t('challenge.landing.subscriptionNeededPrice', { price: price.replace(/ /g, '\u00A0') })
            : t('challenge.landing.subscriptionNeeded')}
        </Text>
      ) : null}
    </View>
  );
}

// The flow in one line; wraps between steps on narrow screens or large text.
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

// Card on a timeline that runs to one marked moment: task -> opportunity. A
// picture of the idea, no numbers or promised results. Drawn at the measured width
// so card and moment sit exactly above their labels.
function FocusLine(): React.ReactElement {
  const [width, setWidth] = useState(0);
  const end = width - 14;
  return (
    <View style={styles.focusLine} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {width > 0 ? (
        <Svg width={width} height={32}>
          <Rect x={1} y={2} width={20} height={28} rx={4} stroke={colors.accentBlue} strokeWidth={2} fill={colors.dark} />
          <Line x1={6} y1={10} x2={16} y2={10} stroke={colors.accentBlue} strokeWidth={2} strokeLinecap="round" />
          <Line x1={32} y1={16} x2={end - 22} y2={16} stroke={colors.headerBorder} strokeWidth={2} strokeDasharray="2 6" strokeLinecap="round" />
          <Circle cx={end} cy={16} r={12} stroke={colors.accentBlue} strokeWidth={2} fill="none" />
          <Circle cx={end} cy={16} r={5} fill={colors.accentBlue} />
        </Svg>
      ) : null}
    </View>
  );
}

// One calm dark area showing what the card does in a round.
export function CardsFocusPanel(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.focus}>
      <Text style={styles.focusKicker}>{t('challenge.landing.focusKicker')}</Text>
      <Text style={styles.focusTitle}>{t('challenge.landing.focusTitle')}</Text>
      <Text style={styles.focusBody}>{t('challenge.landing.focusBody')}</Text>
      <View style={styles.focusGraphic} accessible accessibilityLabel={t('challenge.landing.focusGraphicLabel')}>
        <FocusLine />
        <View style={styles.focusLabels}>
          <Text style={styles.focusLabel}>{t('challenge.landing.focusTask')}</Text>
          <Text style={[styles.focusLabel, styles.focusLabelMoment]}>{t('challenge.landing.focusMoment')}</Text>
        </View>
      </View>
    </View>
  );
}

export function CardsSafetyNote(): React.ReactElement {
  const { t } = useTranslation();
  return <Text style={styles.safetyNote}>{t('challenge.landing.safetyNote')}</Text>;
}

const styles = StyleSheet.create({
  hero: { gap: 8 },
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
  stepsBlock: { gap: 8, alignItems: 'center' },
  steps: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', rowGap: 4, columnGap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepText: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 22 },
  partnerNote: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  focus: { backgroundColor: colors.dark, borderRadius: 24, padding: 24, gap: 8 },
  focusKicker: { color: colors.accentBlue, fontFamily: 'Inter_700Bold', fontSize: 12, lineHeight: 16, letterSpacing: 2 },
  focusTitle: { color: colors.headerTextPrimary, fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 30 },
  focusBody: { color: colors.headerTextSecondary, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  focusGraphic: { marginTop: 16, gap: 8 },
  focusLine: { height: 32 },
  focusLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  focusLabel: { color: colors.headerTextSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16 },
  focusLabelMoment: { color: colors.accentBlue, textAlign: 'right' },
  safetyNote: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
