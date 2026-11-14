import {
  isNewOpening,
  MAX_AUTO_SHOWS,
  mayAutoShow,
  parseShowCount,
  RESUME_AFTER_MS,
  shouldAutoShow,
  trialOfferStorageKey,
} from './trialOfferPrompt';

describe('parseShowCount', () => {
  it('treats missing or broken values as never shown', () => {
    expect(parseShowCount(null)).toBe(0);
    expect(parseShowCount('')).toBe(0);
    expect(parseShowCount('abc')).toBe(0);
    expect(parseShowCount('-3')).toBe(0);
  });

  it('reads stored counts', () => {
    expect(parseShowCount('1')).toBe(1);
    expect(parseShowCount('2')).toBe(2);
  });
});

describe('shouldAutoShow', () => {
  const base = { shownCount: 0, subscribed: false, trialAvailable: true };

  it('shows the first and second time', () => {
    expect(shouldAutoShow(base)).toBe(true);
    expect(shouldAutoShow({ ...base, shownCount: 1 })).toBe(true);
  });

  it('stops after two shows', () => {
    expect(MAX_AUTO_SHOWS).toBe(2);
    expect(shouldAutoShow({ ...base, shownCount: 2 })).toBe(false);
    expect(mayAutoShow(2)).toBe(false);
  });

  it('never shows to subscribers', () => {
    expect(shouldAutoShow({ ...base, subscribed: true })).toBe(false);
  });

  it('never shows without a store trial', () => {
    expect(shouldAutoShow({ ...base, trialAvailable: false })).toBe(false);
  });
});

describe('isNewOpening', () => {
  it('needs a background time', () => {
    expect(isNewOpening(null, 1_000_000)).toBe(false);
  });

  it('counts long background stays as a new opening', () => {
    expect(isNewOpening(0, RESUME_AFTER_MS)).toBe(true);
    expect(isNewOpening(0, RESUME_AFTER_MS - 1)).toBe(false);
  });
});

describe('trialOfferStorageKey', () => {
  it('is per account', () => {
    expect(trialOfferStorageKey('a')).not.toBe(trialOfferStorageKey('b'));
  });
});
