import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

// Grows a map marker while it is the active one (tapped / its window is open)
// and shrinks it back afterwards. Runs on the UI thread.
//
// The outer wrapper is static and padded; only the inner view is scaled. That
// matters on iOS: react-native-maps (AIRMapMarker layoutSubviews) adopts the
// first subview's frame as the marker size once it grows past the marker and
// keeps the marker's BOTTOM in place — a scaled first subview would make the
// marker drift on every frame. The padding also keeps the scaled marker inside
// the view bounds, so Android does not clip it.
export const MARKER_GROW_MS = 250;
const ACTIVE_SCALE          = 1.3;

interface Props {
  active:   boolean;
  children: React.ReactNode;
}

export default function ActiveMarkerScale({ active, children }: Props): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(active ? ACTIVE_SCALE : 1);

  useEffect(() => {
    const target = active ? ACTIVE_SCALE : 1;
    scale.value = reduceMotion
      ? target
      : withTiming(target, { duration: MARKER_GROW_MS, easing: Easing.out(Easing.quad) });
  }, [active, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    // collapsable={false}: Fabric would otherwise flatten this layout-only
    // wrapper away, making the scaled view the marker's first subview again.
    <View style={styles.wrapper} collapsable={false}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding:    16,
    alignItems: 'center',
  },
});
