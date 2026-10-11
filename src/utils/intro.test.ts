import {
  INTRO_VERSION, ONBOARDING_PREVIEW_CHALLENGE_ID, introStartStep, isIntroCandidate, missingProfileItems,
  needsIntroUpgrade, pickIntroSparring, searchArrivalHint,
} from './intro';
import { playableChallengesForArea } from './challengeAvailability';

const done = { name: 'Romeo', has_birth_date: true, onboarding_completed: true };

describe('introStartStep', () => {
  it('waits for the required setup', () => {
    expect(introStartStep({ ...done, name: null, tour_status: 'in_progress', tour_version: INTRO_VERSION, tour_station: 1 })).toBeNull();
    expect(introStartStep({ ...done, has_birth_date: false, tour_status: 'in_progress' })).toBeNull();
    expect(introStartStep({ ...done, onboarding_completed: false, tour_status: 'in_progress' })).toBeNull();
  });

  it('maps a running old tour to the new card step', () => {
    expect(introStartStep({ ...done, tour_status: 'in_progress', tour_station: 3, tour_version: null })).toBe(0);
    expect(introStartStep({ ...done, tour_status: 'in_progress', tour_station: 2, tour_version: 1 })).toBe(0);
  });

  it('never auto-starts after completed, skipped or no tour', () => {
    expect(introStartStep({ ...done, tour_status: 'completed' })).toBeNull();
    expect(introStartStep({ ...done, tour_status: 'skipped' })).toBeNull();
    expect(introStartStep({ ...done, tour_status: null })).toBeNull();
    expect(introStartStep(done)).toBeNull();
  });

  it('resumes the saved new step', () => {
    expect(introStartStep({ ...done, tour_status: 'in_progress', tour_station: 1, tour_version: INTRO_VERSION })).toBe(1);
    expect(introStartStep({ ...done, tour_status: 'in_progress', tour_station: 0, tour_version: INTRO_VERSION })).toBe(0);
  });
});

describe('needsIntroUpgrade', () => {
  it('upgrades a running old tour once', () => {
    expect(needsIntroUpgrade({ ...done, tour_status: 'in_progress', tour_station: 2, tour_version: null })).toBe(true);
    // Once saved as version 2, a restart keeps the new step.
    expect(needsIntroUpgrade({ ...done, tour_status: 'in_progress', tour_station: 1, tour_version: INTRO_VERSION })).toBe(false);
    expect(needsIntroUpgrade({ ...done, tour_status: 'completed', tour_version: null })).toBe(false);
  });
});

const now = new Date('2026-10-11T10:00:00Z');
const s = (id: string, over: Partial<{ scheduled_at: string; is_active: boolean; max_slots: number; signup_count: number }> = {}) => ({
  id, scheduled_at: '2026-10-12T18:00:00Z', is_active: true, max_slots: 4, signup_count: 1, ...over,
});

describe('pickIntroSparring', () => {
  it('takes the first upcoming, active sparring with a free slot', () => {
    const list = [
      s('past', { scheduled_at: '2026-10-10T18:00:00Z' }),
      s('full', { signup_count: 4 }),
      s('off', { is_active: false }),
      s('ok'),
      s('later'),
    ];
    expect(pickIntroSparring(list, now)?.id).toBe('ok');
  });

  it('returns null without a fitting one', () => {
    expect(pickIntroSparring([s('full', { signup_count: 4 })], now)).toBeNull();
    expect(pickIntroSparring([], now)).toBeNull();
  });

  it('rechecks a single sparring', () => {
    expect(isIntroCandidate(s('ok'), now)).toBe(true);
    expect(isIntroCandidate(s('full', { signup_count: 4 }), now)).toBe(false);
  });
});

describe('preview card', () => {
  it('exists in the delivered deck', () => {
    expect(playableChallengesForArea('kickboxen').some((c) => c.id === ONBOARDING_PREVIEW_CHALLENGE_ID)).toBe(true);
  });
});

describe('missingProfileItems', () => {
  it('lists only what is missing', () => {
    expect(missingProfileItems({ avatar_url: null, disciplines: [] })).toEqual(['photo', 'disciplines']);
    expect(missingProfileItems({ avatar_url: 'a.jpg', disciplines: ['Boxen'] })).toEqual([]);
    expect(missingProfileItems(null)).toEqual([]);
  });
});

describe('searchArrivalHint', () => {
  it('waits for an answered search', () => {
    expect(searchArrivalHint('loading', 'ready', 0)).toBeNull();
    expect(searchArrivalHint('idle', 'loading', 0)).toBeNull();
  });

  it('never treats an error or a missing place as empty', () => {
    expect(searchArrivalHint('error', 'ready', 0)).toBeNull();
    expect(searchArrivalHint('ready', 'none', 0)).toBeNull();
  });

  it('picks the variant by hits', () => {
    expect(searchArrivalHint('ready', 'ready', 3)).toBe('results');
    expect(searchArrivalHint('ready', 'ready', 0)).toBe('empty');
  });
});
