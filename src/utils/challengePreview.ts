// Picks the card Home shows in its Sparr Cards teaser. Pure and deterministic:
//   - only the user's own deck (stored choice, else the profile disciplines —
//     the same rule the game uses);
//   - only delivered content: placeholder entries ("Platzhalter …" /
//     "Challenge-Text folgt.") never show;
//   - the pick changes once per local day, never per render.
// The game itself has no paywall or tier rules, so no content is unlocked here.

import { CHALLENGE_AREAS, challengesForArea } from '../data/sparringChallenges';
import type { ChallengeArea, SparringChallenge } from '../data/sparringChallenges';
import { isDeliveredChallenge } from './challengeAvailability';

export { isDeliveredChallenge } from './challengeAvailability';

export const CHALLENGE_STORAGE_KEY = 'sparr.challenge.v1';

// The stored deck choice of the game ({"area": "..."}); null when unset or invalid.
export function storedChallengeArea(raw: string | null): ChallengeArea | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const area = (parsed as { area?: unknown }).area;
    return CHALLENGE_AREAS.some((a) => a.key === area) ? (area as ChallengeArea) : null;
  } catch {
    return null;
  }
}

// Days since 1970 in local time — the index of "today".
export function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function pickPreviewChallenge(
  deck: readonly SparringChallenge[],
  dayNumber: number,
): SparringChallenge | null {
  const delivered = deck.filter(isDeliveredChallenge);
  if (delivered.length === 0) return null;
  return delivered[((dayNumber % delivered.length) + delivered.length) % delivered.length];
}

export function previewChallengeForArea(area: ChallengeArea, date: Date): SparringChallenge | null {
  return pickPreviewChallenge(challengesForArea(area), localDayNumber(date));
}

// First sentence (or the start) of the task, for a one- to two-line excerpt.
export function challengeExcerpt(instruction: string, maxChars = 90): string {
  const text = instruction.replace(/\s+/g, ' ').trim();
  const sentence = text.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() ?? text;
  if (sentence.length <= maxChars) return sentence;
  const cut = sentence.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\s]+$/, '')} …`;
}

// "4789" → "4.789" without relying on Intl (not complete on every Hermes build).
export function formatCount(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
