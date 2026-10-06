import {
  normalizeGymText,
  gymSearchTokens,
  isSameGym,
  significantGymWords,
  rankSimilarGyms,
  gymPlaceLabel,
  validateNewGym,
  gymErrorMessage,
} from './gymSearch';

describe('normalizeGymText', () => {
  it('lowercases and collapses punctuation like the SQL gym_norm', () => {
    expect(normalizeGymText('  Box-Club  München ')).toBe('box club münchen');
    expect(normalizeGymText('K.O. Gym!')).toBe('k o gym');
  });
});

describe('gymSearchTokens', () => {
  it('drops characters that would break a PostgREST filter', () => {
    expect(gymSearchTokens('Box,Club (Nord)*')).toEqual(['Box', 'Club', 'Nord']);
  });
  it('drops one-letter fragments and caps the token count', () => {
    expect(gymSearchTokens('a bc de fg hi jk')).toEqual(['bc', 'de', 'fg', 'hi']);
  });
  it('keeps umlauts and inner hyphens', () => {
    expect(gymSearchTokens('Köln-Ehrenfeld -')).toEqual(['Köln-Ehrenfeld']);
  });
  it('is empty for blank input', () => {
    expect(gymSearchTokens('   ')).toEqual([]);
  });
});

describe('isSameGym', () => {
  it('matches across case and punctuation, but not across cities', () => {
    expect(isSameGym({ name: 'Box Club Nord', city: 'München' }, { name: 'box-club nord', city: 'MÜNCHEN' })).toBe(true);
    expect(isSameGym({ name: 'Box Club Nord', city: 'München' }, { name: 'Box Club Nord', city: 'Berlin' })).toBe(false);
  });
});

describe('significantGymWords', () => {
  it('ignores generic words', () => {
    expect(significantGymWords('Fight Club Phoenix Gym')).toEqual(['phoenix']);
  });
});

describe('rankSimilarGyms', () => {
  const gyms = [
    { id: '1', name: 'Phoenix Gym', city: 'Berlin' },
    { id: '2', name: 'Phoenix Gym', city: 'München' },
    { id: '3', name: 'Bulldog Boxing', city: 'München' },
    { id: '4', name: 'Phoenix Fight Academy', city: 'München' },
  ];
  it('puts the exact match first, then same-city name matches, drops unrelated ones', () => {
    expect(rankSimilarGyms(gyms, 'phoenix gym', 'München').map((g) => g.id)).toEqual(['2', '4', '1']);
  });
  it('returns nothing for a generic-only name without exact match', () => {
    expect(rankSimilarGyms(gyms, 'Gym', 'Hamburg')).toEqual([]);
  });
});

describe('gymPlaceLabel', () => {
  it('joins name and city, tolerates a missing city', () => {
    expect(gymPlaceLabel({ name: 'Phoenix', city: 'Berlin' })).toBe('Phoenix · Berlin');
    expect(gymPlaceLabel({ name: 'Phoenix', city: ' ' })).toBe('Phoenix');
    expect(gymPlaceLabel({ name: 'Phoenix', city: null })).toBe('Phoenix');
  });
});

describe('validateNewGym', () => {
  it('requires name and city, address optional', () => {
    expect(validateNewGym({ name: '', city: 'B', address: '' })).toEqual({
      name: 'Bitte gib den Namen des Gyms an.',
      city: 'Bitte gib die Stadt an.',
    });
    expect(validateNewGym({ name: 'Phoenix', city: 'Berlin', address: '' })).toEqual({});
  });
});

describe('gymErrorMessage', () => {
  it('maps server codes', () => {
    expect(gymErrorMessage('GYM_RATE_LIMIT')).toContain('morgen');
    expect(gymErrorMessage('network down')).toContain('erneut');
  });
});
