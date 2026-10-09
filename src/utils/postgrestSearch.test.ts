import { sanitizeSearchTerm } from './postgrestSearch';

describe('sanitizeSearchTerm', () => {
  it('keeps plain text', () => {
    expect(sanitizeSearchTerm('Berlin Gym')).toBe('Berlin Gym');
  });
  it('turns filter syntax into single-char wildcards', () => {
    expect(sanitizeSearchTerm('a,name.eq.x)(b')).toBe('a_name_eq_x__b');
  });
  it('keeps names with dots and apostrophes matchable', () => {
    expect(sanitizeSearchTerm('St. Pauli')).toBe('St_ Pauli');
    expect(sanitizeSearchTerm("O'Brien")).toBe('O_Brien');
  });
  it('drops wildcards and escapes', () => {
    expect(sanitizeSearchTerm('a%b*c\\d')).toBe('abcd');
  });
  it('collapses whitespace and control chars', () => {
    expect(sanitizeSearchTerm('  a \n\t  b  ')).toBe('a b');
  });
  it('caps length at 64', () => {
    expect(sanitizeSearchTerm('x'.repeat(100)).length).toBe(64);
  });
  it('returns empty for only special chars', () => {
    expect(sanitizeSearchTerm(',.()')).toBe('');
  });
});
