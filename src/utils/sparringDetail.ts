// Pure display helpers for the sparring detail window. No business logic —
// status sets mirror the RPC migration and only decide what is SHOWN.
import type { SparringParticipant, SparringSignupStatus } from '../types/database.types';
import i18n from '../i18n';

// ─── Location ──────────────────────────────────────────────────────────────────

export interface SparringLocationLines {
  primary:   string;
  secondary: string | null;
}

// Studio sparrings: studio name first, address below. Private sparrings: if the
// address contains a German "PLZ Stadt" part, the city leads and the rest
// follows; otherwise the address is shown as entered (user content, never
// re-cased or guessed).
export function sparringLocationLines(input: {
  studioId:   string | null;
  studioName: string;
  studioCity: string;
  address:    string;
}): SparringLocationLines {
  const address = input.address.trim();

  if (input.studioId !== null) {
    const city = input.studioCity.trim();
    const cityMissing = city.length > 0 && !address.toLowerCase().includes(city.toLowerCase());
    const secondary = [address, cityMissing ? city : ''].filter((p) => p.length > 0).join(' · ');
    return { primary: input.studioName, secondary: secondary.length > 0 ? secondary : null };
  }

  const match = address.match(/(?:^|[\s,])(\d{5})\s+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .-]*)/);
  const city = match?.[2]?.trim();
  if (match !== null && city !== undefined && city.length > 0) {
    const rest = address
      .replace(match[0], ' ')
      .replace(/\s*,\s*$/, '')
      .replace(/^\s*,\s*/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return {
      primary:   city,
      secondary: rest.length > 0 ? `${rest} · ${i18n.t('sparring.detail.privateMeetingPoint')}` : i18n.t('sparring.detail.privateMeetingPoint'),
    };
  }
  return { primary: address.length > 0 ? address : i18n.t('sparring.detail.placeInApp'), secondary: i18n.t('sparring.detail.privateMeetingPoint') };
}

// ─── Date ──────────────────────────────────────────────────────────────────────

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MONTHS   = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

// "DI · 31. MAI · 18:00" in the device's local time.
export function compactDateLabel(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const weekday = i18n.t(`sparring.detail.weekdayShort.${WEEKDAYS[d.getDay()]}`);
  const month = i18n.t(`sparring.detail.monthShort.${MONTHS[d.getMonth()]}`);
  return i18n.t('sparring.detail.compactDate', { weekday, day: d.getDate(), month, time: `${hh}:${mm}` });
}

// ─── Participants ──────────────────────────────────────────────────────────────

// Everyone who is (or was) part of the sparring — slot holders and recorded
// attendance. The waitlist is counted separately.
const TAKING_PART: ReadonlySet<SparringSignupStatus> = new Set(['pending', 'confirmed', 'attended', 'no_show']);

export interface ParticipantsSummary {
  takingPart:     SparringParticipant[];
  waitlistCount:  number;
  confirmedCount: number;
  namesLine:      string | null;
}

// Current user first (as "Du"), then the others in RPC order.
export function summarizeParticipants(
  participants: SparringParticipant[],
  currentUserId: string | null,
  maxNames = 3,
): ParticipantsSummary {
  const takingPart = participants.filter((p) => TAKING_PART.has(p.status));
  const ordered = [
    ...takingPart.filter((p) => p.user_id === currentUserId),
    ...takingPart.filter((p) => p.user_id !== currentUserId),
  ];
  const names = ordered.map((p) => (p.user_id === currentUserId ? i18n.t('sparring.detail.you') : firstName(p.name)));
  const shown = names.slice(0, maxNames);
  const rest  = names.length - shown.length;

  return {
    takingPart:     ordered,
    waitlistCount:  participants.filter((p) => p.status === 'waitlisted').length,
    confirmedCount: takingPart.filter((p) => p.status === 'confirmed').length,
    namesLine:      shown.length === 0 ? null : rest > 0 ? i18n.t('sparring.detail.namesMore', { names: shown.join(', '), count: rest }) : shown.join(', '),
  };
}

export function firstName(name: string | null): string {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed.split(/\s+/)[0] : i18n.t('sparring.detail.unknown');
}

// Up to 2-letter initials for avatar fallbacks (shared implementation).
export { getInitials as initialsOf } from './initials';
