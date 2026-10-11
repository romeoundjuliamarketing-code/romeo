import React, { useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { colors } from '../../theme/colors';

const STROKE = 2.75;
const SHADOW_X = 2;
const SHADOW_Y = 4;                // harder and smaller than the button edge (5)
const ARCH = 5;                    // how far the top edge rises in the middle
const BULGE = 2;                   // outward curve of the side edges
const TAIL_HALF = 12;              // half of the tail base
const FILLET = 6;                  // soft joint between bottom edge and tail
const PAD = 48;                    // svg room around the body (tail, shadow)
const R_TL = 28;
const R_TR = 20;
const R_BR = 26;
const R_BL = 18;

export type BubbleTail = {
  /** Centre of the tail base, measured from the bubble's left edge. */
  baseX: number;
  /** Tip, relative to the bubble's bottom-left corner (y grows downwards). */
  tipX:  number;
  tipY:  number;
};

// One closed outline: slightly arched top, uneven corners, gently bulged
// sides and a short swung tail leaving the bottom edge. Body and tail share
// a single path, so stroke and shadow have no seam.
function bubblePath(w: number, h: number, tail: BubbleTail): string {
  const bx = Math.min(Math.max(tail.baseX, R_BL + TAIL_HALF + FILLET), w - R_BR - TAIL_HALF - FILLET);
  const right = bx + TAIL_HALF;
  const left = bx - TAIL_HALF;
  const tx = tail.tipX;
  const ty = h + tail.tipY;
  return [
    `M ${R_TL} 0`,
    `Q ${w * 0.46} ${-ARCH * 2} ${w - R_TR} 0`,
    `Q ${w} 0 ${w} ${R_TR}`,
    `Q ${w + BULGE} ${h / 2} ${w} ${h - R_BR}`,
    `Q ${w} ${h} ${w - R_BR} ${h}`,
    `L ${right + FILLET} ${h}`,
    `Q ${right} ${h} ${right - 1} ${h + 3}`,
    `C ${right - 3} ${h + (ty - h) * 0.45} ${tx + 8} ${ty - 1} ${tx} ${ty}`,
    `C ${tx + 5} ${ty - 7} ${left + 3} ${h + 6} ${left + 1} ${h + 3}`,
    `Q ${left} ${h} ${left - FILLET} ${h}`,
    `L ${R_BL} ${h}`,
    `Q 0 ${h} 0 ${h - R_BL}`,
    `Q ${-BULGE} ${h / 2} 0 ${R_TL}`,
    `Q 0 0 ${R_TL} 0`,
    'Z',
  ].join(' ');
}

// Comic speech bubble with its tail on the bottom edge. The body grows with
// its content (native text inside); the outline is drawn behind it in SVG.
export default function ComicSpeechBubble({ tail, children }: {
  /** Tail geometry; called with the measured bubble size. */
  tail:     (width: number, height: number) => BubbleTail;
  children: React.ReactNode;
}): React.ReactElement {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  function onLayout(e: LayoutChangeEvent): void {
    const { width, height } = e.nativeEvent.layout;
    if (size === null || size.w !== width || size.h !== height) setSize({ w: width, h: height });
  }

  const d = size !== null ? bubblePath(size.w, size.h, tail(size.w, size.h)) : null;

  return (
    <View style={styles.body} onLayout={onLayout}>
      {size !== null && d !== null && (
        <Svg
          style={[styles.svg, { width: size.w + PAD * 2, height: size.h + PAD * 2 }]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <G x={PAD} y={PAD}>
            <G x={SHADOW_X} y={SHADOW_Y}>
              <Path d={d} fill={colors.dark} />
            </G>
            <Path
              d={d}
              fill={colors.coachBubble}
              stroke={colors.dark}
              strokeWidth={STROKE}
              strokeLinejoin="round"
            />
          </G>
        </Svg>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop:        24,
    paddingBottom:     24,
    paddingHorizontal: 24,
  },
  svg: {
    position: 'absolute',
    left:     -PAD,
    top:      -PAD,
  },
});
