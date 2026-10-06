import { useEffect, useRef } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import {
  Easing,
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const ENTER_MS = 520;

// Progress 0 -> 1 for a slide illustration. Plays once, the first time the
// slide becomes active, then stays at rest. Illustrations are fully opaque at
// 0 (only posed differently), so a slide peeking in during a swipe never shows
// an empty panel. Leaving the slide stops a running animation at its end
// state; with reduced motion the illustration starts at rest.
export function useSlideEntrance(active: boolean, delayMs = 80): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const played = useRef(reduceMotion);

  useEffect(() => {
    if (!active) {
      if (played.current) {
        cancelAnimation(progress);
        progress.value = 1;
      }
      return;
    }
    if (played.current) return;
    played.current = true;
    progress.value = withDelay(delayMs, withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }));
  }, [active, delayMs, progress]);

  useEffect(() => () => cancelAnimation(progress), [progress]);

  return progress;
}
