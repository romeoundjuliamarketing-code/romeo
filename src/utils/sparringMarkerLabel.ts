// Short marker text for the sparring map, e.g. "K1 · Sa" or "BJJ · Heute".
// Kept narrow so neighbouring markers overlap as little as possible.

const SHORT_DISCIPLINE: Record<string, string> = {
  'K1 / Kickboxen': 'K1',
  'Muay Thai':      'Muay Thai',
  'Sonstiges':      'Sparring',
};

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;
const MAX_DISCIPLINE_CHARS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export function shortDiscipline(discipline: string): string {
  const trimmed = discipline.trim();
  if (trimmed.length === 0) return 'Sparring';
  const known = SHORT_DISCIPLINE[trimmed];
  if (known !== undefined) return known;
  const first = trimmed.split(/[\s/]+/)[0];
  return first.length > MAX_DISCIPLINE_CHARS ? `${first.slice(0, MAX_DISCIPLINE_CHARS - 1)}.` : first;
}

// "Heute", "Morgen", the weekday within the next 6 days, the date beyond that
// (a bare weekday would be ambiguous). Local device time.
export function shortDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / DAY_MS);
  if (days <= 0) return 'Heute';
  if (days === 1) return 'Morgen';
  if (days < 7) return WEEKDAYS[d.getDay()];
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

export function sparringMarkerLabel(discipline: string, scheduledAt: string, now: Date = new Date()): string {
  return `${shortDiscipline(discipline)} · ${shortDay(scheduledAt, now)}`;
}
