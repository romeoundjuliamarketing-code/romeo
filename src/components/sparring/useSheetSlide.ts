import { useEffect, useRef } from 'react';
import {
  Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';

const IN_MS = 280;
const OUT_MS = 200;

// Bottom sheet entrance: the dim layer fades in while the sheet slides up from
// below its own height. Reduced motion: only the fade. close(then) mirrors
// usePopAnimation, so callers can navigate once the sheet is gone.
export function useSheetSlide(onClose: () => void, openKey: string | null, sheetHeight: number) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const closingRef = useRef(false);
  const thenRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (openKey === null) return;
    closingRef.current = false;
    progress.value = 0;
    progress.value = withTiming(1, { duration: IN_MS, easing: Easing.out(Easing.cubic) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey]);

  function finishClose(): void {
    onClose();
    thenRef.current?.();
  }

  function close(then?: () => void): void {
    if (closingRef.current) return;
    closingRef.current = true;
    thenRef.current = then;
    progress.value = withTiming(0, { duration: OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }

  const overlayStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => (reduceMotion
    ? { opacity: progress.value }
    : { transform: [{ translateY: (1 - progress.value) * sheetHeight }] }));

  return { overlayStyle, sheetStyle, close };
}
