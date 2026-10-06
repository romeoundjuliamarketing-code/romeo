// Pure language helpers (no React Native imports, unit-tested in node).

export type AppLanguage = 'de' | 'en';

export const APP_LANGUAGES: readonly AppLanguage[] = ['de', 'en'];

export function parseLanguage(value: unknown): AppLanguage | null {
  return value === 'de' || value === 'en' ? value : null;
}

// Any German variant (de-AT, de-CH, ...) is German; everything else is English.
export function languageFromDeviceTag(tag: string | null | undefined): AppLanguage {
  return tag && tag.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function resolveStartupLanguage(
  stored: unknown,
  deviceTag: string | null | undefined,
): AppLanguage {
  return parseLanguage(stored) ?? languageFromDeviceTag(deviceTag);
}

// After login: the profile wins when set (cross-device choice); when unset the
// current app language is uploaded so server-side push texts match the UI.
export function decideProfileSync(
  profileLanguage: unknown,
  current: AppLanguage,
): { apply: AppLanguage | null; upload: AppLanguage | null } {
  const fromProfile = parseLanguage(profileLanguage);
  if (fromProfile === null) return { apply: null, upload: current };
  if (fromProfile !== current) return { apply: fromProfile, upload: null };
  return { apply: null, upload: null };
}

export function localeFor(language: AppLanguage): 'de-DE' | 'en-GB' {
  return language === 'de' ? 'de-DE' : 'en-GB';
}
