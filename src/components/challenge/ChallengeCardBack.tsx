import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
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

// Inset of the fine contour from the card edge.
const KEYLINE_INSET = 10;
// Spacing between the ring-corner ropes.
const ROPE_GAP = 8;
const ROPE_COUNT = 3;

// The ropes meeting at a ring corner: nested L shapes in two opposite corners, drawn
// faintly inside the keyline. Bottom right is the top left one mirrored.
function ringCornerPath(width: number, height: number): string {
  const arm = Math.round(width * 0.26);
  const parts: string[] = [];
  for (let i = 1; i <= ROPE_COUNT; i += 1) {
    const o = KEYLINE_INSET + ROPE_GAP * i;
    const len = arm - ROPE_GAP * (i - 1);
    parts.push(`M${o} ${o + len} L${o} ${o} L${o + len} ${o}`);
    parts.push(`M${width - o} ${height - o - len} L${width - o} ${height - o} L${width - o - len} ${height - o}`);
  }
  return parts.join(' ');
}

// Back of a challenge card, the strongest brand moment: Sparr blue with a restrained
// vertical gradient, one fine inset contour, faint ring-corner ropes and the mascot
// in the middle over the wordmark. It must never carry anything about the mission.
export default function ChallengeCardBack({ size, elevated = true }: Props): React.ReactElement {
  const { width, height } = size;
  const logoSize = Math.round(width * 0.4);
  const compact  = width < 240;

  return (
    <View style={[styles.card, { width, height }, elevated && cardShadow]}>
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Defs>
          <LinearGradient id="cardBackFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.cardBackTop} />
            <Stop offset="0.55" stopColor={colors.accentBlue} />
            <Stop offset="1" stopColor={colors.cardBackBottom} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#cardBackFill)" />
        <Path
          d={ringCornerPath(width, height)}
          stroke={colors.cardBackPattern}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Rect
          x={KEYLINE_INSET + 0.5}
          y={KEYLINE_INSET + 0.5}
          width={width - KEYLINE_INSET * 2 - 1}
          height={height - KEYLINE_INSET * 2 - 1}
          rx={CARD_RADIUS - KEYLINE_INSET}
          stroke={colors.cardBackKeyline}
          strokeWidth={1}
          fill="none"
        />
      </Svg>

      <View style={styles.center}>
        <SparrLogo size={logoSize} />
        <Text style={[styles.wordmark, compact && styles.wordmarkCompact]} maxFontSizeMultiplier={1.2}>SPARR</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    // Same blue under the gradient, so no light seam can show at the rounded corners.
    backgroundColor: colors.accentBlue,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 3,
    color: colors.headerTextPrimary,
  },
  wordmarkCompact: {
    fontSize: 16,
    letterSpacing: 2,
  },
});
