import { hasFlag } from 'country-flag-icons';
import { COUNTRIES, countryByCode, normalizeCountryQuery, searchCountries } from './countries';

const sortKey = (name: string): string => name
  .toLowerCase()
  .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

describe('COUNTRIES', () => {
  it('has a bundled flag for every code', () => {
    expect(COUNTRIES.filter((c) => !hasFlag(c.code))).toEqual([]);
  });

  it('has unique codes in the shape the database accepts', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    codes.forEach((code) => expect(code).toMatch(/^[A-Z]{2}(-[A-Z]{3})?$/));
  });

  it('is sorted alphabetically in German', () => {
    for (let i = 1; i < COUNTRIES.length; i++) {
      expect(sortKey(COUNTRIES[i - 1].name) < sortKey(COUNTRIES[i].name)).toBe(true);
    }
  });
});

describe('countryByCode', () => {
  it('finds known codes and ignores unknown or empty ones', () => {
    expect(countryByCode('DE')?.name).toBe('Deutschland');
    expect(countryByCode('GB-SCT')?.name).toBe('Schottland');
    expect(countryByCode('ZZ')).toBeNull();
    expect(countryByCode(null)).toBeNull();
  });
});

describe('searchCountries', () => {
  it('returns all countries for an empty query', () => {
    expect(searchCountries('  ')).toBe(COUNTRIES);
  });

  it('matches regardless of umlaut spelling and case', () => {
    expect(searchCountries('österreich').map((c) => c.code)).toEqual(['AT']);
    expect(searchCountries('Oesterreich').map((c) => c.code)).toEqual(['AT']);
    expect(searchCountries('turkei').map((c) => c.code)).toEqual(['TR']);
  });

  it('matches by exact code', () => {
    expect(searchCountries('th').map((c) => c.code)).toContain('TH');
  });

  it('folds accents', () => {
    expect(normalizeCountryQuery('São Tomé')).toBe('sao tome');
  });
});
