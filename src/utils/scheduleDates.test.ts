import { nextDateForWeekday } from './scheduleDates';

// Helper: create a Date at midnight for a specific ISO date string
function d(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

// 2026-06-05 is a Friday (JS getDay() === 5)
// day_of_week mapping: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6

describe('nextDateForWeekday', () => {
  const friday = d('2026-06-05');

  it('returns next Monday when from is Friday', () => {
    // dayOfWeek 0 = Monday
    expect(nextDateForWeekday(0, friday)).toBe('2026-06-08');
  });

  it('returns next Saturday when from is Friday', () => {
    // dayOfWeek 5 = Saturday
    expect(nextDateForWeekday(5, friday)).toBe('2026-06-06');
  });

  it('returns next Sunday when from is Friday', () => {
    // dayOfWeek 6 = Sunday
    expect(nextDateForWeekday(6, friday)).toBe('2026-06-07');
  });

  it('returns next Friday (7 days later) when from IS a Friday', () => {
    // dayOfWeek 4 = Friday — same weekday as `from`, must skip to next week
    expect(nextDateForWeekday(4, friday)).toBe('2026-06-12');
  });

  it('returns next Tuesday when from is Monday', () => {
    // 2026-06-08 is a Monday (JS getDay() === 1)
    const monday = d('2026-06-08');
    // dayOfWeek 1 = Tuesday
    expect(nextDateForWeekday(1, monday)).toBe('2026-06-09');
  });

  it('returns next Monday (7 days later) when from is Monday and target is Monday', () => {
    const monday = d('2026-06-08');
    // dayOfWeek 0 = Monday — same weekday, must skip
    expect(nextDateForWeekday(0, monday)).toBe('2026-06-15');
  });

  it('throws for invalid dayOfWeek', () => {
    expect(() => nextDateForWeekday(7, friday)).toThrow();
    expect(() => nextDateForWeekday(-1, friday)).toThrow();
  });

  it('works without explicit from (uses today)', () => {
    // Just verify it returns a valid ISO date in the future
    const result = nextDateForWeekday(0);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const resultDate = new Date(result + 'T00:00:00');
    expect(resultDate.getTime()).toBeGreaterThan(Date.now());
  });
});
