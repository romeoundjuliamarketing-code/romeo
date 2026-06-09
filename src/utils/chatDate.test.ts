// Tests for chatDate utility functions.
import { isSameDay, chatDateLabel } from './chatDate';

// Helper to create a date from date parts only (midnight local time)
function makeDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

describe('isSameDay', () => {
  it('returns true for the same date at different times', () => {
    const a = new Date(2026, 5, 5, 8, 0, 0);
    const b = new Date(2026, 5, 5, 23, 59, 59);
    expect(isSameDay(a, b)).toBe(true);
  });

  it('returns false for consecutive days', () => {
    const a = new Date(2026, 5, 5);
    const b = new Date(2026, 5, 6);
    expect(isSameDay(a, b)).toBe(false);
  });

  it('returns false for same day in different months', () => {
    const a = new Date(2026, 4, 5);
    const b = new Date(2026, 5, 5);
    expect(isSameDay(a, b)).toBe(false);
  });

  it('returns false for same day in different years', () => {
    const a = new Date(2025, 5, 5);
    const b = new Date(2026, 5, 5);
    expect(isSameDay(a, b)).toBe(false);
  });
});

describe('chatDateLabel', () => {
  const now = makeDate(2026, 6, 5); // 5 June 2026

  it('returns "Heute" for a timestamp on the same day', () => {
    const iso = new Date(2026, 5, 5, 14, 30, 0).toISOString();
    expect(chatDateLabel(iso, now)).toBe('Heute');
  });

  it('returns "Gestern" for a timestamp one day before', () => {
    const iso = new Date(2026, 5, 4, 9, 0, 0).toISOString();
    expect(chatDateLabel(iso, now)).toBe('Gestern');
  });

  it('returns a formatted German date for older timestamps', () => {
    const iso = new Date(2026, 5, 12, 10, 0, 0).toISOString();
    // 12 June 2026 is in the future relative to our mock "now" (5 June 2026),
    // so it should be formatted as a full date.
    const label = chatDateLabel(iso, now);
    expect(label).toBe('12. Juni 2026');
  });

  it('handles day boundaries correctly: midnight of today is "Heute"', () => {
    const iso = new Date(2026, 5, 5, 0, 0, 0).toISOString();
    expect(chatDateLabel(iso, now)).toBe('Heute');
  });

  it('handles day boundaries correctly: one second before today is "Gestern"', () => {
    const iso = new Date(2026, 5, 4, 23, 59, 59).toISOString();
    expect(chatDateLabel(iso, now)).toBe('Gestern');
  });
});
