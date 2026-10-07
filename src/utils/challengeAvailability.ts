import { CHALLENGE_AREAS, challengesForArea } from '../data/sparringChallenges';
import type { ChallengeArea, ChallengeAreaMeta, SparringChallenge } from '../data/sparringChallenges';

export function isDeliveredChallenge(challenge: SparringChallenge): boolean {
  return !challenge.title.de.startsWith('Platzhalter') && challenge.instruction.de.trim() !== 'Challenge-Text folgt.';
}

export function playableChallengesForArea(area: ChallengeArea): SparringChallenge[] {
  return challengesForArea(area).filter(isDeliveredChallenge);
}

export function availableChallengeAreas(): ChallengeAreaMeta[] {
  return CHALLENGE_AREAS.filter((area) => playableChallengesForArea(area.key).length > 0);
}

export function normalizeChallengeArea(area: ChallengeArea): ChallengeArea {
  return playableChallengesForArea(area).length > 0 ? area : availableChallengeAreas()[0]?.key ?? area;
}

// Cards explicitly released for the public preview (Karten tab, intro, Home), shown
// in full to everyone, with or without a subscription. The first one is the main
// example. Only listed ids are ever shown — nothing is picked from the deck at random.
export const PREVIEW_CHALLENGE_IDS = ['k1-017', 'k1-034', 'k1-067'] as const;

// The released preview cards that exist and are delivered, in list order.
export function previewChallenges(): SparringChallenge[] {
  const deck = playableChallengesForArea('kickboxen');
  return PREVIEW_CHALLENGE_IDS
    .map((id) => deck.find((card) => card.id === id))
    .filter((card): card is SparringChallenge => card !== undefined);
}

export function freePreviewChallenge(): SparringChallenge | null {
  return previewChallenges()[0] ?? null;
}
