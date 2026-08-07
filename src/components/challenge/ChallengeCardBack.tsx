import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import SparrLogo from '../common/SparrLogo';
import { CARD_RADIUS, cardShadow } from './cardLayout';
import type { CardSize } from './cardLayout';

interface Props {
  size: CardSize;
}

// Back of a challenge card: Sparr blue, dark outer edge, fine off-white inset line,
// the mark centred over a very faint oversized watermark of itself.
export default function ChallengeCardBack({ size }: Props): React.ReactElement {
  const logoSize      = Math.round(size.width * 0.36);
  const watermarkSize = Math.round(size.width * 1.15);
  const cornerSize    = 10;

  return (
    <View style={[styles.card, { width: size.width, height: size.height }, cardShadow]}>
      <View style={styles.watermark} pointerEvents="none">
        <SparrLogo size={watermarkSize} opacity={0.08} />
      </View>

      <View style={styles.inset}>
        <View style={[styles.corner, styles.cornerTopLeft]}>
          <SparrLogo size={cornerSize} opacity={0.5} />
        </View>
        <View style={[styles.corner, styles.cornerTopRight]}>
          <SparrLogo size={cornerSize} opacity={0.5} />
        </View>
        <View style={[styles.corner, styles.cornerBottomLeft]}>
          <SparrLogo size={cornerSize} opacity={0.5} />
        </View>
        <View style={[styles.corner, styles.cornerBottomRight]}>
          <SparrLogo size={cornerSize} opacity={0.5} />
        </View>

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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
  corner: {
    position: 'absolute',
  },
  cornerTopLeft:     { top: 8,    left: 8 },
  cornerTopRight:    { top: 8,    right: 8 },
  cornerBottomLeft:  { bottom: 8, left: 8 },
  cornerBottomRight: { bottom: 8, right: 8 },
});
