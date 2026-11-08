import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const PENGUIN = require('../../../assets/coach/paywall_premium_penguin.png');
const GOLD = require('../../../assets/coach/paywall_premium_gold.png');

const HOVER_DISTANCE = 4;
const HOVER_DURATION_MS = 2400;

// The gold ornament floats behind a static penguin. The gold layer continues
// under the penguin's outline, so no gap opens up while it moves.
export default function PremiumCoachArt(): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      offset.value = 0;
      return;
    }
    offset.value = -HOVER_DISTANCE;
    offset.value = withRepeat(
      withTiming(HOVER_DISTANCE, { duration: HOVER_DURATION_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(offset);
  }, [offset, reduceMotion]);

  const goldStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <View style={styles.art}>
      <Animated.Image source={GOLD} style={[styles.layer, goldStyle]} resizeMode="contain" />
      <Image source={PENGUIN} style={styles.layer} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    width: 256,
    height: 256,
    alignSelf: 'center',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    width: 256,
    height: 256,
  },
});
