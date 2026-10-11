import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import {
  onboardingRoute, onboardingSaveError, parseOnboardingState, routeAfterProfile,
  type OnboardingRoute, type OnboardingSaveError, type OnboardingState,
} from '../utils/onboarding';
import { INTRO_VERSION, introStartStep, needsIntroUpgrade, type IntroStep } from '../utils/intro';

// "Done" (setup finished, no intro pending) is cached per account (queryCache
// is cleared on sign-out / account switch), so returning users enter the app
// at once while the server answer revalidates silently. Anything else always
// waits for the server.
const cacheKey = (userId: string): string => `onboarding_done:${userId}`;

export type OnboardingGateStatus = 'loading' | 'error' | 'ready';

export type SaveProfileResult = { ok: true } | { ok: false; error: OnboardingSaveError };

// Best effort with one retry: a lost save only means the intro shows again
// (or not) on the next start, never a blocked app.
async function saveIntro(status: 'in_progress' | 'completed' | 'skipped', step: IntroStep | null): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { error } = await supabase.rpc('set_my_tour_state', { p_status: status, p_station: step, p_version: INTRO_VERSION });
      if (error === null) return;
    } catch {
      // retry once
    }
  }
}

export function useOnboardingGate(userId: string | null): {
  status:      OnboardingGateStatus;
  route:       OnboardingRoute | null;
  state:       OnboardingState | null;
  /** When a brand-new account finished step 2 in this session (ms), else null. */
  finishedAt:  number | null;
  /** Optional intro (card / sparring step) to show before the app, else null. */
  intro:       IntroStep | null;
  setIntroStep: (step: IntroStep) => void;
  /** Ends the intro for good (never auto-started again). */
  endIntro:    (result: 'completed' | 'skipped') => void;
  /** Back from the intro's first step to step 2 (only right after the setup). */
  backToLocation: () => void;
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
  const [intro, setIntro] = useState<IntroStep | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Single flight for writes: double taps never send a second request.
  const busyRef = useRef(false);

  useEffect(() => {
    setFinishedAt(null);
    setIntro(null);
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
      const startStep = introStartStep(parsed);
      // An old running tour becomes the new intro once (saved as version 2).
      if (needsIntroUpgrade(parsed) && startStep !== null) void saveIntro('in_progress', startStep);
      setState(parsed);
      setIntro(startStep);
      setRoute(next);
      setStatus('ready');
      setCached<boolean>(cacheKey(userId), next === 'done' && startStep === null);
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
      // Back from the intro to step 1 of this session: on through step 2 again.
      const next = finishedAt !== null ? 'location' : routeAfterProfile(saved);
      setState(saved);
      setRoute(next);
      if (next === 'done') setCached<boolean>(cacheKey(userId), true);
      return { ok: true };
    } catch {
      return { ok: false, error: 'network' };
    } finally {
      busyRef.current = false;
    }
  }, [userId, state, finishedAt]);

  const complete = useCallback(async (): Promise<boolean> => {
    if (busyRef.current || userId === null || state === null) return false;
    busyRef.current = true;
    try {
      const { error } = await supabase.rpc('complete_onboarding');
      if (error !== null) return false;
      setState({ ...state, onboarding_completed: true, tour_status: 'in_progress', tour_station: 0, tour_version: INTRO_VERSION });
      // The intro follows right away; "done" is cached once it ended.
      setCached<boolean>(cacheKey(userId), false);
      void saveIntro('in_progress', 0);
      setIntro(0);
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

  const setIntroStep = useCallback((step: IntroStep): void => {
    setIntro(step);
    void saveIntro('in_progress', step);
  }, []);

  const endIntro = useCallback((result: 'completed' | 'skipped'): void => {
    setIntro(null);
    setState((prev) => (prev !== null ? { ...prev, tour_status: result, tour_station: null, tour_version: INTRO_VERSION } : prev));
    if (userId !== null) setCached<boolean>(cacheKey(userId), true);
    void saveIntro(result, null);
  }, [userId]);

  // Name, birth date and place are saved already; step 2 shows them again and
  // finishing it (idempotent on the server) returns to the intro.
  const backToLocation = useCallback((): void => {
    if (finishedAt === null) return;
    setIntro(null);
    setRoute('location');
  }, [finishedAt]);

  return {
    status, route, state, finishedAt, intro, setIntroStep, endIntro, backToLocation,
    retry, saveProfile, complete, backToProfile,
  };
}
