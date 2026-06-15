import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

// Runs `onRefocus` whenever the screen is re-focused, but skips the very first
// focus on mount. Data hooks already load once on mount, so triggering a
// refetch on that initial focus would double every request on screen entry.
export function useFocusRefetch(onRefocus: () => void): void {
  const isFirstFocus = useRef(true);
  // Keep the latest callback in a ref so the focus subscription stays stable
  // (empty deps) regardless of the callback's identity changing per render.
  const callbackRef = useRef(onRefocus);
  callbackRef.current = onRefocus;

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      callbackRef.current();
    }, []),
  );
}
