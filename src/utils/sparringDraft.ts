// Pure state helpers for the three-step "Sparring erstellen" flow: the draft,
// per-step validation, persistence mapping and the mapping onto the publish
// contract. The server (publish_sparring: place, radius, slot, subscription)
// stays the source of truth; this only keeps the client from sending obviously
// incomplete data.

import type { PublishInput } from '../hooks/useSparringTrustActions';
import type { SparringPlace } from '../types/sparringTrust';
import i18n from '../i18n';

export const SPARRING_DISCIPLINES = [
  'Boxen',
  'K1 / Kickboxen',
  'BJJ',
  'MMA',
  'Muay Thai',
  'Ringen',
  'Sonstiges',
] as const;

/** Default duration; the user picks one of SPARRING_TRUST.durationOptionsMin. */
export const DEFAULT_DURATION_MIN = 90;
export const MIN_DURATION_MIN = 30;
export const MAX_DURATION_MIN = 300;
export const PLACE_LABEL_MIN = 2;
export const PLACE_LABEL_MAX = 80;
export const DEFAULT_MAX_SLOTS = 10;
/** Lower bound of max_slots (update_sparring rejects < 1). */
export const MIN_MAX_SLOTS = 1;

export type FlowStep = 1 | 2 | 3;

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
  /** Linked gym (convenience: pre-fills the place search, sent as gym id). */
  gym:         DraftGym | null;
  /** Coach: meet at the team studio (pre-fills the search, sent as studio id). */
  atStudio:    boolean;
  /** Server-resolved place; the only source of the target position. */
  place:       SparringPlace | null;
  /** Venue name, required when the place is a plain street address. */
  placeLabel:  string;
  durationMin: number;
  /** Self-declaration: we may train at this place. */
  permissionConfirmed: boolean;
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
    atStudio:    false,
    place:       null,
    placeLabel:  '',
    durationMin: DEFAULT_DURATION_MIN,
    permissionConfirmed: false,
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

/** Plain street addresses need a venue name from the organizer. */
export function placeNeedsLabel(place: SparringPlace | null): boolean {
  return place !== null && place.category === 'address';
}

export function isPlaceLabelValid(label: string): boolean {
  const n = label.trim().length;
  return n >= PLACE_LABEL_MIN && n <= PLACE_LABEL_MAX;
}

/** Name + address + city of a gym, used to pre-fill the place search. */
export function gymSearchQuery(gym: DraftGym): string {
  const parts = [gym.name, gym.address ?? '', gym.city].map((p) => p.trim()).filter((p) => p.length > 0);
  return parts.join(', ');
}

/** Name + address of the team studio for the place search. */
export function studioSearchQuery(studio: DraftStudio): string {
  return studio.address.trim();
}

/**
 * Takes a gym as a convenience: the place is cleared (the user picks a server
 * result for it) while the gym stays linked.
 */
export function applyGym(draft: SparringDraft, gym: DraftGym): SparringDraft {
  return { ...draft, gym, atStudio: false, place: null, placeLabel: '' };
}

export function applyStudio(draft: SparringDraft): SparringDraft {
  return { ...draft, gym: null, accessNote: '', atStudio: true, place: null, placeLabel: '' };
}

export function selectPlace(draft: SparringDraft, place: SparringPlace): SparringDraft {
  return { ...draft, place, placeLabel: '' };
}

/** "Ort ändern": drops the picked place, keeps a gym/studio link. */
export function clearPlace(draft: SparringDraft): SparringDraft {
  return { ...draft, place: null, placeLabel: '' };
}

export function clearLink(draft: SparringDraft): SparringDraft {
  return { ...draft, gym: null, atStudio: false, accessNote: '' };
}

export function validateStep(step: FlowStep, draft: SparringDraft, now: Date): DraftErrors {
  const errors: DraftErrors = {};
  if (step === 1 || step === 3) {
    if (draft.discipline === null) errors.discipline = i18n.t('sparring.draft.errors.discipline');
    if (!Number.isInteger(draft.maxSlots) || draft.maxSlots < MIN_MAX_SLOTS) {
      errors.maxSlots = i18n.t('sparring.draft.errors.maxSlots');
    }
  }
  if (step === 2 || step === 3) {
    if (draft.scheduledAt.getTime() <= now.getTime()) {
      errors.scheduledAt = i18n.t('sparring.draft.errors.scheduledAt');
    }
    if (draft.place === null) {
      errors.place = i18n.t('sparring.draft.errors.placeNone');
    } else if (placeNeedsLabel(draft.place) && !isPlaceLabelValid(draft.placeLabel)) {
      errors.place = i18n.t('sparringTrust.notice.placeLabelRequired');
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
    draft.atStudio !== initial.atStudio ||
    (draft.gym?.id ?? null) !== (initial.gym?.id ?? null) ||
    (draft.place?.id ?? null) !== (initial.place?.id ?? null) ||
    draft.placeLabel !== initial.placeLabel ||
    draft.durationMin !== initial.durationMin ||
    draft.permissionConfirmed !== initial.permissionConfirmed ||
    draft.accessNote !== initial.accessNote ||
    draft.title !== initial.title ||
    draft.notes !== initial.notes
  );
}

/**
 * Maps a draft onto the publish contract (without the request id). Returns
 * null when it is incomplete (call validateStep(3, ...) first for messages).
 * The permission self-declaration is passed through; the caller explains a
 * missing one instead of blocking silently.
 */
export function buildPublishInput(
  draft: SparringDraft,
  studioId: string | null,
): Omit<PublishInput, 'requestId'> | null {
  if (draft.discipline === null || draft.place === null) return null;
  if (draft.durationMin < MIN_DURATION_MIN || draft.durationMin > MAX_DURATION_MIN) return null;
  const needsLabel = placeNeedsLabel(draft.place);
  if (needsLabel && !isPlaceLabelValid(draft.placeLabel)) return null;
  const atStudio = draft.atStudio && studioId !== null;
  const accessNote = draft.accessNote.trim();
  const notes = draft.notes.trim();
  return {
    placeId:      draft.place.id,
    placeLabel:   needsLabel ? draft.placeLabel.trim() : null,
    title:        resolvedTitle(draft),
    discipline:   draft.discipline,
    notes:        notes.length > 0 ? notes : null,
    scheduledAt:  draft.scheduledAt.toISOString(),
    durationMin:  draft.durationMin,
    maxSlots:     draft.maxSlots,
    verifiedOnly: false,
    permissionConfirmed: draft.permissionConfirmed,
    gymId:        draft.gym !== null && !atStudio ? draft.gym.id : null,
    studioId:     atStudio ? studioId : null,
    accessNote:   draft.gym !== null && !atStudio && accessNote.length > 0 ? accessNote : null,
  };
}

/** JSON-safe form of the draft kept on the device. */
export interface StoredDraftData extends Omit<SparringDraft, 'scheduledAt'> {
  scheduledAt: string;
}

export function serializeDraft(draft: SparringDraft): StoredDraftData {
  return { ...draft, scheduledAt: draft.scheduledAt.toISOString() };
}

/**
 * Restores a stored draft; fills missing fields with defaults and replaces a
 * time in the past with the default slot. Returns null for unusable data.
 */
export function restoreDraft(raw: Partial<StoredDraftData> | null | undefined, now: Date): SparringDraft | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const base = emptyDraft(now);
  const at = typeof raw.scheduledAt === 'string' ? new Date(raw.scheduledAt) : null;
  const validAt = at !== null && !Number.isNaN(at.getTime()) && at.getTime() > now.getTime();
  const place = raw.place !== undefined && raw.place !== null && typeof raw.place.id === 'string' ? raw.place : null;
  return {
    discipline:  typeof raw.discipline === 'string' ? raw.discipline : null,
    maxSlots:    typeof raw.maxSlots === 'number' && raw.maxSlots >= MIN_MAX_SLOTS ? raw.maxSlots : base.maxSlots,
    scheduledAt: validAt && at !== null ? at : base.scheduledAt,
    gym:         raw.gym ?? null,
    atStudio:    raw.atStudio === true,
    place,
    placeLabel:  typeof raw.placeLabel === 'string' ? raw.placeLabel : '',
    durationMin: typeof raw.durationMin === 'number' ? raw.durationMin : base.durationMin,
    permissionConfirmed: raw.permissionConfirmed === true,
    accessNote:  typeof raw.accessNote === 'string' ? raw.accessNote : '',
    title:       typeof raw.title === 'string' ? raw.title : '',
    notes:       typeof raw.notes === 'string' ? raw.notes : '',
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
