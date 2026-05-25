import type { Workout } from './workouts';
import type { FitnessGroup } from '../hooks/useFitnessRatings';

// ─── Supercategories ──────────────────────────────────────────────────────────

export type SupercategoryKey = 'striking' | 'ausdauer' | 'kraft' | 'mobility' | 'grappling';

export interface Supercategory {
  key: SupercategoryKey;
  label: string;
  groups: FitnessGroup[];
}

export const SUPERCATEGORIES: Supercategory[] = [
  { key: 'striking',  label: 'Striking',  groups: ['schlagkraft', 'trittkraft', 'beinarbeit', 'koordination'] },
  { key: 'ausdauer',  label: 'Ausdauer',  groups: ['ausdauer'] },
  { key: 'kraft',     label: 'Kraft',     groups: ['schulter', 'nackenhals', 'griffkraft'] },
  { key: 'mobility',  label: 'Mobility',  groups: ['mobilitaet'] },
  { key: 'grappling', label: 'Grappling', groups: ['partnertraining'] },
];

export function getSupercategoryForGroup(group: FitnessGroup): SupercategoryKey | null {
  for (const sc of SUPERCATEGORIES) {
    if ((sc.groups as string[]).includes(group)) return sc.key;
  }
  return null;
}

// All supported disciplines
export type Discipline = 'Boxen' | 'Kickboxen' | 'MMA' | 'BJJ' | 'Wrestling';

export const ALL_DISCIPLINES: Discipline[] = ['Boxen', 'Kickboxen', 'MMA', 'BJJ', 'Wrestling'];

// Workout categories that are relevant per discipline
const DISCIPLINE_WORKOUT_CATEGORIES: Record<Discipline, Workout['category'][]> = {
  Boxen:     ['schlagkraft', 'beinarbeit', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'koordination', 'mobilitaet', 'partnertraining'],
  Kickboxen: ['schlagkraft', 'trittkraft', 'beinarbeit', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'koordination', 'mobilitaet', 'partnertraining'],
  MMA:       ['schlagkraft', 'trittkraft', 'beinarbeit', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'koordination', 'mobilitaet', 'partnertraining'],
  BJJ:       ['ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'koordination', 'mobilitaet', 'partnertraining'],
  Wrestling: ['beinarbeit', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'koordination', 'mobilitaet', 'partnertraining'],
};

// Fitness profile groups that are relevant per discipline
const DISCIPLINE_FITNESS_GROUPS: Record<Discipline, FitnessGroup[]> = {
  Boxen:     ['schlagkraft', 'beinarbeit', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'koordination', 'mobilitaet', 'partnertraining'],
  Kickboxen: ['schlagkraft', 'trittkraft', 'beinarbeit', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'koordination', 'mobilitaet', 'partnertraining'],
  MMA:       ['schlagkraft', 'trittkraft', 'beinarbeit', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'koordination', 'mobilitaet', 'partnertraining'],
  BJJ:       ['ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'koordination', 'mobilitaet', 'partnertraining'],
  Wrestling: ['beinarbeit', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'koordination', 'mobilitaet', 'partnertraining'],
};

// Returns the union of relevant workout categories for a set of disciplines.
// Falls back to all categories when no disciplines are selected.
export function getRelevantWorkoutCategories(
  disciplines: string[],
): Workout['category'][] {
  const valid = disciplines.filter((d): d is Discipline =>
    ALL_DISCIPLINES.includes(d as Discipline),
  );
  if (valid.length === 0) {
    // No disciplines set → show everything
    return ['schlagkraft', 'trittkraft', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'beinarbeit', 'koordination', 'mobilitaet', 'partnertraining'];
  }
  const union = new Set<Workout['category']>();
  for (const d of valid) {
    for (const cat of DISCIPLINE_WORKOUT_CATEGORIES[d]) {
      union.add(cat);
    }
  }
  // Preserve the canonical category order
  const order: Workout['category'][] = ['schlagkraft', 'trittkraft', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'beinarbeit', 'koordination', 'mobilitaet', 'partnertraining'];
  return order.filter((cat) => union.has(cat));
}

// Returns the union of relevant fitness groups for a set of disciplines.
// Falls back to all groups when no disciplines are selected.
export function getRelevantFitnessGroups(disciplines: string[]): FitnessGroup[] {
  const valid = disciplines.filter((d): d is Discipline =>
    ALL_DISCIPLINES.includes(d as Discipline),
  );
  if (valid.length === 0) {
    return ['schlagkraft', 'trittkraft', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'beinarbeit', 'koordination', 'mobilitaet', 'partnertraining'];
  }
  const union = new Set<FitnessGroup>();
  for (const d of valid) {
    for (const g of DISCIPLINE_FITNESS_GROUPS[d]) {
      union.add(g);
    }
  }
  const order: FitnessGroup[] = ['schlagkraft', 'trittkraft', 'ausdauer', 'schulter', 'nackenhals', 'griffkraft', 'beinarbeit', 'koordination', 'mobilitaet', 'partnertraining'];
  return order.filter((g) => union.has(g));
}
