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

// Back of a challenge card, the strongest brand moment: Sparr blue, a fine double
// inset frame like a printed card, the mascot large in the middle over the wordmark.
// It must never carry anything about the mission underneath.
export default function ChallengeCardBack({ size, elevated = true }: Props): React.ReactElement {
  const logoSize      = Math.round(size.width * 0.42);
  const watermarkSize = Math.round(size.width * 1.05);
  const compact       = size.width < 240;

  return (
    <View style={[styles.card, { width: size.width, height: size.height }, elevated && cardShadow]}>
      {/* Oversized mark, offset and cropped by the card edge so it reads as a
          background texture instead of a second face behind the centred logo. */}
      <View style={styles.watermark} pointerEvents="none">
        <SparrLogo size={watermarkSize} opacity={0.06} />
      </View>

      <View style={styles.frameOuter}>
        <View style={styles.frameInner}>
          <View style={styles.center}>
            <SparrLogo size={logoSize} />
            <Text style={[styles.wordmark, compact && styles.wordmarkCompact]}>SPARR</Text>
            <View style={styles.rule} />
          </View>
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
  frameOuter: {
    flex: 1,
    borderRadius: CARD_RADIUS - 8,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    padding: 4,
  },
  frameInner: {
    flex: 1,
    borderRadius: CARD_RADIUS - 12,
    borderWidth: 1,
    borderColor: colors.headerDotFuture,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 6,
    color: colors.headerTextPrimary,
  },
  wordmarkCompact: {
    fontSize: 20,
    letterSpacing: 4,
  },
  rule: {
    width: 32,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.headerBorder,
  },
});
