import { localized } from './localized';

describe('localized', () => {
  const text = { de: 'Hallo', en: 'Hello' } as const;
  it('picks the active language', () => {
    expect(localized(text, 'de' as const)).toBe('Hallo');
    expect(localized(text, 'en' as const)).toBe('Hello');
  });
  it('falls back to German when English is empty', () => {
    expect(localized({ de: 'Hallo', en: '' }, 'en' as const)).toBe('Hallo');
  });
});
