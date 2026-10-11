import { localeFor, type AppLanguage } from './language';

export type DateFormat = 'date' | 'dateLong' | 'dayMonth' | 'weekdayLong' | 'time' | 'dateTime' | 'dayNumber' | 'monthShort' | 'weekday';

const OPTIONS: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
  dateLong: { day: 'numeric', month: 'long', year: 'numeric' },
  dayMonth: { day: 'numeric', month: 'short' },
  weekdayLong: { weekday: 'long', day: 'numeric', month: 'long' },
  time: { hour: '2-digit', minute: '2-digit', hour12: false },
  dateTime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false },
  dayNumber: { day: 'numeric' },
  monthShort: { month: 'short' },
  weekday: { weekday: 'long' },
};

// Single entry point for user-visible dates; returns '' for unparseable input
// so the UI never shows "Invalid Date".
export function formatDate(input: Date | string | number, format: DateFormat, language: AppLanguage): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeFor(language), OPTIONS[format]).format(date);
}
