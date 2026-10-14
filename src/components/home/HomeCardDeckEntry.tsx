import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { SparringChallenge } from '../../data/sparringChallenges';
import { useTranslation } from 'react-i18next';
import HomeCardFan from './HomeCardFan';

interface Props {
  /** Fixed, delivered example cards for the fan (first one starts in front). */
  previews: SparringChallenge[];
  /** Opens the existing card game entry (onboarding, access and paywall live there). */
  onDraw:   () => void;
}

// "Sparring Cards" on Home: the cards are the motif. Small label, short
// headline, a large swipeable fan of real card fronts, a quiet swipe hint and
// the black "Spiel starten" button — free on the page background, no box.
export default function HomeCardDeckEntry({ previews, onDraw }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <Text style={styles.label} accessibilityRole="header">{t('home.cards.heading')}</Text>
      <Text style={styles.headline}>{t('home.cards.tagline')}</Text>

      <HomeCardFan cards={previews} onOpen={onDraw} />

      <Pressable
        onPress={onDraw}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityHint={t('home.cards.openHint')}
      >
        <Text style={styles.buttonText}>{t('home.cards.start')}</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.card} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.accentBlueText,
    textAlign: 'center',
  },
  headline: {
    marginTop: 8,
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    textTransform: 'uppercase',
    color: colors.text,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: colors.dark,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.card,
  },
});
