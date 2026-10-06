// Pure state helpers for the three-step "Sparring erstellen" flow: the draft,
// per-step validation and the mapping onto the existing CreateSparringInput.
// The server (open_sparrings insert, RLS, subscription gate) stays the source
// of truth; this only keeps the client from sending obviously incomplete data.

import type { CreateSparringInput } from '../hooks/useSparringActions';

export const SPARRING_DISCIPLINES = [
  'Boxen',
  'K1 / Kickboxen',
  'BJJ',
  'MMA',
  'Muay Thai',
  'Ringen',
  'Sonstiges',
] as const;

/** Fixed on creation, adjustable later in the edit sheet. */
export const CREATE_DURATION_MIN = 90;
export const DEFAULT_MAX_SLOTS = 10;
/** Lower bound of max_slots (update_sparring rejects < 1). */
export const MIN_MAX_SLOTS = 1;

export type FlowStep = 1 | 2 | 3;

/** Where the meeting point comes from. */
export type PlaceSource = 'gym' | 'custom' | 'studio';

export interface DraftGym {
  id:      string;
  name:    string;
  city:    string;
  address: string | null;
  lat:     number | null;
  lng:     number | null;
}

export interface DraftStudio {
  id:      string;
  address: string;
  lat:     number | null;
  lng:     number | null;
}

export interface SparringDraft {
  discipline:  string | null;
  /** Places for participants; the host is not counted (see join_sparring). */
  maxSlots:    number;
  scheduledAt: Date;
  /** Linked gym (location only). Kept even when the meeting point differs. */
  gym:         DraftGym | null;
  source:      PlaceSource | null;
  /** The actual meeting point. */
  address:     string;
  /** Map pick or stored gym/studio coordinates; null = geocode on save. */
  coord:       { lat: number; lng: number } | null;
  accessNote:  string;
  title:       string;
  notes:       string;
}

export type DraftErrorKey = 'discipline' | 'maxSlots' | 'scheduledAt' | 'place';
export type DraftErrors = Partial<Record<DraftErrorKey, string>>;

export function nextDay18h(now: Date): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

export function emptyDraft(now: Date): SparringDraft {
  return {
    discipline:  null,
    maxSlots:    DEFAULT_MAX_SLOTS,
    scheduledAt: nextDay18h(now),
    gym:         null,
    source:      null,
    address:     '',
    coord:       null,
    accessNote:  '',
    title:       '',
    notes:       '',
  };
}

/** Same automatic name the old sheet used (homeAgenda relies on it). */
export function defaultSparringTitle(discipline: string): string {
  return `${discipline} – Sparring`;
}

export function resolvedTitle(draft: SparringDraft): string {
  const own = draft.title.trim();
  if (own.length > 0) return own;
  return draft.discipline !== null ? defaultSparringTitle(draft.discipline) : '';
}

export function gymHasAddress(gym: DraftGym): boolean {
  return gym.address !== null && gym.address.trim().length > 0;
}

/**
 * Takes a gym as the place. Its stored address becomes the meeting point (with
 * stored coordinates if any). Without an address the gym stays linked and the
 * meeting point has to be entered separately.
 */
export function applyGym(draft: SparringDraft, gym: DraftGym): SparringDraft {
  if (gymHasAddress(gym)) {
    return {
      ...draft,
      gym,
      source:  'gym',
      address: (gym.address ?? '').trim(),
      coord:   gym.lat !== null && gym.lng !== null ? { lat: gym.lat, lng: gym.lng } : null,
    };
  }
  // Keep a meeting point the user already typed, but never the address of a
  // previously chosen gym.
  const keepCustom = draft.source === 'custom';
  return {
    ...draft,
    gym,
    source:  'custom',
    address: keepCustom ? draft.address : '',
    coord:   keepCustom ? draft.coord : null,
  };
}

/** Meeting point differs from the gym: the gym stays linked, address is free. */
export function toCustomMeetingPoint(draft: SparringDraft): SparringDraft {
  return { ...draft, source: 'custom', address: '', coord: null };
}

export function applyStudio(draft: SparringDraft, studio: DraftStudio): SparringDraft {
  return {
    ...draft,
    gym:        null,
    accessNote: '',
    source:     'studio',
    address:    studio.address.trim(),
    coord:      studio.lat !== null && studio.lng !== null ? { lat: studio.lat, lng: studio.lng } : null,
  };
}

export function clearPlace(draft: SparringDraft): SparringDraft {
  return { ...draft, gym: null, accessNote: '', source: null, address: '', coord: null };
}

export function validateStep(step: FlowStep, draft: SparringDraft, now: Date): DraftErrors {
  const errors: DraftErrors = {};
  if (step === 1 || step === 3) {
    if (draft.discipline === null) errors.discipline = 'Wähle eine Disziplin.';
    if (!Number.isInteger(draft.maxSlots) || draft.maxSlots < MIN_MAX_SLOTS) {
      errors.maxSlots = 'Mindestens 1 Platz.';
    }
  }
  if (step === 2 || step === 3) {
    if (draft.scheduledAt.getTime() <= now.getTime()) {
      errors.scheduledAt = 'Der Termin liegt in der Vergangenheit. Wähle einen späteren Zeitpunkt.';
    }
    if (draft.source === null) {
      errors.place = 'Wähle ein Gym oder gib eine Adresse an.';
    } else if (draft.address.trim().length === 0) {
      errors.place = draft.gym !== null && draft.source === 'custom'
        ? 'Gib an, wo ihr euch trefft.'
        : 'Gib eine Adresse ein.';
    }
  }
  return errors;
}

/** First step that holds one of the given errors (to jump back on publish). */
export function firstStepWithError(errors: DraftErrors): FlowStep | null {
  if (errors.discipline !== undefined || errors.maxSlots !== undefined) return 1;
  if (errors.scheduledAt !== undefined || errors.place !== undefined) return 2;
  return null;
}

/** True once the user entered anything worth protecting from a discard. */
export function isDraftDirty(draft: SparringDraft, initial: SparringDraft): boolean {
  return (
    draft.discipline !== initial.discipline ||
    draft.maxSlots !== initial.maxSlots ||
    draft.scheduledAt.getTime() !== initial.scheduledAt.getTime() ||
    draft.source !== initial.source ||
    (draft.gym?.id ?? null) !== (initial.gym?.id ?? null) ||
    draft.address !== initial.address ||
    draft.accessNote !== initial.accessNote ||
    draft.title !== initial.title ||
    draft.notes !== initial.notes
  );
}

/**
 * Maps a validated draft onto the existing create contract. Returns null when
 * the draft is incomplete (call validateStep(3, ...) first for messages).
 */
export function buildCreateInput(draft: SparringDraft, studioId: string | null): CreateSparringInput | null {
  if (draft.discipline === null || draft.source === null) return null;
  const address = draft.address.trim();
  if (address.length === 0) return null;
  const atStudio = draft.source === 'studio' && studioId !== null;
  const accessNote = draft.accessNote.trim();
  return {
    address,
    ...(draft.coord !== null ? { lat: draft.coord.lat, lng: draft.coord.lng } : {}),
    ...(atStudio ? { isAtStudio: true as const, atStudioId: studioId } : {}),
    ...(draft.gym !== null && !atStudio
      ? { gymId: draft.gym.id, ...(accessNote.length > 0 ? { accessNote } : {}) }
      : {}),
    title:       resolvedTitle(draft),
    discipline:  draft.discipline,
    scheduledAt: draft.scheduledAt.toISOString(),
    durationMin: CREATE_DURATION_MIN,
    maxSlots:    draft.maxSlots,
    notes:       draft.notes,
  };
}

/** Keeps the calendar day, takes hours and minutes from `time`. */
export function withTime(day: Date, time: Date): Date {
  const merged = new Date(day);
  merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return merged;
}

/** Keeps hours and minutes, takes the calendar day from `day`. */
export function withDay(current: Date, day: Date): Date {
  const merged = new Date(day);
  merged.setHours(current.getHours(), current.getMinutes(), 0, 0);
  return merged;
}
