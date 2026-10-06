// Status wording for the own sparring history on the profile. Statuses come
// from sparring_signups as the server set them — attendance is never derived
// from a mere commitment: a past slot without a recorded result stays "offen".

export type HistoryRole = 'participant' | 'organizer';

export interface HistoryEntryInput {
  role:        HistoryRole;
  /** sparring_signups.status for participants; null for organizers. */
  status:      string | null;
  scheduledAt: string;
}

export type HistoryTone = 'upcoming' | 'done' | 'missed' | 'neutral';

export interface HistoryStatus {
  label: string;
  tone:  HistoryTone;
}

// In-time cancellations and expired slots never were a meeting for this user.
const HIDDEN: ReadonlySet<string> = new Set(['cancelled', 'expired']);

export function isHistoryVisible(e: HistoryEntryInput): boolean {
  return e.role === 'organizer' || (e.status !== null && !HIDDEN.has(e.status));
}

export function historyStatus(e: HistoryEntryInput, now: Date = new Date()): HistoryStatus {
  const past = new Date(e.scheduledAt).getTime() <= now.getTime();
  if (e.role === 'organizer') {
    return past ? { label: 'Organisiert', tone: 'neutral' } : { label: 'Du organisierst', tone: 'upcoming' };
  }
  switch (e.status) {
    case 'attended':       return { label: 'Teilgenommen', tone: 'done' };
    case 'no_show':        return { label: 'Nicht erschienen', tone: 'missed' };
    case 'cancelled_late': return { label: 'Kurzfristig abgesagt', tone: 'missed' };
    case 'waitlisted':     return past ? { label: 'Warteliste', tone: 'neutral' } : { label: 'Warteliste', tone: 'upcoming' };
    case 'confirmed':      return past ? { label: 'Teilnahme offen', tone: 'neutral' } : { label: 'Bestätigt', tone: 'upcoming' };
    case 'pending':        return past ? { label: 'Teilnahme offen', tone: 'neutral' } : { label: 'Zugesagt', tone: 'upcoming' };
    default:               return { label: 'Unbekannt', tone: 'neutral' };
  }
}
