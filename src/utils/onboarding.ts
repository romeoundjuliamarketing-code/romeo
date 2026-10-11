// Onboarding rules after sign-up: name and birth date (step 1), search
// location (step 2). Pure, so age limit and entry route are testable.

export const MIN_AGE_YEARS = 16;
export const NAME_MAX_LENGTH = 40;
const EARLIEST_BIRTH_YEAR = 1900;

/** Calendar date without time or time zone. Month is 1-12. */
export interface CalendarDate {
  year:  number;
  month: number;
  day:   number;
}

/** Local calendar day of a JS date (what the user sees on their device). */
export function calendarDateOf(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function isValidCalendarDate(c: CalendarDate): boolean {
  if (!Number.isInteger(c.year) || !Number.isInteger(c.month) || !Number.isInteger(c.day)) return false;
  if (c.month < 1 || c.month > 12 || c.day < 1) return false;
  // Day 0 of the next month = last day of this month (UTC: no DST surprises).
  const daysInMonth = new Date(Date.UTC(c.year, c.month, 0)).getUTCDate();
  return c.day <= daysInMonth;
}

function compare(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

// Full years on `today`. The birthday counts from its own calendar day on; a
// 29 February birthday counts from 1 March in non-leap years.
export function ageOn(birth: CalendarDate, today: CalendarDate): number {
  let age = today.year - birth.year;
  if (today.month < birth.month || (today.month === birth.month && today.day < birth.day)) age -= 1;
  return age;
}

export type BirthDateCheck = 'ok' | 'invalid' | 'future' | 'underage';

export function checkBirthDate(birth: CalendarDate | null, today: CalendarDate): BirthDateCheck {
  if (birth === null || !isValidCalendarDate(birth) || birth.year < EARLIEST_BIRTH_YEAR) return 'invalid';
  if (compare(birth, today) > 0) return 'future';
  return ageOn(birth, today) >= MIN_AGE_YEARS ? 'ok' : 'underage';
}

/** "YYYY-MM-DD" for the Postgres `date` column. */
export function toIsoDate(c: CalendarDate): string {
  const pad = (n: number, len: number): string => String(n).padStart(len, '0');
  return `${pad(c.year, 4)}-${pad(c.month, 2)}-${pad(c.day, 2)}`;
}

export type NameCheck = { ok: true; name: string } | { ok: false; reason: 'empty' | 'tooLong' };

export function checkName(raw: string): NameCheck {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, reason: 'empty' };
  if (name.length > NAME_MAX_LENGTH) return { ok: false, reason: 'tooLong' };
  return { ok: true, name };
}

export type TourStatus = 'in_progress' | 'completed' | 'skipped';

/** Server answer of get_my_onboarding_state(). */
export interface OnboardingState {
  name:                 string | null;
  has_birth_date:       boolean;
  onboarding_completed: boolean;
  /** Coach tour, independent of the onboarding; null = never started. */
  tour_status?:         TourStatus | null;
  tour_station?:        number | null;
}

export type OnboardingRoute = 'profile' | 'location' | 'done';

// The data decides, not a marker: missing name or birth date always means
// step 1, even with an old "completed" flag. Step 2 only for accounts that
// never finished an onboarding (new users); existing accounts skip it.
export function onboardingRoute(state: OnboardingState): OnboardingRoute {
  const hasName = (state.name ?? '').trim().length > 0;
  if (!hasName || !state.has_birth_date) return 'profile';
  return state.onboarding_completed ? 'done' : 'location';
}

// After step 1: new users continue with the location, existing ones go back to
// where the app would have opened anyway.
export function routeAfterProfile(state: OnboardingState): OnboardingRoute {
  return state.onboarding_completed ? 'done' : 'location';
}

export function parseOnboardingState(raw: unknown): OnboardingState | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    name:                 typeof r.name === 'string' ? r.name : null,
    has_birth_date:       r.has_birth_date === true,
    onboarding_completed: r.onboarding_completed === true,
    tour_status:          r.tour_status === 'in_progress' || r.tour_status === 'completed' || r.tour_status === 'skipped'
      ? r.tour_status : null,
    tour_station:         typeof r.tour_station === 'number' ? r.tour_station : null,
  };
}

export type OnboardingSaveError = 'underage' | 'invalidBirthDate' | 'invalidName' | 'contentFilter' | 'network';

// Machine codes raised by set_my_profile_basics / complete_onboarding.
export function onboardingSaveError(message: string | null | undefined): OnboardingSaveError {
  const m = message ?? '';
  if (m.includes('ONBOARDING_UNDERAGE')) return 'underage';
  if (m.includes('ONBOARDING_INVALID_BIRTH_DATE')) return 'invalidBirthDate';
  if (m.includes('ONBOARDING_INVALID_NAME')) return 'invalidName';
  if (m.includes('CONTENT_FILTER_BLOCKED')) return 'contentFilter';
  return 'network';
}
