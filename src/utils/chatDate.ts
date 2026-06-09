// Utility functions for chat date labels and day comparison.

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

/**
 * Returns a human-readable date label for a chat message timestamp.
 * @param iso  - ISO-8601 date string
 * @param now  - optional reference date (defaults to current time; useful for tests)
 */
export function chatDateLabel(iso: string, now?: Date): string {
  const date    = new Date(iso);
  const today   = now ?? new Date();

  if (isSameDay(date, today)) return 'Heute';

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Gestern';

  return date.toLocaleDateString('de-DE', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  });
}
