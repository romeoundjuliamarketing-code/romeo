// Official fight nights (fight_events) for Home's "Gemeinsam Kämpfe schauen"
// block, and how a local watch party (events.public_viewing) is matched to one.
// Pure so the date/time-zone rules are testable. Times render in the device
// time zone (a US Saturday night is a Sunday morning in Germany).

import { appointmentDayLabel, timeLabel } from './homeAgenda';

export type FightPromotion = 'UFC' | 'OKTAGON';

export const FIGHT_PROMOTIONS: readonly FightPromotion[] = ['UFC', 'OKTAGON'];

export interface FightEvent {
  id:           string;
  promotion:    FightPromotion;
  name:         string;
  /** Calendar date at the venue, "YYYY-MM-DD". */
  eventDate:    string;
  prelimsAt:    string | null;
  mainCardAt:   string | null;
  endsAt:       string | null;
  status:       'scheduled' | 'cancelled';
}

const RUNNING_HOURS = 8;
const HOUR_MS = 3_600_000;

function parseEventDate(eventDate: string): Date {
  const [y, m, d] = eventDate.split('-').map((p) => parseInt(p, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// First moment the night is on air (for ordering and the map match).
export function fightEventStart(event: FightEvent): Date | null {
  const iso = event.prelimsAt ?? event.mainCardAt;
  return iso !== null ? new Date(iso) : null;
}

// Until when the night counts as current: the stored end, else 8 h after the
// last known start, else the end of the day after the event date. A running
// event therefore stays visible after the main card has started.
export function fightEventEnd(event: FightEvent): Date {
  if (event.endsAt !== null) return new Date(event.endsAt);
  const lastStart = event.mainCardAt ?? event.prelimsAt;
  if (lastStart !== null) return new Date(new Date(lastStart).getTime() + RUNNING_HOURS * HOUR_MS);
  const date = parseEventDate(event.eventDate);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 2);
}

function sortKey(event: FightEvent): number {
  return (fightEventStart(event) ?? parseEventDate(event.eventDate)).getTime();
}

export function pickNextFightEvent(
  events: readonly FightEvent[],
  promotion: FightPromotion,
  now: Date,
): FightEvent | null {
  return events
    .filter((e) => e.promotion === promotion && e.status === 'scheduled' && fightEventEnd(e).getTime() > now.getTime())
    .sort((a, b) => sortKey(a) - sortKey(b))[0] ?? null;
}

// Promotions that currently have a next event — the toggle only offers these.
export function availablePromotions(events: readonly FightEvent[], now: Date): FightPromotion[] {
  return FIGHT_PROMOTIONS.filter((p) => pickNextFightEvent(events, p, now) !== null);
}

export interface FightEventWhen {
  /** Which broadcast part the time refers to; null when no time is known. */
  segment: 'Main Card' | 'Prelims' | null;
  day:     string;
  /** "02:00", or null → "Uhrzeit folgt". */
  time:    string | null;
  running: boolean;
}

export function fightEventWhen(event: FightEvent, now: Date): FightEventWhen {
  const start = fightEventStart(event);
  const running = start !== null && start.getTime() <= now.getTime();
  if (event.mainCardAt !== null) {
    const d = new Date(event.mainCardAt);
    return { segment: 'Main Card', day: appointmentDayLabel(d, now), time: timeLabel(d), running };
  }
  if (event.prelimsAt !== null) {
    const d = new Date(event.prelimsAt);
    return { segment: 'Prelims', day: appointmentDayLabel(d, now), time: timeLabel(d), running };
  }
  return { segment: null, day: appointmentDayLabel(parseEventDate(event.eventDate), now), time: null, running: false };
}

// ─── Watch parties on the event map ──────────────────────────────────────────

export interface WatchPartyLike {
  title:       string;
  fightCard:   string | null;
  scheduledAt: string;
}

const MATCH_WINDOW_HOURS = 18;

function mentionsPromotion(text: string, promotion: FightPromotion): boolean {
  return new RegExp(`(^|[^A-Za-zÄÖÜäöü])${promotion}([^A-Za-zÄÖÜäöü]|$)`, 'i').test(text);
}

// A watch party belongs to a fight night when its title or fight card names
// the promotion and it takes place around that night (±18 h of the first
// broadcast start, or on the event date / the day after when no time is known).
// Other sports never match because the promotion must be named.
export function watchPartyMatches(
  party: WatchPartyLike,
  promotion: FightPromotion,
  anchor: { start: string | null; eventDate: string | null } | null,
): boolean {
  const text = `${party.title} ${party.fightCard ?? ''}`;
  if (!mentionsPromotion(text, promotion)) return false;
  if (anchor === null) return true;
  const at = new Date(party.scheduledAt).getTime();
  if (anchor.start !== null) {
    return Math.abs(at - new Date(anchor.start).getTime()) <= MATCH_WINDOW_HOURS * HOUR_MS;
  }
  if (anchor.eventDate !== null) {
    const day = parseEventDate(anchor.eventDate);
    const from = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const to = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 2).getTime();
    return at >= from && at < to;
  }
  return true;
}
