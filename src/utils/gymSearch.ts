// Pure helpers for the gym search and "Gym hinzufügen". A gym is a row of the
// studios table; the server-side duplicate check (create_gym / gym_norm) uses
// the same normalisation as normalizeGymText, so the client can warn early.
import i18n from '../i18n';

export interface GymLike {
  id:   string;
  name: string;
  city: string;
}

// Lowercase, everything but letters/digits becomes one space — mirrors the SQL
// gym_norm(): "Box-Club  München" → "box club münchen".
export function normalizeGymText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Search tokens safe to embed in a PostgREST or() filter: only letters, digits
// and hyphens survive (commas, brackets, quotes and wildcards would break or
// widen the filter). Short fragments are dropped, at most 4 tokens.
export function gymSearchTokens(query: string): string[] {
  return query
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter((t) => t.length >= 2)
    .slice(0, 4);
}

export function isSameGym(a: { name: string; city: string }, b: { name: string; city: string }): boolean {
  return normalizeGymText(a.name) === normalizeGymText(b.name)
    && normalizeGymText(a.city) === normalizeGymText(b.city);
}

// Words that say nothing about which gym is meant.
const GENERIC_WORDS: ReadonlySet<string> = new Set([
  'gym', 'club', 'team', 'studio', 'boxing', 'boxen', 'box', 'fight', 'fightclub', 'academy', 'akademie',
  'mma', 'bjj', 'kickboxen', 'kickboxing', 'thai', 'muay', 'sport', 'sports', 'verein', 'ev', 'e', 'v',
  'der', 'die', 'das', 'the', 'und', 'and',
]);

// Significant words of a gym name for "Meintest du …?" — generic words and
// fragments under 3 characters do not count.
export function significantGymWords(name: string): string[] {
  return normalizeGymText(name)
    .split(' ')
    .filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w));
}

// Ranks existing gyms that could be the one the user is about to add: an exact
// name+city match first, then entries sharing a significant name word, same
// city before other cities. Unrelated entries are dropped.
export function rankSimilarGyms<T extends GymLike>(candidates: T[], name: string, city: string): T[] {
  const words = significantGymWords(name);
  const normName = normalizeGymText(name);
  const normCity = normalizeGymText(city);
  const scored = candidates
    .map((g) => {
      const gName = normalizeGymText(g.name);
      const sameCity = normCity.length > 0 && normalizeGymText(g.city) === normCity;
      const exact = gName === normName && sameCity;
      const shared = words.filter((w) => gName.includes(w)).length;
      const nameMatch = gName === normName || shared > 0;
      const score = exact ? 100 : (nameMatch ? 10 + shared : 0) + (nameMatch && sameCity ? 5 : 0);
      return { g, score };
    })
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || a.g.name.localeCompare(b.g.name, 'de'));
  return scored.map((x) => x.g);
}

// "Name · Stadt" — the label that keeps equally named gyms distinguishable.
export function gymPlaceLabel(gym: { name: string; city: string | null }): string {
  const city = gym.city?.trim() ?? '';
  return city.length > 0 ? `${gym.name} · ${city}` : gym.name;
}

export const GYM_LIMITS = { name: 80, city: 60, address: 160, note: 500, accessNote: 120 } as const;

// Validation for "Gym hinzufügen" (same bounds as create_gym).
export function validateNewGym(input: { name: string; city: string; address: string }): {
  name?: string; city?: string; address?: string;
} {
  const errors: { name?: string; city?: string; address?: string } = {};
  const name = input.name.trim();
  const city = input.city.trim();
  if (name.length < 2) errors.name = i18n.t('gym.validation.nameRequired');
  else if (name.length > GYM_LIMITS.name) errors.name = i18n.t('gym.validation.maxChars', { max: GYM_LIMITS.name });
  if (city.length < 2) errors.city = i18n.t('gym.validation.cityRequired');
  else if (city.length > GYM_LIMITS.city) errors.city = i18n.t('gym.validation.maxChars', { max: GYM_LIMITS.city });
  if (input.address.trim().length > GYM_LIMITS.address) errors.address = i18n.t('gym.validation.maxChars', { max: GYM_LIMITS.address });
  return errors;
}

// Server error codes of create_gym → German UI copy.
export function gymErrorMessage(message: string): string {
  if (message.includes('GYM_RATE_LIMIT')) return i18n.t('gym.validation.rateLimit');
  if (message.includes('GYM_NAME_INVALID')) return i18n.t('gym.validation.nameInvalid');
  if (message.includes('GYM_CITY_INVALID')) return i18n.t('gym.validation.cityInvalid');
  if (message.includes('GYM_ADDRESS_INVALID')) return i18n.t('gym.validation.addressInvalid');
  return i18n.t('gym.validation.saveFailed');
}
