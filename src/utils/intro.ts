// Intro after the required onboarding: step 3 (reveal one example card) and
// step 4 (discover a sparring). Pure, so resume rules and the sparring pick
// are testable.
import { onboardingRoute, type OnboardingState } from './onboarding';

/** Progress record version written by this intro (old coach tour: 1 / null). */
export const INTRO_VERSION = 2;

/** 0 = card step, 1 = sparring step. */
export type IntroStep = 0 | 1;

/** Steps of the whole flow: name/birth, place, card, sparring. */
export const FLOW_TOTAL_STEPS = 4;
/** Required setup steps before the intro. */
export const SETUP_STEPS = 2;

// The free onboarding preview card. Chosen on purpose (short, easily
// understood) from the delivered deck; never a random pick from the paid deck.
export const ONBOARDING_PREVIEW_CHALLENGE_ID = 'k1-111';

// Where the intro starts on app start, or null when it does not show.
// - Required setup incomplete: the setup comes first (no intro yet).
// - New intro begun (version 2): its saved step.
// - Old coach tour still running: the new card step.
// - Completed, skipped or never started: no automatic start.
export function introStartStep(state: OnboardingState): IntroStep | null {
  if (onboardingRoute(state) !== 'done') return null;
  if (state.tour_status !== 'in_progress') return null;
  if (state.tour_version === INTRO_VERSION) return state.tour_station === 1 ? 1 : 0;
  return 0;
}

// An old running tour is saved as the new intro once, so a later restart
// resumes the new step instead of mapping the old station again.
export function needsIntroUpgrade(state: OnboardingState): boolean {
  return introStartStep(state) !== null && state.tour_version !== INTRO_VERSION;
}

export interface IntroSparringCandidate {
  scheduled_at: string;
  is_active:    boolean;
  max_slots:    number;
  signup_count: number;
}

/** Upcoming, active, with a free slot: something one could still join. */
export function isIntroCandidate(s: IntroSparringCandidate, now: Date): boolean {
  return s.is_active
    && new Date(s.scheduled_at).getTime() > now.getTime()
    && s.signup_count < s.max_slots;
}

// The sparring step 4 shows. The list is already nearest first, so the
// first fitting one is the closest.
export function pickIntroSparring<T extends IntroSparringCandidate>(list: readonly T[], now: Date): T | null {
  return list.find((s) => isIntroCandidate(s, now)) ?? null;
}

export type ProfileGap = 'photo' | 'disciplines';

// What a profile still misses for others to judge a sparring partner. Filled
// fields are never asked again. Only fields the profile editor can change
// (experience/training_since currently has no editor, so it is not listed).
export function missingProfileItems(p: {
  avatar_url:  string | null;
  disciplines: readonly string[] | null;
} | null): ProfileGap[] {
  if (p === null) return [];
  const gaps: ProfileGap[] = [];
  if (p.avatar_url === null || p.avatar_url.trim() === '') gaps.push('photo');
  if (p.disciplines === null || p.disciplines.length === 0) gaps.push('disciplines');
  return gaps;
}

export type IntroArrivalHint = 'results' | 'empty' | 'detail';

// Which coach hint the search shows after the intro hand-over: only once the
// search answered. While loading, on an error (its own retry state) or
// without a place there is none.
export function searchArrivalHint(
  status: 'idle' | 'loading' | 'ready' | 'error',
  locationStatus: 'loading' | 'ready' | 'none',
  hits: number,
): IntroArrivalHint | null {
  if (locationStatus !== 'ready' || status !== 'ready') return null;
  return hits > 0 ? 'results' : 'empty';
}
