import {
  parseLanguage, languageFromDeviceTag, resolveStartupLanguage, decideProfileSync, localeFor,
} from './language';

describe('parseLanguage', () => {
  it('accepts de and en', () => {
    expect(parseLanguage('de')).toBe('de');
    expect(parseLanguage('en')).toBe('en');
  });
  it('rejects anything else', () => {
    expect(parseLanguage('fr')).toBeNull();
    expect(parseLanguage('')).toBeNull();
    expect(parseLanguage('EN ')).toBeNull();
    expect(parseLanguage(null)).toBeNull();
    expect(parseLanguage(42)).toBeNull();
  });
});

describe('languageFromDeviceTag', () => {
  it('maps every German variant to de', () => {
    expect(languageFromDeviceTag('de')).toBe('de');
    expect(languageFromDeviceTag('de-AT')).toBe('de');
    expect(languageFromDeviceTag('de-CH')).toBe('de');
    expect(languageFromDeviceTag('DE-de')).toBe('de');
  });
  it('maps everything else to en', () => {
    expect(languageFromDeviceTag('en-US')).toBe('en');
    expect(languageFromDeviceTag('tr-TR')).toBe('en');
    expect(languageFromDeviceTag(undefined)).toBe('en');
    expect(languageFromDeviceTag(null)).toBe('en');
    expect(languageFromDeviceTag('')).toBe('en');
  });
});

describe('resolveStartupLanguage', () => {
  it('prefers a valid stored choice', () => {
    expect(resolveStartupLanguage('en', 'de-DE')).toBe('en');
  });
  it('falls back to the device when stored is invalid', () => {
    expect(resolveStartupLanguage('fr', 'de-DE')).toBe('de');
    expect(resolveStartupLanguage(null, 'en-US')).toBe('en');
  });
});

describe('decideProfileSync', () => {
  it('uploads the current language when the profile has none', () => {
    expect(decideProfileSync(null, 'en')).toEqual({ apply: null, upload: 'en' });
  });
  it('applies the profile language when it differs (account switch)', () => {
    expect(decideProfileSync('de', 'en')).toEqual({ apply: 'de', upload: null });
  });
  it('does nothing when both match', () => {
    expect(decideProfileSync('en', 'en')).toEqual({ apply: null, upload: null });
  });
  it('treats an invalid profile value like none', () => {
    expect(decideProfileSync('xx', 'de')).toEqual({ apply: null, upload: 'de' });
  });
});

describe('localeFor', () => {
  it('maps to the formatting locale', () => {
    expect(localeFor('de')).toBe('de-DE');
    expect(localeFor('en')).toBe('en-GB');
  });
});
