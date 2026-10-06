import { normalizeWebsite, websiteLabel, routeUrl, WEBSITE_MAX } from './gymLinks';

describe('normalizeWebsite', () => {
  it('returns null without error for empty input', () => {
    expect(normalizeWebsite('   ')).toEqual({ url: null, error: null });
  });

  it('adds https to a bare domain', () => {
    expect(normalizeWebsite('boxclub.de')).toEqual({ url: 'https://boxclub.de', error: null });
  });

  it('keeps an existing http(s) scheme and path', () => {
    expect(normalizeWebsite('http://www.boxclub.de/kontakt').url).toBe('http://www.boxclub.de/kontakt');
    expect(normalizeWebsite('HTTPS://boxclub.de').url).toBe('HTTPS://boxclub.de');
  });

  it('rejects text without a domain', () => {
    expect(normalizeWebsite('boxclub').error).not.toBeNull();
    expect(normalizeWebsite('box club.de').error).not.toBeNull();
  });

  it('rejects overly long input', () => {
    expect(normalizeWebsite(`${'a'.repeat(WEBSITE_MAX)}.de`).error).not.toBeNull();
  });
});

describe('websiteLabel', () => {
  it('strips scheme, www and trailing slash', () => {
    expect(websiteLabel('https://www.boxclub.de/')).toBe('boxclub.de');
    expect(websiteLabel('http://boxclub.de/kurse')).toBe('boxclub.de/kurse');
  });
});

describe('routeUrl', () => {
  const base = { address: 'Hauptstr. 1, Berlin', lat: null, lng: null, label: 'Box Club' };

  it('returns null without address and coordinates', () => {
    expect(routeUrl('ios', { ...base, address: '  ' })).toBeNull();
  });

  it('uses coordinates when known', () => {
    expect(routeUrl('ios', { ...base, lat: 52.5, lng: 13.4 })).toBe('https://maps.apple.com/?daddr=52.5,13.4&q=Box%20Club');
    expect(routeUrl('android', { ...base, lat: 52.5, lng: 13.4 })).toBe('geo:52.5,13.4?q=52.5,13.4(Box%20Club)');
  });

  it('falls back to the address', () => {
    expect(routeUrl('ios', base)).toBe('https://maps.apple.com/?daddr=Hauptstr.%201%2C%20Berlin');
    expect(routeUrl('android', base)).toBe('geo:0,0?q=Hauptstr.%201%2C%20Berlin');
  });
});
