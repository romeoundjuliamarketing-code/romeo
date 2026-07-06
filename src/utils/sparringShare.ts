// Pure helpers for sharing a single sparring. No React Native imports so this
// stays unit-testable and reusable.

// Placeholder domain — replace with the final domain once registered.
// See plan "Global Constraints > DOMAIN-Platzhalter".
export const SHARE_BASE_URL = 'https://sparr.app';

export function buildSparringShareUrl(id: string): string {
  return `${SHARE_BASE_URL}/s/${encodeURIComponent(id)}`;
}

export type SparringShareStatus = 'upcoming' | 'full' | 'expired';

export function sparringShareStatus(input: {
  scheduledAt: string;
  slotsLeft: number;
  now?: Date;
}): SparringShareStatus {
  const now = input.now ?? new Date();
  if (new Date(input.scheduledAt).getTime() < now.getTime()) return 'expired';
  if (input.slotsLeft <= 0) return 'full';
  return 'upcoming';
}

// Mirrors public_sparrings.area_label: studio name if present, otherwise the
// city segment after the last comma, otherwise a generic label. Never the
// exact street.
export function coarseAreaLabel(input: {
  studioName: string | null;
  address: string;
}): string {
  if (input.studioName && input.studioName.length > 0) return input.studioName;
  if (!input.address.includes(',')) return 'Ort in der App';
  const parts = input.address.split(',');
  const city = parts[parts.length - 1]?.trim();
  return city && city.length > 0 ? city : 'Ort in der App';
}
