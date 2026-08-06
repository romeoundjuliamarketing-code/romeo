import type { SparringChallenge } from '../data/sparringChallenges';

export interface DrawResult {
  card:     SparringChallenge;
  drawnIds: string[];
}

// Picks a random challenge that has not been drawn yet. Once every card of the pool
// has been drawn the pool starts over, so a draw never runs out of cards. The random
// source is injected so tests stay deterministic.
export function drawChallenge(
  pool:     SparringChallenge[],
  drawnIds: string[],
  random:   () => number = Math.random,
): DrawResult | null {
  if (pool.length === 0) return null;

  const remaining = pool.filter((c) => !drawnIds.includes(c.id));

  if (remaining.length > 0) {
    const card = pickOne(remaining, random);
    return { card, drawnIds: [...drawnIds, card.id] };
  }

  // Pool exhausted → start over, but avoid repeating the card that was drawn last.
  const lastId = drawnIds[drawnIds.length - 1];
  const candidates = pool.length > 1 ? pool.filter((c) => c.id !== lastId) : pool;
  const card = pickOne(candidates, random);
  return { card, drawnIds: [card.id] };
}

function pickOne(cards: SparringChallenge[], random: () => number): SparringChallenge {
  const index = Math.min(cards.length - 1, Math.max(0, Math.floor(random() * cards.length)));
  return cards[index];
}
