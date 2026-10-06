// Single source for the experience and training-frequency choices: the
// onboarding steps render these options and the athlete profile shows the
// same wording (src/utils/athleteProfile.ts).

import i18n from '../i18n';

export type TrainingSince = 'under_1_year' | '1_3_years' | '3_5_years' | 'over_5_years';
export type FrequencyTier = 'low' | 'medium' | 'high';

export interface ProfileOption<T extends string> {
  value: T;
  label: string;
  sub:   string;
}

// label/sub are getters so the text is translated when read, not at module load.
function option<T extends string>(value: T, keyPath: string): ProfileOption<T> {
  return {
    value,
    get label(): string { return i18n.t(`onboarding.${keyPath}.label` as 'onboarding.experience.under_1_year.label'); },
    get sub(): string { return i18n.t(`onboarding.${keyPath}.sub` as 'onboarding.experience.under_1_year.sub'); },
  };
}

export const EXPERIENCE_OPTIONS: readonly ProfileOption<TrainingSince>[] = [
  option('under_1_year', 'experience.under_1_year'),
  option('1_3_years', 'experience.1_3_years'),
  option('3_5_years', 'experience.3_5_years'),
  option('over_5_years', 'experience.over_5_years'),
];

export const FREQUENCY_OPTIONS: readonly ProfileOption<FrequencyTier>[] = [
  option('low', 'frequency.low'),
  option('medium', 'frequency.medium'),
  option('high', 'frequency.high'),
];
