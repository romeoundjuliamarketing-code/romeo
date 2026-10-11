import {
  ageOn, checkBirthDate, checkName, isValidCalendarDate, onboardingRoute, onboardingSaveError,
  parseOnboardingState, routeAfterProfile, toIsoDate,
} from './onboarding';

const d = (year: number, month: number, day: number) => ({ year, month, day });

describe('ageOn', () => {
  it('counts the birthday itself as the new year', () => {
    expect(ageOn(d(2010, 10, 11), d(2026, 10, 11))).toBe(16);
    expect(ageOn(d(2010, 10, 12), d(2026, 10, 11))).toBe(15);
    expect(ageOn(d(2010, 11, 1), d(2026, 10, 31))).toBe(15);
  });

  it('treats 29 February as reached on 1 March in non-leap years', () => {
    expect(ageOn(d(2008, 2, 29), d(2025, 2, 28))).toBe(16);
    expect(ageOn(d(2009, 3, 1), d(2025, 2, 28))).toBe(15);
    expect(ageOn(d(2009, 2, 28), d(2025, 2, 28))).toBe(16);
  });
});

describe('checkBirthDate', () => {
  const today = d(2026, 10, 11);

  it('allows exactly from the 16th birthday', () => {
    expect(checkBirthDate(d(2010, 10, 11), today)).toBe('ok');
    expect(checkBirthDate(d(2010, 10, 12), today)).toBe('underage');
    expect(checkBirthDate(d(1990, 1, 1), today)).toBe('ok');
  });

  it('rejects future, missing and invalid dates', () => {
    expect(checkBirthDate(d(2026, 10, 12), today)).toBe('future');
    expect(checkBirthDate(null, today)).toBe('invalid');
    expect(checkBirthDate(d(2001, 2, 29), today)).toBe('invalid');
    expect(checkBirthDate(d(2000, 13, 1), today)).toBe('invalid');
    expect(checkBirthDate(d(1899, 12, 31), today)).toBe('invalid');
  });

  it('counts today as underage, not future', () => {
    expect(checkBirthDate(today, today)).toBe('underage');
  });
});

describe('isValidCalendarDate / toIsoDate', () => {
  it('knows leap years', () => {
    expect(isValidCalendarDate(d(2000, 2, 29))).toBe(true);
    expect(isValidCalendarDate(d(1900, 2, 29))).toBe(false);
    expect(isValidCalendarDate(d(2024, 4, 31))).toBe(false);
  });

  it('pads to YYYY-MM-DD', () => {
    expect(toIsoDate(d(2008, 3, 7))).toBe('2008-03-07');
  });
});

describe('checkName', () => {
  it('trims and rejects empty input', () => {
    expect(checkName('  Mo  ')).toEqual({ ok: true, name: 'Mo' });
    expect(checkName('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(checkName('a'.repeat(41))).toEqual({ ok: false, reason: 'tooLong' });
  });
});

describe('onboardingRoute', () => {
  const base = { name: 'Mo', has_birth_date: true, onboarding_completed: true };

  it('lets fully set-up accounts in', () => {
    expect(onboardingRoute(base)).toBe('done');
  });

  it('asks for missing data even with an old completed flag', () => {
    expect(onboardingRoute({ ...base, has_birth_date: false })).toBe('profile');
    expect(onboardingRoute({ ...base, name: '  ' })).toBe('profile');
    expect(onboardingRoute({ ...base, name: null })).toBe('profile');
  });

  it('sends new accounts to the location step after their data', () => {
    expect(onboardingRoute({ ...base, onboarding_completed: false })).toBe('location');
    expect(onboardingRoute({ name: null, has_birth_date: false, onboarding_completed: false })).toBe('profile');
  });

  it('returns existing accounts to the app after step 1', () => {
    expect(routeAfterProfile({ ...base, has_birth_date: false })).toBe('done');
    expect(routeAfterProfile({ ...base, onboarding_completed: false })).toBe('location');
  });
});

describe('parseOnboardingState / onboardingSaveError', () => {
  it('parses defensively', () => {
    expect(parseOnboardingState(null)).toBeNull();
    expect(parseOnboardingState({ name: 5, has_birth_date: 'yes' }))
      .toEqual({ name: null, has_birth_date: false, onboarding_completed: false, tour_status: null, tour_station: null });
    expect(parseOnboardingState({ name: 'Mo', has_birth_date: true, onboarding_completed: true, tour_status: 'in_progress', tour_station: 2 }))
      .toMatchObject({ tour_status: 'in_progress', tour_station: 2 });
    expect(parseOnboardingState({ tour_status: 'weird' })?.tour_status).toBeNull();
  });

  it('maps server codes', () => {
    expect(onboardingSaveError('ONBOARDING_UNDERAGE')).toBe('underage');
    expect(onboardingSaveError('CONTENT_FILTER_BLOCKED')).toBe('contentFilter');
    expect(onboardingSaveError('Failed to fetch')).toBe('network');
    expect(onboardingSaveError(undefined)).toBe('network');
  });
});
