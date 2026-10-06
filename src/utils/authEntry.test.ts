import { authInitialRoute, isEntryLoading, parseIntroSeen, INTRO_SEEN_VALUE } from './authEntry';

describe('isEntryLoading', () => {
  it('waits while the session is still being restored', () => {
    expect(isEntryLoading(true, false, true)).toBe(true);
    expect(isEntryLoading(true, true, null)).toBe(true);
  });

  it('never waits for the intro flag when a session exists', () => {
    expect(isEntryLoading(false, true, null)).toBe(false);
  });

  it('waits for the intro flag when signed out', () => {
    expect(isEntryLoading(false, false, null)).toBe(true);
  });

  it('is ready once signed out and the flag is known', () => {
    expect(isEntryLoading(false, false, false)).toBe(false);
    expect(isEntryLoading(false, false, true)).toBe(false);
  });
});

describe('authInitialRoute', () => {
  it('starts on the intro while it is unseen', () => {
    expect(authInitialRoute(false)).toBe('Welcome');
  });

  it('starts on the login once the intro was seen', () => {
    expect(authInitialRoute(true)).toBe('Login');
  });
});

describe('parseIntroSeen', () => {
  it('reads the stored marker', () => {
    expect(parseIntroSeen(INTRO_SEEN_VALUE)).toBe(true);
  });

  it('treats a missing or unknown value as unseen', () => {
    expect(parseIntroSeen(null)).toBe(false);
    expect(parseIntroSeen('true')).toBe(false);
    expect(parseIntroSeen('')).toBe(false);
  });
});
