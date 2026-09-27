// Single source for the experience and training-frequency choices: the
// onboarding steps render these options and the athlete profile shows the
// same wording (src/utils/athleteProfile.ts).

export type TrainingSince = 'under_1_year' | '1_3_years' | '3_5_years' | 'over_5_years';
export type FrequencyTier = 'low' | 'medium' | 'high';

export interface ProfileOption<T extends string> {
  value: T;
  label: string;
  sub:   string;
}

export const EXPERIENCE_OPTIONS: readonly ProfileOption<TrainingSince>[] = [
  { value: 'under_1_year', label: 'Einsteiger',      sub: 'Weniger als 1 Jahr' },
  { value: '1_3_years',    label: 'Fortgeschritten', sub: '1 bis 3 Jahre'      },
  { value: '3_5_years',    label: 'Erfahren',        sub: '3 bis 5 Jahre'      },
  { value: 'over_5_years', label: 'Veteran',         sub: 'Mehr als 5 Jahre'   },
];

export const FREQUENCY_OPTIONS: readonly ProfileOption<FrequencyTier>[] = [
  { value: 'low',    label: 'ca. 3x pro Woche',  sub: 'Moderat aktiv' },
  { value: 'medium', label: 'ca. 5x pro Woche',  sub: 'Sehr aktiv'    },
  { value: 'high',   label: 'ca. 10x pro Woche', sub: '2x täglich'    },
];
