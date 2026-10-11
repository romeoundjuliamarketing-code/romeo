import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Rect as SvgRect } from 'react-native-svg';
import { colors } from '../../theme/colors';
import type { Rect } from '../../utils/tour';

const PAD = 8;
const RADIUS = 20;
// Light enough that the real page stays recognisable around the coach.
const DIM = 0.5;

function roundedRect(r: Rect): string {
  const x = r.x - PAD;
  const y = r.y - PAD;
  const w = r.width + PAD * 2;
  const h = r.height + PAD * 2;
  const k = Math.min(RADIUS, w / 2, h / 2);
  return [
    `M ${x + k} ${y}`, `H ${x + w - k}`, `Q ${x + w} ${y} ${x + w} ${y + k}`,
    `V ${y + h - k}`, `Q ${x + w} ${y + h} ${x + w - k} ${y + h}`,
    `H ${x + k}`, `Q ${x} ${y + h} ${x} ${y + h - k}`,
    `V ${y + k}`, `Q ${x} ${y} ${x + k} ${y}`, 'Z',
  ].join(' ');
}

// Dims the whole screen except the explained elements (holes cut with the
// even-odd rule) and draws a light ring around each of them.
export default function TourSpotlight({ rects }: { rects: readonly Rect[] }): React.ReactElement {
  const { width, height } = useWindowDimensions();
  const holes = rects.map(roundedRect);
  const outer = `M 0 0 H ${width} V ${height} H 0 Z`;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {holes.length === 0 ? (
        <SvgRect x={0} y={0} width={width} height={height} fill={colors.dark} opacity={DIM} />
      ) : (
        <Path d={[outer, ...holes].join(' ')} fill={colors.dark} opacity={DIM} fillRule="evenodd" />
      )}
      {holes.map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={colors.coachBubble} strokeWidth={3} />
      ))}
    </Svg>
  );
}
