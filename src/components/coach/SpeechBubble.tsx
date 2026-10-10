import React, { useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { colors } from '../../theme/colors';

const STROKE = 2.25;
const SHADOW_X = 3;
const SHADOW_Y = 5;
const TAIL_LENGTH = 22;            // how far the tail reaches out of the body
const TAIL_HALF = 11;              // half of the tail base
const BULGE = 3;                   // outward curve of the edges
const PAD = 24;                    // svg room around the body (tail, accents, shadow)
const R_TL = 30;
const R_TR = 22;
const R_BR = 28;
const R_BL = 16;

export type TailSide = 'left' | 'right';

// Mirrors x for a tail on the right, so one outline serves both sides.
function mirror(w: number, side: TailSide): (x: number) => number {
  return side === 'left' ? (x) => x : (x) => w - x;
}

// Organic comic outline: uneven corners, slightly bulged edges and one
// connected curved tail on the speaker's side, centred at `tailY`.
function bubblePath(w: number, h: number, tailY: number, side: TailSide): string {
  const X = mirror(w, side);
  const ty = Math.min(Math.max(tailY, R_TL + TAIL_HALF), h - R_BL - TAIL_HALF);
  const tipX = -TAIL_LENGTH;
  const tipY = ty + 4;
  return [
    `M ${X(R_TL)} 0`,
    `Q ${X(w / 2)} ${-BULGE} ${X(w - R_TR)} 0`,
    `Q ${X(w)} 0 ${X(w)} ${R_TR}`,
    `Q ${X(w + BULGE)} ${h / 2} ${X(w)} ${h - R_BR}`,
    `Q ${X(w)} ${h} ${X(w - R_BR)} ${h}`,
    `Q ${X(w / 2)} ${h + BULGE} ${X(R_BL)} ${h}`,
    `Q ${X(0)} ${h} ${X(0)} ${h - R_BL}`,
    `L ${X(0)} ${ty + TAIL_HALF}`,
    `C ${X(-4)} ${ty + TAIL_HALF - 1} ${X(tipX + 8)} ${tipY + 4} ${X(tipX)} ${tipY}`,
    `C ${X(tipX + 10)} ${ty - 2} ${X(-4)} ${ty - TAIL_HALF + 2} ${X(0)} ${ty - TAIL_HALF}`,
    `L ${X(0)} ${R_TL}`,
    `Q ${X(0)} 0 ${X(R_TL)} 0`,
    'Z',
  ].join(' ');
}

// Two short emphasis strokes just outside the top corner away from the
// speaker (kept within a few points of the edge so a gutter never clips them).
function accentPath(w: number, side: TailSide): string {
  const X = mirror(w, side);
  return `M ${X(w - 10)} -7 L ${X(w - 6)} -17 M ${X(w + 1)} -3 L ${X(w + 10)} -10`;
}

// Comic speech bubble whose tail points towards the speaker. The body grows
// with its content; the outline is drawn behind it in SVG.
export default function SpeechBubble({ tailY, tailSide = 'left', children }: {
  /** Desired tail centre, measured from the bubble's top edge. */
  tailY:     number;
  /** Side of the speaker. */
  tailSide?: TailSide;
  children: React.ReactNode;
}): React.ReactElement {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  function onLayout(e: LayoutChangeEvent): void {
    const { width, height } = e.nativeEvent.layout;
    if (size === null || size.w !== width || size.h !== height) setSize({ w: width, h: height });
  }

  const d = size !== null ? bubblePath(size.w, size.h, tailY, tailSide) : null;

  return (
    <View style={styles.body} onLayout={onLayout}>
      {size !== null && d !== null && (
        <Svg
          style={[styles.svg, { width: size.w + PAD * 2, height: size.h + PAD * 2 }]}
          pointerEvents="none"
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
            <Path d={accentPath(size.w, tailSide)} stroke={colors.dark} strokeWidth={2.5} strokeLinecap="round" fill="none" />
          </G>
        </Svg>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop:        16,
    paddingBottom:     16,
    paddingHorizontal: 16,
  },
  svg: {
    position: 'absolute',
    left:     -PAD,
    top:      -PAD,
  },
});
