import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../navigation/navigationRef';
import { loadPremiumOffer, PREVIEW_TRIAL_OFFER } from '../lib/premiumOffer';
import { useStoreEntitlements } from './useStoreEntitlements';
import {
  isNewOpening,
  mayAutoShow,
  parseShowCount,
  shouldAutoShow,
  SHOW_DELAY_MS,
  trialOfferStorageKey,
} from '../utils/trialOfferPrompt';

// Never open the offer on top of these.
const BLOCKING_ROUTES = new Set<string>(['Paywall', 'TrialOffer', 'Intro']);

// Opens the free-trial offer shortly after the app opens (cold start, or a
// return after a long background stay) while `enabled` (user fully inside the
// app). At most twice per account on this device; see trialOfferPrompt.ts.
export function useTrialOfferPrompt(enabled: boolean, userId: string | null): void {
  const { refetch } = useStoreEntitlements();
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!enabled || userId === null) return;
    const key = trialOfferStorageKey(userId);
    let cancelled = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backgroundSince: number | null = null;

    async function attempt(): Promise<void> {
      if (running) return;
      running = true;
      try {
        const startedAt = Date.now();
        if (PREVIEW_TRIAL_OFFER) {
          await new Promise<void>((resolve) => { timer = setTimeout(resolve, SHOW_DELAY_MS); });
          if (!cancelled && navigationRef.isReady()) navigationRef.navigate('TrialOffer');
          return;
        }
        const shownCount = parseShowCount(await AsyncStorage.getItem(key).catch(() => null));
        if (cancelled || !mayAutoShow(shownCount)) return;
        const [entitlements, offer] = await Promise.all([
          refetchRef.current(),
          loadPremiumOffer().catch(() => null),
        ]);
        const subscribed = entitlements.creatorActive || entitlements.cardsActive;
        if (cancelled || !shouldAutoShow({ shownCount, subscribed, trialAvailable: offer?.trial != null })) return;
        await new Promise<void>((resolve) => {
          timer = setTimeout(resolve, Math.max(0, SHOW_DELAY_MS - (Date.now() - startedAt)));
        });
        if (cancelled || !navigationRef.isReady()) return;
        const current = navigationRef.getCurrentRoute()?.name;
        if (current !== undefined && BLOCKING_ROUTES.has(current)) return;
        navigationRef.navigate('TrialOffer');
        await AsyncStorage.setItem(key, String(shownCount + 1)).catch(() => undefined);
      } finally {
        running = false;
      }
    }

    void attempt();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundSince = Date.now();
      } else if (state === 'active') {
        if (isNewOpening(backgroundSince, Date.now())) void attempt();
        backgroundSince = null;
      }
    });
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      subscription.remove();
    };
  }, [enabled, userId]);
}
