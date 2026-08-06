import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import SparrLogo from '../common/SparrLogo';
import { CARD_RADIUS, cardShadow } from './cardLayout';
import type { CardSize } from './cardLayout';

interface Props {
  size: CardSize;
}

// Back of a challenge card. Only the top card of the stack ever renders this —
// the cards below are plain filled surfaces without content.
export default function ChallengeCardBack({ size }: Props): React.ReactElement {
  const logoSize = Math.round(size.width * 0.4);

  return (
    <View style={[styles.card, { width: size.width, height: size.height }, cardShadow]}>
      <View style={styles.inner}>
        <SparrLogo size={logoSize} />
        <Text style={styles.label}>SPARRING CHALLENGE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.cardBack,
    padding: 8,
  },
  // Thin blue inset line — the only decoration on the back.
  inner: {
    flex: 1,
    borderRadius: CARD_RADIUS - 8,
    borderWidth: 1,
    borderColor: colors.accentBlueMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.headerTextSecondary,
  },
});
