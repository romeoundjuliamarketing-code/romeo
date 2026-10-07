// What Home puts first. Pure so the selection rules are testable:
//   - the featured card is the earliest upcoming sparring the user organizes or
//     holds a slot in (pending/confirmed — waitlist, cancelled and expired rows
//     never reach this module, see useMyUpcomingSparrings);
//   - its state follows the existing commitment rules (sparringCommitment.ts):
//     only a pending slot inside the confirm window asks for confirmation, and
//     the organizer is never asked;
// Dates use the device time zone, like the rest of the app (sparringDetail.ts).

import { hasStarted, isInConfirmWindow } from './sparringCommitment';
import { SPARRING_CONFIRM_DEADLINE_HOURS } from '../data/sparringConfig';
import i18n from '../i18n';
import { parseLanguage } from './language';
import { sparringDisplayTitle } from './sparringDisplayTitle';

export type HomeSparringRole = 'organizer' | 'pending' | 'confirmed';

/** A slot holder (pending/confirmed signup) — same set the detail view counts. */
export interface HomeParticipant {
  userId:    string;
  name:      string | null;
  avatarUrl: string | null;
}

export interface HomeSparring {
  id:            string;
  title:         string;
  discipline:    string;
  /** ISO timestamp */
  scheduledAt:   string;
  durationMin:   number;
  /** Studio name for studio sparrings, otherwise null. */
  gymName:       string | null;
  /** City (studio) or short address (private meet-up). */
  locationLabel: string;
  role:          HomeSparringRole;
  /** Slot holders, loaded with the sparring (no extra request). The organizer is not one. */
  participants:  HomeParticipant[];
}

/** host: own sparring · confirm: final confirmation due · in: slot held, no confirmation due yet · confirmed: re-confirmed */
export type SparringCardState = 'host' | 'confirm' | 'in' | 'confirmed';

export function pickFeaturedSparring(sparrings: readonly HomeSparring[], now: Date): HomeSparring | null {
  return sparrings
    .filter((s) => !hasStarted(s.scheduledAt, now))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0] ?? null;
}

export function sparringCardState(sparring: HomeSparring, now: Date): SparringCardState {
  if (sparring.role === 'organizer') return 'host';
  if (sparring.role === 'confirmed') return 'confirmed';
  return isInConfirmWindow(sparring.scheduledAt, now) ? 'confirm' : 'in';
}

// The existing confirm deadline (sparring_confirm_deadline() on the server,
// mirrored in sparringConfig). Null once it has passed — then the card only
// asks for confirmation without a time.
export function confirmDeadline(scheduledAt: string, now: Date): Date | null {
  const deadline = new Date(new Date(scheduledAt).getTime() - SPARRING_CONFIRM_DEADLINE_HOURS * 3_600_000);
  return deadline.getTime() > now.getTime() ? deadline : null;
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const WEEKDAY_KEYS = [
  'home.agenda.weekdays.sun', 'home.agenda.weekdays.mon', 'home.agenda.weekdays.tue', 'home.agenda.weekdays.wed',
  'home.agenda.weekdays.thu', 'home.agenda.weekdays.fri', 'home.agenda.weekdays.sat',
] as const;
const MONTH_KEYS = [
  'home.agenda.months.jan', 'home.agenda.months.feb', 'home.agenda.months.mar', 'home.agenda.months.apr',
  'home.agenda.months.may', 'home.agenda.months.jun', 'home.agenda.months.jul', 'home.agenda.months.aug',
  'home.agenda.months.sep', 'home.agenda.months.oct', 'home.agenda.months.nov', 'home.agenda.months.dec',
] as const;

const weekdayName = (date: Date): string => i18n.t(WEEKDAY_KEYS[date.getDay()]);
const monthName = (date: Date): string => i18n.t(MONTH_KEYS[date.getMonth()]);

function calendarDaysBetween(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end   = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function timeLabel(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "Heute" · "Morgen" · "Fr., 2. Okt." · "Fr., 25. Mai 2029" (year only when not the current one). */
export function appointmentDayLabel(date: Date, now: Date): string {
  const days = calendarDaysBetween(now, date);
  if (days === 0) return i18n.t('home.agenda.today');
  if (days === 1) return i18n.t('home.agenda.tomorrow');
  const year = date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : '';
  return i18n.t('home.agenda.dayLabel', { weekday: weekdayName(date), day: date.getDate(), month: monthName(date), year });
}

// Default titles are "<Disziplin> – Sparring" (CreateSparringSheet). The
// catch-all discipline reads better as plain "Sparring"; own titles stay.
export function displaySparringTitle(title: string): string {
  return sparringDisplayTitle(title, parseLanguage(i18n.language) ?? 'de');
}

// A bare "Sparring" says little on Home — the section label already names the
// occasion, so the place becomes the main line ("Delmenhorst"). The place is
// the last part of the location label (city, or city of a short address).
export function homeSparringTitle(title: string, locationLabel: string): { text: string; isPlace: boolean } {
  const display = displaySparringTitle(title);
  if (display !== 'Sparring') return { text: display, isPlace: false };
  const place = locationLabel.split(',').map((p) => p.trim()).filter((p) => p.length > 0).pop();
  return place !== undefined ? { text: place, isPlace: true } : { text: display, isPlace: false };
}

export interface DateBlockParts {
  weekday: string;
  day:     string;
  month:   string;
  /** Only when not in the current year. */
  year:    string | null;
}

// Calendar block on Home: weekday small, day number large, month below.
export function dateBlockParts(date: Date, now: Date): DateBlockParts {
  return {
    weekday: weekdayName(date),
    day:     String(date.getDate()),
    month:   monthName(date),
    year:    date.getFullYear() !== now.getFullYear() ? String(date.getFullYear()) : null,
  };
}

export interface ParticipantsPreview {
  /** Up to `max` avatars, the current user first. */
  shown: HomeParticipant[];
  /** "Du + 3 weitere" · "4 Zusagen" (organizer) · null when there is nothing to add. */
  label: string | null;
}

// Real slot holders only; the current user never counts as "weitere".
export function participantsPreview(
  participants: readonly HomeParticipant[],
  currentUserId: string | null,
  max = 3,
): ParticipantsPreview {
  const me     = participants.filter((p) => p.userId === currentUserId);
  const others = participants.filter((p) => p.userId !== currentUserId);
  const shown  = [...me, ...others].slice(0, max);
  let label: string | null = null;
  if (me.length > 0) {
    label = others.length > 0 ? i18n.t('home.agenda.youPlusOthers', { count: others.length }) : null;
  } else if (others.length > 0) {
    label = i18n.t('home.agenda.confirmations', { count: others.length });
  }
  return { shown: label === null && me.length > 0 ? [] : shown, label };
}

// "Hauptstr. 1, 28195 Bremen" → "Hauptstr. 1, Bremen": postal codes add noise
// on a small card; the full address stays in the details.
export function shortAddress(address: string): string {
  return address
    .split(',')
    .map((part) => part.trim().replace(/^\d{4,5}\s+/, ''))
    .filter((part) => part.length > 0 && part !== 'Deutschland')
    .slice(0, 2)
    .join(', ');
}

// Milliseconds until the next local midnight — Home re-renders then so
// "Heute"/"Morgen" never go stale while the app stays open.
export function msUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
