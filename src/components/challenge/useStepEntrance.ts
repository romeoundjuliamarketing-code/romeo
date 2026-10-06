import { useEffect, useRef } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const ENTER_MS = 220;

// Taps are ignored this long after a step appears. The primary button of one step sits
// exactly where the next step's button appears, so without it a quick double tap would
// cover a mission and confirm the handoff in one go.
const ARM_MS = 400;

export interface StepEntrance {
  // Short fade + rise for the step's card, on the UI thread. Static with reduced motion.
  cardStyle: ReturnType<typeof useAnimatedStyle>;
  // Wraps a handler so it only fires once the step is armed.
  guard:     (handler: () => void) => () => void;
}

export function useStepEntrance(): StepEntrance {
  const reduceMotion = useReducedMotion();
  const progress     = useSharedValue(reduceMotion ? 1 : 0);
  const armedAt      = useRef(Date.now() + ARM_MS);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, progress]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 16 },
      { scale: 0.97 + progress.value * 0.03 },
    ],
  }));

  const guard = (handler: () => void) => (): void => {
    if (Date.now() < armedAt.current) return;
    handler();
  };

  return { cardStyle, guard };
}
