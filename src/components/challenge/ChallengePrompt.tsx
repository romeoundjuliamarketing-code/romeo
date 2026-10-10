import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

interface Props {
  // A card lies face up — the prompt then stops asking for a draw.
  revealed:  boolean;
  deckEmpty: boolean;
}

// The line above the deck: asks for a draw, then frames the drawn card.
export default function ChallengePrompt({ revealed, deckEmpty }: Props): React.ReactElement {
  const { t } = useTranslation();
  const title = deckEmpty
    ? t('challenge.noCards')
    : revealed ? t('challenge.screen.revealedTitle') : t('challenge.screen.inviteTitle');
  const body = deckEmpty
    ? null
    : revealed ? t('challenge.screen.revealedBody') : t('challenge.screen.inviteBody');

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>{title}</Text>
      {body !== null ? <Text style={styles.body} maxFontSizeMultiplier={1.4}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    color: colors.headerTextPrimary,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.headerTextSecondary,
  },
});
