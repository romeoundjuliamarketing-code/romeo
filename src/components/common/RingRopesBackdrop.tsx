import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Line } from 'react-native-svg';
import { colors } from '../../theme/colors';

// Graphic stand-in for a missing cover or gym photo: black canvas, three ring
// ropes (the middle one in brand blue) and a padded corner post on the left.
// Static SVG, drawn once — no stock photo, nothing loads from outside.
function RingRopesBackdrop(): React.ReactElement {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="ropesFloor" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.dark} stopOpacity="1" />
          <Stop offset="1" stopColor={colors.text} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="400" height="300" fill="url(#ropesFloor)" />
      {/* Corner post with its blue pad */}
      <Rect x="28" y="40" width="14" height="260" fill={colors.coverRope} />
      <Rect x="22" y="70" width="26" height="120" rx="6" fill={colors.accentBlue} opacity={0.9} />
      {/* Ropes, slightly converging towards the post */}
      <Line x1="42" y1="84" x2="400" y2="64" stroke={colors.coverRope} strokeWidth="5" strokeLinecap="round" />
      <Line x1="42" y1="128" x2="400" y2="118" stroke={colors.accentBlue} strokeWidth="5" strokeLinecap="round" opacity={0.75} />
      <Line x1="42" y1="172" x2="400" y2="172" stroke={colors.coverRope} strokeWidth="5" strokeLinecap="round" />
    </Svg>
  );
}

export default React.memo(RingRopesBackdrop);
