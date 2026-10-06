import { localeFor, type AppLanguage } from './language';

export type DateFormat = 'date' | 'dayMonth' | 'weekdayLong' | 'time' | 'dateTime';

const OPTIONS: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
  dayMonth: { day: 'numeric', month: 'short' },
  weekdayLong: { weekday: 'long', day: 'numeric', month: 'long' },
  time: { hour: '2-digit', minute: '2-digit', hour12: false },
  dateTime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false },
};

// Single entry point for user-visible dates; returns '' for unparseable input
// so the UI never shows "Invalid Date".
export function formatDate(input: Date | string | number, format: DateFormat, language: AppLanguage): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeFor(language), OPTIONS[format]).format(date);
}
