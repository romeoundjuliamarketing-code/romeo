// day_of_week convention: 0=Monday … 6=Sunday (NOT JavaScript Date standard)
// JavaScript Date: 0=Sunday, 1=Monday … 6=Saturday

const DB_TO_JS_WEEKDAY: Record<number, number> = {
  0: 1, // Monday
  1: 2, // Tuesday
  2: 3, // Wednesday
  3: 4, // Thursday
  4: 5, // Friday
  5: 6, // Saturday
  6: 0, // Sunday
};

/**
 * Returns the ISO date string (YYYY-MM-DD) of the next occurrence of the
 * given weekday (using the app's day_of_week convention: 0=Mon … 6=Sun).
 *
 * "Next" means the first day >= tomorrow. If `from` falls exactly on the
 * target weekday we skip it and return 7 days later — the booking is always
 * in the future.
 */
export function nextDateForWeekday(dayOfWeek: number, from: Date = new Date()): string {
  const jsTarget = DB_TO_JS_WEEKDAY[dayOfWeek];
  if (jsTarget === undefined) {
    throw new Error(`Invalid dayOfWeek: ${dayOfWeek}. Expected 0–6.`);
  }

  // Start from tomorrow
  const candidate = new Date(from);
  candidate.setHours(0, 0, 0, 0);
  candidate.setDate(candidate.getDate() + 1);

  // Advance until we hit the target JS weekday
  while (candidate.getDay() !== jsTarget) {
    candidate.setDate(candidate.getDate() + 1);
  }

  const year = candidate.getFullYear();
  const month = String(candidate.getMonth() + 1).padStart(2, '0');
  const day = String(candidate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
