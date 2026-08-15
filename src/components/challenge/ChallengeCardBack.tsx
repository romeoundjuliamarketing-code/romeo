import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import SparrLogo from '../common/SparrLogo';
import { CARD_RADIUS, cardShadow } from './cardLayout';
import type { CardSize } from './cardLayout';

interface Props {
  size:      CardSize;
  // Off while the card rotates in 3D (ChallengeDeck) — a shadow without a shadowPath
  // forces an offscreen render that blurs during the flip.
  elevated?: boolean;
}

// Back of a challenge card: Sparr blue, dark outer edge, fine off-white inset line,
// the mark centred over a very faint oversized watermark of itself.
export default function ChallengeCardBack({ size, elevated = true }: Props): React.ReactElement {
  const logoSize      = Math.round(size.width * 0.36);
  const watermarkSize = Math.round(size.width * 1.05);

  return (
    <View style={[styles.card, { width: size.width, height: size.height }, elevated && cardShadow]}>
      {/* Oversized mark, offset and cropped by the card edge so it reads as a
          background texture instead of a second face behind the centred logo. */}
      <View style={styles.watermark} pointerEvents="none">
        <SparrLogo size={watermarkSize} opacity={0.05} />
      </View>

      <View style={styles.inset}>
        <View style={styles.center}>
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
    backgroundColor: colors.accentBlue,
    borderWidth: 2,
    borderColor: colors.dark,
    padding: 8,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    right: -56,
    bottom: -48,
  },
  inset: {
    flex: 1,
    borderRadius: CARD_RADIUS - 8,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.headerTextPrimary,
  },
});
