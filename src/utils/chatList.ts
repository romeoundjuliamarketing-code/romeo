// Utility functions for the sparring chat list screen.

/**
 * Returns up to 2 uppercase initials from the first two words of a title.
 * Falls back to '?' when the title is empty.
 */
export function initialsFromTitle(title: string): string {
  const words = title.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return '?';
  const first  = words[0].charAt(0).toUpperCase();
  const second = words.length > 1 ? words[1].charAt(0).toUpperCase() : '';
  return first + second;
}

/**
 * Returns a short human-readable label for the last-message timestamp.
 * - null input  → ''
 * - today       → 'HH:MM'
 * - yesterday   → 'Gestern'
 * - within 7 days → short weekday ('Mo', 'Di', …)
 * - older       → 'TT.MM.' (e.g. '12.06.')
 */
export function lastMessageTimeLabel(iso: string | null, now?: Date): string {
  if (iso === null) return '';
  const date    = new Date(iso);
  const today   = now !== undefined ? new Date(now) : new Date();
  today.setHours(0, 0, 0, 0);

  const msgDay  = new Date(date);
  msgDay.setHours(0, 0, 0, 0);

  const diffMs   = today.getTime() - msgDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Same day: show time
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) {
    // Short German weekday abbreviation
    return date.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
  }
  // 'TT.MM.' format
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.`;
}

/**
 * Returns a short countdown label for the sparring event date.
 * - past        → 'Vorbei'
 * - today       → 'Heute · HH:MM'
 * - tomorrow    → 'Morgen · HH:MM'
 * - within 7 days → 'Wochentag · HH:MM' (e.g. 'Sa · 19:00')
 * - otherwise   → 'TT.MM. · HH:MM'
 */
export function sparringDateLabel(iso: string, now?: Date): string {
  const event   = new Date(iso);
  const today   = now !== undefined ? new Date(now) : new Date();
  const time    = event.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);

  const eventMidnight = new Date(event);
  eventMidnight.setHours(0, 0, 0, 0);

  const diffMs   = eventMidnight.getTime() - todayMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (event < today) return 'Vorbei';
  if (diffDays === 0) return `Heute · ${time}`;
  if (diffDays === 1) return `Morgen · ${time}`;
  if (diffDays < 7) {
    // Short German weekday abbreviation, strip trailing dot
    const weekday = event.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
    return `${weekday} · ${time}`;
  }
  const dd = String(event.getDate()).padStart(2, '0');
  const mm = String(event.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}. · ${time}`;
}
