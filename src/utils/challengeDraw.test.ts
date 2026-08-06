import { drawChallenge } from './challengeDraw';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function card(id: string) {
  return {
    id,
    area: 'boxen' as const,
    title: `Karte ${id}`,
    instruction: 'Text',
    focus: 'Fokus',
    difficulty: 'leicht' as const,
  };
}

const POOL = [card('a'), card('b'), card('c')];

// Returns a random source that yields the given values in order, then repeats the last.
function seeded(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('drawChallenge', () => {
  it('gibt null zurueck, wenn der Pool leer ist', () => {
    expect(drawChallenge([], [], seeded(0))).toBeNull();
  });

  it('zieht aus dem gesamten Pool, wenn noch nichts gezogen wurde', () => {
    const result = drawChallenge(POOL, [], seeded(0));
    expect(result?.card.id).toBe('a');
    expect(result?.drawnIds).toEqual(['a']);
  });

  it('zieht nur Karten, die noch nicht gezogen wurden', () => {
    // Von ['a','b','c'] sind a und b weg → nur c bleibt uebrig
    const result = drawChallenge(POOL, ['a', 'b'], seeded(0.99));
    expect(result?.card.id).toBe('c');
    expect(result?.drawnIds).toEqual(['a', 'b', 'c']);
  });

  it('haengt die gezogene Karte an die Historie an', () => {
    const result = drawChallenge(POOL, ['a'], seeded(0));
    expect(result?.drawnIds).toEqual(['a', 'b']);
  });

  it('setzt den Pool zurueck, wenn alle Karten gezogen wurden', () => {
    const result = drawChallenge(POOL, ['a', 'b', 'c'], seeded(0));
    expect(result).not.toBeNull();
    // Historie beginnt neu und enthaelt nur die frisch gezogene Karte
    expect(result?.drawnIds).toHaveLength(1);
    expect(result?.drawnIds[0]).toBe(result?.card.id);
  });

  it('wiederholt beim Zuruecksetzen nicht die zuletzt gezogene Karte', () => {
    // Zuletzt gezogen war 'c'; random 0.99 wuerde ohne Ausschluss auf 'c' zeigen
    const result = drawChallenge(POOL, ['a', 'b', 'c'], seeded(0.99));
    expect(result?.card.id).not.toBe('c');
  });

  it('gibt bei einem Pool mit nur einer Karte dieselbe Karte erneut zurueck', () => {
    const single = [card('solo')];
    const result = drawChallenge(single, ['solo'], seeded(0));
    expect(result?.card.id).toBe('solo');
    expect(result?.drawnIds).toEqual(['solo']);
  });

  it('ignoriert gespeicherte IDs, die es im Pool nicht mehr gibt', () => {
    const result = drawChallenge(POOL, ['veraltet'], seeded(0));
    expect(result?.card.id).toBe('a');
    expect(result?.drawnIds).toEqual(['veraltet', 'a']);
  });
});
