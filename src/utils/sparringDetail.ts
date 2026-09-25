// Pure display helpers for the sparring detail window. No business logic —
// status sets mirror the RPC migration and only decide what is SHOWN.
import type { SparringParticipant, SparringSignupStatus } from '../types/database.types';

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
      secondary: rest.length > 0 ? `${rest} · Privater Treffpunkt` : 'Privater Treffpunkt',
    };
  }
  return { primary: address.length > 0 ? address : 'Ort in der App', secondary: 'Privater Treffpunkt' };
}

// ─── Date ──────────────────────────────────────────────────────────────────────

const WEEKDAYS = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'] as const;
const MONTHS   = ['JAN.', 'FEB.', 'MÄRZ', 'APR.', 'MAI', 'JUNI', 'JULI', 'AUG.', 'SEPT.', 'OKT.', 'NOV.', 'DEZ.'] as const;

// "DI · 31. MAI · 18:00" in the device's local time.
export function compactDateLabel(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${WEEKDAYS[d.getDay()]} · ${d.getDate()}. ${MONTHS[d.getMonth()]} · ${hh}:${mm}`;
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
  const names = ordered.map((p) => (p.user_id === currentUserId ? 'Du' : firstName(p.name)));
  const shown = names.slice(0, maxNames);
  const rest  = names.length - shown.length;

  return {
    takingPart:     ordered,
    waitlistCount:  participants.filter((p) => p.status === 'waitlisted').length,
    confirmedCount: takingPart.filter((p) => p.status === 'confirmed').length,
    namesLine:      shown.length === 0 ? null : rest > 0 ? `${shown.join(', ')} +${rest} weitere` : shown.join(', '),
  };
}

function firstName(name: string | null): string {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed.split(/\s+/)[0] : 'Unbekannt';
}

// Up to 2-letter initials for avatar fallbacks.
export function initialsOf(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}
