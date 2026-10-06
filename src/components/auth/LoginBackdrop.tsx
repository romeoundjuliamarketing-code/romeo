import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface Props {
  width:  number;
  // Distance from the top of the screen to the logo row.
  top:    number;
  // Height of the blue surface from the screen top (brand block + a soft fade).
  height: number;
}

const ROPE_BAND = 96;
const ROPE_SLIDE_PX = 24;

// Decoration behind the login's brand block: a light brand-blue surface cut
// off at the top and right edge that fades into the off-white, with a ring
// corner (post + three ropes, the middle one blue) set into it. Purely
// decorative: no touches, hidden from screen readers. Fades in once; the ropes
// slide in sideways and then stand still.
export default function LoginBackdrop({ width, top, height }: Props): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const surface = useSharedValue(0);
  const ropes = useSharedValue(0);

  useEffect(() => {
    surface.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) });
    ropes.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    return () => {
      cancelAnimation(surface);
      cancelAnimation(ropes);
    };
  }, [surface, ropes]);

  const surfaceStyle = useAnimatedStyle(() => ({ opacity: surface.value }));
  const ropeStyle = useAnimatedStyle(() => ({
    opacity: ropes.value,
    transform: [{ translateX: reduceMotion ? 0 : (1 - ropes.value) * ROPE_SLIDE_PX }],
  }));

  // Surface: full width at the top, its lower edge sweeps from high on the
  // left to the full height on the right.
  const surfacePath =
    `M 0 0 H ${width} V ${height} C ${width * 0.62} ${height} ${width * 0.3} ${height * 0.78} 0 ${height * 0.66} Z`;

  // Ring corner: the post is cut off by the right edge, the ropes rise gently
  // towards the left and fade out before they reach the wordmark.
  const ropeLength = Math.min(200, Math.round(width * 0.46));
  const postX = width - 16;
  const ropeY = [20, 44, 68];
  const rope = (y: number): string =>
    `M ${postX} ${top + y} Q ${postX - ropeLength * 0.5} ${top + y + 4} ${postX - ropeLength} ${top + y - 12}`;

  return (
    <View
      style={[styles.root, { height: Math.max(height, top + ROPE_BAND) }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, surfaceStyle]}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="loginSurface" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accentBlueTint} stopOpacity={1} />
              <Stop offset="0.55" stopColor={colors.accentBlueTint} stopOpacity={0.85} />
              <Stop offset="1" stopColor={colors.accentBlueTint} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={surfacePath} fill="url(#loginSurface)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, ropeStyle]}>
        <Svg width={width} height={top + ROPE_BAND}>
          <Defs>
            <LinearGradient id="ropeDark" x1="1" y1="0" x2="0" y2="0">
              <Stop offset="0" stopColor={colors.dark} stopOpacity={0.22} />
              <Stop offset="1" stopColor={colors.dark} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="ropeBlue" x1="1" y1="0" x2="0" y2="0">
              <Stop offset="0" stopColor={colors.accentBlue} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.accentBlue} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={rope(ropeY[0])} stroke="url(#ropeDark)" strokeWidth={5} strokeLinecap="round" fill="none" />
          <Path d={rope(ropeY[1])} stroke="url(#ropeBlue)" strokeWidth={5} strokeLinecap="round" fill="none" />
          <Path d={rope(ropeY[2])} stroke="url(#ropeDark)" strokeWidth={5} strokeLinecap="round" fill="none" />
          {/* Starts below the status bar so the system icons stay readable */}
          <Rect x={postX - 8} y={top} width={32} height={ROPE_BAND - 8} rx={12} fill={colors.dark} />
          <Rect x={postX - 2} y={top + ropeY[1] - 6} width={10} height={12} rx={3} fill={colors.accentBlue} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// Small dot grid for the lower-left corner, the calm counterpart to the ring
// corner. Static, decorative.
export function LoginDotGrid({ bottom }: { bottom: number }): React.ReactElement {
  const cols = 5;
  const rows = 4;
  const gap = 12;
  return (
    <View
      style={[styles.dots, { bottom }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={cols * gap} height={rows * gap}>
        {Array.from({ length: cols * rows }, (_, i) => (
          <Circle
            key={i}
            cx={(i % cols) * gap + gap / 2}
            cy={Math.floor(i / cols) * gap + gap / 2}
            r={1.5}
            fill={colors.dark}
            opacity={0.14}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
  },
  dots: {
    position: 'absolute',
    left:     16,
  },
});
