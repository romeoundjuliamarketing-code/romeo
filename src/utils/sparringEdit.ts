// Pure helpers for editing a sparring. Mirrors the change detection of the
// update_sparring RPC (trimmed text, empty notes = none) so the confirmation
// dialog matches what the server will do. The server stays the source of truth.

import i18n from '../i18n';

export interface SparringEditFields {
  title:        string;
  notes:        string | null;
  discipline:   string;
  address:      string;
  lat:          number | null;
  lng:          number | null;
  /** ISO timestamp */
  scheduledAt:  string;
  durationMin:  number;
  maxSlots:     number;
  verifiedOnly: boolean;
}

export type SparringEditField =
  | 'scheduled_at'
  | 'location'
  | 'duration_min'
  | 'discipline'
  | 'title'
  | 'notes'
  | 'max_slots'
  | 'verified_only';

// Participants are notified and re-confirm only for these.
export const MATERIAL_EDIT_FIELDS: readonly SparringEditField[] = [
  'scheduled_at', 'location', 'duration_min', 'discipline',
];

function normNotes(notes: string | null): string | null {
  const trimmed = (notes ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function changedSparringFields(
  before: SparringEditFields,
  after: SparringEditFields,
): SparringEditField[] {
  const changed: SparringEditField[] = [];
  if (new Date(before.scheduledAt).getTime() !== new Date(after.scheduledAt).getTime()) {
    changed.push('scheduled_at');
  }
  if (before.address.trim() !== after.address.trim() || before.lat !== after.lat || before.lng !== after.lng) {
    changed.push('location');
  }
  if (before.durationMin !== after.durationMin) changed.push('duration_min');
  if (before.discipline.trim() !== after.discipline.trim()) changed.push('discipline');
  if (before.title.trim() !== after.title.trim()) changed.push('title');
  if (normNotes(before.notes) !== normNotes(after.notes)) changed.push('notes');
  if (before.maxSlots !== after.maxSlots) changed.push('max_slots');
  if (before.verifiedOnly !== after.verifiedOnly) changed.push('verified_only');
  return changed;
}

export function isMaterialEdit(changed: readonly SparringEditField[]): boolean {
  return changed.some((f) => MATERIAL_EDIT_FIELDS.includes(f));
}

// Confirmation text before saving a material change.
export function editNotifyMessage(affected: number): string {
  return i18n.t('sparring.edit.notify', { count: affected });
}
