import React from 'react';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

interface Props {
  onDismiss: () => void;
  children:  React.ReactNode;
}

// Past this drag distance or fling speed a release dismisses the card.
const DISMISS_DISTANCE = 64;
const DISMISS_VELOCITY = 800;
// Off-screen slide distance after a dismissing release.
const SLIDE_OUT = 240;

// Floating card that can be swiped down to close it (in addition to its own
// close button). Taps on the card's buttons keep working: the pan only starts
// after a clear vertical move. Runs on the UI thread, no setState per frame.
export default function SwipeDownDismiss({ onDismiss, children }: Props): React.ReactElement {
  const translateY = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      // Down follows the finger; up only gives a little.
      translateY.value = e.translationY > 0 ? e.translationY : e.translationY / 6;
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        translateY.value = withTiming(SLIDE_OUT, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onDismiss)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   1 - Math.min(Math.max(translateY.value, 0) / SLIDE_OUT, 1),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </GestureDetector>
  );
}
