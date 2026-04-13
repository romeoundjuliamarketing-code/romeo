// ─── Shared workout domain types ─────────────────────────────────────────────

export type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  muscles: string[];
  benefit: string;
};

export type WorkoutModule = {
  id: string;
  title: string;
  category: string;
  duration: string;
  difficulty: string;
  exercises: Exercise[];
};
