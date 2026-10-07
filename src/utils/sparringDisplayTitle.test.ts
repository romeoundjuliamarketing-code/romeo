import { sparringDisplayTitle } from './sparringDisplayTitle';

describe('sparringDisplayTitle', () => {
  it('translates default titles', () => {
    expect(sparringDisplayTitle('Boxen – Sparring', 'en' as const)).toBe('Boxing – Sparring');
    expect(sparringDisplayTitle('K1 / Kickboxen – Sparring', 'en' as const)).toBe('K1 / Kickboxing – Sparring');
  });
  it('shows the catch-all discipline as plain Sparring in both languages', () => {
    expect(sparringDisplayTitle('Sonstiges – Sparring', 'en' as const)).toBe('Sparring');
    expect(sparringDisplayTitle('Sonstiges – Sparring', 'de' as const)).toBe('Sparring');
  });
  it('keeps own titles, including ones that end like a default', () => {
    expect(sparringDisplayTitle('Hamburg – Sparring', 'en' as const)).toBe('Hamburg – Sparring');
    expect(sparringDisplayTitle('  Lockeres Box sparring ', 'en' as const)).toBe('Lockeres Box sparring');
    expect(sparringDisplayTitle('Boxen – Sparring', 'de' as const)).toBe('Boxen – Sparring');
  });
});
