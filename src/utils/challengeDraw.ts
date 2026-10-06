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
  return cards[pickIndex(cards.length, random)];
}

function pickIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

export interface DrawSetResult {
  cards:    SparringChallenge[];
  usedIds:  string[];
}

// Draws `count` cards at once, all different from each other — that is what keeps the
// two fighters of a round from getting the same mission. Cards already used in the
// session are avoided until the pool runs dry, then it starts over without repeating
// anything from the set being drawn right now. Returns fewer cards than asked for only
// when the pool itself is smaller; callers check that before starting a session.
export function drawChallengeSet(
  pool:    SparringChallenge[],
  usedIds: string[],
  count:   number,
  random:  () => number = Math.random,
): DrawSetResult | null {
  if (pool.length === 0 || count <= 0) return null;

  const used = new Set(usedIds);
  let available = pool.filter((c) => !used.has(c.id));
  const picked: SparringChallenge[] = [];
  let recycled = false;

  while (picked.length < count) {
    if (available.length === 0) {
      const taken = new Set(picked.map((c) => c.id));
      available = pool.filter((c) => !taken.has(c.id));
      recycled = true;
      // Pool smaller than the set — hand back what there is.
      if (available.length === 0) break;
    }
    const index = pickIndex(available.length, random);
    picked.push(available[index]);
    available = available.filter((_, i) => i !== index);
  }

  if (picked.length === 0) return null;

  const pickedIds = picked.map((c) => c.id);
  return {
    cards:   picked,
    usedIds: recycled ? pickedIds : [...usedIds, ...pickedIds],
  };
}
