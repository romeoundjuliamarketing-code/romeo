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
      <View style={styles.frame}>
        <View style={styles.inner}>
          <SparrLogo size={logoSize} />
          <Text style={styles.label}>SPARRING CHALLENGE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.cardBack,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    padding: 8,
  },
  // Printed double frame, as on the back of a real deck.
  frame: {
    flex: 1,
    borderRadius: CARD_RADIUS - 8,
    borderWidth: 1,
    borderColor: colors.accentBlueMuted,
    padding: 8,
  },
  inner: {
    flex: 1,
    borderRadius: CARD_RADIUS - 16,
    borderWidth: 1,
    borderColor: colors.accentBlueSoft,
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
