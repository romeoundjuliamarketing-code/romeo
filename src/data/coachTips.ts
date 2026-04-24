export type PerformanceCategory = 'Schlagkraft' | 'Trittkraft' | 'Schulter' | 'Cardio';

export interface CoachTip {
  category: PerformanceCategory;
  title: string;
  tip: string;
}

export const COACH_TIPS: CoachTip[] = [
  { category: 'Schlagkraft', title: 'Schlagkraft',      tip: 'Plyometrische Übungen steigern deine explosive Kraft. Zwei gezielte Einheiten pro Woche sind ausreichend.' },
  { category: 'Schlagkraft', title: 'Schlagkraft',      tip: 'Medicine-Ball-Würfe gegen die Wand trainieren reaktive Kraft – direkt übertragbar auf Punch-Speed.' },
  { category: 'Trittkraft',  title: 'Trittkraft',       tip: 'Einbeinige Squats und Box Jumps verbessern die Hüftextension – die wichtigste Quelle deiner Trittkraft.' },
  { category: 'Trittkraft',  title: 'Trittkraft',       tip: 'Romanian Deadlifts stärken die hintere Kette. Drei Sätze zweimal pro Woche zeigen sichtbare Verbesserung.' },
  { category: 'Schulter',    title: 'Schulterausdauer', tip: 'Deine Schulterrotation zeigt Ermüdungserscheinungen. Integriere täglich 3 Sätze Theraband-Kreise zur Stabilisierung.' },
  { category: 'Schulter',    title: 'Schulterausdauer', tip: 'Face Pulls und Y-T-W Übungen stärken die Rotatorenmanschette – wichtig für langfristige Schlaggesundheit.' },
  { category: 'Cardio',      title: 'Cardio-Basis',     tip: 'Intervallläufe im 1:2-Verhältnis simulieren das Energiesystem im Kampf am besten.' },
  { category: 'Cardio',      title: 'Cardio-Basis',     tip: 'Seilspringen 3x pro Woche für 10 Minuten verbessert deine ringspezifische Ausdauer nachweislich.' },
];
