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

// Cards released for the example deck on the Karten tab, shown in full to everyone,
// with or without a subscription, in draw order. Picked for short, easy-to-grasp
// tasks from different topics; the stored card texts stay untouched. Only listed
// ids are ever shown — nothing is picked from the deck at random.
export const PREVIEW_CHALLENGE_IDS = ['k1-111', 'k1-028', 'k1-089'] as const;

// The released preview cards that exist and are delivered, in list order.
export function previewChallenges(): SparringChallenge[] {
  const deck = playableChallengesForArea('kickboxen');
  return PREVIEW_CHALLENGE_IDS
    .map((id) => deck.find((card) => card.id === id))
    .filter((card): card is SparringChallenge => card !== undefined);
}

// Three short, varied cards for the Home teaser fan, in fan order (the first
// one starts in front). Picked for short titles and tasks that fit the
// preview card in full; the stored card texts stay untouched.
export const HOME_PREVIEW_CHALLENGE_IDS = ['k1-111', 'k1-035', 'k1-107'] as const;

export function homePreviewChallenges(): SparringChallenge[] {
  const deck = playableChallengesForArea('kickboxen');
  return HOME_PREVIEW_CHALLENGE_IDS
    .map((id) => deck.find((card) => card.id === id))
    .filter((card): card is SparringChallenge => card !== undefined);
}
