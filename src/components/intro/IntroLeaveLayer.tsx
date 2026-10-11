import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

const FADE_MS = 280;
// If the animation never reports its end, the layer still goes away.
const SAFETY_MS = FADE_MS + 600;

// Hosts the intro. On `leaving` the real app is already mounted underneath;
// this layer fades out on the warm background (no white or black frame) and
// takes every touch meanwhile, so nothing is pressed twice. Afterwards
// `onDone` removes it, nothing invisible stays behind. Reduced motion: the
// switch is immediate.
export default function IntroLeaveLayer({ leaving, onDone, children }: {
  leaving:  boolean;
  onDone:   () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!leaving) return undefined;
    doneRef.current = false;
    const finish = (): void => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    };
    if (reduceMotion) {
      finish();
      return undefined;
    }
    opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, (ok) => {
      if (ok === true) runOnJS(finish)();
    });
    const safety = setTimeout(finish, SAFETY_MS);
    return () => clearTimeout(safety);
  }, [leaving, reduceMotion, opacity, onDone]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.layer, fade]}
      // While leaving, the layer swallows touches; the intro inside is inert.
      pointerEvents={leaving ? 'box-only' : 'auto'}
      accessibilityElementsHidden={leaving}
      importantForAccessibility={leaving ? 'no-hide-descendants' : 'auto'}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
});
