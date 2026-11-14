import { isFemale, isGender, parseGender } from './gender';

describe('gender', () => {
  it('erkennt nur die drei gespeicherten Werte', () => {
    expect(isGender('female')).toBe(true);
    expect(isGender('male')).toBe(true);
    expect(isGender('other')).toBe(true);
    expect(isGender('Female')).toBe(false);
    expect(isGender(null)).toBe(false);
    expect(parseGender('divers')).toBeNull();
    expect(parseGender('other')).toBe('other');
  });

  it('nur weiblich zählt für Frauen-Sparrings', () => {
    expect(isFemale('female')).toBe(true);
    expect(isFemale('other')).toBe(false);
    expect(isFemale('male')).toBe(false);
    expect(isFemale(null)).toBe(false);
  });
});
