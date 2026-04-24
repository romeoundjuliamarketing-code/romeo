// Points earned per 30-minute training unit, keyed by training_type
export const POINTS_PER_30MIN: Record<string, number> = {
  'K1': 35,
  'Boxen': 35,
  'BJJ': 35,
  'MMA': 35,
  'Kraft & Ausdauer': 30,
  'Plyometrik': 35,
  'Intervallläufe': 30,
  'Sprints': 30,
  'Seilspringen': 25,
  'Joggen': 20,
  'Schwimmen': 20,
  'Gym': 25,
  'Kettlebell': 25,
  'Dehnen': 10,
  'Yoga': 15,
  'Sauna': 8,
};

// Calculates points earned for a given duration and per-30min rate
export function calculatePoints(durationMin: number, pointsPer30Min: number): number {
  return Math.round((durationMin / 30) * pointsPer30Min);
}
