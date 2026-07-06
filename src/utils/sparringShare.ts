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

// Mirrors the get_public_sparring RPC's area_label: studio name if present,
// else a German "PLZ Stadt" label positively extracted from the address. Never
// emits raw coordinates (lat/lng pairs have no "<5-digit> <city>" match) or
// house numbers (digits terminate the city character class); falls back to a
// generic label otherwise. Never the exact street/point.
export function coarseAreaLabel(input: {
  studioName: string | null;
  address: string;
}): string {
  if (input.studioName && input.studioName.length > 0) return input.studioName;
  const match = input.address.match(
    /(?:^|\s)(\d{5}\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .-]*)/,
  );
  const label = match?.[1]?.trim();
  return label && label.length > 0 ? label : 'Ort in der App';
}
