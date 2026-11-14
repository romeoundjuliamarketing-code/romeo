// Gender as stored in profiles.gender. Self-declared; once set it cannot be
// changed by the user (server trigger trg_profiles_lock_gender), only by support.

export const GENDERS = ['female', 'male', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export function isGender(value: unknown): value is Gender {
  return typeof value === 'string' && (GENDERS as readonly string[]).includes(value);
}

/** Null for anything that is not a known value (old rows, typos). */
export function parseGender(value: unknown): Gender | null {
  return isGender(value) ? value : null;
}

/** Women-only sparrings: only 'female' may create, see and join them. */
export function isFemale(gender: unknown): boolean {
  return gender === 'female';
}
