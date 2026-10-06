import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Circle } from 'react-native-svg';
import { colors } from '../../theme/colors';

// Static backdrop of the brand hero (login, register, profile): deep blue diagonal gradient, a soft light
// bloom behind the logo area and a few sweeping lines that hint at movement.
// Pure SVG (no extra dependency), drawn once — nothing animates.
function BrandHeroBackground(): React.ReactElement {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 400 320"
      preserveAspectRatio="xMidYMid slice"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="heroFill" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.brandNight} />
          <Stop offset="1" stopColor={colors.brandRoyalDeep} />
        </LinearGradient>
        <RadialGradient id="heroGlow" cx="0.78" cy="0.22" r="0.55">
          <Stop offset="0" stopColor={colors.brandGlow} stopOpacity="0.45" />
          <Stop offset="1" stopColor={colors.brandGlow} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="0" y="0" width="400" height="320" fill="url(#heroFill)" />
      <Rect x="0" y="0" width="400" height="320" fill="url(#heroGlow)" />

      {/* Motion lines: long, shallow arcs like a swing or a footwork path */}
      <Path d="M -20 250 C 90 190, 210 290, 420 150" stroke={colors.brandHeroLine} strokeWidth="1.5" fill="none" />
      <Path d="M -20 285 C 120 225, 240 320, 420 190" stroke={colors.brandHeroLine} strokeWidth="1" fill="none" />
      <Path d="M 170 -20 C 230 60, 330 70, 420 40" stroke={colors.brandHeroLine} strokeWidth="1" fill="none" />

      {/* Tiny penguin-yellow accent */}
      <Circle cx="352" cy="176" r="3" fill={colors.brandAccent} />
    </Svg>
  );
}

// Memoized: static and prop-less — typing in the auth forms must not redraw it.
export default React.memo(BrandHeroBackground);
