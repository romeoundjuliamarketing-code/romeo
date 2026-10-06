import { formatDate } from './formatDate';

const d = new Date(2026, 9, 6, 14, 5); // Tue 6 Oct 2026, 14:05 local

describe('formatDate', () => {
  it('formats a numeric date', () => {
    expect(formatDate(d, 'date', 'de')).toBe('06.10.2026');
    expect(formatDate(d, 'date', 'en')).toBe('06/10/2026');
  });
  it('formats day + short month', () => {
    expect(formatDate(d, 'dayMonth', 'de')).toBe('6. Okt.');
    expect(formatDate(d, 'dayMonth', 'en')).toBe('6 Oct');
  });
  it('formats long weekday + day + month', () => {
    expect(formatDate(d, 'weekdayLong', 'de')).toBe('Dienstag, 6. Oktober');
    expect(formatDate(d, 'weekdayLong', 'en')).toBe('Tuesday 6 October');
  });
  it('formats 24h time in both languages', () => {
    expect(formatDate(d, 'time', 'de')).toBe('14:05');
    expect(formatDate(d, 'time', 'en')).toBe('14:05');
  });
  it('accepts ISO strings and timestamps', () => {
    expect(formatDate(d.toISOString(), 'time', 'de')).toBe('14:05');
    expect(formatDate(d.getTime(), 'time', 'en')).toBe('14:05');
  });
  it('returns an empty string for invalid input', () => {
    expect(formatDate('kaputt', 'date', 'de')).toBe('');
    expect(formatDate(Number.NaN, 'time', 'en')).toBe('');
  });
});
