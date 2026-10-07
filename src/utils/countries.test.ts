import { hasFlag } from 'country-flag-icons';
import { COUNTRIES, countryByCode, countryName, normalizeCountryQuery, searchCountries } from './countries';

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

describe('English country names', () => {
  it('has an English name for every country', () => {
    COUNTRIES.forEach((c) => expect([c.code, c.nameEn.trim().length > 0]).toEqual([c.code, true]));
  });
  it('names a country in the active language', () => {
    const de = countryByCode('DE');
    expect(de && countryName(de, 'en' as const)).toBe('Germany');
    expect(de && countryName(de, 'de' as const)).toBe('Deutschland');
    const sct = countryByCode('GB-SCT');
    expect(sct && countryName(sct, 'en' as const)).toBe('Scotland');
  });
  it('searches by the English name and sorts by it', () => {
    expect(searchCountries('germ', 'en' as const).map((c) => c.code)).toContain('DE');
    expect(searchCountries('äg', 'de' as const).map((c) => c.code)).toContain('EG');
    const all = searchCountries('', 'en' as const);
    expect(all.length).toBe(COUNTRIES.length);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].nameEn.localeCompare(all[i].nameEn, 'en') <= 0).toBe(true);
    }
  });
});
