// Fighting stance (Kampfauslage) — shared type, options and display labels.
// Used by the profile editor and every read-only profile view so the
// stance -> label mapping lives in exactly one place.

export const STANCES = ['orthodox', 'southpaw', 'switch'] as const;

export type Stance = (typeof STANCES)[number];

const STANCE_LABELS: Record<Stance, string> = {
  orthodox: 'Orthodox',
  southpaw: 'Southpaw',
  switch: 'Switch',
};

// Returns the German-UI label for a stance, or null when unset.
export function stanceLabel(stance: Stance | null | undefined): string | null {
  if (stance == null) return null;
  return STANCE_LABELS[stance] ?? null;
}
