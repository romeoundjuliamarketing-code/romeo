// Small helpers for the practical part of the gym page: website input and
// the "Route öffnen" link into the platform's maps app.

export const WEBSITE_MAX = 200;

// Turns user input into a storable website URL. Empty input → null (remove).
// "boxclub.de" becomes "https://boxclub.de"; anything that is not a plain
// http(s) address with a host is rejected (same rule as the DB check).
export function normalizeWebsite(input: string): { url: string | null; error: string | null } {
  const raw = input.trim();
  if (raw.length === 0) return { url: null, error: null };
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  if (withScheme.length > WEBSITE_MAX) return { url: null, error: `Höchstens ${WEBSITE_MAX} Zeichen.` };
  if (/\s/.test(withScheme)) return { url: null, error: 'Die Adresse darf keine Leerzeichen enthalten.' };
  const host = withScheme.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] ?? '';
  if (!/^[^.]+(\.[^.]+)+$/.test(host) || /[^a-z0-9.\-:äöüß]/i.test(host)) {
    return { url: null, error: 'Bitte gib eine gültige Website an, z. B. boxclub.de.' };
  }
  return { url: withScheme, error: null };
}

// Short display form: "https://www.boxclub.de/" → "boxclub.de".
export function websiteLabel(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

// Route link for the maps app: coordinates when known, else the address.
// iOS opens Apple Maps, Android hands a geo: intent to the user's maps app.
export function routeUrl(
  platform: 'ios' | 'android' | string,
  target: { address: string | null; lat: number | null; lng: number | null; label: string },
): string | null {
  const address = target.address?.trim() ?? '';
  const hasCoords = target.lat !== null && target.lng !== null;
  if (!hasCoords && address.length === 0) return null;
  if (platform === 'ios') {
    return hasCoords
      ? `https://maps.apple.com/?daddr=${target.lat},${target.lng}&q=${encodeURIComponent(target.label)}`
      : `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
  }
  return hasCoords
    ? `geo:${target.lat},${target.lng}?q=${target.lat},${target.lng}(${encodeURIComponent(target.label)})`
    : `geo:0,0?q=${encodeURIComponent(address)}`;
}
