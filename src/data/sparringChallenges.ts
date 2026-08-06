// Sparrings-Challenges: Karten, die man sich fuer ein Sparring zieht.
// Die Inhalte werden vom Auftraggeber geliefert — die Eintraege unten sind reine
// Platzhalter, damit das UI lauffaehig ist, und werden 1:1 ersetzt.

export type ChallengeArea = 'boxen' | 'kickboxen' | 'mma';

export type ChallengeDifficulty = 'leicht' | 'mittel' | 'schwer';

export interface SparringChallenge {
  id:          string;
  area:        ChallengeArea;
  title:       string;
  instruction: string;
  focus:       string;
  difficulty:  ChallengeDifficulty;
}

export interface ChallengeAreaMeta {
  key:   ChallengeArea;
  label: string;
}

export const CHALLENGE_AREAS: ChallengeAreaMeta[] = [
  { key: 'boxen',     label: 'Boxen' },
  { key: 'kickboxen', label: 'Kickboxen' },
  { key: 'mma',       label: 'MMA' },
];

export const SPARRING_CHALLENGES: SparringChallenge[] = [
  // ── Boxen ───────────────────────────────────────────────────────────────────
  {
    id:          'box-01',
    area:        'boxen',
    title:       'Platzhalter Boxen 1',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'leicht',
  },
  {
    id:          'box-02',
    area:        'boxen',
    title:       'Platzhalter Boxen 2',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'mittel',
  },
  {
    id:          'box-03',
    area:        'boxen',
    title:       'Platzhalter Boxen 3',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'schwer',
  },

  // ── Kickboxen ───────────────────────────────────────────────────────────────
  {
    id:          'kick-01',
    area:        'kickboxen',
    title:       'Platzhalter Kickboxen 1',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'leicht',
  },
  {
    id:          'kick-02',
    area:        'kickboxen',
    title:       'Platzhalter Kickboxen 2',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'mittel',
  },
  {
    id:          'kick-03',
    area:        'kickboxen',
    title:       'Platzhalter Kickboxen 3',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'schwer',
  },

  // ── MMA (Striking) ──────────────────────────────────────────────────────────
  {
    id:          'mma-01',
    area:        'mma',
    title:       'Platzhalter MMA 1',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'leicht',
  },
  {
    id:          'mma-02',
    area:        'mma',
    title:       'Platzhalter MMA 2',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'mittel',
  },
  {
    id:          'mma-03',
    area:        'mma',
    title:       'Platzhalter MMA 3',
    instruction: 'Challenge-Text folgt.',
    focus:       'Platzhalter',
    difficulty:  'schwer',
  },
];

export function challengesForArea(area: ChallengeArea): SparringChallenge[] {
  return SPARRING_CHALLENGES.filter((c) => c.area === area);
}

export function challengeById(id: string): SparringChallenge | null {
  return SPARRING_CHALLENGES.find((c) => c.id === id) ?? null;
}

export function areaLabel(area: ChallengeArea): string {
  return CHALLENGE_AREAS.find((a) => a.key === area)?.label ?? '';
}

// Maps the disciplines from the user profile onto a challenge area. Only the three
// striking disciplines have decks; everything else falls back to Boxen.
export function areaFromDisciplines(disciplines: string[]): ChallengeArea {
  for (const d of disciplines) {
    if (d === 'Boxen') return 'boxen';
    if (d === 'Kickboxen') return 'kickboxen';
    if (d === 'MMA') return 'mma';
  }
  return 'boxen';
}
