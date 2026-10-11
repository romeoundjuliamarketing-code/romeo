import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import {
  onboardingRoute, onboardingSaveError, parseOnboardingState, routeAfterProfile,
  type OnboardingRoute, type OnboardingSaveError, type OnboardingState,
} from '../utils/onboarding';

// "Done" is cached per account (queryCache is cleared on sign-out / account
// switch), so returning users enter the app at once while the server answer
// revalidates silently. Anything else always waits for the server.
const cacheKey = (userId: string): string => `onboarding_done:${userId}`;

export type OnboardingGateStatus = 'loading' | 'error' | 'ready';

export type SaveProfileResult = { ok: true } | { ok: false; error: OnboardingSaveError };

export function useOnboardingGate(userId: string | null): {
  status:      OnboardingGateStatus;
  route:       OnboardingRoute | null;
  state:       OnboardingState | null;
  /** When a brand-new account finished step 2 in this session (ms), else null. */
  finishedAt:  number | null;
  retry:       () => void;
  saveProfile: (name: string, birthDateIso: string) => Promise<SaveProfileResult>;
  complete:    () => Promise<boolean>;
  /** Back from step 2 to step 1 (entered data stays in the step's own state). */
  backToProfile: () => void;
} {
  const [status, setStatus] = useState<OnboardingGateStatus>('loading');
  const [state, setState] = useState<OnboardingState | null>(null);
  const [route, setRoute] = useState<OnboardingRoute | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Single flight for writes: double taps never send a second request.
  const busyRef = useRef(false);

  useEffect(() => {
    setFinishedAt(null);
    if (userId === null) {
      setStatus('loading');
      setState(null);
      setRoute(null);
      return;
    }
    let cancelled = false;
    const cachedDone = getCached<boolean>(cacheKey(userId)) === true;
    if (cachedDone) {
      setRoute('done');
      setStatus('ready');
    } else {
      setStatus('loading');
      setRoute(null);
    }

    void (async () => {
      const { data, error } = await supabase.rpc('get_my_onboarding_state');
      if (cancelled) return;
      const parsed = error === null ? parseOnboardingState(data) : null;
      if (parsed === null) {
        // Keep a cached "done"; without one there is nothing safe to show.
        if (!cachedDone) setStatus('error');
        return;
      }
      const next = onboardingRoute(parsed);
      setState(parsed);
      setRoute(next);
      setStatus('ready');
      setCached<boolean>(cacheKey(userId), next === 'done');
    })();

    return () => { cancelled = true; };
  }, [userId, attempt]);

  const retry = useCallback((): void => setAttempt((a) => a + 1), []);

  const saveProfile = useCallback(async (name: string, birthDateIso: string): Promise<SaveProfileResult> => {
    if (busyRef.current || userId === null || state === null) return { ok: false, error: 'network' };
    busyRef.current = true;
    try {
      const { error } = await supabase.rpc('set_my_profile_basics', { p_name: name, p_birth_date: birthDateIso });
      if (error !== null) return { ok: false, error: onboardingSaveError(error.message) };
      const saved: OnboardingState = { ...state, name, has_birth_date: true };
      const next = routeAfterProfile(saved);
      setState(saved);
      setRoute(next);
      if (next === 'done') setCached<boolean>(cacheKey(userId), true);
      return { ok: true };
    } catch {
      return { ok: false, error: 'network' };
    } finally {
      busyRef.current = false;
    }
  }, [userId, state]);

  const complete = useCallback(async (): Promise<boolean> => {
    if (busyRef.current || userId === null || state === null) return false;
    busyRef.current = true;
    try {
      const { error } = await supabase.rpc('complete_onboarding');
      if (error !== null) return false;
      setState({ ...state, onboarding_completed: true });
      setCached<boolean>(cacheKey(userId), true);
      setFinishedAt(Date.now());
      setRoute('done');
      return true;
    } catch {
      return false;
    } finally {
      busyRef.current = false;
    }
  }, [userId, state]);

  const backToProfile = useCallback((): void => {
    if (route === 'location') setRoute('profile');
  }, [route]);

  return { status, route, state, finishedAt, retry, saveProfile, complete, backToProfile };
}
