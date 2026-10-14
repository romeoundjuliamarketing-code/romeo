import React from 'react';
import Svg, { Circle, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { colors } from '../../theme/colors';

// Drawing space of every motif; it scales to the motif band of the card.
const VIEW_W = 240;
const VIEW_H = 72;

type MotifKind = 'ring' | 'zones' | 'counter';

// Motif per card category (focus.de is the stable key). Categories without an
// own drawing get the ring, the neutral picture of a sparring round.
const MOTIF_BY_FOCUS: Record<string, MotifKind> = {
  'Taktik & Ringkontrolle':     'ring',
  'Fokus-Ziele & Trefferzonen': 'zones',
  'Trigger & Konter':           'counter',
};

export function motifForFocus(focusDe: string): MotifKind {
  return MOTIF_BY_FOCUS[focusDe] ?? 'ring';
}

// Ring from above: two position marks close together (you, filled; partner,
// outlined) and a short trail behind you — staying close and following.
function RingMotif(): React.ReactElement {
  return (
    <G>
      <Rect x={64} y={6} width={112} height={60} rx={6} stroke={colors.accentBlue} strokeOpacity={0.55} strokeWidth={1.5} fill="none" />
      <Rect x={70} y={12} width={100} height={48} rx={4} stroke={colors.accentBlue} strokeOpacity={0.25} strokeWidth={1} fill="none" />
      <Rect x={61} y={3} width={6} height={6} rx={1} fill={colors.accentBlue} />
      <Rect x={173} y={3} width={6} height={6} rx={1} fill={colors.accentBlue} />
      <Rect x={61} y={63} width={6} height={6} rx={1} fill={colors.accentBlue} />
      <Rect x={173} y={63} width={6} height={6} rx={1} fill={colors.accentBlue} />
      <Path d="M84 52 Q98 50 110 43" stroke={colors.accentBlue} strokeWidth={2} strokeDasharray="3 4" strokeLinecap="round" fill="none" />
      <Circle cx={119} cy={39} r={7} fill={colors.accentBlue} />
      <Circle cx={139} cy={31} r={7} stroke={colors.text} strokeWidth={2} fill={colors.cardFaceMotif} />
    </G>
  );
}

// Three hit zones stacked like a target column; the low zone is marked and an
// arrow ends in it.
function ZonesMotif(): React.ReactElement {
  return (
    <G>
      <Rect x={128} y={6} width={20} height={14} rx={7} stroke={colors.text} strokeWidth={1.5} fill="none" />
      <Rect x={124} y={24} width={28} height={20} rx={6} stroke={colors.text} strokeWidth={1.5} fill="none" />
      <Rect x={126} y={48} width={24} height={18} rx={6} fill={colors.accentBlue} />
      <Line x1={76} y1={57} x2={114} y2={57} stroke={colors.accentBlue} strokeWidth={2.5} strokeLinecap="round" />
      <Polygon points="120,57 111,52 111,62" fill={colors.accentBlue} />
    </G>
  );
}

// Action and answer: an attack comes in (dark), the marked moment, and the
// counter goes back out on a higher line (blue).
function CounterMotif(): React.ReactElement {
  return (
    <G>
      <Line x1={176} y1={50} x2={128} y2={50} stroke={colors.text} strokeWidth={2} strokeLinecap="round" />
      <Polygon points="122,50 131,45 131,55" fill={colors.text} />
      <Circle cx={112} cy={50} r={8} stroke={colors.accentBlue} strokeWidth={2} fill={colors.cardFaceMotif} />
      <Circle cx={112} cy={50} r={3} fill={colors.accentBlue} />
      <Path d="M112 40 Q120 20 166 20" stroke={colors.accentBlue} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Polygon points="174,20 165,15 165,25" fill={colors.accentBlue} />
    </G>
  );
}

interface Props {
  focusDe: string;
  height:  number;
}

// Simple vector illustration of a card's category. Decorative: the card text
// carries the meaning, so it is hidden from screen readers.
export default function CardMotif({ focusDe, height }: Props): React.ReactElement {
  const kind = motifForFocus(focusDe);
  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {kind === 'ring' ? <RingMotif /> : kind === 'zones' ? <ZonesMotif /> : <CounterMotif />}
    </Svg>
  );
}
