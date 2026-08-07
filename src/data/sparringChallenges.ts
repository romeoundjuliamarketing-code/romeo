import type { Discipline } from './disciplines';

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
  // Optional: "Geschafft, wenn …" — wird auf der Karte nur angezeigt, wenn gesetzt.
  successCriteria?: string;
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

export const DEFAULT_AREA: ChallengeArea = 'boxen';

// Indexed once at module load: the deck is static app data, so every lookup below is
// O(1) and `challengesForArea` hands out a stable array instead of a fresh filter.
const BY_AREA: Record<ChallengeArea, SparringChallenge[]> = emptyAreaRecord(() => []);
const BY_ID = new Map<string, SparringChallenge>();
const POSITION_IN_AREA = new Map<string, number>();

for (const challenge of SPARRING_CHALLENGES) {
  const deck = BY_AREA[challenge.area];
  deck.push(challenge);
  BY_ID.set(challenge.id, challenge);
  POSITION_IN_AREA.set(challenge.id, deck.length);
}

// Builds a record keyed by every challenge area, so a new area only has to be added
// to CHALLENGE_AREAS.
export function emptyAreaRecord<T>(value: () => T): Record<ChallengeArea, T> {
  const record = {} as Record<ChallengeArea, T>;
  for (const area of CHALLENGE_AREAS) record[area.key] = value();
  return record;
}

export function challengesForArea(area: ChallengeArea): SparringChallenge[] {
  return BY_AREA[area];
}

export function challengeById(id: string): SparringChallenge | null {
  return BY_ID.get(id) ?? null;
}

export function areaLabel(area: ChallengeArea): string {
  return CHALLENGE_AREAS.find((a) => a.key === area)?.label ?? '';
}

// Position of a card inside its own deck, 1-based — shown as the mission number on
// the card and as "Karte n von m" on the screen.
export function challengePosition(challenge: SparringChallenge): number {
  return POSITION_IN_AREA.get(challenge.id) ?? 0;
}

// Maps the disciplines from the user profile onto a challenge area. Only the three
// striking disciplines have decks; everything else falls back to the default.
// Typed against Discipline so renaming one there breaks the build here.
const AREA_BY_DISCIPLINE: Partial<Record<Discipline, ChallengeArea>> = {
  Boxen:     'boxen',
  Kickboxen: 'kickboxen',
  MMA:       'mma',
};

export function areaFromDisciplines(disciplines: string[]): ChallengeArea {
  for (const discipline of disciplines) {
    const area = AREA_BY_DISCIPLINE[discipline as Discipline];
    if (area !== undefined) return area;
  }
  return DEFAULT_AREA;
}
